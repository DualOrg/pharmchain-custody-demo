# PharmChain 9.8 Rubric

This score applies to the hosted reviewer demo with live DUAL readback and operator-gated writes when configured, not a production DSCSA platform.

## 9.8 Requirements

| Area | Pass Condition |
|---|---|
| Product clarity | First screen clearly reads as a pharma custody desk for one serialized drug family. |
| DUAL model | Template, object identity, state machine, lifecycle actions, and proof hashes are visible. |
| DSCSA-style checks | Handoff evaluation checks transaction information, transaction statement, authorized partners, product identifiers, receiver identity, and cold-chain range. |
| Proof | Batch hash, custody root, DSCSA hash, event hash, state hash, and integrity hash re-derive locally. |
| MCP/API | Agent surface supports public read, evaluate, proof, resources, prompts, and operator-gated write tools. |
| Safety | No public writes, exposed secrets, or patient PII storage; live writes require server-side credentials and operator token. |
| UX | Desktop and mobile layouts are usable, no intentional horizontal overflow, and blocked reasons are clear. |
| Docs | README, reviewer pack, MCP guide, and this rubric are enough for a new reviewer to run or inspect it. |

## Score Boundary

Eligible for `9.8/10` when all checks above pass and Cowork review finds no concrete blocker inside the stated hosted live-DUAL reviewer scope.

Not included in the score:

- real DSCSA legal compliance;
- production-grade DUAL deployment/RBAC;
- real manufacturer, wholesaler, pharmacy, or regulator integrations;
- patient-facing workflows;
- production auth, RBAC, audit retention, uptime, or observability.
