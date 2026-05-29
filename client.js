const stateLabels = {
  Manufactured: "Manufacturer signature and lot release",
  In_Transit: "Wholesaler custody and cold-chain monitoring",
  At_Pharmacy: "Dispenser receipt and serial verification",
  Dispensed: "Pseudonymous release proof, no patient PII"
};

let current = null;
let proof = null;
let dualStatus = null;
let reviewerIndex = 0;

const reviewerSteps = [
  ["Readback", "Confirm the DUAL object and state in the header."],
  ["Batch", "Inspect the serialized batch passport and DSCSA checks."],
  ["Gate", "Run the next handoff verifier before any write path."],
  ["Proof", "Compare the proof rail hashes and verifier bundle."],
  ["Boundary", "Simulate a breach and confirm live writes stay gated."]
];

const $ = (id) => document.getElementById(id);
const setText = (id, value) => {
  const element = $(id);
  if (element) element.textContent = value;
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

async function load() {
  const [status, batch, proofBundle] = await Promise.all([
    api("/api/dual/status"),
    api("/api/batches/current"),
    api("/api/proof")
  ]);
  current = batch;
  proof = proofBundle;
  dualStatus = status;
  renderStatus(status);
  renderBatch(batch);
  renderEventForm(batch.next_event);
  renderDecision(batch.readiness);
  renderProof(proofBundle);
  renderScorecard();
  renderReviewerGuide();
}

function renderStatus(status) {
  const modeLabel = status.writable ? "Live DUAL gated" : status.readbackReady ? "DUAL readback" : "Local proof";
  const canonicalObjectConfigured = Boolean(status.readbackReady && status.objectId && status.objectId !== "pharmchain-batch-local-v1");
  const hasNextEvent = Boolean(current?.next_event?.event_type);
  const dualStatusEl = $("dualStatus");
  if (dualStatusEl) {
    dualStatusEl.textContent = modeLabel;
    dualStatusEl.className = status.publicWrites ? "status-pill blocked" : "status-pill safe";
  }
  const readbackStatusEl = $("readbackStatus");
  if (readbackStatusEl) {
    readbackStatusEl.textContent = status.readbackReady ? "Readback on" : "Readback off";
    readbackStatusEl.className = status.readbackReady ? "status-pill safe" : "status-pill";
  }
  setText("headerObjectMeta", shortId(status.objectId || current?.object_id));
  setText("proofScore", status.publicWrites ? "84" : status.readbackReady ? "98" : "94");
  $("writeBoundary").textContent = status.writable ? "Operator-gated writes" : "No public writes";
  $("writeBoundary").className = status.publicWrites ? "status-pill blocked" : "status-pill safe";
  $("operatorGate").textContent = status.operatorGateConfigured ? "Configured" : "Not configured";
  $("dualLiveList").innerHTML = [
    ["Mode", status.mode],
    ["Template", status.templateId],
    ["Object", status.objectId],
    ["Write mode", status.writeMode],
    ["Public writes", String(status.publicWrites)],
    ["Live writes", status.writable ? "operator gated" : "disabled"]
  ].map(([label, value]) => `<code>${escapeHtml(label)}: ${escapeHtml(value || "n/a")}</code>`).join("");
  $("syncDualBtn").disabled = !status.operatorGateConfigured || !hasNextEvent;
  $("syncDualBtn").title = hasNextEvent ? "Write the approved next handoff to DUAL." : "Batch lifecycle is complete.";
  $("mintDualBtn").disabled = !status.mintReady || canonicalObjectConfigured;
  $("mintDualBtn").title = canonicalObjectConfigured ? "Canonical DUAL object already exists." : "Mint the canonical PharmChain batch object.";
}

function renderBatch(batch) {
  const stateLabel = batch.current_state.replaceAll("_", " ");
  const nextGate = batch.next_event?.event_type
    ? batch.next_event.event_type.replaceAll("_", " ")
    : "Complete";
  $("stateChip").textContent = stateLabel;
  $("stateChip").className = "state-chip active";
  $("nextEvent").textContent = batch.next_event?.event_type
    ? `Next: ${nextGate}`
    : "Complete";
  $("eventCount").textContent = `${batch.custody_events.length} events`;
  setText("headerStateMeta", stateLabel);
  setText("previewState", stateLabel);
  setText("heroState", stateLabel);
  setText("heroBatchId", batch.batch_id);
  setText("heroUnits", String(batch.unit_count));
  setText("heroReleased", batch.dscsa.patient_pii_stored ? "PII risk" : "0 PII fields");
  setText("heroNextGate", nextGate);
  setText("heroSubtitle", `${batch.product_family} lot ${batch.lot} moving through a governed manufacturer-to-dispenser chain.`);
  $("batchDetails").innerHTML = detailRows([
    ["Batch", batch.batch_id],
    ["Product", batch.product_family],
    ["Lot", batch.lot],
    ["Serial range", batch.serial_range],
    ["Units", batch.unit_count],
    ["Template", batch.template_id],
    ["Source", batch.source || "local_seed"],
    ["Object", batch.dual_object?.id || batch.object_id]
  ]);
  $("dscsaChecks").innerHTML = [
    ["Transaction information", batch.dscsa.transaction_information],
    ["Transaction history", batch.dscsa.transaction_history],
    ["Transaction statement", batch.dscsa.transaction_statement],
    ["Product identifier", batch.dscsa.product_identifier_verified],
    ["Authorized partners", batch.dscsa.authorized_trading_partners],
    ["No patient PII stored", !batch.dscsa.patient_pii_stored]
  ].map(([label, ok]) => `<div class="check-row"><span class="check-dot${ok ? "" : " warn"}"></span>${label}</div>`).join("");
  $("actorList").innerHTML = [
    [batch.manufacturer.name, `Manufacturer site ${batch.manufacturer.site}`],
    [batch.wholesaler.name, `Facility ${batch.wholesaler.facility_id}`],
    [batch.pharmacy.name, `Receiver ${batch.pharmacy.receiver_id}`]
  ].map(([name, detail]) => `<div class="actor-card"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(detail)}</p></div>`).join("");
  $("stateRail").innerHTML = Object.entries(stateLabels).map(([name, detail]) => `
    <div class="state-node${name === batch.current_state ? " active" : ""}">
      <strong>${name.replaceAll("_", " ")}</strong>
      <span>${detail}</span>
    </div>
  `).join("");
  $("eventList").innerHTML = batch.custody_events.map((event) => `
    <div class="event-card">
      <strong>${escapeHtml(event.event_type.replaceAll("_", " "))}</strong>
      <p>${escapeHtml(event.actor)} - ${new Date(event.at).toLocaleString()}</p>
      <p>${escapeHtml(event.evidence_ref)} - ${escapeHtml(event.hash)}</p>
    </div>
  `).join("");
}

function detailRows(rows) {
  return rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join("");
}

function renderEventForm(event) {
  const complete = !event?.event_type;
  $("eventType").innerHTML = ["release_to_wholesaler", "receive_at_pharmacy", "dispense"].map((value) => (
    `<option value="${value}"${value === event?.event_type ? " selected" : ""}>${value.replaceAll("_", " ")}</option>`
  )).join("");
  $("receiverId").value = event?.receiver_id || "";
  $("tempMin").value = event?.temperature_min_celsius ?? "";
  $("tempMax").value = event?.temperature_max_celsius ?? "";
  $("serialsVerified").checked = Boolean(event?.serials_verified);
  $("transactionInfo").checked = Boolean(event?.transaction_information);
  $("transactionStatement").checked = Boolean(event?.transaction_statement);
  $("patientPii").checked = Boolean(event?.patient_pii_included);
  ["eventType", "receiverId", "tempMin", "tempMax", "serialsVerified", "transactionInfo", "transactionStatement", "patientPii", "evaluateBtn", "tempBreachBtn", "resetBtn"].forEach((id) => {
    $(id).disabled = complete;
  });
}

function readEventForm() {
  return {
    event_type: $("eventType").value,
    receiver_id: $("receiverId").value,
    temperature_min_celsius: Number($("tempMin").value),
    temperature_max_celsius: Number($("tempMax").value),
    excursions: Number($("tempMax").value) > 8 || Number($("tempMin").value) < 2 ? 1 : 0,
    serials_verified: $("serialsVerified").checked,
    transaction_information: $("transactionInfo").checked,
    transaction_statement: $("transactionStatement").checked,
    patient_pii_included: $("patientPii").checked
  };
}

async function evaluateCurrent() {
  const evaluation = await api("/api/batches/evaluate", {
    method: "POST",
    body: { batch: current, event: readEventForm() }
  });
  proof = { ...proof, hashes: evaluation.proof, result: evaluation.result, next_state: evaluation.next_state };
  renderDecision(evaluation);
  renderProof(proof);
}

function renderDecision(evaluation) {
  const approved = evaluation.result === "Approved";
  $("decisionBadge").textContent = evaluation.result;
  $("decisionBadge").className = approved ? "status-pill safe" : "status-pill blocked";
  $("decisionPanel").className = `decision-panel ${approved ? "approved" : "blocked"}`;
  $("decisionPanel").innerHTML = `
    <strong>${escapeHtml(evaluation.reason)}</strong>
    <p>State: ${escapeHtml(evaluation.from_state)} -> ${escapeHtml(evaluation.next_state)}</p>
    <div class="check-list">
      ${evaluation.checks.map((check) => `<div class="check-row"><span class="check-dot${check.ok ? "" : " warn"}"></span>${escapeHtml(check.message)}</div>`).join("")}
    </div>
  `;
}

function renderProof(bundle) {
  const hashes = bundle.hashes || {};
  setText("previewHash", shortHash(hashes.integrity_hash));
  $("proofGrid").innerHTML = [
    ["Verifier", bundle.verifier_level || "local_rederived"],
    ["Batch hash", hashes.batch_hash],
    ["Custody root", hashes.custody_root],
    ["DSCSA hash", hashes.dscsa_hash],
    ["State hash", hashes.state_hash],
    ["Integrity hash", hashes.integrity_hash]
  ].map(([label, value]) => `
    <div class="proof-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(shortValue(value))}</strong>
      <code>${escapeHtml(value || "pending")}</code>
    </div>
  `).join("");
}

function shortValue(value) {
  if (!value) return "pending";
  return String(value).startsWith("0x") ? shortHash(value) : String(value);
}

function renderScorecard() {
  $("scoreList").innerHTML = [
    ["Custody lifecycle", "Manufactured -> In_Transit -> At_Pharmacy -> Dispensed"],
    ["DSCSA gate", "Transaction info, statement, partner auth, serial check"],
    ["Proof", "Batch hash, custody root, DSCSA hash, state hash"],
    ["MCP", "Read/evaluate/proof plus operator-gated write tools"],
    ["Boundary", "No patient PII, no public writes, live DUAL writes require operator token"]
  ].map(([title, detail]) => `<div class="score-item"><span>${title}</span><strong>${detail}</strong></div>`).join("");
}

function renderReviewerGuide() {
  $("reviewerSteps").innerHTML = reviewerSteps.map(([title, detail], index) => `
    <div class="reviewer-step${index === reviewerIndex ? " active" : ""}">
      <strong>${index + 1}. ${escapeHtml(title)}</strong>
      ${escapeHtml(detail)}
    </div>
  `).join("");
  $("reviewerStepText").textContent = `${reviewerIndex + 1}. ${reviewerSteps[reviewerIndex][1]}`;
  $("reviewerBackBtn").disabled = reviewerIndex === 0;
  $("reviewerNextBtn").textContent = reviewerIndex === reviewerSteps.length - 1 ? "Done" : "Next";
}

function openReviewerGuide() {
  $("reviewerGuide").scrollIntoView({ behavior: "smooth", block: "center" });
  renderReviewerGuide();
}

function shortHash(value) {
  if (!value) return "pending";
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

function shortId(value) {
  if (!value) return "pending";
  const text = String(value);
  return text.length > 18 ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

$("evaluateBtn").addEventListener("click", evaluateCurrent);
$("tempBreachBtn").addEventListener("click", () => {
  $("tempMax").value = "12.4";
  evaluateCurrent();
});
$("resetBtn").addEventListener("click", () => renderEventForm(current.next_event));
$("resetDemoBtn").addEventListener("click", () => {
  renderEventForm(current.next_event);
  renderDecision(current.readiness);
  renderProof(proof);
});
$("verifyNextGateBtn").addEventListener("click", evaluateCurrent);
$("reviewerModeBtn").addEventListener("click", openReviewerGuide);
$("walkthroughPlayBtn").addEventListener("click", openReviewerGuide);
$("reviewerBackBtn").addEventListener("click", () => {
  reviewerIndex = Math.max(0, reviewerIndex - 1);
  renderReviewerGuide();
});
$("reviewerNextBtn").addEventListener("click", () => {
  if (reviewerIndex === reviewerSteps.length - 1) {
    $("reviewerGuide").scrollIntoView({ behavior: "smooth", block: "end" });
    return;
  }
  reviewerIndex += 1;
  renderReviewerGuide();
});
$("syncDualBtn").addEventListener("click", syncToDual);
$("mintDualBtn").addEventListener("click", mintToDual);
$("exportProofBtn").addEventListener("click", () => {
  const data = JSON.stringify({ batch: current, proof, event: readEventForm() }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "pharmchain-proof.json";
  anchor.click();
  URL.revokeObjectURL(url);
});
$("copyBriefBtn").addEventListener("click", async () => {
  const brief = [
    "PharmChain demonstrates a DUAL-native custody ledger for one serialized drug family.",
    `Batch ${current.batch_id} is currently ${current.current_state}.`,
    "The public demo exposes read/evaluate/proof paths; live DUAL writes require the operator token.",
    `Proof integrity hash: ${proof.hashes.integrity_hash}`
  ].join("\n");
  try {
    await navigator.clipboard.writeText(brief);
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = brief;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.left = "-9999px";
    document.body.appendChild(fallback);
    fallback.select();
    document.execCommand("copy");
    fallback.remove();
  }
  $("copyBriefBtn").textContent = "Copied";
  setTimeout(() => { $("copyBriefBtn").textContent = "Copy brief"; }, 1200);
});

load().catch((error) => {
  document.body.innerHTML = `<pre>${escapeHtml(error.stack || error.message)}</pre>`;
});

async function syncToDual() {
  const token = $("operatorToken").value.trim();
  if (!token) {
    renderLiveWriteResult("Operator token required.", false);
    return;
  }
  try {
    const result = await operatorApi("/api/batches/sync", {
      batch: current,
      event: readEventForm(),
      audit: { source: "browser_operator", requested_at: new Date().toISOString() }
    }, token);
    renderLiveWriteResult(`Synced ${result.event.event_type}; readback hash ${shortHash(result.verification.readback_integrity_hash)}.`, true);
    await load();
  } catch (error) {
    renderLiveWriteResult(error.message, false);
  }
}

async function mintToDual() {
  const token = $("operatorToken").value.trim();
  if (!token) {
    renderLiveWriteResult("Operator token required.", false);
    return;
  }
  try {
    const result = await operatorApi("/api/batches/mint", {
      batch: current,
      audit: { source: "browser_operator", requested_at: new Date().toISOString() }
    }, token);
    renderLiveWriteResult(`Minted ${result.object?.id || "batch object"}; hash ${shortHash(result.verification.readback_integrity_hash)}.`, true);
    await load();
  } catch (error) {
    renderLiveWriteResult(error.message, false);
  }
}

async function operatorApi(path, body, token) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-demo-operator-token": token
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message || payload.error || `${path} returned ${response.status}`);
  }
  return payload;
}

function renderLiveWriteResult(message, ok) {
  $("liveWriteResult").className = `decision-panel ${ok ? "approved" : "blocked"}`;
  $("liveWriteResult").innerHTML = `<strong>${escapeHtml(message)}</strong>`;
}
