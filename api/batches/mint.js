import {
  mintBatch,
  readBody,
  requireMethod,
  requireOperator,
  sendError,
  sendJson
} from "../../src/dual-live.mjs";

export default async function handler(request, response) {
  if (!requireMethod(request, response, "POST")) return;
  try {
    requireOperator(request);
    const body = await readBody(request);
    sendJson(response, 200, await mintBatch(body));
  } catch (error) {
    sendError(response, error);
  }
}
