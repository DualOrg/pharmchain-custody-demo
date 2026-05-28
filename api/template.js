import { template } from "../src/pharmchain.mjs";
import { readiness } from "../src/dual-live.mjs";

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }
  const status = readiness();
  response.status(200).json({
    ...template,
    id: status.templateId,
    org_id: status.orgId,
    safety: {
      ...template.safety,
      live_dual_writes: status.writable ? "operator_gated" : "not_configured",
      public_write_tools: false,
      patient_pii_stored: false
    }
  });
}
