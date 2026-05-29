# PharmChain 9.8 Rubric

This score applies to the hosted reviewer demo with live DUAL readback and operator-gated writes when configured. It does not score a production DSCSA platform.

## Score Thesis

PharmChain is 9.8-ready only if a new reviewer can open the app, understand the custody story, prove the DUAL boundary, run the machine checks, and see unsafe evidence blocked without needing private context.

## 9.8 Requirements

| Area | Pass condition |
| --- | --- |
| Product clarity | First screen clearly reads as a pharma custody desk for one serialized drug family. |
| Demo support | README, playbook, proof run sheet, reviewer walkthrough, and UI checklist make the demo runnable without a separate briefing. |
| DUAL model | Template, object identity, state machine, lifecycle actions, readback posture, and proof hashes are visible. |
| DSCSA-style checks | Handoff evaluation checks transaction information, transaction statement, transaction history, authorized partners, product identifiers, receiver identity, cold-chain range, and patient-PII exclusion. |
| Proof | Batch hash, custody root, DSCSA hash, event hash, state hash, and integrity hash re-derive locally from the same source data. |
| MCP/API | Agent surface supports public read, evaluate, proof, resources, prompts, and operator-gated write tools. |
| Safety | No public writes, exposed secrets, or patient PII storage; live writes require server-side credentials and operator token. |
| UX | Desktop and mobile layouts are usable, no intentional horizontal overflow, and blocked reasons are clear. |
| Docs | Documentation covers local use, production URL, API, MCP, live DUAL setup, deployment, proof evidence, and safety boundaries. |
| Review independence | For a claimed 9.8 gate, Codex and external Claude Cowork via Computer Use both score at least 9.8 under the DUALVAULT process. |

## Evidence Required

- `npm run check`
- `npm run proof:unit`
- `npm run proof:mcp`
- `npm run proof:network` or equivalent strict network smoke/rederive
- production `SMOKE_STRICT_NETWORK=1` smoke
- production `SMOKE_STRICT_NETWORK=1` proof re-derivation
- `/api/deployment` showing repository, commit, DUAL posture, and safety posture
- `/api/dual/status` showing public writes false and operator-gate posture
- MCP missing-token write rejection

## Score Boundary

Eligible for `9.8/10` when all checks above pass and Cowork review finds no concrete blocker inside the stated hosted live-DUAL reviewer scope.

Not included in the score:

- real DSCSA legal compliance;
- production-grade DUAL deployment/RBAC;
- real manufacturer, wholesaler, pharmacy, dispenser, or regulator integrations;
- patient-facing workflows;
- production auth, RBAC, audit retention, uptime, or observability.

## Automatic Downgrades

| Issue | Maximum score until fixed |
| --- | ---: |
| Public write path exists without operator token | 6.5 |
| Patient PII stored or displayed | 6.5 |
| Proof hashes cannot be re-derived | 8.0 |
| MCP write tools do not reject missing token | 8.0 |
| UI does not expose blocked breach path | 8.5 |
| README lacks live demo, safety, and validation path | 8.5 |
| Production deployment differs from documented posture | 9.0 |
