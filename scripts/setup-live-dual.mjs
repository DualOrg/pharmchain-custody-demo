import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureTemplateAndObject } from "../src/dual-live.mjs";

const defaultEnvPath = "/Users/ibuswell/Documents/DualVault/sandbox/ager-dual-pilot/.env";
const envPath = process.env.DUAL_ENV_FILE || defaultEnvPath;
const outputPath = process.env.DUAL_SETUP_OUTPUT || "/private/tmp/pharmchain-live-setup.json";

Object.assign(process.env, parseEnvFile(envPath), process.env);

if (!process.env.DUAL_API_KEY) {
  throw new Error(`DUAL_API_KEY was not found in ${resolve(envPath)} or process env.`);
}

const setup = await ensureTemplateAndObject();
writeFileSync(outputPath, `${JSON.stringify(setup, null, 2)}\n`, { mode: 0o600 });

console.log(`DUAL PharmChain template ready: ${setup.template_id}`);
console.log(`DUAL PharmChain object ready: ${setup.object_id}`);
console.log(`Setup metadata written: ${outputPath}`);

function parseEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\n/)
        .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
        .filter(Boolean)
        .map((match) => [match[1], unquote(match[2].trim())])
    );
  } catch {
    return {};
  }
}

function unquote(value) {
  if (value.startsWith("\"") && value.endsWith("\"")) return value.slice(1, -1).replace(/\\"/g, "\"");
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}
