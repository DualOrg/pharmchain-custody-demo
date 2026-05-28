import { readFileSync } from "node:fs";
import { getCurrentBatchLive, readiness, syncHandoff } from "../src/dual-live.mjs";

const envPath = process.env.DUAL_ENV_FILE || "";
if (envPath) Object.assign(process.env, parseEnvFile(envPath), process.env);

const tokenPath = process.env.DEMO_OPERATOR_TOKEN_FILE || "";
if (!process.env.DEMO_OPERATOR_TOKEN && tokenPath) {
  process.env.DEMO_OPERATOR_TOKEN = readFileSync(tokenPath, "utf8").trim();
}

const status = readiness();
assert(status.readbackReady, "DUAL readback is configured");
assert(status.writable, "operator-gated DUAL writes are configured");
assert(status.publicWrites === false, "public writes remain disabled");

const current = await getCurrentBatchLive();
const result = await syncHandoff({
  batch: current,
  event: current.next_event,
  audit: {
    source: "dual-live-write-proof",
    requested_at: new Date().toISOString()
  }
});

assert(result.ok === true, "live DUAL sync returned ok");
assert(result.action === "update", "live DUAL sync executed update action");
assert(result.publicWrites === false, "live DUAL sync keeps public writes disabled");
assert(result.verification.ok === true, "live DUAL readback matched expected proof state");

console.log(`DUAL object: ${status.objectId}`);
console.log(`Payload style: ${result.payloadStyle}`);
console.log(`New state: ${result.batch.current_state}`);
console.log(`Readback integrity hash: ${result.verification.readback_integrity_hash}`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`ok - ${message}`);
}

function parseEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\n/)
        .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
        .filter(Boolean)
        .map((match) => [match[1], unquote(match[2].trim())])
    );
  } catch {
    return {};
  }
}

function unquote(value) {
  if (value.startsWith("\"") && value.endsWith("\"")) return value.slice(1, -1).replace(/\\"/g, "\"");
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}
