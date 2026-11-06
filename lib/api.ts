import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  adminClient,
  isConfigured,
  configurationError,
} from "./supabase/server";
import { databaseProblem } from "./supabase/config";
import { originDecision } from "./origins";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function checkOrigin(request: Request) {
  const decision = originDecision(request.headers.get("origin"), process.env);
  if (decision === "unconfigured")
    throw new ApiError(503, "ยังไม่ได้ตั้งค่า APP_ORIGIN หรือโดเมน Vercel");
  if (decision === "rejected")
    throw new ApiError(
      403,
      "โดเมนเว็บไม่ตรงกับการตั้งค่าเซิร์ฟเวอร์ กรุณาตรวจ APP_ORIGIN บน hosting แล้ว deploy ใหม่",
    );
}
export async function authenticate(request: Request, allowToken = false) {
  if (!isConfigured())
    throw new ApiError(
      503,
      configurationError() ?? "กรุณาเชื่อมต่อ Supabase ก่อนใช้งาน",
    );
  const auth = request.headers.get("authorization");
  if (auth) {
    if (!allowToken || !/^Bearer pt_[A-Za-z0-9_-]{43}$/.test(auth))
      throw new ApiError(401, "โทเคนไม่ถูกต้องหรือไม่มีสิทธิ์");
    const db = adminClient();
    const { data, error } = await db
      .from("shortcut_tokens")
      .select("id,user_id")
      .eq("token_hash", hashToken(auth.slice(7)))
      .is("revoked_at", null)
      .maybeSingle();
    if (error) throw new ApiError(503, "ตรวจสอบโทเคนไม่ได้ กรุณาลองใหม่");
    if (!data) throw new ApiError(401, "โทเคนไม่ถูกต้องหรือถูกเพิกถอนแล้ว");
    await rateLimit(data.user_id);
    const { error: updateError } = await db
      .from("shortcut_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("revoked_at", null);
    if (updateError) throw new ApiError(503, "ตรวจสอบโทเคนไม่ได้ กรุณาลองใหม่");
    return {
      userId: data.user_id as string,
      source: "shortcut",
      tokenId: data.id as string,
    };
  }
  if (request.method !== "GET") checkOrigin(request);
  const { data: owner, error } = await adminClient()
    .from("parking_owner")
    .select("id")
    .single();
  if (error)
    throw new ApiError(
      503,
      databaseProblem(
        error,
        "อ่านข้อมูลเจ้าของไม่ได้ กรุณาตรวจการเชื่อมต่อ Supabase",
      ),
    );
  if (!owner)
    throw new ApiError(503, "กรุณารัน migration สำหรับการใช้งานคนเดียวก่อน");
  await rateLimit(owner.id);
  return { userId: owner.id as string, source: "web", tokenId: null };
}
export async function rateLimit(key: string, limit = 90) {
  const { data, error } = await adminClient().rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
  });
  if (error)
    throw new ApiError(
      503,
      databaseProblem(
        error,
        "ยังเชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจสอบ migration",
      ),
    );
  if (!data)
    throw new ApiError(429, "เรียกใช้งานบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่");
}
export async function body(request: Request) {
  const text = await request.text();
  if (text.length > 8192) throw new ApiError(413, "ข้อมูลมีขนาดใหญ่เกินไป");
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "รูปแบบข้อมูลไม่ถูกต้อง");
  }
}
export async function run(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError)
      return NextResponse.json(
        { ok: false, message: error.message },
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store",
            ...(error.status === 429 ? { "Retry-After": "60" } : {}),
          },
        },
      );
    return NextResponse.json(
      { ok: false, message: "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export async function rpcCommand(
  identity: { userId: string; source: string; tokenId: string | null },
  action: string,
  payload: Record<string, unknown>,
  key: string | null,
) {
  const { data, error } = await adminClient().rpc("parking_command", {
    p_user: identity.userId,
    p_action: action,
    p_payload: payload,
    p_key: key,
    p_source: identity.source,
    p_token_id: identity.tokenId,
  });
  if (error) {
    const messages: Record<string, [number, string]> = {
      PT_OVERLAP: [409, "ช่วงเวลานี้ซ้อนกับรายการอื่น กรุณาแก้ไขเวลา"],
      PT_TIME: [400, "กรุณาตรวจสอบเวลาเข้าและออก โดยต้องไม่เกินเวลาปัจจุบัน"],
      PT_NOT_FOUND: [404, "ไม่พบรายการนี้ หรือรายการถูกเปลี่ยนไปแล้ว"],
      PT_KEY: [409, "รหัสคำขอนี้ถูกใช้กับคำสั่งอื่นแล้ว"],
      PT_TOKEN: [401, "โทเคนถูกเพิกถอนแล้ว"],
    };
    const match = Object.entries(messages).find(([key]) =>
      error.message.includes(key),
    );
    if (match) throw new ApiError(...match[1]);
    if (error.code === "23P01")
      throw new ApiError(409, "ช่วงเวลานี้ซ้อนกับรายการอื่น");
    throw new ApiError(
      503,
      "บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่",
    );
  }
  return data;
}
