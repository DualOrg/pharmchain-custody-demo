# PharmChain MCP Agent Guide

This guide is for reviewer agents and developer tools that inspect the PharmChain hosted reviewer demo through MCP.

The boundary is deliberate: public MCP clients can read, evaluate, and verify proof. Live DUAL writes exist only as operator-gated tools and must reject missing or wrong operator tokens before calling DUAL.

## Required Vault Context

Before reviewing or extending this demo, connect to the project vault:

`/Users/ibuswell/Documents/DualVault`

Read:

- `AGENTS.md`
- `memory/soul.md`
- `memory/user.md`
- `memory/memory.md`
- `wiki/hot.md`
- `projects/dual/context.md`
- `wiki/concepts/dual-pharmchain.md`

## Endpoints

| Mode | Endpoint |
| --- | --- |
| Local | `http://127.0.0.1:4182/mcp` |
| Local alternate | `http://127.0.0.1:4182/api/mcp` |
| Production | `https://pharmchain-custody-demo.vercel.app/mcp` |
| Production alternate | `https://pharmchain-custody-demo.vercel.app/api/mcp` |

`GET /mcp` returns a landing manifest. `POST /mcp` accepts JSON-RPC style MCP calls.

## Quick Start

Initialize:

```bash
curl -s https://pharmchain-custody-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

List tools:

```bash
curl -s https://pharmchain-custody-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Evaluate the default next handoff without writing:

```bash
curl -s https://pharmchain-custody-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"pharmchain_evaluate_handoff","arguments":{}}}'
```

Fetch proof:

```bash
curl -s https://pharmchain-custody-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"pharmchain_get_proof","arguments":{}}}'
```

## Tools

| Tool | Public | Writes | Purpose |
| --- | --- | --- | --- |
| `pharmchain_get_status` | Yes | No | Read readiness, live-DUAL posture, and safety boundary. |
| `pharmchain_get_batch` | Yes | No | Read the current serialized batch, next event, and DUAL readback envelope. |
| `pharmchain_evaluate_handoff` | Yes | No | Evaluate a proposed custody handoff without writing. |
| `pharmchain_get_proof` | Yes | No | Return the proof bundle re-derived from local state or live DUAL readback. |
| `pharmchain_sync_handoff` | No | Yes | Operator-gated live DUAL update for an approved handoff. |
| `pharmchain_mint_batch` | No | Yes | Operator-gated live DUAL mint; refuses duplicate canonical mints unless `force=true`. |

## Resources

- `pharmchain://manifest`
- `pharmchain://status`
- `pharmchain://batch/current`
- `pharmchain://template`
- `pharmchain://proof/current`
- `pharmchain://scorecard`

## Prompts

- `pharmchain_reviewer_check`
- `pharmchain_write_boundary_review`

Use `pharmchain_write_boundary_review` when the reviewer needs a direct audit of whether public clients can write.

## Write Boundary Test

This call should be rejected unless a valid operator token is supplied:

```bash
curl -s https://pharmchain-custody-demo.vercel.app/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"pharmchain_sync_handoff","arguments":{}}}'
```

Expected result:

- JSON-RPC response is returned.
- Response contains an error.
- Error message names the operator token boundary.
- No DUAL write is attempted.

Approved private operator calls must supply an operator token through the approved server-side/private path. Do not put tokens in shared transcripts, browser screenshots, repo files, DUAL objects, or docs.

## Expected Read Results

Production status should include:

- `publicWrites=false`
- `liveDualWrites=true`
- `readbackReady=true`
- `operatorGateConfigured=true`
- `writeExecutionExposed=operator_gated`
- `safety.patientPiiStored=false`

The batch response should identify:

- batch `PHC-GLP1-2026-0004`;
- product family `GLP-1 cold-chain pen`;
- no patient PII;
- DSCSA-style checks;
- current custody state;
- next suggested event;
- proof hashes and DUAL readback envelope when configured.

## Agent Review Checklist

An MCP reviewer should report:

- which endpoint was used;
- which vault files were read before review;
- tool list and resource list;
- status posture, including public-write and operator-gate fields;
- default handoff result;
- breach-path result if tested through the API or UI;
- proof verifier level and hash set;
- whether write tools rejected missing token;
- any residual production gaps.

## Boundary

The MCP write tools require `operator_token` and reject missing or wrong tokens before DUAL is called. The public surface must not store patient PII, expose secrets, or allow anonymous/public live DUAL writes.
