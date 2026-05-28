import { evaluateHandoff, getCurrentBatch, getProofBundle, getStatus, template } from "../src/pharmchain.mjs";

const resources = [
  { uri: "pharmchain://manifest", name: "Manifest" },
  { uri: "pharmchain://status", name: "Status" },
  { uri: "pharmchain://batch/current", name: "Current Batch" },
  { uri: "pharmchain://template", name: "DUAL Template" },
  { uri: "pharmchain://proof/current", name: "Proof Bundle" },
  { uri: "pharmchain://scorecard", name: "9.8 Scorecard" }
];

const prompts = [
  {
    name: "pharmchain_reviewer_check",
    description: "Review the PharmChain local proof demo against the 9.8 bar.",
    arguments: []
  },
  {
    name: "pharmchain_write_boundary_review",
    description: "Inspect the app/API/MCP surface for accidental live-write or patient-PII risk.",
    arguments: []
  }
];

const tools = [
  {
    name: "pharmchain_get_status",
    description: "Read the PharmChain demo readiness, safety, and DUAL write boundary.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true }
  },
  {
    name: "pharmchain_get_batch",
    description: "Read the current serialized batch custody token and next suggested event.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true }
  },
  {
    name: "pharmchain_evaluate_handoff",
    description: "Evaluate a proposed custody handoff without writing to DUAL.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        event: { type: "object" },
        batch: { type: "object" }
      }
    },
    annotations: { readOnlyHint: true }
  },
  {
    name: "pharmchain_get_proof",
    description: "Return the local re-derived proof bundle for the current batch.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true }
  }
];

export default async function mcp(request, response) {
  setHeaders(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method === "GET") {
    response.status(200).json({
      name: "dual-pharmchain-custody-demo",
      protocol: "mcp-jsonrpc-lite",
      version: "0.2.0",
      tools: tools.map(({ name, description, annotations }) => ({ name, description, annotations })),
      resources: resources.map((resource) => resource.uri),
      prompts: prompts.map((prompt) => prompt.name),
      safety: {
        publicWrites: false,
        liveDualWrites: false,
        writeTools: "none"
      }
    });
    return;
  }

  const { id = null, method, params = {} } = request.body || {};
  try {
    const result = await dispatch(method, params);
    response.status(200).json({ jsonrpc: "2.0", id, result });
  } catch (error) {
    response.status(200).json({
      jsonrpc: "2.0",
      id,
      error: {
        code: error.code || -32000,
        message: error.message || "MCP request failed"
      }
    });
  }
}

async function dispatch(method, params) {
  if (method === "initialize") {
    return {
      protocolVersion: "2025-06-18",
      serverInfo: { name: "dual-pharmchain-custody-demo", version: "0.2.0" },
      capabilities: { tools: {}, resources: {}, prompts: {} },
      safety: { publicWrites: false, liveDualWrites: false, writeTools: "none" }
    };
  }
  if (method === "tools/list") return { tools };
  if (method === "resources/list") return { resources };
  if (method === "resources/read") {
    const uri = params.uri;
    const contents = readResource(uri);
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(contents, null, 2) }] };
  }
  if (method === "prompts/list") return { prompts };
  if (method === "prompts/get") return readPrompt(params.name);
  if (method === "tools/call") {
    return callTool(params.name, params.arguments || {});
  }
  throw Object.assign(new Error(`Unsupported method: ${method}`), { code: -32601 });
}

function readResource(uri) {
  if (uri === "pharmchain://manifest") return buildManifest();
  if (uri === "pharmchain://status") return getStatus();
  if (uri === "pharmchain://batch/current") return getCurrentBatch();
  if (uri === "pharmchain://template") return template;
  if (uri === "pharmchain://proof/current") return getProofBundle();
  if (uri === "pharmchain://scorecard") return buildScorecard();
  throw Object.assign(new Error(`Unknown resource: ${uri}`), { code: -32602 });
}

function readPrompt(name) {
  if (name === "pharmchain_reviewer_check") {
    return {
      description: "Review the PharmChain local proof demo against the 9.8 bar.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Connect to /Users/ibuswell/Documents/DualVault.",
              "Read AGENTS.md, memory/soul.md, memory/user.md, memory/memory.md, wiki/hot.md, projects/dual/context.md, wiki/concepts/dual-pharmchain.md.",
              "Review sandbox/pharmchain-custody-demo for product clarity, DUAL-native model, DSCSA gate logic, proof re-derivation, MCP/API safety, docs, and local validation.",
              "Return a score out of 10 and concrete blockers only."
            ].join(" ")
          }
        }
      ]
    };
  }
  if (name === "pharmchain_write_boundary_review") {
    return {
      description: "Inspect the app/API/MCP surface for accidental live-write or patient-PII risk.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Connect to /Users/ibuswell/Documents/DualVault.",
              "Verify PharmChain exposes read/evaluate/proof only.",
              "Confirm no sync, mint, update, operator-token, secret, patient-PII storage, public-write, or live-DUAL-write path exists.",
              "Return pass/fail with exact file references."
            ].join(" ")
          }
        }
      ]
    };
  }
  throw Object.assign(new Error(`Unknown prompt: ${name}`), { code: -32602 });
}

function callTool(name, args) {
  const structuredContent = (() => {
    if (name === "pharmchain_get_status") return getStatus();
    if (name === "pharmchain_get_batch") return getCurrentBatch();
    if (name === "pharmchain_evaluate_handoff") return evaluateHandoff(args);
    if (name === "pharmchain_get_proof") return getProofBundle(args);
    throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  })();
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent
  };
}

function setHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "content-type, mcp-protocol-version");
}

function buildManifest() {
  return {
    name: "dual-pharmchain-custody-demo",
    version: "0.2.0",
    project_vault: "/Users/ibuswell/Documents/DualVault",
    demo_path: "sandbox/pharmchain-custody-demo",
    concept: "PharmChain",
    scope: "local-proof",
    liveDualWrites: false,
    publicWrites: false,
    patientPiiStored: false,
    tools: tools.map((tool) => tool.name),
    resources: resources.map((resource) => resource.uri),
    prompts: prompts.map((prompt) => prompt.name)
  };
}

function buildScorecard() {
  return {
    target_score: 9.8,
    applies_to: "local reviewer-grade DUAL proof demo",
    categories: [
      "Product clarity",
      "DUAL-native state/template/action model",
      "DSCSA-style handoff checks",
      "Local proof re-derivation",
      "Read-only MCP/API agent readiness",
      "No public writes, live writes, secrets, or patient PII",
      "Responsive reviewer UI",
      "Runbook and reviewer docs"
    ],
    exclusions: [
      "live DUAL writes",
      "production DSCSA compliance",
      "real partner integrations",
      "patient-facing workflows"
    ]
  };
}
