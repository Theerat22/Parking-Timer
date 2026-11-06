type Environment = Record<string, string | undefined>;
export function configurationProblem(env: Environment): string | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) return "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL";
  if (/YOUR_|placeholder/i.test(url))
    return "กรุณาแทน URL ตัวอย่างด้วย Project URL จริงของ Supabase";
  try {
    new URL(url);
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL ไม่ใช่ URL ที่ถูกต้อง";
  }
  if (!key) return "ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY";
  if (/YOUR_|placeholder/i.test(key))
    return "SUPABASE_SERVICE_ROLE_KEY ยังเป็นค่าตัวอย่าง กรุณาใส่ service_role key จริงใน .env.local แล้วเปิดแอปใหม่";
  if (key.startsWith("sb_publishable_"))
    return "SUPABASE_SERVICE_ROLE_KEY ต้องใช้ service_role หรือ secret key ไม่ใช่ publishable key";
  return null;
}
export function databaseProblem(
  error: { code?: string; message?: string },
  fallback: string,
): string {
  if (/invalid api key|invalid jwt|jwt expired/i.test(error.message ?? ""))
    return "คีย์ Supabase ไม่ถูกต้องหรือใช้กับคนละโปรเจกต์ กรุณาตรวจ SUPABASE_SERVICE_ROLE_KEY และ Project URL";
  if (["PGRST205", "42P01"].includes(error.code ?? ""))
    return "ยังไม่พบตารางที่ต้องใช้ กรุณารัน migration ใน Supabase ตามลำดับ";
  if (["PGRST202", "42883"].includes(error.code ?? ""))
    return "ยังไม่พบฟังก์ชันฐานข้อมูล กรุณารัน migration ใน Supabase ให้ครบ";
  if (error.code === "42501")
    return "คีย์ Supabase ไม่มีสิทธิ์ที่ต้องใช้ กรุณาใช้ service_role หรือ secret key ฝั่งเซิร์ฟเวอร์";
  if (/fetch failed|network|ENOTFOUND/i.test(error.message ?? ""))
    return "เชื่อมต่อ Supabase ไม่ได้ กรุณาตรวจ URL และอินเทอร์เน็ต";
  return fallback;
}
