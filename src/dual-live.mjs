import {
  ORG_ID,
  TEMPLATE_NAME,
  applyApprovedHandoff,
  batchTemplateProperties,
  buildDefaultEvent,
  canonicalBatch,
  cloneBatch,
  evaluateHandoff,
  getCurrentBatch,
  getProofBundle,
  normalizeBatch,
  stableHash,
  templatePayload
} from "./pharmchain.mjs";

export function dualConfig() {
  const writeMode = process.env.DUAL_WRITE_MODE || "read_only";
  const persistenceMode = process.env.DUAL_PERSISTENCE_MODE || "local";
  return {
    apiUrl: process.env.DUAL_API_URL || "https://api-testnet.dual.network",
    apiKey: process.env.DUAL_API_KEY || "",
    orgId: process.env.DUAL_ORG_ID || ORG_ID,
    templateName: TEMPLATE_NAME,
    templateId: process.env.DUAL_PHARMCHAIN_TEMPLATE_ID || "",
    objectId: process.env.DUAL_PHARMCHAIN_BATCH_OBJECT_ID || "",
    operatorToken: process.env.DEMO_OPERATOR_TOKEN || "",
    persistenceMode,
    writeMode,
    eventBusPath: process.env.DUAL_EVENTBUS_PATH || "/ebus/execute",
    publicWrites: false
  };
}

export function readiness() {
  const config = dualConfig();
  const readbackReady = Boolean(config.apiKey && config.objectId);
  const mintReady = Boolean(config.apiKey && config.templateId && config.operatorToken && config.writeMode === "event_bus");
  const writable = Boolean(readbackReady && mintReady);
  const missing = [];
  if (!config.apiKey) missing.push("DUAL_API_KEY");
  if (!config.templateId) missing.push("DUAL_PHARMCHAIN_TEMPLATE_ID");
  if (!config.objectId) missing.push("DUAL_PHARMCHAIN_BATCH_OBJECT_ID");
  if (!config.operatorToken) missing.push("DEMO_OPERATOR_TOKEN");
  if (config.writeMode !== "event_bus") missing.push("DUAL_WRITE_MODE=event_bus");

  return {
    service: "dual-pharmchain-custody-demo",
    runtime: process.env.VERCEL ? "vercel" : "node",
    mode: readbackReady ? "dual" : "local-proof",
    persistenceMode: config.persistenceMode,
    orgId: config.orgId,
    templateName: config.templateName,
    templateId: config.templateId || "pharmchain-template-local-v1",
    objectId: config.objectId || "pharmchain-batch-local-v1",
    configured: readbackReady,
    readbackReady,
    mintReady,
    writable,
    writeMode: config.writeMode,
    eventBusPath: config.eventBusPath,
    operatorGateConfigured: Boolean(config.operatorToken),
    publicWrites: false,
    liveDualWrites: writable,
    writeExecutionExposed: writable ? "operator_gated" : false,
    missing: writable ? [] : missing,
    safety: {
      patientPiiStored: false,
      publicWriteTools: false,
      operatorGate: config.operatorToken ? "configured" : "not_configured",
      proofLevel: readbackReady ? "dual_readback_rederived" : "local_rederived"
    },
    detail: writable
      ? "DUAL readback and operator-gated event-bus writes are configured."
      : readbackReady
        ? "DUAL readback is configured. Live writes need event_bus mode and DEMO_OPERATOR_TOKEN."
        : "Running in local proof mode. Set DUAL_API_KEY and DUAL_PHARMCHAIN_BATCH_OBJECT_ID to enable live DUAL readback."
  };
}

export async function readCurrentObject() {
  const config = dualConfig();
  const object = await dualRequest(config, "GET", `/objects/${encodeURIComponent(config.objectId)}`);
  const properties = extractCustom(object);
  const batch = normalizeBatch({
    ...properties,
    object_id: extractObjectId(object) || config.objectId,
    template_id: extractTemplateId(object) || config.templateId,
    org_id: extractOrganizationId(object) || config.orgId
  });
  return {
    available: true,
    source: "dual_readback",
    object: summarizeObject(object),
    properties: batchTemplateProperties(batch),
    batch,
    status: readiness()
  };
}

