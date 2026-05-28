# PharmChain Deployment Runbook

## Target

- Repository: `DualOrg/pharmchain-custody-demo`
- Hosting: Vercel
- Mode: hosted reviewer demo
- Write posture: read/evaluate/proof only

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

No DUAL API key, operator token, patient data, or write credential is required for this reviewer demo.

## Production Acceptance

```bash
DEMO_BASE_URL=https://<vercel-url> SMOKE_STRICT_NETWORK=1 npm run smoke
DEMO_BASE_URL=https://<vercel-url> SMOKE_STRICT_NETWORK=1 npm run proof:rederive
curl -s https://<vercel-url>/api/deployment
```

Acceptance requires:

- UI loads at `/`.
- `/api/dual/status` returns `publicWrites=false` and `liveDualWrites=false`.
- `/api/batches/evaluate` approves the default pharmacy receipt.
- `/api/batches/evaluate` blocks a cold-chain breach.
- `/api/proof` hashes re-derive locally.
- `/mcp` exposes read/evaluate/proof tools with no write-like tools.
- `/api/deployment` reports `operatorTokenAccepted=false`.

## Boundary

Do not add Vercel secrets, DUAL API keys, operator tokens, public write endpoints, patient PII, or live DUAL writes in this phase.
