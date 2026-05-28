# PharmChain 9.8 Rubric

This score applies to the hosted reviewer demo running in local-proof/no-write mode, not a production DSCSA platform.

## 9.8 Requirements

| Area | Pass Condition |
|---|---|
| Product clarity | First screen clearly reads as a pharma custody desk for one serialized drug family. |
| DUAL model | Template, object identity, state machine, lifecycle actions, and proof hashes are visible. |
| DSCSA-style checks | Handoff evaluation checks transaction information, transaction statement, authorized partners, product identifiers, receiver identity, and cold-chain range. |
| Proof | Batch hash, custody root, DSCSA hash, event hash, state hash, and integrity hash re-derive locally. |
| MCP/API | Agent surface supports read, evaluate, proof, resources, and prompts with no write tools. |
| Safety | No live DUAL writes, public writes, operator-token intake, secrets, or patient PII storage. |
| UX | Desktop and mobile layouts are usable, no intentional horizontal overflow, and blocked reasons are clear. |
| Docs | README, reviewer pack, MCP guide, and this rubric are enough for a new reviewer to run or inspect it. |

## Score Boundary

Eligible for `9.8/10` when all checks above pass and Cowork review finds no concrete blocker inside the stated hosted-reviewer/local-proof scope.

Not included in the score:

- real DSCSA legal compliance;
- live DUAL template/object creation;
- real manufacturer, wholesaler, pharmacy, or regulator integrations;
- patient-facing workflows;
- production auth, RBAC, audit retention, uptime, or observability.
