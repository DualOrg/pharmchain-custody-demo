import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import mcp from "./api/mcp.js";
import { getDeploymentInfo } from "./src/deployment.mjs";
import { evaluateHandoff, getCurrentBatch, getProofBundle, getStatus, template } from "./src/pharmchain.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4182);
const host = process.env.HOST || "127.0.0.1";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const routes = new Map([
  ["GET /mcp", mcp],
  ["POST /mcp", mcp],
  ["OPTIONS /mcp", mcp],
  ["GET /api/mcp", mcp],
  ["POST /api/mcp", mcp],
  ["OPTIONS /api/mcp", mcp],
  ["GET /api/dual/status", jsonRoute(getStatus)],
  ["GET /api/batches/current", jsonRoute(getCurrentBatch)],
  ["POST /api/batches/evaluate", jsonRoute((request) => evaluateHandoff(request.body))],
  ["GET /api/proof", jsonRoute(getProofBundle)],
  ["GET /api/template", jsonRoute(() => template)],
  ["GET /api/deployment", jsonRoute(getDeploymentInfo)]
]);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);
    if (url.pathname === "/mcp" || url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, error.status || 500, {
      error: { message: error.message || "Unknown server error", code: error.code || "SERVER_ERROR" }
    });
  }
});

server.listen(port, host, () => {
  console.log(`PharmChain custody demo running on http://${host}:${port}`);
});

async function handleApi(request, response, url) {
  const route = routes.get(`${request.method} ${url.pathname}`);
  if (!route) {
    sendJson(response, 404, { error: { message: "Not found" } });
    return;
  }
  const body = request.method === "GET" ? undefined : await readJson(request);
  const wrappedRequest = {
    method: request.method,
    headers: request.headers,
    query: Object.fromEntries(url.searchParams.entries()),
    body
  };
  const wrappedResponse = {
    setHeader(name, value) {
      response.setHeader(name, value);
      return wrappedResponse;
    },
    status(statusCode) {
      return {
        json(payload) {
          sendJson(response, statusCode, payload);
        },
        end(payload = "") {
          response.writeHead(statusCode);
          response.end(payload);
        }
      };
    }
  };
  await route(wrappedRequest, wrappedResponse);
}

function jsonRoute(handler) {
  return async (request, response) => {
    response.status(200).json(await handler(request));
  };
}

async function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);
  if (!filePath.startsWith(root)) {
    sendJson(response, 403, { error: { message: "Forbidden" } });
    return;
  }
  let content;
  try {
    content = await readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendJson(response, 404, { error: { message: "Not found" } });
      return;
    }
    throw error;
  }
  response.writeHead(200, {
    "Content-Type": mime[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(content);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}
