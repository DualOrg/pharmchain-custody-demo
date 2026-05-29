# PharmChain Proof Run Sheet

Live app: <https://pharmchain-custody-demo.vercel.app/>

Purpose: show exactly where PharmChain proof evidence lives across the application, API, MCP surface, and live DUAL readback posture.

This run sheet is for the hosted reviewer surface. It uses a synthetic pharma batch and no patient PII. Live DUAL writes are available only when the top status and `/api/dual/status` show operator-gated write readiness.

## 30-Second Frame

Say this before touching the controls:

> PharmChain is a custody proof demo. The batch is synthetic. The public surface can read, evaluate, and verify. DUAL readback proves the configured batch object exists, and live writes are gated behind an operator token.

Point to the top status chips:

- `DUAL READBACK READY`: production can read the configured DUAL object.
- `OPERATOR-GATED WRITES`: server-side write path exists but requires an operator token.
- `PUBLIC WRITES FALSE`: public users and public MCP clients cannot write.
- `0 PII FIELDS`: the record excludes patient PII.

## Run The Reviewer Path

1. Open <https://pharmchain-custody-demo.vercel.app/>.
2. Confirm the batch passport shows:
   - Batch: `PHC-GLP1-2026-0004`
   - Product family: `GLP-1 cold-chain pen`
   - Lot: `GLP1-AU-26-042`
   - Serial range: `AU042-000001..AU042-000480`
3. Click `Verify next gate`.
4. Call out the decision:
   - result `Approved`;
   - state transition shown by the app;
   - no patient PII.
5. Click `Simulate breach`.
6. Call out the decision:
   - result `Blocked`;
   - cold-chain reason;
   - no DUAL write from the public action.

Presenter line:

> This is the moment the demo becomes more than a screen. The same workflow can prove both allowed and refused custody movement.

## Where To Look In The App

Use the first screen.

1. `Batch Passport`
   - Shows product, lot, serial range, partners, current state, and batch-level identifiers.
2. `Verifier Workflow`
   - Shows the next handoff, approval decision, and breach decision.
3. `Proof Rail`
   - Shows proof hashes and live/local proof posture.
4. `Reviewer Guide`
   - Shows the checklist for a new reviewer.

## API Evidence

Use these routes when someone asks, "Is this machine-readable?"

| Evidence | Link |
| --- | --- |
| Deployment metadata | <https://pharmchain-custody-demo.vercel.app/api/deployment> |
| DUAL status | <https://pharmchain-custody-demo.vercel.app/api/dual/status> |
| Current batch | <https://pharmchain-custody-demo.vercel.app/api/batches/current> |
| Proof bundle | <https://pharmchain-custody-demo.vercel.app/api/proof> |
| MCP landing | <https://pharmchain-custody-demo.vercel.app/mcp> |

Quick commands:

```bash
curl -s https://pharmchain-custody-demo.vercel.app/api/deployment
curl -s https://pharmchain-custody-demo.vercel.app/api/dual/status
curl -s https://pharmchain-custody-demo.vercel.app/api/batches/current
curl -s https://pharmchain-custody-demo.vercel.app/api/proof
```

## Current Production Evidence

Captured from production on 2026-05-29.

| Field | Value |
| --- | --- |
| Version | `0.3.0` |
| Git SHA | `4a9e2cb9b9658ff2e5bbd5a2a27ff3bc87b64558` |
| Mode | `dual` |
| Verifier level | `dual_readback_rederived` |
| DUAL org | `69b935b4187e903f826bbe71` |
| Template id | `6a18253edf473dbc374b828c` |
| Batch object id | `6a182540df473dbc374b828e` |
| Batch id | `PHC-GLP1-2026-0004` |
| Product family | `GLP-1 cold-chain pen` |
| Current state | `At_Pharmacy` |
| Next event | `dispense` |
| Next state | `Dispensed` |
| Public writes | `false` |
| Live DUAL writes | `true` |
| Operator gate | `configured` |
| Patient PII stored | `false` |

If the app is reseeded, refresh this table from `/api/deployment`, `/api/dual/status`, `/api/batches/current`, and `/api/proof`.

## Proof Hashes

Captured from production on 2026-05-29.

| Hash | Value |
| --- | --- |
| Batch hash | `0x85bb613f5a624c746dbb05cbb7bad75391656dbce3e6009b3292373c04e3fde0` |
| Custody root | `0x79f8c5c263c99aaddc79803f936db26d5b62b8240a20c429b81711b066ac3746` |
| DSCSA hash | `0xe9e552979430bc6e663a2bcab6bf6ec99692e9ae11c48d87a940e3063a05b6c1` |
| Event hash | `0x1ba26253976d062ccf317d06089d5d7f7e68db628f7b1dcf7f3f29c34bbd7892` |
| State hash | `0xb03d22942f6d33601b85374b16aaaf3cd7e88b6e9220e286e009a80d7a35d625` |
| Integrity hash | `0xfec958f8a554c74a7e7c60c4d6339ef2509f2babb6b4009b165672a0c2f6c02b` |

Verifier result:

- `result: Approved`
- `source: dual_readback`
- `publicWrites: false`
- `liveDualWrites: true`
- evidence refs include manufacturer release, ASN, cold-chain sensor window, and pharmacy receipt evidence.

## DUAL Readback Story

Say this:

> The app is not only showing local demo data. In production it reads the configured PharmChain batch object from DUAL, re-derives the proof bundle, and still keeps public writes false.

Where to point:

- `/api/dual/status` for mode, readback, writable, public-write, and operator-gate fields.
- `/api/batches/current` for the DUAL readback envelope and object properties.
- `/api/proof` for verifier level and hash set.
- `/api/deployment` for repository, commit, and deployment posture.

## MCP Evidence

List tools:

```bash
curl -s https://pharmchain-custody-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Expected public tools:

- `pharmchain_get_status`
- `pharmchain_get_batch`
- `pharmchain_evaluate_handoff`
- `pharmchain_get_proof`

Expected operator-gated tools:

- `pharmchain_sync_handoff`
- `pharmchain_mint_batch`

Missing-token write test:

```bash
curl -s https://pharmchain-custody-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"pharmchain_sync_handoff","arguments":{}}}'
```

Expected result: JSON-RPC error naming the operator token boundary.

## If Something Is Pending During A Live Demo

Use this wording:

> The public proof path is still valid. If live DUAL write readiness is pending, we treat the demo as readback/local proof only and do not claim a write happened.

Then open:

- DUAL status: <https://pharmchain-custody-demo.vercel.app/api/dual/status>
- Proof bundle: <https://pharmchain-custody-demo.vercel.app/api/proof>
- Deployment metadata: <https://pharmchain-custody-demo.vercel.app/api/deployment>

## Close

End with:

> The proof is the product. PharmChain shows the custody state, the gate decision, the blocked breach, the DUAL readback posture, and the hashes a reviewer can re-run.
