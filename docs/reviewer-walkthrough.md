# PharmChain Reviewer Walkthrough

## Visual Check

Desktop:

![PharmChain desktop reviewer desk](assets/pharmchain-desktop.png)

Mobile:

![PharmChain mobile reviewer desk](assets/pharmchain-mobile.png)

## 60-Second Path

1. Open the hosted app or local `http://127.0.0.1:4182`.
2. Confirm the first screen says `PharmChain Custody Desk`.
3. In `Batch Passport`, confirm batch `PHC-GLP1-2026-0004` and state `In Transit`.
4. In `Custody State Machine`, confirm the lifecycle is `Manufactured -> In Transit -> At Pharmacy -> Dispensed`.
5. In `Event Intake`, click `Evaluate handoff`; the valid pharmacy receipt should be `Approved`.
6. Click `Simulate breach`; the decision should switch to `Blocked` with a cold-chain reason.
7. In `Proof Rail`, confirm hash fields are visible and the surface says `No public writes`.
8. Open `/mcp`; confirm it lists read-only tools/resources/prompts and no sync/mint/update/write tool.
9. Open `/api/deployment`; confirm `publicWrites=false`, `liveDualWrites=false`, and `operatorTokenAccepted=false`.

## What Good Looks Like

- The UI reads as a pharma custody desk, not a generic dashboard.
- The proof rail makes object state and evidence hashes inspectable.
- Invalid cold-chain evidence is blocked with a human-readable reason.
- The API/MCP surface is reviewer- and agent-readable without exposing write capability.

## Known Scope Boundary

This is a hosted reviewer demo. It is not a production DSCSA compliance system, does not create a live DUAL object, does not store patient PII, and does not integrate with real manufacturers, wholesalers, pharmacies, or regulators.
