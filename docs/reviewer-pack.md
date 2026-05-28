# PharmChain Reviewer Pack

## Review Scope

PharmChain is a DUAL-style proof demo for one serialized pharmaceutical batch.

This review covers:

- local app UX;
- read-only API;
- read-only MCP;
- DSCSA gate simulation;
- local proof re-derivation;
- no-live-write and no-PII boundary.

This review does not cover:

- live DUAL writes;
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
```

## Expected Evidence

- `GET /api/dual/status` returns `publicWrites=false` and `liveDualWrites=false`.
- `GET /api/batches/current` returns batch `PHC-GLP1-2026-0004`.
- Valid pharmacy receipt evaluates to `Approved` and moves to `At_Pharmacy`.
- Temperature breach evaluates to `Blocked`.
- `GET /api/proof` returns local hashes.
- `GET /api/deployment` returns the repository, Vercel environment, CI command, and no-write safety posture.
- `npm run proof:rederive` re-computes the proof from source data.
- `/mcp` lists no write-like tools and exposes reviewer/write-boundary prompts.

When a local command sandbox refuses `127.0.0.1` despite the server listening, `npm run smoke` and `npm run proof:rederive` use the same route handlers in-process. Set `SMOKE_STRICT_NETWORK=1` to force network-only validation.

CI and hosted-reviewer validation should use `npm run proof:network` or set `SMOKE_STRICT_NETWORK=1` against the deployed URL.

## 9.8 Rubric

| Category | Requirement |
|---|---|
| Product clarity | The demo immediately reads as a pharma custody desk, not a generic dashboard. |
| DUAL-native model | Template, object state, event lifecycle, and proof hashes are visible. |
| DSCSA fidelity | Handoff checks include transaction info, transaction statement, authorized partners, product identifiers, and receiver identity. |
| Safety | No patient PII, no public writes, no live DUAL writes, no secrets. |
| Agent readiness | MCP exposes read/evaluate/proof tools with no write tools. |
| Verifiability | Proof bundle can be re-derived locally and tamper changes hashes. |
| Usability | Browser UI is responsive and reviewer-friendly. |
| Documentation | README, reviewer pack, MCP guide, and rubric are enough for a new reviewer to run checks. |

## Remaining Production Gaps

- Real partner identity verification.
- Real DSCSA data contracts.
- Live DUAL template/object creation after explicit approval.
- Authenticated operator/admin roles.
- Audit retention and compliance/legal review.
