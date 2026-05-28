import { evaluateHandoff, getCurrentBatch, getProofBundle, getStatus, template } from "../src/pharmchain.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`ok - ${message}`);
}

const status = getStatus();
assert(status.publicWrites === false, "status reports no public writes");
assert(status.liveDualWrites === false, "status reports no live DUAL writes");
assert(status.safety.patientPiiStored === false, "status reports no patient PII");

const current = getCurrentBatch();
assert(current.batch_id === "PHC-GLP1-2026-0004", "current batch is canonical PharmChain batch");
assert(current.current_state === "In_Transit", "current state is In_Transit");
assert(current.next_event.event_type === "receive_at_pharmacy", "next event is pharmacy receipt");

const approved = evaluateHandoff({ batch: current, event: current.next_event });
assert(approved.result === "Approved", "valid pharmacy receipt is approved");
assert(approved.next_state === "At_Pharmacy", "valid pharmacy receipt advances state");
assert(approved.proof.integrity_hash, "approved handoff returns integrity hash");

const blockedTemperature = evaluateHandoff({
  batch: current,
  event: { ...current.next_event, temperature_max_celsius: 12.4, excursions: 1 }
});
assert(blockedTemperature.result === "Blocked", "temperature breach is blocked");
assert(blockedTemperature.reason.includes("Cold-chain breach"), "temperature breach reason is explicit");

const blockedPii = evaluateHandoff({
  batch: { ...current, current_state: "At_Pharmacy" },
  event: { ...current.next_event, event_type: "dispense", patient_pii_included: true }
});
assert(blockedPii.result === "Blocked", "patient PII in proof record is blocked");
assert(blockedPii.reason.includes("Patient PII"), "patient PII reason is explicit");

const proof = getProofBundle();
assert(proof.verifier_level === "local_rederived", "proof bundle is local rederived");
assert(proof.publicWrites === false, "proof bundle reports no public writes");
assert(proof.hashes.integrity_hash === approved.proof.integrity_hash, "proof bundle matches approved default event");

const stringFalse = evaluateHandoff({
  batch: current,
  event: {
    ...current.next_event,
    serials_verified: "false"
  }
});
assert(stringFalse.result === "Blocked", "string false does not pass boolean gates");

assert(template.safety.live_dual_writes === false, "template declares no live DUAL writes");
assert(template.actions.length === 3, "template declares three custody lifecycle actions");
