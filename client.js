const stateLabels = {
  Manufactured: "Manufacturer signature and lot release",
  In_Transit: "Wholesaler custody and cold-chain monitoring",
  At_Pharmacy: "Dispenser receipt and serial verification",
  Dispensed: "Pseudonymous release proof, no patient PII"
};

let current = null;
let proof = null;

const $ = (id) => document.getElementById(id);

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
  renderStatus(status);
  renderBatch(batch);
  renderEventForm(batch.next_event);
  renderDecision(batch.readiness);
  renderProof(proofBundle);
  renderScorecard();
}

function renderStatus(status) {
  $("dualStatus").textContent = status.publicWrites ? "Public writes" : "Local proof";
  $("dualStatus").className = status.publicWrites ? "status-pill blocked" : "status-pill safe";
}

function renderBatch(batch) {
  $("stateChip").textContent = batch.current_state.replaceAll("_", " ");
  $("stateChip").className = "state-chip active";
  $("nextEvent").textContent = `Next: ${batch.next_event.event_type.replaceAll("_", " ")}`;
  $("eventCount").textContent = `${batch.custody_events.length} events`;
  $("batchDetails").innerHTML = detailRows([
    ["Batch", batch.batch_id],
    ["Product", batch.product_family],
    ["Lot", batch.lot],
    ["Serial range", batch.serial_range],
    ["Units", batch.unit_count],
    ["Template", batch.template_id]
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
  $("eventType").innerHTML = ["release_to_wholesaler", "receive_at_pharmacy", "dispense"].map((value) => (
    `<option value="${value}"${value === event.event_type ? " selected" : ""}>${value.replaceAll("_", " ")}</option>`
  )).join("");
  $("receiverId").value = event.receiver_id;
  $("tempMin").value = event.temperature_min_celsius;
  $("tempMax").value = event.temperature_max_celsius;
  $("serialsVerified").checked = event.serials_verified;
  $("transactionInfo").checked = event.transaction_information;
  $("transactionStatement").checked = event.transaction_statement;
  $("patientPii").checked = event.patient_pii_included;
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
    ["MCP", "Read/evaluate/proof only, no write tools"],
    ["Boundary", "No patient PII, no live DUAL writes, no public writes"]
  ].map(([title, detail]) => `<div class="score-item"><span>${title}</span><strong>${detail}</strong></div>`).join("");
}

function shortHash(value) {
  if (!value) return "pending";
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
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
    "The public demo is read-only: no live DUAL writes, no patient PII, no public write tools.",
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
