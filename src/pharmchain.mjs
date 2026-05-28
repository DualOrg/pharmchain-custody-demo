import { createHash } from "node:crypto";

export const ORG_ID = "69b935b4187e903f826bbe71";
export const TEMPLATE_ID = "pharmchain-template-local-v1";
export const OBJECT_ID = "pharmchain-batch-local-v1";
export const TEMPLATE_NAME = "io.dual.pharmchain.batch.v1";

export const STATES = ["Manufactured", "In_Transit", "At_Pharmacy", "Dispensed"];

export const NEXT_EVENTS = {
  Manufactured: "release_to_wholesaler",
  In_Transit: "receive_at_pharmacy",
  At_Pharmacy: "dispense",
  Dispensed: null
};

export const TRANSITIONS = {
  release_to_wholesaler: {
    label: "Release to wholesaler",
    from: ["Manufactured"],
    to: "In_Transit"
  },
  receive_at_pharmacy: {
    label: "Pharmacy receipt",
    from: ["In_Transit"],
    to: "At_Pharmacy"
  },
  dispense: {
    label: "Dispenser release",
    from: ["At_Pharmacy"],
    to: "Dispensed"
  }
};

export const canonicalBatch = {
  object_id: OBJECT_ID,
  template_id: TEMPLATE_ID,
  org_id: ORG_ID,
  batch_id: "PHC-GLP1-2026-0004",
  product_family: "GLP-1 cold-chain pen",
  lot: "GLP1-AU-26-042",
  serial_range: "AU042-000001..AU042-000480",
  unit_count: 480,
  current_state: "In_Transit",
  manufacturer: {
    name: "Northstar Biologics",
    site: "AU-SYD-01",
    signature_id: "mfr_sig_8f2d9a7c",
    signature_valid: true
  },
  wholesaler: {
    name: "Harbour Wholesale",
    facility_id: "HWD-SYD-3",
    outbound_notice: "asn_2026_05_28_glp1_004"
  },
  pharmacy: {
    name: "Harbourside Pharmacy",
    facility_id: "PHA-NSW-8842",
    receiver_id: "rx_receiver_8842"
  },
  dscsa: {
    transaction_information: true,
    transaction_history: true,
    transaction_statement: true,
    product_identifier_verified: true,
    authorized_trading_partners: true,
    patient_pii_stored: false
  },
  sensor_window: {
    min_celsius: 3.1,
    max_celsius: 6.8,
    excursions: 0,
    last_scan_at: "2026-05-28T04:12:44.000Z"
  },
  custody_events: [
    {
      id: "evt_mfg_release",
      state: "Manufactured",
      actor: "Northstar Biologics",
      event_type: "manufactured",
      at: "2026-05-27T22:10:00.000Z",
      evidence_ref: "mfr-release-certificate.pdf"
    },
    {
      id: "evt_whs_pickup",
      state: "In_Transit",
      actor: "Harbour Wholesale",
      event_type: "release_to_wholesaler",
      at: "2026-05-28T01:40:00.000Z",
      evidence_ref: "asn_2026_05_28_glp1_004.json"
    },
    {
      id: "evt_cold_scan",
      state: "In_Transit",
      actor: "Cold chain sensor",
      event_type: "temperature_window",
      at: "2026-05-28T04:12:44.000Z",
      evidence_ref: "sensor-window-042.csv"
    }
  ].map(withEventHash)
};

export const template = {
  id: TEMPLATE_ID,
  name: TEMPLATE_NAME,
  description: "Serialized drug-family custody token for DSCSA-style manufacturer-to-dispenser proof.",
  org_id: ORG_ID,
  object_type: "pharma_batch",
  immutable_fields: [
    "batch_id",
    "product_family",
    "lot",
    "serial_range",
    "manufacturer.signature_id"
  ],
  mutable_fields: [
    "current_state",
    "custody_events",
    "sensor_window",
    "dscsa"
  ],
  states: STATES,
  actions: Object.entries(TRANSITIONS).map(([id, transition]) => ({
    id,
    label: transition.label,
    allowed_from: transition.from,
    moves_to: transition.to
  })),
  safety: {
    live_dual_writes: "operator_gated_when_configured",
    patient_pii_stored: false,
    public_write_tools: false
  }
};

export function cloneBatch(overrides = {}) {
  return {
    ...structuredClone(canonicalBatch),
    ...overrides
  };
}

