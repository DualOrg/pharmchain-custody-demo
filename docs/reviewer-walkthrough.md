# PharmChain Reviewer Walkthrough

## Visual Check

Desktop:

![PharmChain desktop reviewer desk](assets/pharmchain-desktop.png)

Mobile:

![PharmChain mobile reviewer desk](assets/pharmchain-mobile.png)

## 60-Second Path

1. Open the hosted app or local `http://127.0.0.1:4182`.
2. Confirm the first screen says `PharmChain Custody Desk`, shows the DUAL brand, and presents the synthetic-batch/live-proof disclosure.
3. Use `Reviewer mode` or the walkthrough preview to expose the bottom checklist.
4. In `Batch Passport`, confirm batch `PHC-GLP1-2026-0004` and state `In Transit`.
5. In the central batch hero and `Custody State Machine`, confirm the next gate is `receive at pharmacy`.
6. Click `Verify next gate`; the valid pharmacy receipt should be `Approved`.
7. Click `Simulate breach`; the decision should switch to `Blocked` with a cold-chain reason.
8. In `Proof Rail`, confirm hash fields are visible and the surface says `No public writes` or `Operator-gated writes`.
9. Open `/mcp`; confirm it lists public read/evaluate/proof tools and operator-gated sync/mint tools.
10. Open `/api/deployment`; confirm `publicWrites=false` and no secrets are present.

## What Good Looks Like

- The UI reads as a pharma custody desk, not a generic dashboard.
- The first viewport gives a reviewer enough guidance to demo the product without a separate script.
- The proof rail makes object state and evidence hashes inspectable.
- Invalid cold-chain evidence is blocked with a human-readable reason.
- The API/MCP surface is reviewer- and agent-readable; live writes are operator-gated, not public.

## Known Scope Boundary

This is a hosted reviewer demo. It is not a production DSCSA compliance system, does not store patient PII, and does not integrate with real manufacturers, wholesalers, pharmacies, or regulators.
