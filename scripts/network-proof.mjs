import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const port = process.env.PORT || "4182";
const host = process.env.HOST || "127.0.0.1";
const baseUrl = `http://${host}:${port}`;

const server = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: port, HOST: host },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

try {
  await waitForServer();
  await run("npm", ["run", "smoke"], { DEMO_BASE_URL: baseUrl, SMOKE_STRICT_NETWORK: "1" });
  await run("npm", ["run", "proof:rederive"], { DEMO_BASE_URL: baseUrl, SMOKE_STRICT_NETWORK: "1" });
  console.log(`ok - strict network proof passed at ${baseUrl}`);
} finally {
  server.kill("SIGTERM");
}

async function waitForServer() {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited before readiness.\n${output}`);
    }
    try {
      await execFileAsync("curl", ["-sS", "-f", `${baseUrl}/api/dual/status`], { maxBuffer: 1024 * 1024 });
      console.log(`ok - server ready at ${baseUrl}`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`Server did not become ready at ${baseUrl}.\n${output}`);
}

async function run(command, args, env) {
  await execFileAsync(command, args, {
    env: { ...process.env, ...env },
    maxBuffer: 4 * 1024 * 1024
  });
  console.log(`ok - ${command} ${args.join(" ")} passed`);
}
