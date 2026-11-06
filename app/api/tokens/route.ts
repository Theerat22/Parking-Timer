import { randomBytes } from "node:crypto";
import { authenticate, ApiError, hashToken, run } from "@/lib/api";
import { adminClient } from "@/lib/supabase/server";
export const POST = (request: Request) =>
  run(async () => {
    const identity = await authenticate(request);
    const db = adminClient();
    const { count, error: countError } = await db
      .from("shortcut_tokens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", identity.userId)
      .is("revoked_at", null);
    if (countError) throw new ApiError(503, "สร้างโทเคนไม่ได้ กรุณาลองใหม่");
    if ((count ?? 0) >= 5)
      throw new ApiError(
        400,
        "มีโทเคนที่ใช้งานอยู่ครบ 5 รายการแล้ว กรุณาเพิกถอนรายการเดิมก่อน",
      );
    const token = `pt_${randomBytes(32).toString("base64url")}`;
    const { data, error } = await db
      .from("shortcut_tokens")
      .insert({
        user_id: identity.userId,
        name: "Apple Shortcuts",
        token_hash: hashToken(token),
        prefix: token.slice(0, 10),
      })
      .select("id,name,prefix,created_at,last_used_at,revoked_at")
      .single();
    if (error) throw new ApiError(503, "สร้างโทเคนไม่ได้ กรุณาลองใหม่");
    return {
      ok: true,
      token,
      metadata: data,
      message: "สร้างโทเคนแล้ว คัดลอกและเก็บไว้ก่อนออกจากหน้านี้",
    };
  });
