export function getDeploymentInfo() {
  return {
    name: "dual-pharmchain-custody-demo",
    version: "0.2.0",
    scope: "hosted-reviewer-demo",
    repository: "https://github.com/DualOrg/pharmchain-custody-demo",
    demo_path: "sandbox/pharmchain-custody-demo",
    project_vault: "/Users/ibuswell/Documents/DualVault",
    ci_command: "npm run proof:network",
    qa_command: "npm run qa",
    safety: {
      publicWrites: false,
      liveDualWrites: false,
      patientPiiStored: false,
      operatorTokenAccepted: false
    },
    vercel: {
      url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      environment: process.env.VERCEL_ENV || "local"
    }
  };
}
