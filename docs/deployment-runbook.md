# PharmChain Deployment Runbook

## Target

- Repository: `DualOrg/pharmchain-custody-demo`
- Hosting: Vercel
- Mode: hosted live DUAL reviewer demo
- Write posture: public read/evaluate/proof plus operator-gated live DUAL mint/update
- Production URL: `https://pharmchain-custody-demo.vercel.app`
- Production provenance: `https://pharmchain-custody-demo.vercel.app/api/deployment`

## Local Preflight

```bash
npm install
npm run qa
```

On an unrestricted local shell or CI runner:

```bash
npm run proof:network
```

`npm run proof:network` starts the local server and runs strict HTTP smoke plus proof re-derivation with `SMOKE_STRICT_NETWORK=1`.

## Vercel Deployment

```bash
npx --yes vercel@latest deploy --prod --yes
```

No DUAL API key, operator token, patient data, or write credential is required for local proof mode.

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

## Production Acceptance

```bash
DEMO_BASE_URL=https://pharmchain-custody-demo.vercel.app SMOKE_STRICT_NETWORK=1 npm run smoke
DEMO_BASE_URL=https://pharmchain-custody-demo.vercel.app SMOKE_STRICT_NETWORK=1 npm run proof:rederive
curl -s https://pharmchain-custody-demo.vercel.app/api/deployment
```

Acceptance requires:

- UI loads at `/`.
- `/api/dual/status` returns `publicWrites=false`; in live mode it also returns `readbackReady=true`, `writable=true`, and `operatorGateConfigured=true`.
- `/api/batches/evaluate` approves the default pharmacy receipt.
- `/api/batches/evaluate` blocks a cold-chain breach.
- `/api/proof` hashes re-derive locally.
- `/mcp` exposes public read/evaluate/proof tools and operator-gated write tools.
- `/api/deployment` reports the live DUAL template/object IDs without secrets.

## Boundary

Do not add public write endpoints, patient PII, exposed secrets, or ungated live DUAL writes. Live DUAL writes are allowed only through server-side credentials plus the operator token.
