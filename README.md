# PharmChain Custody Desk

[![PharmChain CI](https://github.com/DualOrg/pharmchain-custody-demo/actions/workflows/pharmchain-ci.yml/badge.svg)](https://github.com/DualOrg/pharmchain-custody-demo/actions/workflows/pharmchain-ci.yml)

DUAL-native custody proof demo for one serialized pharmaceutical batch.

PharmChain shows how a serialized GLP-1 cold-chain batch can move from manufacturer to dispenser with DSCSA-style checks, explicit custody state, proof hashes, DUAL readback, and operator-gated live writes.

Short version:

> PharmChain tracks custody. DUAL verifies, gates, records, and proves.

This is a hosted reviewer demo, not a production DSCSA compliance system. It stores no patient PII, exposes no public write path, and only performs live DUAL writes when server-side credentials and an operator token are configured.

## Live Demo

Production app: <https://pharmchain-custody-demo.vercel.app/>

Production provenance: <https://pharmchain-custody-demo.vercel.app/api/deployment>

What to look for on the first screen:

- `DUAL READBACK READY`: the app can read the configured DUAL batch object.
- `OPERATOR-GATED WRITES`: live mint/update calls require a server-side operator token.
- `PUBLIC WRITES FALSE`: public users and public MCP clients cannot write to DUAL.
- `0 PII FIELDS`: patient PII is explicitly outside the record.
- `BATCH PASSPORT`: one serialized GLP-1 cold-chain batch, lot, serial range, partners, and state.
- `VERIFIER WORKFLOW`: a valid next handoff is approved; a cold-chain breach is blocked.
- `PROOF RAIL`: batch, custody, DSCSA, event, state, and integrity hashes are inspectable.
- `REVIEWER GUIDE`: the UI includes a first-screen walkthrough and checklist.

Documentation:

- [Demo playbook](docs/pharmchain-demo-playbook.md)
- [Proof run sheet](docs/pharmchain-proof-run-sheet.md)
- [Reviewer pack](docs/reviewer-pack.md)
- [Reviewer walkthrough](docs/reviewer-walkthrough.md)
- [MCP agent guide](docs/pharmchain-mcp-agent-guide.md)
- [Deployment runbook](docs/deployment-runbook.md)
- [9.8 rubric](docs/pharmchain-98-rubric.md)

## New User Paths

| User | Start here | Credentials needed | Expected result |
| --- | --- | --- | --- |
| Live demo viewer | Open the production app | None | Inspect the custody desk, approve the safe next gate, simulate a breach, and view proof hashes. |
| Technical reviewer | Read the playbook and run sheet | None for public reads | Validate UI, API, proof re-derivation, MCP read tools, and write-boundary rejection. |
| Local developer | Run the local quick start | None | Same demo in local proof mode with deterministic hashes and no DUAL writes. |
| MCP/agent client | Use `/mcp` or `/api/mcp` | None for read/evaluate/proof | List resources, evaluate handoffs, fetch proof, and confirm write tools reject missing tokens. |
| DUAL operator | Use live setup commands | Scoped DUAL API key and operator token | Mint or update the configured DUAL batch object through the gated event-bus path. |
| Production DSCSA team | Read the safety boundary first | Not supported by this demo | Identify the gap to real partner identity, RBAC, retention, monitoring, and regulatory review. |

## Requirements

- Node.js 18 or newer.
- npm.
- Network access only if you want to install dependencies, call the deployed app, or configure live DUAL read/write mode.

No DUAL API key, operator token, patient data, manufacturer credential, pharmacy credential, or regulator account is required for local proof mode.

## Quick Start: Local Reviewer Demo

```bash
npm install
npm start
```

Open <http://127.0.0.1:4182>.

Run the default quality checks:

```bash
npm run check
npm run proof:unit
npm run proof:mcp
npm run qa
DEMO_BASE_URL=http://127.0.0.1:4182 npm run smoke
DEMO_BASE_URL=http://127.0.0.1:4182 npm run proof:rederive
npm run proof:network
```

`npm run proof:network` starts the local server and requires strict HTTP validation with `SMOKE_STRICT_NETWORK=1`.

If a command sandbox refuses `127.0.0.1` even though the local server is listening, `npm run smoke` and `npm run proof:rederive` fall back to the same route handlers in-process. Set `SMOKE_STRICT_NETWORK=1` to require the network path.

## First Run Walkthrough

1. Open the app and confirm the top status chips show DUAL readback, operator-gated writes, public writes false, and zero PII fields.
2. Read the batch hero: batch `PHC-GLP1-2026-0004`, product family `GLP-1 cold-chain pen`, lot `GLP1-AU-26-042`, and serial range `AU042-000001..AU042-000480`.
3. Use `Verify next gate`. The normal next handoff should return `Approved`.
4. Use `Simulate breach`. The cold-chain breach should return `Blocked` with a readable reason.
5. Inspect the `Proof Rail`: batch hash, custody root, DSCSA hash, event hash, state hash, and integrity hash.
6. Open `/api/deployment`. Confirm the repository, Vercel commit, DUAL posture, and safety boundary are present without secrets.
7. Open `/mcp`. Confirm public tools are read/evaluate/proof only and write tools are labelled operator-gated.

Presenter line:

> The useful part is not only that the pharmacy receipt can pass. The useful part is that the same surface can show why it passed, why a breach fails, and whether the proof was read back from DUAL.

## Hosted Reviewer Demo

Target repository: <https://github.com/DualOrg/pharmchain-custody-demo>

Production URL: <https://pharmchain-custody-demo.vercel.app>

Production provenance: <https://pharmchain-custody-demo.vercel.app/api/deployment>

The hosted UI follows the TradeFlow/Kraken control-desk pattern: compact DUAL header, first-screen demo disclosure, 60-90 second walkthrough strip, batch passport, central verifier workflow, right proof rail, and bottom reviewer checklist.

Current live posture, last verified on 2026-05-29:

| Field | Value |
| --- | --- |
| Scope | `hosted-live-dual-reviewer-demo` |
| Mode | `dual` |
| DUAL org | `69b935b4187e903f826bbe71` |
| Template | `io.dual.pharmchain.batch.v1` |
| Template id | `6a18253edf473dbc374b828c` |
| Batch object id | `6a182540df473dbc374b828e` |
| Readback | `readbackReady=true` |
| Live writes | `writable=true`, `writeMode=event_bus` |
| Public writes | `false` |
| Operator gate | `operatorGateConfigured=true` |
| Patient PII stored | `false` |

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

## Modes

### Local Proof Mode

Default local mode. The demo uses deterministic local data, evaluates custody transitions, produces proof hashes, and exposes API/MCP read surfaces without any DUAL API key.

### Live DUAL Readback Mode

When `DUAL_API_KEY` and `DUAL_PHARMCHAIN_BATCH_OBJECT_ID` are configured, the app reads the configured DUAL object and re-derives the proof bundle from readback data. This is the production reviewer posture.

### Operator-Gated Write Mode

When DUAL readback, template id, object id, `DUAL_WRITE_MODE=event_bus`, and `DEMO_OPERATOR_TOKEN` are configured, the server can mint or update the DUAL object through the event-bus path. Public users still cannot write.

### Public Deployment Mode

The Vercel deployment is safe for public review: read/evaluate/proof endpoints are public, write tools exist only behind the operator token, and no secret is sent to the browser.

## API Quick Checks

```bash
curl http://127.0.0.1:4182/api/dual/status
curl http://127.0.0.1:4182/api/batches/current
curl http://127.0.0.1:4182/api/proof
curl http://127.0.0.1:4182/api/deployment
```

Useful endpoints:

```text
GET  /api/dual/status
GET  /api/batches/current
POST /api/batches/evaluate
POST /api/batches/sync
POST /api/batches/mint
GET  /api/proof
GET  /api/template
GET  /api/deployment
GET  /mcp
POST /mcp
GET  /api/mcp
POST /api/mcp
```

`/api/proof` returns a portable proof bundle with verifier level, source, write boundary, DUAL ids, batch state, next event, next state, decision result, evidence refs, and the hash set needed for local re-derivation.

`/api/batches/current` returns the canonical serialized batch, partner metadata, DSCSA checks, current state, next suggested event, DUAL readback envelope, and readiness decision.

`/api/deployment` returns repository, environment, commit, DUAL readiness, write posture, and safety posture without exposing secrets.

## MCP Quick Start

`POST /mcp` is a JSON-RPC MCP facade for agent clients. Public tools are read/evaluate/proof only. Live write tools reject missing or wrong operator tokens before calling DUAL.

Initialize:

```bash
curl -s http://127.0.0.1:4182/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

List tools:

```bash
curl -s http://127.0.0.1:4182/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Evaluate the default safe next handoff:

```bash
curl -s http://127.0.0.1:4182/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"pharmchain_evaluate_handoff","arguments":{}}}'
```

Available MCP tools:

- `pharmchain_get_status`
- `pharmchain_get_batch`
- `pharmchain_evaluate_handoff`
- `pharmchain_get_proof`
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

## DUAL Object Model

The demo uses a DUAL-shaped object named `pharmchain_batch`.

Core fields:

- `batch_id`: `PHC-GLP1-2026-0004`
- `product_family`: `GLP-1 cold-chain pen`
- `lot`: `GLP1-AU-26-042`
- `serial_range`: `AU042-000001..AU042-000480`
- `unit_count`: `480`
- `current_state`: `Manufactured`, `In_Transit`, `At_Pharmacy`, or `Dispensed`
- `patient_pii_stored`: `false`
- `policy_version`: `1`

Every custody action produces or preserves evidence hashes:

- `batch_hash`
- `custody_root`
- `dscsa_hash`
- `event_hash`
- `state_hash`
- `integrity_hash`
- per-event `hash`

DSCSA-style checks include transaction information, transaction statement, transaction history, authorized trading partners, product identifier verification, receiver identity, cold-chain range, and patient-PII exclusion.

## Live DUAL Setup

Live read/write mode uses IanTest by default and requires server-side environment variables only:

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

Last verified live ids:

- Template id: `6a18253edf473dbc374b828c`
- Batch object id: `6a182540df473dbc374b828e`
- First gated update advanced the object to `At_Pharmacy` and readback matched the expected integrity hash.

## Safety Rules

- Public review is read/evaluate/proof by default.
- No patient PII is stored in the demo record.
- No DUAL API key or operator token is required for local proof mode.
- No secret should be placed in browser code, DUAL objects, screenshots, logs, docs, or commits.
- Live DUAL writes are only allowed through server-side credentials plus `DEMO_OPERATOR_TOKEN`.
- MCP write tools must reject missing or wrong operator tokens before calling DUAL.
- Production DSCSA use is out of scope until real partner identity, RBAC, retention, monitoring, regulatory review, and least-privilege operational controls exist.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Port `4182` is busy | Another local server is running. | Start with `PORT=4183 npm start`. |
| UI shows local proof mode | DUAL readback env vars are missing. | Configure server-side DUAL env vars only if you need live readback. |
| `/api/dual/status` says `writable=false` | Missing template id, object id, event-bus mode, operator token, or API key. | Check `missing` in `/api/dual/status`. |
| MCP write call is rejected | Missing or wrong operator token. | This is expected for public clients; use an approved operator token only for private proof. |
| Network smoke fails locally | Sandbox cannot reach `127.0.0.1`. | Use `npm run proof:unit`, or rerun with an unrestricted shell; use `SMOKE_STRICT_NETWORK=1` in CI. |
| Hash re-derivation fails | Source batch data or proof serialization changed. | Re-run `npm run proof:unit` and inspect `src/pharmchain.mjs`. |

## Support and Contributing

This is a public demo repo under `DualOrg`.

- Issues: <https://github.com/DualOrg/pharmchain-custody-demo/issues>
- Repository: <https://github.com/DualOrg/pharmchain-custody-demo>
- License: see [LICENSE](LICENSE)

## Build Roadmap

1. Add a read-only DUAL Console/data-link rail for template and object inspection.
2. Add exportable reviewer proof bundle.
3. Add multi-batch scenarios across manufacturer, wholesaler, pharmacy, and recall workflows.
4. Add durable audit storage if the demo becomes more than a public reviewer surface.
5. Add production DSCSA controls only after partner identity, RBAC, retention, monitoring, and regulatory review are defined.
