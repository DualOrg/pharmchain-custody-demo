import { readFileSync } from "node:fs";
import { getCurrentBatchLive, getProofBundleLive, readiness } from "../src/dual-live.mjs";

const envPath = process.env.DUAL_ENV_FILE || "";
if (envPath) Object.assign(process.env, parseEnvFile(envPath), process.env);

const status = readiness();
assert(status.readbackReady, "DUAL readback is configured");
assert(status.mode === "dual", "status reports dual mode");
assert(status.publicWrites === false, "public writes remain disabled");

const batch = await getCurrentBatchLive();
assert(batch.source === "dual_readback", "current batch comes from DUAL readback");
assert(batch.batch_id === "PHC-GLP1-2026-0004", "DUAL readback returns canonical PharmChain batch");
assert(batch.dscsa.patient_pii_stored === false, "DUAL readback stores no patient PII");

const proof = await getProofBundleLive();
assert(proof.source === "dual_readback", "proof comes from DUAL readback");
assert(proof.verifier_level === "dual_readback_rederived", "proof verifier level is dual_readback_rederived");
assert(Boolean(proof.hashes.integrity_hash), "proof contains integrity hash");

console.log(`DUAL object: ${status.objectId}`);
console.log(`Integrity hash: ${proof.hashes.integrity_hash}`);

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
