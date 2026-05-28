# PharmChain MCP Agent Guide

## Scope

This MCP surface is for reviewer and agent inspection of the PharmChain hosted reviewer demo. It exposes public read/evaluate/proof tools and operator-gated live DUAL write tools when configured.

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
- `pharmchain_get_proof` - proof bundle re-derived from local state or live DUAL readback.
- `pharmchain_sync_handoff` - operator-gated live DUAL update.
- `pharmchain_mint_batch` - operator-gated live DUAL mint.

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

The MCP write tools require `operator_token` and reject missing or wrong tokens before DUAL is called. The public surface must not store patient PII, expose secrets, or allow anonymous/public live DUAL writes.
