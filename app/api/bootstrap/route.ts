import { authenticate, run, ApiError } from "@/lib/api";
import { adminClient } from "@/lib/supabase/server";
import { databaseProblem } from "@/lib/supabase/config";
export const GET = (request: Request) =>
  run(async () => {
    const identity = await authenticate(request);
    const { data, error } = await adminClient().rpc("parking_bootstrap", {
      p_user: identity.userId,
    });
    if (error)
      throw new ApiError(
        503,
        databaseProblem(
          error,
          "โหลดข้อมูลไม่ได้ กรุณาตรวจสอบว่าได้ติดตั้ง migration แล้ว",
        ),
      );
    return {
      ok: true,
      ...data,
      owner: { id: identity.userId },
    };
  });