export async function getCurrentBatchLive() {
  const status = readiness();
  if (!status.readbackReady) {
    return {
      ...localBatchEnvelope(),
      status
    };
  }
  const current = await readCurrentObject();
  const nextEvent = buildNextEvent(current.batch);
  const evaluation = nextEvent
    ? {
        ...evaluateHandoff({ batch: current.batch, event: nextEvent }),
        liveDualWrites: current.status.writable,
        writeExecutionExposed: current.status.writeExecutionExposed
      }
    : null;
  return {
    ...current.batch,
    source: "dual_readback",
    dual_object: current.object,
    dual_status: current.status,
    next_event: nextEvent,
    next_state: evaluation?.next_state || current.batch.current_state,
    readiness: evaluation || {
      ok: true,
      result: "Complete",
      reason: "Batch lifecycle is complete.",
      from_state: current.batch.current_state,
      next_state: current.batch.current_state,
      checks: [],
      publicWrites: false,
      liveDualWrites: current.status.writable
    }
  };
}

export async function getProofBundleLive() {
  const status = readiness();
  if (!status.readbackReady) return getProofBundle();
  const current = await readCurrentObject();
  return getProofBundle({
    batch: current.batch,
    source: "dual_readback",
    verifier_level: "dual_readback_rederived",
    liveDualWrites: status.writable,
    dual_readback: current.object
  });
}

export async function mintBatch(input = {}) {
  requireWritable({ requireObject: false });
  const config = dualConfig();
  if (config.objectId && input.force !== true) {
    const error = new Error("Canonical PharmChain object is already configured; mint is disabled unless force=true.");
    error.status = 409;
    error.readiness = readiness();
    throw error;
  }
  const balance = await requirePositiveBalance(config);
  const batch = normalizeBatch(input.batch || input.properties || cloneBatch());
  const metadata = semanticMetadata("pharmchain_batch_minted", batch, input.audit || {});
  const { result, payloadStyle } = await executeEventBusWithFallback(
    config,
    mintPayloadAttempts(config.templateId, batch, metadata)
  );
  const object = extractResultObject(result);
  const objectId = object?.id || extractObjectId(result);
  const readback = objectId ? await readObjectById(objectId) : object;
  const verified = verifyBatchReadback(readback?.properties || batchTemplateProperties(batch), batch);
  return {
    ok: true,
    minted: true,
    synced: true,
    action: "mint",
    payloadStyle,
    balance,
    publicWrites: false,
    liveDualWrites: true,
    object: readback || object,
    verification: verified,
    result
  };
}

export async function syncHandoff(input = {}) {
  requireWritable();
  const config = dualConfig();
  const balance = await requirePositiveBalance(config);
  const current = input.batch ? normalizeBatch(input.batch) : (await readCurrentObject()).batch;
  const event = input.event || current.next_event || {};
  const evaluation = {
    ...evaluateHandoff({ batch: current, event }),
    liveDualWrites: true,
    writeExecutionExposed: "operator_gated"
  };
  const advanced = applyApprovedHandoff(current, event, evaluation);
  const metadata = semanticMetadata("pharmchain_handoff_synced", advanced.batch, {
    event: advanced.event,
    evaluation,
    ...(input.audit || {})
  });
  const { result, payloadStyle } = await executeEventBusWithFallback(
    config,
    updatePayloadAttempts(config.objectId, advanced.batch, metadata)
  );
  const readback = await readObjectById(config.objectId);
  const verification = verifyBatchReadback(readback.properties, advanced.batch);
  return {
    ok: true,
    synced: true,
    action: "update",
    payloadStyle,
    balance,
    publicWrites: false,
    liveDualWrites: true,
    event: advanced.event,
    evaluation,
    batch: advanced.batch,
    object: readback,
    verification,
    result
  };
}

export async function ensureTemplateAndObject(options = {}) {
  const config = dualConfig();
  if (!config.apiKey) {
    const error = new Error("DUAL_API_KEY is not configured.");
    error.status = 409;
    throw error;
  }
  const template = await findOrCreateTemplate(config);
  const templateId = extractTemplateId(template);
  const balance = await requirePositiveBalance(config);
  const object = await findOrMintSeedObject({ ...config, templateId }, templateId, options);
  const objectId = extractObjectId(object);
  const readback = objectId ? await readObjectById(objectId, { ...config, objectId }) : null;
  return {
    created_at: new Date().toISOString(),
    api_url: config.apiUrl,
    org_id: config.orgId,
    template_name: config.templateName,
    template_id: templateId,
    object_id: objectId,
    balance,
    readback_verified: Boolean(readback && verifyBatchIdentity(readback.properties).ok),
    readback
  };
}

