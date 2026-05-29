# PharmChain Deployment Runbook

This runbook covers local validation, Vercel deployment, live DUAL readback, and the operator-gated write boundary for the PharmChain custody demo.

## Target

| Field | Value |
| --- | --- |
| Repository | `DualOrg/pharmchain-custody-demo` |
| Hosting | Vercel |
| Mode | hosted live DUAL reviewer demo |
| Production URL | <https://pharmchain-custody-demo.vercel.app> |
| Provenance | <https://pharmchain-custody-demo.vercel.app/api/deployment> |
| CI command | `npm run proof:network` |
| Public posture | read/evaluate/proof only |
| Write posture | operator-gated live DUAL mint/update |

## Local Preflight

```bash
npm install
npm run check
npm run proof:unit
npm run proof:mcp
npm run qa
```

On an unrestricted local shell or CI runner:

```bash
npm run proof:network
```

`npm run proof:network` starts the local server and runs strict HTTP smoke plus proof re-derivation with `SMOKE_STRICT_NETWORK=1`.

## Environment Modes

| Mode | Required env | Writes | Use case |
| --- | --- | --- | --- |
| Local proof | None | No | Default local dev and safe review. |
| DUAL readback | `DUAL_API_KEY`, `DUAL_PHARMCHAIN_BATCH_OBJECT_ID` | No | Re-derive proof from DUAL object readback. |
| Operator-gated write | Readback env plus `DUAL_PHARMCHAIN_TEMPLATE_ID`, `DUAL_WRITE_MODE=event_bus`, `DEMO_OPERATOR_TOKEN` | Yes, gated | Private live DUAL mint/update proof. |
| Public deployment | Server-side env only | Public writes false | Hosted reviewer surface. |

Live mode requires server-side secrets only:

```bash
DUAL_API_URL
DUAL_API_KEY
DUAL_ORG_ID
DUAL_PHARMCHAIN_TEMPLATE_ID
DUAL_PHARMCHAIN_BATCH_OBJECT_ID
DUAL_WRITE_MODE=event_bus
DEMO_OPERATOR_TOKEN
```

Never commit these values.

## Vercel Deployment

```bash
npx --yes vercel@latest deploy --prod --yes
```

After deployment, validate the production URL rather than only the generated Vercel preview URL.

## Production Acceptance

```bash
DEMO_BASE_URL=https://pharmchain-custody-demo.vercel.app SMOKE_STRICT_NETWORK=1 npm run smoke
DEMO_BASE_URL=https://pharmchain-custody-demo.vercel.app SMOKE_STRICT_NETWORK=1 npm run proof:rederive
curl -s https://pharmchain-custody-demo.vercel.app/api/deployment
curl -s https://pharmchain-custody-demo.vercel.app/api/dual/status
```

Acceptance requires:

- UI loads at `/`.
- `/api/dual/status` returns `publicWrites=false`; in live mode it also returns `readbackReady=true`, `writable=true`, and `operatorGateConfigured=true`.
- `/api/batches/current` returns batch `PHC-GLP1-2026-0004` and no patient PII.
- `/api/batches/evaluate` approves the default next handoff.
- `/api/batches/evaluate` blocks a cold-chain breach.
- `/api/proof` hashes re-derive locally.
- `/mcp` exposes public read/evaluate/proof tools and operator-gated write tools.
- `/mcp` write tools reject missing or wrong operator tokens.
- `/api/deployment` reports live DUAL template/object IDs without secrets.

## Last Verified Production Posture

Verified on 2026-05-29:

| Field | Value |
| --- | --- |
| Version | `0.3.0` |
| Production git SHA | `4a9e2cb9b9658ff2e5bbd5a2a27ff3bc87b64558` |
| DUAL org | `69b935b4187e903f826bbe71` |
| Template id | `6a18253edf473dbc374b828c` |
| Batch object id | `6a182540df473dbc374b828e` |
| Mode | `dual` |
| Readback | `true` |
| Writable | `true` |
| Write mode | `event_bus` |
| Operator gate | `configured` |
| Public writes | `false` |
| Patient PII stored | `false` |

Refresh this table after reseeding DUAL objects, changing Vercel env vars, or redeploying a materially different build.

## Live DUAL Setup

Create or reuse the template/object:

```bash
npm run setup:dual
```

Readback proof:

```bash
DUAL_ENV_FILE=/path/to/private.env DUAL_PHARMCHAIN_TEMPLATE_ID=... DUAL_PHARMCHAIN_BATCH_OBJECT_ID=... npm run proof:dual
```

Operator-gated write proof:

```bash
DUAL_ENV_FILE=/path/to/private.env DUAL_PHARMCHAIN_TEMPLATE_ID=... DUAL_PHARMCHAIN_BATCH_OBJECT_ID=... DEMO_OPERATOR_TOKEN_FILE=/private/tmp/pharmchain-operator-token DUAL_WRITE_MODE=event_bus npm run proof:dual:write
```

Do not run the write proof unless the operator token and target DUAL object are approved for the test.

## Rollback And Safe Mode

If live write posture is not ready:

1. Remove or pause `DEMO_OPERATOR_TOKEN`.
2. Set `DUAL_WRITE_MODE=read_only` or remove the event-bus write mode.
3. Keep `DUAL_API_KEY` and object id only if readback should remain live.
4. Re-run `/api/dual/status`.
5. Confirm `publicWrites=false` and `writable=false`.

The app remains useful in local proof/readback mode as long as public read/evaluate/proof endpoints work and write tools reject tokens correctly.

## Boundary

Do not add public write endpoints, patient PII, exposed secrets, or ungated live DUAL writes. Live DUAL writes are allowed only through server-side credentials plus the operator token.
