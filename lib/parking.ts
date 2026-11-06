export const TIME_ZONE = "Asia/Bangkok";
export type ParkingSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  billing_model?: "minute" | "hourly_step";
  free_minutes: number;
  hourly_rate_satang: number;
  cost_satang: number | null;
  source: string;
};
export type ShortcutToken = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};
export function calculateParking(
  start: string | number,
  end: string | number,
  freeMinutes = 120,
  hourlyRateSatang = 2000,
  billingModel: "minute" | "hourly_step" = "hourly_step",
) {
  const elapsedMs = Math.max(
    0,
    new Date(end).getTime() - new Date(start).getTime(),
  );
  if (
    !Number.isFinite(elapsedMs) ||
    !Number.isSafeInteger(freeMinutes) ||
    freeMinutes < 0 ||
    !Number.isSafeInteger(hourlyRateSatang) ||
    hourlyRateSatang < 0
  )
    throw new Error("Invalid parking input");
  const billedMinutes = Math.ceil(
    Math.max(0, elapsedMs - freeMinutes * 60_000) / 60_000,
  );
  const billedHours =
    elapsedMs < freeMinutes * 60_000
      ? 0
      : Math.floor((elapsedMs - freeMinutes * 60_000) / 3_600_000) + 1;
  const costSatang =
    billingModel === "minute"
      ? Number((BigInt(billedMinutes) * BigInt(hourlyRateSatang) + 30n) / 60n)
      : billedHours * hourlyRateSatang;
  return {
    elapsedMs,
    billedMinutes,
    billedHours,
    costSatang,
    freeRemainingMs: Math.max(0, freeMinutes * 60_000 - elapsedMs),
  };
}
export function bangkokDate(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function clock(value: string | number | Date) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
export function dateLabel(value: string | number | Date, full = false) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: full ? "long" : "short",
    year: "numeric",
    ...(full ? { weekday: "long" as const } : {}),
  }).format(new Date(value));
}
export function money(satang: number) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(satang / 100);
}
export function duration(ms: number) {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  return `${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`;
}
export function timer(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ].map((v) => String(v).padStart(2, "0"));
}
export function summarize(rows: ParkingSession[]) {
  const completed = rows.filter((r) => r.ended_at);
  const totalMs = completed.reduce(
    (sum, r) =>
      sum + Math.max(0, Date.parse(r.ended_at!) - Date.parse(r.started_at)),
    0,
  );
  const totalSatang = completed.reduce(
    (sum, r) => sum + (r.cost_satang ?? 0),
    0,
  );
  const days = new Set(completed.map((r) => bangkokDate(r.started_at))).size;
  return {
    count: completed.length,
    totalMs,
    totalSatang,
    averageMs: completed.length ? totalMs / completed.length : 0,
    averageSatang: completed.length
      ? Math.round(totalSatang / completed.length)
      : 0,
    averageDailySatang: days ? Math.round(totalSatang / days) : 0,
    days,
  };
}
export function localInput(value: string) {
  return new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 23);
}
export function fromBangkokInput(value: string) {
  const d = new Date(`${value.length === 16 ? value + ":00" : value}+07:00`);
  if (!Number.isFinite(d.getTime()))
    throw new Error("กรุณาระบุวันและเวลาให้ถูกต้อง");
  return d.toISOString();
}
