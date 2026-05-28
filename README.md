# PharmChain Custody Demo

[![PharmChain CI](https://github.com/DualOrg/pharmchain-custody-demo/actions/workflows/pharmchain-ci.yml/badge.svg)](https://github.com/DualOrg/pharmchain-custody-demo/actions/workflows/pharmchain-ci.yml)

DUAL-native custody ledger demo for one serialized drug family.

The demo is based on the DUAL idea `PharmChain`: manufacturer-to-dispenser custody for a serialized pharmaceutical batch. It shows how DUAL-style object state, lifecycle actions, and proof hashes can make DSCSA-style handoffs auditable without storing patient PII.

## What It Demonstrates

- Batch passport for one serialized product family.
- Lifecycle: `Manufactured -> In_Transit -> At_Pharmacy -> Dispensed`.
- DSCSA gate checks: transaction information, transaction statement, authorized partners, product identifier verification, receiver identity, and cold-chain window.
- Read-only API and MCP surfaces for agents/reviewers.
- Local proof bundle with batch hash, custody root, DSCSA hash, event hash, state hash, and integrity hash.
- Explicit boundary: no live DUAL writes, no public write tools, no patient PII.

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

Expected Vercel routes:

- `/` reviewer UI.
- `/api/dual/status` safety/readiness.
- `/api/batches/current` canonical batch.
- `/api/batches/evaluate` handoff evaluation.
- `/api/proof` local proof bundle.
- `/api/template` DUAL template skeleton.
- `/api/deployment` deployment metadata.
- `/mcp` read-only MCP endpoint.

Production validation:

```bash
DEMO_BASE_URL=https://<vercel-url> SMOKE_STRICT_NETWORK=1 npm run smoke
DEMO_BASE_URL=https://<vercel-url> SMOKE_STRICT_NETWORK=1 npm run proof:rederive
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
- `GET /api/proof` returns the local proof bundle.
- `GET /api/template` returns the DUAL template skeleton.
- `GET /api/deployment` returns deployment metadata and safety posture.
- `GET|POST /mcp` exposes the read-only MCP surface.

Example:

```bash
curl -s http://127.0.0.1:4182/api/batches/current
```

## MCP

Read-only tools:

- `pharmchain_get_status`
- `pharmchain_get_batch`
- `pharmchain_evaluate_handoff`
- `pharmchain_get_proof`

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

The MCP endpoint intentionally exposes no sync, mint, update, execute-action, operator-token, or write tools.

## Reviewer Docs

- `docs/reviewer-pack.md`
- `docs/reviewer-walkthrough.md`
- `docs/deployment-runbook.md`
- `docs/pharmchain-mcp-agent-guide.md`
- `docs/pharmchain-98-rubric.md`

## Safety Boundary

This is a local proof demo. It does not execute live DUAL writes, does not accept operator tokens, and does not store patient PII. A production integration would need scoped server-side DUAL credentials, real DSCSA partner identifiers, authenticated users, audit retention, and legal/regulatory review before write mode.

## 9.8 Quality Bar

The demo should be considered 9.8-ready when:

- the app is runnable locally;
- API and MCP are read-only and tested;
- cold-chain and DSCSA failures are blocked with clear reasons;
- proof hashes re-derive locally;
- UI is responsive with no horizontal overflow;
- docs explain setup, API, MCP, and safety boundaries;
- a Cowork reviewer independently agrees there are no remaining concrete blockers.
