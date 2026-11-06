export function validateRequestId(
  raw: string | null,
  hasShortHeader = false,
): { key: string | null; error: string | null } {
  const key = raw?.trim() ?? "";
  if (!key)
    return {
      key: null,
      error: hasShortHeader
        ? "พบ Header ชื่อ Idempotency แต่ต้องใช้ชื่อเต็มว่า Idempotency-Key"
        : "ไม่ได้รับ Idempotency-Key กรุณาเพิ่ม Header ชื่อนี้ และเลือกตัวแปร RequestID เป็นค่า",
    };
  if (key.length < 16 || key.length > 128)
    return {
      key: null,
      error: `ได้รับ RequestID ยาว ${key.length} ตัวอักษร ต้องยาว 16–128 ตัวอักษร กรุณาเลือกผล Text ที่รวมวันที่กับเลขสุ่ม`,
    };
  if (!/^[a-zA-Z0-9_-]+$/.test(key))
    return {
      key: null,
      error:
        "RequestID มีอักขระที่ไม่รองรับ ใช้เฉพาะ A–Z, a–z, 0–9, - และ _ ตั้ง Format Date เป็น yyyyMMddHHmmssSSS และลบช่องว่างหรือการขึ้นบรรทัดใหม่",
    };
  return { key, error: null };
}
