import mcp from "../api/mcp.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`ok - ${message}`);
}

async function getLanding() {
  const response = createResponse();
  await mcp({ method: "GET", body: {} }, response);
  assert(response.statusCode === 200, "MCP landing returns 200");
  return response.payload;
}

async function rpc(method, params = {}) {
  const response = createResponse();
  await mcp({
    method: "POST",
    body: { jsonrpc: "2.0", id: 1, method, params }
  }, response);
  assert(response.statusCode === 200, `MCP ${method} returns HTTP 200`);
  assert(response.payload.jsonrpc === "2.0", `MCP ${method} returns JSON-RPC envelope`);
  if (response.payload.error) throw new Error(response.payload.error.message);
  return response.payload.result;
}

function createResponse() {
  const response = {
    headers: {},
    statusCode: 0,
    payload: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
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
          this.ended = true;
        }
      };
    }
  };
  return response;
}

const landing = await getLanding();
assert(landing.safety.publicWrites === false, "MCP landing reports no public writes");
assert(typeof landing.safety.liveDualWrites === "boolean", "MCP landing reports live write posture");
assert(landing.prompts.includes("pharmchain_reviewer_check"), "MCP landing lists reviewer prompt");

const init = await rpc("initialize");
assert(init.serverInfo.name === "dual-pharmchain-custody-demo", "MCP initialize returns server name");
assert(init.safety.writeTools === "operator_gated", "MCP initialize reports operator-gated write tools");
assert("prompts" in init.capabilities, "MCP initialize advertises prompts");

const tools = await rpc("tools/list");
const toolNames = new Set(tools.tools.map((tool) => tool.name));
assert(toolNames.has("pharmchain_get_status"), "MCP lists status tool");
assert(toolNames.has("pharmchain_get_batch"), "MCP lists batch tool");
assert(toolNames.has("pharmchain_evaluate_handoff"), "MCP lists evaluate tool");
assert(toolNames.has("pharmchain_get_proof"), "MCP lists proof tool");
assert(toolNames.has("pharmchain_sync_handoff"), "MCP lists operator-gated sync tool");
assert(toolNames.has("pharmchain_mint_batch"), "MCP lists operator-gated mint tool");

const resources = await rpc("resources/list");
const resourceUris = new Set(resources.resources.map((resource) => resource.uri));
assert(resourceUris.has("pharmchain://manifest"), "MCP lists manifest resource");
assert(resourceUris.has("pharmchain://scorecard"), "MCP lists scorecard resource");

const manifest = await rpc("resources/read", { uri: "pharmchain://manifest" });
assert(manifest.contents[0].text.includes("DualVault"), "MCP manifest includes project vault");
assert(manifest.contents[0].text.includes("\"publicWrites\": false"), "MCP manifest declares no public writes");

const prompts = await rpc("prompts/list");
const promptNames = new Set(prompts.prompts.map((prompt) => prompt.name));
assert(promptNames.has("pharmchain_reviewer_check"), "MCP lists reviewer prompt");
assert(promptNames.has("pharmchain_write_boundary_review"), "MCP lists write-boundary prompt");

const writeBoundaryPrompt = await rpc("prompts/get", { name: "pharmchain_write_boundary_review" });
assert(writeBoundaryPrompt.messages[0].content.text.includes("DualVault"), "MCP write-boundary prompt requires vault connection");
assert(writeBoundaryPrompt.messages[0].content.text.includes("operator-gated"), "MCP write-boundary prompt checks gated write path");

const evalResult = await rpc("tools/call", {
  name: "pharmchain_evaluate_handoff",
  arguments: {
    event: {
      temperature_max_celsius: 12.4,
      excursions: 1
    }
  }
});
assert(evalResult.structuredContent.result === "Blocked", "MCP evaluate blocks cold-chain breach");
assert(evalResult.structuredContent.publicWrites === false, "MCP evaluate reports no public writes");

const denied = await mcpCallAllowingError("tools/call", {
  name: "pharmchain_sync_handoff",
  arguments: {}
});
assert(denied.error, "MCP write tool rejects missing token");
assert(/operator token/i.test(denied.error.message), "MCP write tool rejection names operator token");

async function mcpCallAllowingError(method, params = {}) {
  const response = createResponse();
  await mcp({
    method: "POST",
    body: { jsonrpc: "2.0", id: 2, method, params }
  }, response);
  assert(response.statusCode === 200, `MCP ${method} returns HTTP 200`);
  return response.payload;
}
