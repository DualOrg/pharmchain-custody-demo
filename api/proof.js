import { getProofBundleLive, sendError } from "../src/dual-live.mjs";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }
  try {
    response.status(200).json(await getProofBundleLive());
  } catch (error) {
    sendError(response, error);
  }
}
