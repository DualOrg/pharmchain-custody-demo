import { evaluateHandoff } from "../../src/pharmchain.mjs";

export default function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }
  response.status(200).json(evaluateHandoff(request.body || {}));
}