export function requireOperator(requestOrToken) {
  const supplied = typeof requestOrToken === "string"
    ? requestOrToken
    : requestOrToken?.headers?.["x-demo-operator-token"]
      || requestOrToken?.headers?.["X-Demo-Operator-Token"]
      || requestOrToken?.headers?.get?.("x-demo-operator-token")
      || "";
  const auth = typeof requestOrToken === "string"
    ? ""
    : requestOrToken?.headers?.authorization
      || requestOrToken?.headers?.Authorization
      || requestOrToken?.headers?.get?.("authorization")
      || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const expected = dualConfig().operatorToken;
  if (!expected || (supplied !== expected && bearer !== expected)) {
    const error = new Error("Invalid or missing operator token.");
    error.status = 403;
    throw error;
  }
}

export function requireWritable(options = {}) {
  const requireObject = options.requireObject !== false;
  const status = readiness();
  const config = dualConfig();
  const baseWritable = Boolean(config.apiKey && config.templateId && config.operatorToken && config.writeMode === "event_bus");
  if (!baseWritable || (requireObject && !config.objectId)) {
    const error = new Error(status.detail);
    error.status = 409;
    error.readiness = status;
    throw error;
  }
}

export async function requirePositiveBalance(config = dualConfig()) {
  const raw = await dualRequest(config, "GET", `/organizations/${encodeURIComponent(config.orgId)}/balance`);
  const value = extractBalance(raw);
  const ready = Number.isFinite(value) && value > 0;
  if (!ready) {
    const error = new Error(`DUAL org balance must be positive before PharmChain event-bus writes. Current balance: ${value}`);
    error.status = 409;
    error.balance = { ready, value, raw };
    throw error;
  }
  return { ready, value };
}

export async function readBody(request) {
  if (request.body && typeof request.body === "object" && !request.readable) return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  return JSON.parse(raw);
}

export function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload, null, 2));
}

export function requireMethod(request, response, method) {
  if (request.method === method) return true;
  sendJson(response, 405, { ok: false, error: `Method ${request.method} not allowed`, allowed: [method] });
  return false;
}

export function sendError(response, error) {
  sendJson(response, error.status || 500, {
    ok: false,
    error: {
      message: error.message || "Unknown error",
      code: error.code || error.name || "SERVER_ERROR",
      readiness: error.readiness || undefined,
      balance: error.balance || undefined
    },
    publicWrites: false
  });
}

export function updatePayloadAttempts(objectId, batchInput, metadata = {}) {
  const batch = normalizeBatch(batchInput);
  return [
    { style: "direct_custom", payload: updatePayloadByStyle("direct_custom", objectId, batch, metadata) },
    { style: "direct_data_custom", payload: updatePayloadByStyle("direct_data_custom", objectId, batch, metadata) }
  ];
}

export function mintPayloadAttempts(templateId, batchInput, metadata = {}) {
  const batch = normalizeBatch(batchInput);
  return [
    { style: "direct_custom", payload: mintPayloadByStyle("direct_custom", templateId, batch, metadata) },
    { style: "direct_data_custom", payload: mintPayloadByStyle("direct_data_custom", templateId, batch, metadata) }
  ];
}

export function semanticMetadata(eventType, batchInput = canonicalBatch, audit = {}) {
  const batch = normalizeBatch(batchInput);
  const proof = getProofBundle({ batch }).hashes;
  return {
    source: "pharmchain_custody_demo",
    event_type: eventType,
    event_status: batch.current_state,
    event_hash: batch.last_event_hash || proof.event_hash,
    batch_id: batch.batch_id,
    current_state: batch.current_state,
    integrity_hash: proof.integrity_hash,
    patient_pii_stored: false,
    generated_at: new Date().toISOString(),
    audit
  };
}

async function findOrCreateTemplate(config) {
  const existing = await findTemplate(config);
  if (existing) return existing;
  const payload = templatePayload(config.orgId);
  try {
    return await dualRequest(config, "POST", "/templates", payload);
  } catch (error) {
    if (error.status !== 400) throw error;
    const { organization_id: _organizationId, ...withoutOrg } = payload;
    return dualRequest(config, "POST", "/templates", withoutOrg);
  }
}

