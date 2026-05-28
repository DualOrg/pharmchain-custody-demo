import {
  readBody,
  requireMethod,
  requireOperator,
  sendError,
  sendJson,
  syncHandoff
} from "../../src/dual-live.mjs";

export default async function handler(request, response) {
  if (!requireMethod(request, response, "POST")) return;
  try {
    requireOperator(request);
    const body = await readBody(request);
    sendJson(response, 200, await syncHandoff(body));
  } catch (error) {
    sendError(response, error);
  }
}
