# PharmChain Reviewer Pack

Live app: <https://pharmchain-custody-demo.vercel.app/>

Source: <https://github.com/DualOrg/pharmchain-custody-demo>

Production provenance: <https://pharmchain-custody-demo.vercel.app/api/deployment>

This pack gives a reviewer the minimum evidence needed to judge the hosted PharmChain demo against the DUAL proof/control standard set by the Kraken agent demo.

## Review Scope

PharmChain is a hosted DUAL-style reviewer demo for one serialized pharmaceutical batch. It runs in local proof mode by default and supports live DUAL readback plus operator-gated event-bus writes when configured.

In scope:

- first-screen reviewer UX;
- public read/evaluate/proof API;
- MCP read/evaluate/proof tools;
- operator-gated MCP/API write tools;
- DSCSA-style custody gate simulation;
- live DUAL readback and proof re-derivation;
- no-public-write and no-PII boundary.

Out of scope:

- anonymous or public DUAL writes;
- real DSCSA legal compliance;
- real manufacturer, wholesaler, pharmacy, dispenser, or regulator integrations;
- patient-facing workflows;
- production auth, RBAC, audit retention, uptime, monitoring, and regulatory approval.

## Demo Thesis

The demo shows that a pharma custody workflow can be represented as a governed object with explicit state, event evidence, and verifiable proof hashes.

> PharmChain turns "the batch moved" into "the batch moved through an allowed custody gate, with a proof trail a reviewer can inspect."

The successful handoff matters, but the blocked breach path is equally important: it shows the verifier can refuse unsafe evidence before state advances.

## Current Live Posture

Last verified against production on 2026-05-29.

| Field | Expected value |
| --- | --- |
| Mode | `dual` |
| Readback | `readbackReady=true` |
| Writable | `writable=true` |
| Write mode | `event_bus` |
| Operator gate | `operatorGateConfigured=true` |
| Public writes | `false` |
| Live DUAL writes | `true` |
| Patient PII stored | `false` |
| Template id | `6a18253edf473dbc374b828c` |
| Batch object id | `6a182540df473dbc374b828e` |
| Batch id | `PHC-GLP1-2026-0004` |

Use `/api/deployment` and `/api/dual/status` as the source of truth if the deployment is reseeded.

## Visual Evidence

Desktop:

![PharmChain desktop reviewer desk](assets/pharmchain-desktop.png)

Mobile:

![PharmChain mobile reviewer desk](assets/pharmchain-mobile.png)

## Reviewer Path

1. Open the live app.
2. Confirm the first viewport shows DUAL readback, operator-gated writes, public writes false, and zero PII fields.
3. Inspect the batch passport for `PHC-GLP1-2026-0004`.
4. Click `Verify next gate`; the safe next event should return `Approved`.
5. Click `Simulate breach`; the cold-chain breach should return `Blocked`.
6. Inspect the proof rail for batch, custody, DSCSA, event, state, and integrity hashes.
7. Open `/api/proof` and `/api/deployment`.
8. Open `/mcp`, list tools, and confirm operator-gated write tools reject missing tokens.

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

CI and hosted-reviewer validation should use `npm run proof:network` locally or set `SMOKE_STRICT_NETWORK=1` against the deployed URL.

When a local command sandbox refuses `127.0.0.1` despite the server listening, `npm run smoke` and `npm run proof:rederive` use the same route handlers in-process. Set `SMOKE_STRICT_NETWORK=1` to force network-only validation.

## Expected Evidence

- `GET /api/dual/status` returns `publicWrites=false`; live mode reports `readbackReady=true`, `writable=true`, and `operatorGateConfigured=true`.
- `GET /api/batches/current` returns batch `PHC-GLP1-2026-0004`, product family `GLP-1 cold-chain pen`, lot `GLP1-AU-26-042`, and no patient PII.
- Valid next handoff evaluates to `Approved` and identifies the next lifecycle state.
- Temperature breach evaluates to `Blocked` with a cold-chain reason.
- `GET /api/proof` returns local or DUAL-readback-derived hashes.
- `GET /api/deployment` returns repository, Vercel environment, DUAL mode, and safety posture without secrets.
- `npm run proof:rederive` re-computes the proof from source data.
- `/mcp` lists public read/evaluate/proof tools, operator-gated `pharmchain_sync_handoff` and `pharmchain_mint_batch`, and reviewer/write-boundary prompts.

## Evidence Links

| Evidence | Link |
| --- | --- |
| Live app | <https://pharmchain-custody-demo.vercel.app/> |
| Deployment metadata | <https://pharmchain-custody-demo.vercel.app/api/deployment> |
| DUAL status | <https://pharmchain-custody-demo.vercel.app/api/dual/status> |
| Current batch | <https://pharmchain-custody-demo.vercel.app/api/batches/current> |
| Proof bundle | <https://pharmchain-custody-demo.vercel.app/api/proof> |
| MCP landing | <https://pharmchain-custody-demo.vercel.app/mcp> |
| Demo playbook | [pharmchain-demo-playbook.md](pharmchain-demo-playbook.md) |
| Proof run sheet | [pharmchain-proof-run-sheet.md](pharmchain-proof-run-sheet.md) |

## 9.8 Rubric

| Category | Requirement |
| --- | --- |
| Product clarity | The demo immediately reads as a pharma custody desk, not a generic dashboard. |
| Demo support | First-screen disclosure, guided walkthrough, and reviewer checklist make the demo runnable without a separate script. |
| DUAL-native model | Template, object state, event lifecycle, readback posture, and proof hashes are visible. |
| DSCSA fidelity | Handoff checks include transaction information, transaction statement, authorized partners, product identifiers, receiver identity, cold-chain range, and no patient PII. |
| Safety | No patient PII, no public writes, no exposed secrets; live writes require server-side credentials and operator token. |
| Agent readiness | MCP exposes read/evaluate/proof tools and operator-gated write tools. |
| Verifiability | Proof bundle can be re-derived locally and tamper changes hashes. |
| Usability | Browser UI is responsive and reviewer-friendly. |
| Documentation | README, playbook, proof run sheet, reviewer pack, MCP guide, deployment runbook, and rubric are enough for a new reviewer to run checks. |

## Remaining Production Gaps

- Real partner identity verification.
- Real DSCSA data contracts and retention policies.
- Production-grade authenticated operator/admin roles.
- Audit retention, monitoring, incident response, and legal/regulatory review.
- DUAL Console/data-link rail for template and object inspection from the UI.
