import assert from "node:assert/strict";
import {
  dualConfig,
  networkMigrationPreflight,
  readiness
} from "../src/dual-live.mjs";

const ENV_KEYS = [
  "DUAL_NETWORK",
  "PHARMCHAIN_DUAL_NETWORK",
  "PHARMCHAIN_MAINNET_CUTOVER_CONFIRMED",
  "DUAL_MAINNET_CUTOVER_CONFIRMED",
  "DUAL_API_URL",
  "DUAL_API_KEY",
  "DUAL_ORG_ID",
  "DUAL_PHARMCHAIN_TEMPLATE_ID",
  "DUAL_PHARMCHAIN_BATCH_OBJECT_ID",
  "DUAL_WRITE_MODE",
  "DUAL_PERSISTENCE_MODE",
  "DEMO_OPERATOR_TOKEN",
  "DUAL_EVENTBUS_PATH"
];

function withEnv(overrides, fn) {
  const snapshot = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== null) process.env[key] = String(value);
  }
  try {
    return fn();
  } finally {
    for (const key of ENV_KEYS) delete process.env[key];
    for (const [key, value] of snapshot.entries()) {
      if (value !== undefined) process.env[key] = value;
    }
  }
}

function runCheck(name, fn) {
  const result = fn();
  return { name, passed: true, ...result };
}

const checks = [];

checks.push(runCheck("default_testnet_mode_is_not_a_mainnet_claim", () => withEnv({}, () => {
  const config = dualConfig();
  const preflight = networkMigrationPreflight(config);
  const status = readiness();
  assert.equal(preflight.ready, true);
  assert.equal(preflight.target_network, "testnet");
  assert.equal(preflight.mainnet_requested, false);
  assert.equal(preflight.api_url_kind, "testnet_api");
  assert.equal(status.readbackReady, false);
  assert.equal(status.writable, false);
  assert.equal(status.publicWrites, false);
  return { preflight, readiness: status };
})));

checks.push(runCheck("mainnet_mode_with_default_testnet_api_fails_closed", () => withEnv({
  DUAL_NETWORK: "mainnet",
  DUAL_API_KEY: "dummy-key",
  DUAL_PHARMCHAIN_TEMPLATE_ID: "dummy-template",
  DUAL_PHARMCHAIN_BATCH_OBJECT_ID: "dummy-object",
  DEMO_OPERATOR_TOKEN: "dummy-token",
  DUAL_WRITE_MODE: "event_bus",
  DUAL_PERSISTENCE_MODE: "dual"
}, () => {
  const config = dualConfig();
  const preflight = networkMigrationPreflight(config);
  const status = readiness();
  assert.equal(preflight.ready, false);
  assert.equal(preflight.mainnet_requested, true);
  assert.equal(preflight.read_allowed, false);
  assert.equal(preflight.write_allowed, false);
  assert.equal(preflight.api_url_kind, "testnet_api");
  assert.equal(status.readbackReady, false);
  assert.equal(status.writable, false);
  assert.equal(status.liveDualWrites, false);
  assert(preflight.missing.includes("PHARMCHAIN_MAINNET_CUTOVER_CONFIRMED=true"));
  assert(preflight.missing.includes("DUAL_API_URL=mainnet_api_base"));
  assert(preflight.missing.includes("DUAL_API_URL_not_testnet_or_legacy"));
  return { preflight, readiness: status };
})));

checks.push(runCheck("mainnet_mode_with_explicit_non_testnet_api_passes_preflight_only", () => withEnv({
  DUAL_NETWORK: "mainnet",
  PHARMCHAIN_MAINNET_CUTOVER_CONFIRMED: "true",
  DUAL_API_URL: "https://pharmchain-mainnet-api.example.invalid"
}, () => {
  const config = dualConfig();
  const preflight = networkMigrationPreflight(config);
  const status = readiness();
  assert.equal(preflight.ready, true);
  assert.equal(preflight.mainnet_requested, true);
  assert.equal(preflight.read_allowed, true);
  assert.equal(preflight.write_allowed, true);
  assert.equal(preflight.api_url_kind, "custom");
  assert.equal(status.readbackReady, false);
  assert.equal(status.writable, false);
  assert.equal(status.liveDualWrites, false);
  assert(status.missing.includes("DUAL_API_KEY"));
  return { preflight, readiness: status };
})));

checks.push(runCheck("current_environment_network_config_is_not_blocked", () => {
  const config = dualConfig();
  const preflight = networkMigrationPreflight(config);
  const status = readiness();
  assert.equal(preflight.ready, true);
  assert.equal(status.publicWrites, false);
  return {
    preflight,
    readiness: status,
    note: "This check does not call the DUAL API and does not run setup, mint, sync, or gate-advance writes."
  };
}));

console.log(JSON.stringify({
  ok: true,
  service: "dual-pharmchain-custody-demo",
  check: "mainnet_migration_preflight",
  secret_returned: false,
  public_writes: false,
  live_dual_calls: false,
  checks
}, null, 2));