export function evaluateHandoff(input = {}) {
  const batch = normalizeBatch(input.batch);
  const event = normalizeEvent(batch, input.event || {});
  const transition = TRANSITIONS[event.event_type];
  const checks = buildChecks(batch, event, transition);
  const failed = checks.filter((check) => !check.ok);
  const warning = checks.filter((check) => check.warning && check.ok);
  const result = failed.length ? "Blocked" : warning.length ? "Human Review" : "Approved";
  const next_state = result === "Approved" ? transition?.to || batch.current_state : batch.current_state;
  const proof = buildProof(batch, event, { result, next_state, checks });

  return {
    ok: result !== "Blocked",
    result,
    reason: failed[0]?.message || warning[0]?.message || `${transition?.label || "Custody event"} satisfies custody and DSCSA checks.`,
    event_type: event.event_type,
    from_state: batch.current_state,
    next_state,
    checks,
    proof,
    publicWrites: false,
    liveDualWrites: false,
    evaluated_at: new Date().toISOString()
  };
}

export function getStatus() {
  return {
    service: "dual-pharmchain-custody-demo",
    orgId: ORG_ID,
    templateId: TEMPLATE_ID,
    objectId: OBJECT_ID,
    mode: "local-proof",
    configured: false,
    writable: false,
    publicWrites: false,
    liveDualWrites: false,
    writeMode: "disabled",
    safety: {
      patientPiiStored: false,
      publicWriteTools: false,
      operatorGate: "not_configured",
      proofLevel: "local_rederived"
    }
  };
}

export function getCurrentBatch() {
  const batch = cloneBatch();
  const suggested_event = buildDefaultEvent(batch);
  const evaluation = evaluateHandoff({ batch, event: suggested_event });
  return {
    ...batch,
    next_event: suggested_event,
    next_state: evaluation.next_state,
    readiness: evaluation
  };
}

export function getProofBundle(input = {}) {
  const batch = normalizeBatch(input.batch);
  const event = normalizeEvent(batch, input.event || buildDefaultEvent(batch));
  const evaluation = evaluateHandoff({ batch, event });
  return {
    verifier: "pharmchain-local-proof-v1",
    verifier_level: input.verifier_level || "local_rederived",
    source: input.source || "local_seed",
    publicWrites: false,
    liveDualWrites: Boolean(input.liveDualWrites),
    org_id: ORG_ID,
    template_id: TEMPLATE_ID,
    object_id: OBJECT_ID,
    batch_id: batch.batch_id,
    state: batch.current_state,
    next_event: event.event_type,
    next_state: evaluation.next_state,
    result: evaluation.result,
    hashes: evaluation.proof,
    evidence_refs: batch.custody_events.map((item) => item.evidence_ref),
    dual_readback: input.dual_readback || null,
    generated_at: new Date().toISOString()
  };
}

export function buildDefaultEvent(batch = canonicalBatch) {
  const next = NEXT_EVENTS[batch.current_state] || "receive_at_pharmacy";
  const actorByEvent = {
    release_to_wholesaler: batch.wholesaler.name,
    receive_at_pharmacy: batch.pharmacy.name,
    dispense: batch.pharmacy.name
  };
  return {
    event_type: next,
    actor: actorByEvent[next] || batch.pharmacy.name,
    sender: next === "receive_at_pharmacy" ? batch.wholesaler.name : batch.manufacturer.name,
    receiver: next === "release_to_wholesaler" ? batch.wholesaler.name : batch.pharmacy.name,
    receiver_id: batch.pharmacy.receiver_id,
    facility_id: batch.pharmacy.facility_id,
    temperature_min_celsius: batch.sensor_window.min_celsius,
    temperature_max_celsius: batch.sensor_window.max_celsius,
    excursions: batch.sensor_window.excursions,
    serials_verified: true,
    transaction_information: true,
    transaction_statement: true,
    patient_pii_included: false,
    evidence_ref: `${batch.batch_id}-${next}-evidence.json`
  };
}

export function normalizeBatch(batch) {
  if (!batch || typeof batch !== "object") return cloneBatch();
  return {
    ...cloneBatch(),
    ...batch,
    manufacturer: { ...canonicalBatch.manufacturer, ...(batch.manufacturer || {}) },
    wholesaler: { ...canonicalBatch.wholesaler, ...(batch.wholesaler || {}) },
    pharmacy: { ...canonicalBatch.pharmacy, ...(batch.pharmacy || {}) },
    dscsa: { ...canonicalBatch.dscsa, ...(batch.dscsa || {}) },
    sensor_window: { ...canonicalBatch.sensor_window, ...(batch.sensor_window || {}) },
    custody_events: normalizeCustodyEvents(
      Array.isArray(batch.custody_events) ? batch.custody_events : structuredClone(canonicalBatch.custody_events)
    )
  };
}

