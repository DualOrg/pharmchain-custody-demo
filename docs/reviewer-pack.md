# PharmChain Reviewer Pack

## Review Scope

PharmChain is a hosted DUAL-style reviewer demo for one serialized pharmaceutical batch. It runs in local proof mode by default and supports live DUAL readback plus operator-gated event-bus writes when configured.

Production URL: `https://pharmchain-custody-demo.vercel.app`

Source: `https://github.com/DualOrg/pharmchain-custody-demo`

Production provenance: `https://pharmchain-custody-demo.vercel.app/api/deployment`

This review covers:

- local app UX;
- public read/evaluate/proof API;
- MCP read/evaluate/proof tools plus operator-gated write tools;
- DSCSA gate simulation;
- benchmark-style reviewer walkthrough and first-screen demo support;
- hosted reviewer proof re-derivation;
- no-public-write and no-PII boundary.

This review does not cover:

- anonymous/public DUAL writes;
- real DSCSA production compliance;
- integrations with manufacturers, wholesalers, pharmacies, or regulators;
- patient-facing workflows.

## Visual Evidence

Desktop:

![PharmChain desktop reviewer desk](assets/pharmchain-desktop.png)

Mobile:

![PharmChain mobile reviewer desk](assets/pharmchain-mobile.png)

## Acceptance Checks

```bash
npm run check
npm run proof:unit
npm run proof:mcp
npm run proof:network
DEMO_BASE_URL=http://127.0.0.1:4182 npm run smoke
DEMO_BASE_URL=http://127.0.0.1:4182 npm run proof:rederive
DEMO_BASE_URL=https://pharmchain-custody-demo.vercel.app SMOKE_STRICT_NETWORK=1 npm run smoke
DEMO_BASE_URL=https://pharmchain-custody-demo.vercel.app SMOKE_STRICT_NETWORK=1 npm run proof:rederive
```

## Expected Evidence

- `GET /api/dual/status` returns `publicWrites=false`; live mode reports `readbackReady=true`, `writable=true`, and `operatorGateConfigured=true`.
- `GET /api/batches/current` returns batch `PHC-GLP1-2026-0004`.
- Valid next handoff evaluates to `Approved` and advances to the next lifecycle state.
- Temperature breach evaluates to `Blocked`.
- `GET /api/proof` returns local hashes or DUAL-readback-derived hashes.
- `GET /api/deployment` returns the repository, Vercel environment, CI command, and no-write safety posture.
- `npm run proof:rederive` re-computes the proof from source data.
- `/mcp` lists public read/evaluate/proof tools, operator-gated `pharmchain_sync_handoff` and `pharmchain_mint_batch`, and reviewer/write-boundary prompts.

When a local command sandbox refuses `127.0.0.1` despite the server listening, `npm run smoke` and `npm run proof:rederive` use the same route handlers in-process. Set `SMOKE_STRICT_NETWORK=1` to force network-only validation.

CI and hosted-reviewer validation should use `npm run proof:network` or set `SMOKE_STRICT_NETWORK=1` against the deployed URL.

## 9.8 Rubric

| Category | Requirement |
|---|---|
| Product clarity | The demo immediately reads as a pharma custody desk, not a generic dashboard. |
| Demo support | First-screen disclosure, guided walkthrough, and reviewer checklist make the demo runnable without a separate script. |
| DUAL-native model | Template, object state, event lifecycle, and proof hashes are visible. |
| DSCSA fidelity | Handoff checks include transaction info, transaction statement, authorized partners, product identifiers, and receiver identity. |
| Safety | No patient PII, no public writes, no exposed secrets; live writes require operator token. |
| Agent readiness | MCP exposes read/evaluate/proof tools and operator-gated write tools. |
| Verifiability | Proof bundle can be re-derived locally and tamper changes hashes. |
| Usability | Browser UI is responsive and reviewer-friendly. |
| Documentation | README, reviewer pack, MCP guide, and rubric are enough for a new reviewer to run checks. |

## Remaining Production Gaps

- Real partner identity verification.
- Real DSCSA data contracts.
- Production-grade authenticated operator/admin roles.
- Audit retention and compliance/legal review.
