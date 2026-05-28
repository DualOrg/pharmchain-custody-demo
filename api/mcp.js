import {
  getCurrentBatchLive,
  getProofBundleLive,
  mintBatch,
  readiness,
  requireOperator,
  syncHandoff
} from "../src/dual-live.mjs";
import { evaluateHandoff, template } from "../src/pharmchain.mjs";

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
    description: "Review the PharmChain live-readback proof demo against the 9.8 bar.",
    arguments: []
  },
  {
    name: "pharmchain_write_boundary_review",
    description: "Inspect the app/API/MCP surface for public-write, live-write, secret, or patient-PII risk.",
    arguments: []
  }
];

const tools = [
  {
    name: "pharmchain_get_status",
    description: "Read the PharmChain demo readiness, safety, DUAL readback, and operator-gated write boundary.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true }
  },
  {
    name: "pharmchain_get_batch",
    description: "Read the current serialized batch custody token from live DUAL readback when configured, otherwise local seed.",
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
    description: "Return the proof bundle for the current batch, re-derived from live DUAL readback when configured.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true }
  },
  {
    name: "pharmchain_sync_handoff",
    description: "Operator-gated live DUAL update: evaluate and sync an approved custody handoff to the configured PharmChain batch object.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["operator_token"],
      properties: {
        operator_token: { type: "string" },
        event: { type: "object" },
        batch: { type: "object" },
        audit: { type: "object" }
      }
    },
    annotations: { readOnlyHint: false }
  },
  {
    name: "pharmchain_mint_batch",
    description: "Operator-gated live DUAL mint: mint a PharmChain batch object from the configured template.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["operator_token"],
      properties: {
        operator_token: { type: "string" },
        batch: { type: "object" },
        audit: { type: "object" }
      }
    },
    annotations: { readOnlyHint: false }
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
      version: "0.3.0",
      tools: tools.map(({ name, description, annotations }) => ({ name, description, annotations })),
      resources: resources.map((resource) => resource.uri),
      prompts: prompts.map((prompt) => prompt.name),
      safety: {
        publicWrites: false,
        liveDualWrites: readiness().writable,
        writeTools: "operator_gated"
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
      serverInfo: { name: "dual-pharmchain-custody-demo", version: "0.3.0" },
      capabilities: { tools: {}, resources: {}, prompts: {} },
      safety: { publicWrites: false, liveDualWrites: readiness().writable, writeTools: "operator_gated" }
    };
  }
  if (method === "tools/list") return { tools };
  if (method === "resources/list") return { resources };
  if (method === "resources/read") {
    const uri = params.uri;
    const contents = await readResource(uri);
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(contents, null, 2) }] };
  }
  if (method === "prompts/list") return { prompts };
  if (method === "prompts/get") return readPrompt(params.name);
  if (method === "tools/call") {
    return callTool(params.name, params.arguments || {});
  }
  throw Object.assign(new Error(`Unsupported method: ${method}`), { code: -32601 });
}

async function readResource(uri) {
  if (uri === "pharmchain://manifest") return buildManifest();
  if (uri === "pharmchain://status") return readiness();
  if (uri === "pharmchain://batch/current") return getCurrentBatchLive();
  if (uri === "pharmchain://template") return template;
  if (uri === "pharmchain://proof/current") return getProofBundleLive();
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
              "If live DUAL env is configured, verify readback and operator-gated write behavior without exposing the operator token.",
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
              "Verify PharmChain exposes public read/evaluate/proof plus only operator-gated live mint/update paths.",
              "Confirm no anonymous public write, secret, patient-PII storage, or un-gated live-DUAL-write path exists.",
              "Return pass/fail with exact file references."
            ].join(" ")
          }
        }
      ]
    };
  }
  throw Object.assign(new Error(`Unknown prompt: ${name}`), { code: -32602 });
}

async function callTool(name, args) {
  const structuredContent = await (async () => {
    if (name === "pharmchain_get_status") return readiness();
    if (name === "pharmchain_get_batch") return getCurrentBatchLive();
    if (name === "pharmchain_evaluate_handoff") return evaluateHandoff(args);
    if (name === "pharmchain_get_proof") return getProofBundleLive(args);
    if (name === "pharmchain_sync_handoff") {
      requireOperator(args.operator_token || "");
      const { operator_token: _operatorToken, ...input } = args;
      return syncHandoff(input);
    }
    if (name === "pharmchain_mint_batch") {
      requireOperator(args.operator_token || "");
      const { operator_token: _operatorToken, ...input } = args;
      return mintBatch(input);
    }
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
  response.setHeader("Access-Control-Allow-Headers", "content-type, mcp-protocol-version, authorization, x-demo-operator-token");
}

function buildManifest() {
  return {
    name: "dual-pharmchain-custody-demo",
    version: "0.3.0",
    project_vault: "DualVault",
    demo_path: "sandbox/pharmchain-custody-demo",
    concept: "PharmChain",
    scope: "hosted-live-dual-reviewer-demo",
    liveDualWrites: readiness().writable,
    publicWrites: false,
    patientPiiStored: false,
    operatorGateConfigured: readiness().operatorGateConfigured,
    tools: tools.map((tool) => tool.name),
    resources: resources.map((resource) => resource.uri),
    prompts: prompts.map((prompt) => prompt.name)
  };
}

function buildScorecard() {
  return {
    target_score: 9.8,
    applies_to: "hosted reviewer-grade DUAL proof demo with live readback and operator-gated writes when configured",
    categories: [
      "Product clarity",
      "DUAL-native state/template/action model",
      "DSCSA-style handoff checks",
      "Proof re-derivation from local or live DUAL readback",
      "Public read/evaluate/proof MCP/API agent readiness",
      "Operator-gated live DUAL read/write path",
      "No public writes, secrets, or patient PII",
      "Responsive reviewer UI",
      "Runbook and reviewer docs"
    ],
    exclusions: [
      "production DSCSA compliance",
      "real partner integrations",
      "patient-facing workflows"
    ]
  };
}