async function findTemplate(config) {
  const body = await dualRequest(config, "GET", `/templates?org_id=${encodeURIComponent(config.orgId)}&limit=25`);
  return asArray(body).find((item) => item?.name === TEMPLATE_NAME) || null;
}

async function findOrMintSeedObject(config, templateId, options = {}) {
  const existing = await findSeedObject(config, templateId);
  if (existing) return existing;
  const batch = normalizeBatch(options.batch || cloneBatch());
  const metadata = semanticMetadata("pharmchain_batch_minted", batch, {
    source: "setup-live-dual",
    reason: "canonical PharmChain batch object"
  });
  const { result } = await executeEventBusWithFallback(config, mintPayloadAttempts(templateId, batch, metadata));
  const objectId = extractObjectId(result);
  if (objectId) return { id: objectId, result };
  return await findSeedObject(config, templateId) || result;
}

async function findSeedObject(config, templateId) {
  const body = await dualRequest(config, "GET", `/objects?template_id=${encodeURIComponent(templateId)}&org_id=${encodeURIComponent(config.orgId)}&limit=25`);
  return asArray(body).find((item) => {
    const custom = extractCustom(item);
    return custom.batch_id === canonicalBatch.batch_id;
  }) || null;
}

async function readObjectById(objectId, config = dualConfig()) {
  const object = await dualRequest(config, "GET", `/objects/${encodeURIComponent(objectId)}`);
  return summarizeObject(object);
}

async function executeEventBusWithFallback(config, attempts) {
  const errors = [];
  for (const attempt of attempts) {
    try {
      const result = await dualRequest(config, "POST", config.eventBusPath, attempt.payload);
      return { result, payloadStyle: attempt.style };
    } catch (error) {
      errors.push({
        style: attempt.style,
        status: error.status || null,
        message: error.message,
        body: error.body || null
      });
    }
  }
  const error = new Error(`DUAL event-bus write failed. ${errors.map((item) => `${item.style}: ${item.message}`).join(" | ")}`);
  error.status = errors[0]?.status || 400;
  error.body = { attempts: errors };
  throw error;
}

