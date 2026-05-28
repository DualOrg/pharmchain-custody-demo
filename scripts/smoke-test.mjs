import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import mcp from "../api/mcp.js";
import { getDeploymentInfo } from "../src/deployment.mjs";
import { evaluateHandoff, getCurrentBatch, getProofBundle, getStatus, template } from "../src/pharmchain.mjs";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.DEMO_BASE_URL || "http://127.0.0.1:4182";

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`ok - ${message}`);
}

async function request(path, options = {}) {
  const result = await fetchLocal(path, options);
  const body = result.contentType.includes("application/json") ? JSON.parse(result.body) : result.body;
  return {
    response: {
      ok: result.status >= 200 && result.status < 300,
      status: result.status
    },
    body
  };
}

async function getText(path) {
  const result = await fetchLocal(path);
  return {
    ok: result.status >= 200 && result.status < 300,
    text: async () => result.body
  };
}

async function fetchLocal(path, options = {}) {
  try {
    return await curl(path, options);
  } catch (error) {
    if (canUseDirectFallback(error)) {
      console.log(`ok - local HTTP unavailable, using in-process fallback for ${path}`);
      return directRequest(path, options);
    }
    throw error;
  }
}

async function curl(path, options = {}) {
  const args = [
    "-sS",
    "-X",
    options.method || "GET",
    "-H",
    "accept: application/json"
  ];
  if (options.body) {
    args.push("-H", "content-type: application/json", "--data", JSON.stringify(options.body));
  }
  args.push(
    "-w",
    "\n__HTTP_STATUS__:%{http_code}\n__CONTENT_TYPE__:%{content_type}",
    `${baseUrl}${path}`
  );
  const { stdout } = await execFileAsync("curl", args, { maxBuffer: 1024 * 1024 });
  const statusMatch = stdout.match(/\n__HTTP_STATUS__:(\d+)\n__CONTENT_TYPE__:(.*)$/);
  if (!statusMatch) throw new Error(`Could not parse curl response for ${path}`);
  return {
    body: stdout.slice(0, statusMatch.index),
    status: Number(statusMatch[1]),
    contentType: statusMatch[2] || ""
  };
}

async function directRequest(path, options = {}) {
  const method = options.method || "GET";
  if (path === "/" && method === "GET") {
    return {
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: await readFile(new URL("../index.html", import.meta.url), "utf8")
    };
  }
  if (path === "/api/dual/status" && method === "GET") return json(getStatus());
  if (path === "/api/batches/current" && method === "GET") return json(getCurrentBatch());
  if (path === "/api/batches/evaluate" && method === "POST") return json(evaluateHandoff(options.body));
  if (path === "/api/proof" && method === "GET") return json(getProofBundle());
  if (path === "/api/template" && method === "GET") return json(template);
  if (path === "/api/deployment" && method === "GET") return json(getDeploymentInfo());
  if (path === "/mcp" || path === "/api/mcp") {
    const response = createResponse();
    await mcp({ method, body: options.body || {} }, response);
    return json(response.payload, response.statusCode || 200);
  }
  return json({ error: { message: "Not found" } }, 404);
}

function json(payload, status = 200) {
  return {
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(payload)
  };
}

function createResponse() {
  return {
    statusCode: 0,
    payload: null,
    setHeader() {
      return this;
    },
    status(statusCode) {
      return {
        json: (payload) => {
          this.statusCode = statusCode;
          this.payload = payload;
        },
        end: (payload = "") => {
          this.statusCode = statusCode;
          this.payload = payload;
        }
      };
    }
  };
}

