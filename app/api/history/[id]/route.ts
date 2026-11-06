import { ApiError, authenticate, body, rpcCommand, run } from "@/lib/api";
async function handle(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const identity = await authenticate(request);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new ApiError(400, "รหัสรายการไม่ถูกต้อง");
    const payload = request.method === "PATCH" ? await body(request) : {};
    if (
      request.method === "PATCH" &&
      ["started_at", "ended_at"].some(
        (k) =>
          typeof payload[k] !== "string" ||
          !Number.isFinite(Date.parse(payload[k] as string)),
      )
    )
      throw new ApiError(400, "กรุณาระบุเวลาเข้าและออกให้ครบ");
    return {
      ok: true,
      ...(await rpcCommand(
        identity,
        request.method === "PATCH" ? "edit" : "delete",
        { ...payload, id },
        null,
      )),
      message:
        request.method === "PATCH" ? "บันทึกเวลาที่แก้ไขแล้ว" : "ลบรายการแล้ว",
    };
  });
}
export const PATCH = handle;
export const DELETE = handle;
