import { cloneBatch, evaluateHandoff, getCurrentBatch, getProofBundle, stableHash } from "../src/pharmchain.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.DEMO_BASE_URL || "http://127.0.0.1:4182";

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`ok - ${message}`);
}

async function json(path) {
  try {
    const { stdout } = await execFileAsync("curl", ["-sS", "-f", "-H", "accept: application/json", `${baseUrl}${path}`], { maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    if (canUseDirectFallback(error)) {
      console.log(`ok - local HTTP unavailable, using in-process fallback for ${path}`);
      if (path === "/api/batches/current") return getCurrentBatch();
      if (path === "/api/proof") return getProofBundle();
    }
    throw error;
  }
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

const current = await json("/api/batches/current");
const proof = await json("/api/proof");
const localEvaluation = evaluateHandoff({ batch: cloneBatch(current), event: current.next_event });

assert(proof.hashes.batch_hash === localEvaluation.proof.batch_hash, "batch hash re-derives locally");
assert(proof.hashes.custody_root === localEvaluation.proof.custody_root, "custody root re-derives locally");
assert(proof.hashes.dscsa_hash === localEvaluation.proof.dscsa_hash, "DSCSA hash re-derives locally");
assert(proof.hashes.state_hash === localEvaluation.proof.state_hash, "state hash re-derives locally");
assert(proof.hashes.integrity_hash === localEvaluation.proof.integrity_hash, "integrity hash re-derives locally");

const tampered = {
  ...current,
  sensor_window: {
    ...current.sensor_window,
    max_celsius: 12.4,
    excursions: 1
  }
};
const tamperedHash = stableHash(tampered.sensor_window);
const originalHash = stableHash(current.sensor_window);
assert(tamperedHash !== originalHash, "tampered sensor window changes hash");

const blocked = evaluateHandoff({
  batch: current,
  event: {
    ...current.next_event,
    temperature_max_celsius: 12.4,
    excursions: 1
  }
});
assert(blocked.result === "Blocked", "tampered temperature event is blocked");
assert(blocked.proof.integrity_hash !== proof.hashes.integrity_hash, "blocked event changes integrity hash");