export function normalizeEvent(batch, event) {
  const defaults = buildDefaultEvent(batch);
  return {
    ...defaults,
    ...event,
    temperature_min_celsius: Number(event.temperature_min_celsius ?? defaults.temperature_min_celsius),
    temperature_max_celsius: Number(event.temperature_max_celsius ?? defaults.temperature_max_celsius),
    excursions: Number(event.excursions ?? defaults.excursions),
    serials_verified: parseBoolean(event.serials_verified, defaults.serials_verified),
    transaction_information: parseBoolean(event.transaction_information, defaults.transaction_information),
    transaction_statement: parseBoolean(event.transaction_statement, defaults.transaction_statement),
    patient_pii_included: parseBoolean(event.patient_pii_included, defaults.patient_pii_included)
  };
}

export function applyApprovedHandoff(batchInput, eventInput, evaluationInput = null) {
  const batch = normalizeBatch(batchInput);
  const event = normalizeEvent(batch, eventInput || buildDefaultEvent(batch));
  const evaluation = evaluationInput || evaluateHandoff({ batch, event });
  if (evaluation.result !== "Approved") {
    const error = new Error(`Cannot write blocked PharmChain handoff: ${evaluation.reason}`);
    error.status = 409;
    error.evaluation = evaluation;
    throw error;
  }
  const at = event.at || new Date().toISOString();
  const custodyEvent = withEventHash({
    id: event.id || `evt_${event.event_type}_${Date.parse(at) || Date.now()}`,
    state: evaluation.next_state,
    actor: event.actor,
    sender: event.sender,
    receiver: event.receiver,
    event_type: event.event_type,
    at,
    evidence_ref: event.evidence_ref,
    receiver_id: event.receiver_id,
    facility_id: event.facility_id,
    temperature_min_celsius: event.temperature_min_celsius,
    temperature_max_celsius: event.temperature_max_celsius,
    excursions: event.excursions
  });
  const nextBatch = normalizeBatch({
    ...batch,
    current_state: evaluation.next_state,
    sensor_window: {
      ...batch.sensor_window,
      min_celsius: event.temperature_min_celsius,
      max_celsius: event.temperature_max_celsius,
      excursions: event.excursions,
      last_scan_at: at
    },
    custody_events: [...batch.custody_events, custodyEvent],
    updated_at: at,
    last_event_hash: custodyEvent.hash,
    last_decision_result: evaluation.result,
    last_decision_reason: evaluation.reason,
    integrity_hash: evaluation.proof.integrity_hash
  });
  return {
    batch: {
      ...nextBatch,
      proof: getProofBundle({ batch: nextBatch, event: buildDefaultEvent(nextBatch) }).hashes
    },
    event: custodyEvent,
    evaluation
  };
}

export function batchTemplateProperties(batchInput = canonicalBatch) {
  const batch = normalizeBatch(batchInput);
  const proof = getProofBundle({ batch, event: buildDefaultEvent(batch) }).hashes;
  return {
    object_type: "pharmchain_batch",
    batch_id: batch.batch_id,
    product_family: batch.product_family,
    lot: batch.lot,
    serial_range: batch.serial_range,
    unit_count: batch.unit_count,
    current_state: batch.current_state,
    manufacturer: batch.manufacturer,
    wholesaler: batch.wholesaler,
    pharmacy: batch.pharmacy,
    dscsa: batch.dscsa,
    sensor_window: batch.sensor_window,
    custody_events: normalizeCustodyEvents(batch.custody_events),
    policy_version: 1,
    patient_pii_stored: false,
    batch_hash: proof.batch_hash,
    custody_root: proof.custody_root,
    dscsa_hash: proof.dscsa_hash,
    event_hash: proof.event_hash,
    state_hash: proof.state_hash,
    integrity_hash: proof.integrity_hash,
    last_event_hash: batch.last_event_hash || batch.custody_events.at(-1)?.hash || "",
    last_decision_result: batch.last_decision_result || "Ready",
    last_decision_reason: batch.last_decision_reason || "Awaiting next handoff.",
    updated_at: batch.updated_at || batch.sensor_window.last_scan_at
  };
}

export function templatePayload(orgId = ORG_ID) {
  const properties = batchTemplateProperties(canonicalBatch);
  return {
    organization_id: orgId,
    name: TEMPLATE_NAME,
    description: "Serialized pharmaceutical custody token with DSCSA-style proof gates.",
    metadata: {
      source: "pharmchain-custody-demo",
      schema_version: "pharmchain.batch.v1",
      proof_scope: "manufacturer_to_dispenser_custody",
      public_writes: false,
      patient_pii_stored: false
    },
    object: {
      metadata: {
        name: "PharmChain GLP-1 Batch",
        description: "Serialized GLP-1 cold-chain batch custody object.",
        category: "pharmaceutical-custody"
      },
      custom: properties
    },
    actions: [
      { name: "mint", alias: "open_pharmchain_batch" },
      { name: "update", alias: "record_pharmchain_handoff" }
    ],
    public_access: {
      custom: Object.keys(properties)
    }
  };
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return Boolean(fallback);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
  }
  return Boolean(value);
}