async function dualRequest(config, method, path, body) {
  if (!config.apiKey) {
    const error = new Error("DUAL_API_KEY is not configured.");
    error.status = 409;
    throw error;
  }
  const response = await fetch(`${config.apiUrl.replace(/\/+$/, "")}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": config.apiKey
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `DUAL request failed with HTTP ${response.status}`);
    error.status = response.status;
    error.body = payload;
    throw error;
  }
  return payload;
}

function updatePayloadByStyle(style, objectId, batchInput, metadata = {}) {
  const custom = {
    ...batchTemplateProperties(batchInput),
    updated_at: new Date().toISOString()
  };
  if (style === "direct_data_custom") {
    return {
      action: {
        update: {
          id: objectId,
          data: { custom }
        }
      },
      metadata
    };
  }
  return {
    action: {
      update: {
        id: objectId,
        custom
      }
    },
    metadata
  };
}

function mintPayloadByStyle(style, templateId, batchInput, metadata = {}) {
  const config = dualConfig();
  const custom = {
    ...batchTemplateProperties(batchInput),
    updated_at: new Date().toISOString()
  };
  if (style === "direct_data_custom") {
    return {
      action: {
        mint: {
          template_id: templateId,
          organization_id: config.orgId,
          num: 1,
          data: { custom }
        }
      },
      metadata: mintMetadata(metadata)
    };
  }
  return {
    action: {
      mint: {
        template_id: templateId,
        organization_id: config.orgId,
        num: 1,
        custom
      }
    },
    metadata: mintMetadata(metadata)
  };
}

function mintMetadata(metadata = {}) {
  return {
    name: "PharmChain Batch Demo",
    description: "Serialized GLP-1 custody object for the PharmChain reviewer package.",
    category: "pharmaceutical-custody",
    ...metadata
  };
}

function verifyBatchReadback(properties = {}, expectedBatchInput = canonicalBatch) {
  const readback = batchTemplateProperties(normalizeBatch(properties));
  const expected = batchTemplateProperties(expectedBatchInput);
  const matches = {
    batch_id: readback.batch_id === expected.batch_id,
    current_state: readback.current_state === expected.current_state,
    custody_root: readback.custody_root === expected.custody_root,
    state_hash: readback.state_hash === expected.state_hash,
    integrity_hash: readback.integrity_hash === expected.integrity_hash,
    patient_pii_stored: readback.patient_pii_stored === false
  };
  const ok = Object.values(matches).every(Boolean);
  if (!ok) {
    const error = new Error("DUAL readback did not match the expected PharmChain proof state.");
    error.status = 409;
    error.verification = { ok, matches, expected, readback };
    throw error;
  }
  return {
    ok,
    matches,
    expected_integrity_hash: expected.integrity_hash,
    readback_integrity_hash: readback.integrity_hash,
    verification_hash: stableHash({ expected, readback })
  };
}

function verifyBatchIdentity(properties = {}) {
  const readback = batchTemplateProperties(normalizeBatch(properties));
  const matches = {
    batch_id: readback.batch_id === canonicalBatch.batch_id,
    patient_pii_stored: readback.patient_pii_stored === false,
    integrity_hash_present: Boolean(readback.integrity_hash)
  };
  const ok = Object.values(matches).every(Boolean);
  return { ok, matches, readback_integrity_hash: readback.integrity_hash };
}

function summarizeObject(object = {}) {
  if (!object || typeof object !== "object") return null;
  const properties = batchTemplateProperties(extractCustom(object));
  return {
    id: extractObjectId(object),
    templateId: extractTemplateId(object),
    organizationId: extractOrganizationId(object),
    stateHash: stringValue(object.state_hash || object.stateHash),
    integrityHash: stringValue(object.integrity_hash || object.integrityHash || properties.integrity_hash),
    properties
  };
}

function extractResultObject(result = {}) {
  const candidates = [
    result?.object,
    result?.data?.object,
    result?.result?.object,
    result?.objects?.[0],
    result?.data?.objects?.[0],
    result?.result?.objects?.[0],
    result?.affected_objects?.[0],
    result?.affectedObjects?.[0]
  ];
  return candidates.map((candidate) => summarizeObject(candidate)).find(Boolean) || null;
}

function extractCustom(object = {}) {
  return object?.properties
    || object?.custom
    || object?.data?.custom
    || object?.state?.custom
    || object?.object?.properties
    || object?.object?.custom
    || {};
}

function extractObjectId(value = {}) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return extractObjectId(value[0]);
  return value.id
    || value.object_id
    || value.objectId
    || value.data?.id
    || value.data?.object_id
    || value.data?.objectId
    || value.data?.objects?.[0]?.id
    || value.objects?.[0]?.id
    || value.result?.id
    || value.result?.object_id
    || value.result?.objectId
    || value.result?.objects?.[0]?.id
    || "";
}

function extractTemplateId(value = {}) {
  return value.template_id
    || value.templateId
    || value.template?.id
    || value.id
    || value.data?.template_id
    || value.data?.templateId
    || value.data?.id
    || "";
}

function extractOrganizationId(value = {}) {
  return value.organization_id
    || value.organizationId
    || value.org_id
    || value.orgId
    || value.data?.organization_id
    || value.data?.organizationId
    || "";
}

function extractBalance(value) {
  const candidates = [
    value?.balance?.amount,
    value?.balance?.value,
    value?.balance,
    value?.available?.amount,
    value?.available?.value,
    value?.available,
    value?.amount,
    value?.value,
    value?.data?.balance?.amount,
    value?.data?.balance?.value,
    value?.data?.balance,
    value?.data?.available?.amount,
    value?.data?.available?.value,
    value?.data?.available,
    value?.organization?.balance
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") continue;
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) return numeric;
  }
  return Number.NaN;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value?.items || value?.templates || value?.objects || value?.results || value?.data?.items || value?.data?.templates || value?.data?.objects || [];
}

function buildNextEvent(batch) {
  const normalized = normalizeBatch(batch);
  return normalized.current_state === "Dispensed" ? null : buildDefaultEvent(normalized);
}

function localBatchEnvelope() {
  return {
    ...getCurrentBatch(),
    source: "local_seed"
  };
}

function stringValue(value, fallback = "") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}
