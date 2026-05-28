# PharmChain MCP Agent Guide

## Scope

This MCP surface is for reviewer and agent inspection of the PharmChain hosted reviewer demo running in local-proof/no-write mode. It is read/evaluate/proof only.

## Required Vault Context

Before reviewing or extending this demo, connect to:

`/Users/ibuswell/Documents/DualVault`

Read:

- `AGENTS.md`
- `memory/soul.md`
- `memory/user.md`
- `memory/memory.md`
- `wiki/hot.md`
- `projects/dual/context.md`
- `wiki/concepts/dual-pharmchain.md`

## Endpoint

- Local: `http://127.0.0.1:4182/mcp`
- Alternate route: `http://127.0.0.1:4182/api/mcp`
- Production: `https://pharmchain-custody-demo.vercel.app/mcp`

## Tools

- `pharmchain_get_status` - readiness and safety boundary.
- `pharmchain_get_batch` - current serialized batch and next event.
- `pharmchain_evaluate_handoff` - evaluate a proposed custody handoff without writing.
- `pharmchain_get_proof` - local re-derived proof bundle.

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

## Boundary

The MCP has no sync, mint, update, execute-action, operator-token, or write tool. It must not store patient PII and must not perform live DUAL writes without a separate explicit approval and implementation pass.