function canUseDirectFallback(error) {
  if (process.env.SMOKE_STRICT_NETWORK === "1") return false;
  let local = false;
  try {
    const url = new URL(baseUrl);
    local = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
  return local && /Failed to connect|Couldn.t connect|Connection refused|ECONNREFUSED|connect EPERM/i.test(
    `${error.message}\n${error.stderr || ""}`
  );
}

let rpcId = 1;

async function rpc(method, params = {}) {
  const result = await request("/mcp", {
    method: "POST",
    body: { jsonrpc: "2.0", id: rpcId++, method, params }
  });
  assert(result.response.ok, `MCP ${method} returns HTTP 200`);
  assert(result.body.jsonrpc === "2.0", `MCP ${method} returns JSON-RPC envelope`);
  assert(!result.body.error, `MCP ${method} has no error`);
  return result.body.result;
}

const home = await getText("/");
assert(home.ok, "home page loads");
const html = await home.text();
assert(html.includes("PharmChain Custody Desk"), "home page includes title");
assert(html.includes("Proof Rail"), "home page includes proof rail");

const status = await request("/api/dual/status");
assert(status.response.ok, "status endpoint returns 200");
assert(status.body.orgId === "69b935b4187e903f826bbe71", "status reports IanTest org");
assert(status.body.publicWrites === false, "status reports no public writes");
assert(status.body.liveDualWrites === false, "status reports no live writes");
assert(!("apiKey" in status.body), "status does not expose apiKey");

const current = await request("/api/batches/current");
assert(current.response.ok, "current batch returns 200");
assert(current.body.batch_id === "PHC-GLP1-2026-0004", "current batch is canonical PharmChain batch");
assert(current.body.current_state === "In_Transit", "current state is in transit");
assert(current.body.dscsa.patient_pii_stored === false, "current batch stores no patient PII");

const approved = await request("/api/batches/evaluate", {
  method: "POST",
  body: { batch: current.body, event: current.body.next_event }
});
assert(approved.response.ok, "evaluate endpoint returns 200");
assert(approved.body.result === "Approved", "valid pharmacy receipt is approved");
assert(approved.body.next_state === "At_Pharmacy", "valid receipt moves to At_Pharmacy");
assert(approved.body.publicWrites === false, "evaluate never exposes public writes");
assert(approved.body.proof.integrity_hash, "evaluate returns proof integrity hash");

const blocked = await request("/api/batches/evaluate", {
  method: "POST",
  body: {
    batch: current.body,
    event: {
      ...current.body.next_event,
      temperature_max_celsius: 12.4,
      excursions: 1
    }
  }
});
assert(blocked.body.result === "Blocked", "temperature breach is blocked");
assert(blocked.body.reason.includes("Cold-chain breach"), "blocked reason explains cold-chain breach");

const proof = await request("/api/proof");
assert(proof.response.ok, "proof endpoint returns 200");
assert(proof.body.verifier_level === "local_rederived", "proof is local rederived");
assert(proof.body.publicWrites === false, "proof reports no public writes");
assert(proof.body.hashes.integrity_hash === approved.body.proof.integrity_hash, "proof integrity matches approved default event");

const deployment = await request("/api/deployment");
assert(deployment.response.ok, "deployment endpoint returns 200");
assert(deployment.body.repository.includes("pharmchain-custody-demo"), "deployment reports target repo");
assert(deployment.body.safety.publicWrites === false, "deployment reports no public writes");
assert(deployment.body.safety.liveDualWrites === false, "deployment reports no live writes");
assert(deployment.body.safety.operatorTokenAccepted === false, "deployment reports no operator token intake");

const mcpLanding = await request("/mcp");
assert(mcpLanding.response.ok, "MCP landing returns 200");
assert(mcpLanding.body.safety.publicWrites === false, "MCP landing reports no public writes");
assert(mcpLanding.body.prompts.includes("pharmchain_reviewer_check"), "MCP landing lists reviewer prompt");

const init = await rpc("initialize");
assert(init.serverInfo.name === "dual-pharmchain-custody-demo", "MCP initialize returns server name");
assert(init.safety.writeTools === "none", "MCP reports no write tools");
assert("prompts" in init.capabilities, "MCP initialize advertises prompts");

const tools = await rpc("tools/list");
const names = new Set((tools.tools || []).map((tool) => tool.name));
assert(names.has("pharmchain_get_status"), "MCP lists status tool");
assert(names.has("pharmchain_evaluate_handoff"), "MCP lists evaluate tool");
assert(![...names].some((name) => name.includes("sync") || name.includes("mint")), "MCP exposes no write-like tools");

const mcpEval = await rpc("tools/call", {
  name: "pharmchain_evaluate_handoff",
  arguments: { event: current.body.next_event }
});
assert(mcpEval.structuredContent.result === "Approved", "MCP evaluate approves default handoff");
assert(mcpEval.structuredContent.liveDualWrites === false, "MCP evaluation reports no live writes");

const resources = await rpc("resources/list");
const resourceUris = new Set((resources.resources || []).map((resource) => resource.uri));
assert(resourceUris.has("pharmchain://manifest"), "MCP lists manifest resource");
assert(resourceUris.has("pharmchain://scorecard"), "MCP lists scorecard resource");

const prompts = await rpc("prompts/list");
const promptNames = new Set((prompts.prompts || []).map((prompt) => prompt.name));
assert(promptNames.has("pharmchain_reviewer_check"), "MCP lists reviewer prompt");
assert(promptNames.has("pharmchain_write_boundary_review"), "MCP lists write-boundary prompt");

const prompt = await rpc("prompts/get", { name: "pharmchain_write_boundary_review" });
assert(prompt.messages[0].content.text.includes("DualVault"), "MCP prompt keeps vault connection explicit");
