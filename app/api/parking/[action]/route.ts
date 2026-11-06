import { ApiError, authenticate, rpcCommand, run } from "@/lib/api";
import {
  calculateParking,
  clock,
  duration,
  money,
  type ParkingSession,
} from "@/lib/parking";
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
    const key = request.headers.get("idempotency-key");
    if (action !== "status" && (!key || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)))
      throw new ApiError(
        400,
        "กรุณาระบุ Idempotency-Key ความยาว 16–128 ตัวอักษร",
      );
    const result = (await rpcCommand(identity, action, {}, key)) as {
      state: string;
      session: ParkingSession | null;
      server_time: string;
    };
    const row = result.session;
    let message = "ยังไม่มีรายการที่กำลังจอด";
    if (row) {
      const p = calculateParking(
        row.started_at,
        row.ended_at ?? result.server_time,
        row.free_minutes,
        row.hourly_rate_satang,
        row.billing_model,
      );
      if (action === "start")
        message =
          result.state === "already_active"
            ? `คุณกำลังจอดรถอยู่ เริ่มเวลา ${clock(row.started_at)} น.`
            : `เริ่มบันทึกเวลาจอดรถแล้ว เวลา ${clock(row.started_at)} น.`;
      else if (action === "stop")
        message = `สิ้นสุดการจอดแล้ว รวม ${duration(p.elapsedMs)} ค่าจอด ${money(row.cost_satang ?? p.costSatang)} บาท`;
      else
        message = `จอดไป ${duration(p.elapsedMs)} ค่าจอด ${money(p.costSatang)} บาท`;
    }
    return { ok: true, ...result, message };
  });
}
export const GET = handle;
export const POST = handle;
