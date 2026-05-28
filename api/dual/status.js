import { readiness } from "../../src/dual-live.mjs";

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }
  response.status(200).json(readiness());
}
