# PharmChain Custody Demo

[![PharmChain CI](https://github.com/DualOrg/pharmchain-custody-demo/actions/workflows/pharmchain-ci.yml/badge.svg)](https://github.com/DualOrg/pharmchain-custody-demo/actions/workflows/pharmchain-ci.yml)

DUAL-native custody ledger demo for one serialized drug family.

The demo is based on the DUAL idea `PharmChain`: manufacturer-to-dispenser custody for a serialized pharmaceutical batch. It shows how DUAL-style object state, lifecycle actions, and proof hashes can make DSCSA-style handoffs auditable without storing patient PII.

## What It Demonstrates

- Batch passport for one serialized product family.
- Lifecycle: `Manufactured -> In_Transit -> At_Pharmacy -> Dispensed`.
- DSCSA gate checks: transaction information, transaction statement, authorized partners, product identifier verification, receiver identity, and cold-chain window.
- Read-only API and MCP surfaces for agents/reviewers.
- Hosted reviewer demo running with local proof by default and live DUAL readback/operator-gated writes when configured.
- Explicit boundary: no public writes, no patient PII, and live DUAL writes require server-side credentials plus an operator token.

## Local Use

```bash
npm install
npm start
```

Open `http://127.0.0.1:4182`.

Validation:

```bash
npm run check
npm run proof:unit
npm run proof:mcp
npm run qa
DEMO_BASE_URL=http://127.0.0.1:4182 npm run smoke
DEMO_BASE_URL=http://127.0.0.1:4182 npm run proof:rederive
npm run proof:network
```

If the local command sandbox cannot connect to `127.0.0.1`, `npm run proof:unit` still verifies the custody rules, blocked paths, proof hashes, and no-write safety boundary directly from the same source module.

`npm run smoke` and `npm run proof:rederive` also fall back to in-process localhost checks only when a localhost connection is refused by the command sandbox. Set `SMOKE_STRICT_NETWORK=1` to require the network path.

CI runs `npm run proof:network`, which starts the server and requires strict HTTP validation with `SMOKE_STRICT_NETWORK=1`.

## Hosted Reviewer Demo

Target repository: `https://github.com/DualOrg/pharmchain-custody-demo`
Production URL: `https://pharmchain-custody-demo.vercel.app`
Production provenance: `https://pharmchain-custody-demo.vercel.app/api/deployment`

The reviewer UI now follows the TradeFlow control-desk benchmark pattern: a compact DUAL header, first-screen demo disclosure, 60-90 second walkthrough strip, batch hero, left passport rail, central verifier workflow, right proof rail, and bottom reviewer checklist.

Reviewer routes:

- `/` reviewer UI.
- `/api/dual/status` safety/readiness.
- `/api/batches/current` canonical batch.
- `/api/batches/evaluate` handoff evaluation.
- `/api/batches/sync` operator-gated live DUAL update.
- `/api/batches/mint` operator-gated live DUAL mint.
- `/api/proof` local proof bundle.
- `/api/template` DUAL template skeleton.
- `/api/deployment` deployment metadata.
- `/mcp` MCP endpoint with public read/evaluate/proof tools and operator-gated write tools.

Production validation:

```bash
DEMO_BASE_URL=https://pharmchain-custody-demo.vercel.app SMOKE_STRICT_NETWORK=1 npm run smoke
DEMO_BASE_URL=https://pharmchain-custody-demo.vercel.app SMOKE_STRICT_NETWORK=1 npm run proof:rederive
```

## Screenshots

Desktop reviewer desk:

![PharmChain desktop reviewer desk](docs/assets/pharmchain-desktop.png)

Mobile reviewer desk:

![PharmChain mobile reviewer desk](docs/assets/pharmchain-mobile.png)

## API

- `GET /api/dual/status` returns readiness and safety state without secrets.
- `GET /api/batches/current` returns the current serialized batch and next suggested event.
- `POST /api/batches/evaluate` evaluates a handoff without writing.
- `POST /api/batches/sync` evaluates and writes an approved handoff to the configured DUAL object. Requires `x-demo-operator-token` or `Authorization: Bearer`.
- `POST /api/batches/mint` mints a PharmChain batch object from the configured DUAL template. Requires `x-demo-operator-token` or `Authorization: Bearer`; refuses duplicate canonical mints unless `force=true`.
- `GET /api/proof` returns the local or DUAL-readback proof bundle.
- `GET /api/template` returns the DUAL template skeleton.
- `GET /api/deployment` returns deployment metadata and safety posture.
- `GET|POST /mcp` exposes public read/evaluate/proof tools and operator-gated write tools.

Example:

```bash
curl -s http://127.0.0.1:4182/api/batches/current
```

## MCP

Public read/evaluate/proof tools:

- `pharmchain_get_status`
- `pharmchain_get_batch`
- `pharmchain_evaluate_handoff`
- `pharmchain_get_proof`

Operator-gated write tools:

- `pharmchain_sync_handoff`
- `pharmchain_mint_batch`

Resources:

- `pharmchain://manifest`
- `pharmchain://status`
- `pharmchain://batch/current`
- `pharmchain://template`
- `pharmchain://proof/current`
- `pharmchain://scorecard`

Prompts:

- `pharmchain_reviewer_check`
- `pharmchain_write_boundary_review`

The MCP write tools require `operator_token` and reject missing or wrong tokens before calling DUAL. They do not make writes public.

## Live DUAL Setup

Live read/write mode uses IanTest by default and requires:

```bash
DUAL_API_URL=...
DUAL_API_KEY=...
DUAL_ORG_ID=69b935b4187e903f826bbe71
DUAL_PHARMCHAIN_TEMPLATE_ID=...
DUAL_PHARMCHAIN_BATCH_OBJECT_ID=...
DUAL_WRITE_MODE=event_bus
DEMO_OPERATOR_TOKEN=...
```

Setup and proof commands:

```bash
npm run setup:dual
DUAL_ENV_FILE=/path/to/private.env DUAL_PHARMCHAIN_TEMPLATE_ID=... DUAL_PHARMCHAIN_BATCH_OBJECT_ID=... npm run proof:dual
DUAL_ENV_FILE=/path/to/private.env DUAL_PHARMCHAIN_TEMPLATE_ID=... DUAL_PHARMCHAIN_BATCH_OBJECT_ID=... DEMO_OPERATOR_TOKEN_FILE=/private/tmp/pharmchain-operator-token DUAL_WRITE_MODE=event_bus npm run proof:dual:write
```

The current live setup created template `6a18253edf473dbc374b828c` and object `6a182540df473dbc374b828e`. The first gated update advanced the object to `At_Pharmacy` and readback matched the expected integrity hash.

## Reviewer Docs

- `docs/reviewer-pack.md`
- `docs/reviewer-walkthrough.md`
- `docs/deployment-runbook.md`
- `docs/pharmchain-mcp-agent-guide.md`
- `docs/pharmchain-98-rubric.md`

## Safety Boundary

This is a hosted reviewer demo with live DUAL readback and operator-gated event-bus writes when configured. It does not expose public writes and does not store patient PII. A production DSCSA integration would still need scoped production credentials, real DSCSA partner identifiers, authenticated users/RBAC, audit retention, monitoring, and legal/regulatory review.

## 9.8 Quality Bar

The demo should be considered 9.8-ready when:

- the app is runnable locally;
- public API/MCP reads are tested and write paths are operator-gated;
- cold-chain and DSCSA failures are blocked with clear reasons;
- proof hashes re-derive locally;
- UI is responsive with no horizontal overflow;
- docs explain setup, API, MCP, live DUAL read/write mode, and safety boundaries;
- a Cowork reviewer independently agrees there are no remaining concrete blockers.
