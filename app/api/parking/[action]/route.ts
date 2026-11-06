import { ApiError, authenticate, rpcCommand, run } from "@/lib/api";
import type { ParkingSession } from "@/lib/parking";
import { parkingMessage } from "@/lib/speech";
import { validateRequestId } from "@/lib/idempotency";
export const runtime = "nodejs";
async function handle(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  return run(async () => {
    const { action } = await context.params;
    if (!["start", "stop", "status"].includes(action))
      throw new ApiError(404, "ไม่พบคำสั่ง");
    if ((action === "status") !== (request.method === "GET"))
      throw new ApiError(405, "วิธีเรียกคำสั่งไม่ถูกต้อง");
    const identity = await authenticate(request, true);
    const validation =
      action === "status"
        ? { key: null, error: null }
        : validateRequestId(
            request.headers.get("idempotency-key"),
            request.headers.has("idempotency"),
          );
    if (validation.error) throw new ApiError(400, validation.error);
    const key = validation.key;
    const result = (await rpcCommand(identity, action, {}, key)) as {
      state: string;
      session: ParkingSession | null;
      server_time: string;
    };
    const message = parkingMessage(action, result);
    return { ok: true, ...result, message };
  });
}
export const GET = handle;
export const POST = handle;
