import { authenticate, ApiError, run } from "@/lib/api";
import { adminClient } from "@/lib/supabase/server";
export const DELETE = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) =>
  run(async () => {
    const identity = await authenticate(request);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new ApiError(400, "รหัสโทเคนไม่ถูกต้อง");
    const { data, error } = await adminClient().rpc("revoke_shortcut_token", {
      p_user: identity.userId,
      p_id: id,
    });
    if (error) throw new ApiError(503, "เพิกถอนไม่สำเร็จ กรุณาลองใหม่");
    if (!data) throw new ApiError(404, "ไม่พบโทเคน");
    return { ok: true, message: "เพิกถอนโทเคนแล้ว" };
  });