function buildChecks(batch, event, transition) {
  const checks = [
    {
      id: "known_transition",
      ok: Boolean(transition),
      message: `Event ${event.event_type} is part of the PharmChain lifecycle.`
    },
    {
      id: "allowed_from_state",
      ok: Boolean(transition?.from.includes(batch.current_state)),
      message: `Event ${event.event_type} is allowed from ${batch.current_state}.`
    },
    {
      id: "manufacturer_signature",
      ok: batch.manufacturer.signature_valid === true,
      message: "Manufacturer signature is valid."
    },
    {
      id: "authorized_partners",
      ok: batch.dscsa.authorized_trading_partners === true,
      message: "Trading partners are authorized."
    },
    {
      id: "transaction_information",
      ok: batch.dscsa.transaction_information === true && event.transaction_information === true,
      message: "Transaction information is present."
    },
    {
      id: "transaction_statement",
      ok: batch.dscsa.transaction_statement === true && event.transaction_statement === true,
      message: "Transaction statement is present."
    },
    {
      id: "serial_verification",
      ok: batch.dscsa.product_identifier_verified === true && event.serials_verified === true,
      message: "Product identifiers and serial range are verified."
    },
    {
      id: "cold_chain_window",
      ok: event.temperature_min_celsius >= 2 && event.temperature_max_celsius <= 8 && event.excursions === 0,
      message: "Cold-chain temperature window stayed between 2C and 8C with no excursions."
    },
    {
      id: "receiver_identity",
      ok: typeof event.receiver_id === "string" && event.receiver_id.length >= 6,
      message: "Receiver identity is present."
    },
    {
      id: "patient_pii_boundary",
      ok: event.patient_pii_included === false,
      message: "No patient PII is stored in the proof record.",
      warning: event.event_type === "dispense" && event.patient_pii_included
    }
  ];
  return checks.map((check) => {
    if (check.ok) return check;
    return { ...check, message: failedMessage(check.id, batch, event) || check.message };
  });
}

function failedMessage(id, batch, event) {
  const messages = {
    known_transition: `Unknown event type: ${event.event_type}.`,
    allowed_from_state: `Event ${event.event_type} cannot move a batch from ${batch.current_state}.`,
    manufacturer_signature: "Manufacturer signature is missing or invalid.",
    authorized_partners: "One or more trading partners are not authorized.",
    transaction_information: "DSCSA transaction information is missing.",
    transaction_statement: "DSCSA transaction statement is missing.",
    serial_verification: "Serial range or product identifier verification failed.",
    cold_chain_window: `Cold-chain breach: ${event.temperature_min_celsius}C to ${event.temperature_max_celsius}C with ${event.excursions} excursions.`,
    receiver_identity: "Receiver identity is missing or too short.",
    patient_pii_boundary: "Patient PII must not be stored in the DUAL proof record."
  };
  return messages[id];
}

export function buildProof(batch, event, decision) {
  const batch_hash = stableHash({
    batch_id: batch.batch_id,
    product_family: batch.product_family,
    lot: batch.lot,
    serial_range: batch.serial_range,
    manufacturer_signature: batch.manufacturer.signature_id
  });
  const custody_root = stableHash(batch.custody_events.map((item) => ({
    id: item.id,
    event_type: item.event_type,
    actor: item.actor,
    at: item.at,
    evidence_ref: item.evidence_ref,
    hash: item.hash
  })));
  const dscsa_hash = stableHash(batch.dscsa);
  const event_hash = stableHash(event);
  const state_hash = stableHash({
    batch_id: batch.batch_id,
    state: batch.current_state,
    next_state: decision.next_state,
    result: decision.result,
    checks: decision.checks.map((check) => ({ id: check.id, ok: check.ok }))
  });
  const integrity_hash = stableHash({
    batch_hash,
    custody_root,
    dscsa_hash,
    event_hash,
    state_hash
  });
  return {
    batch_hash,
    custody_root,
    dscsa_hash,
    event_hash,
    state_hash,
    integrity_hash
  };
}

export function withEventHash(event) {
  const { hash: _hash, ...withoutHash } = event || {};
  return {
    ...withoutHash,
    hash: stableHash(withoutHash)
  };
}

function normalizeCustodyEvents(events = []) {
  return events
    .filter((event) => event && typeof event === "object")
    .map(withEventHash);
}

export function stableHash(value) {
  return `0x${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
