import { readiness } from "./dual-live.mjs";

export function getDeploymentInfo() {
  const status = readiness();
  return {
    name: "dual-pharmchain-custody-demo",
    version: "0.3.0",
    scope: "hosted-live-dual-reviewer-demo",
    repository: "https://github.com/DualOrg/pharmchain-custody-demo",
    demo_path: "sandbox/pharmchain-custody-demo",
    project_vault: "DualVault",
    ci_command: "npm run proof:network",
    qa_command: "npm run qa",
    dual: {
      orgId: status.orgId,
      templateName: status.templateName,
      templateId: status.templateId,
      objectId: status.objectId,
      mode: status.mode,
      readbackReady: status.readbackReady,
      writable: status.writable,
      writeMode: status.writeMode,
      operatorGateConfigured: status.operatorGateConfigured
    },
    safety: {
      publicWrites: false,
      liveDualWrites: status.writable,
      patientPiiStored: false,
      operatorTokenAccepted: status.operatorGateConfigured
    },
    vercel: {
      url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      environment: process.env.VERCEL_ENV || "local"
    }
  };
}
