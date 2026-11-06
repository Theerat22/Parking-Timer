import { calculateParking, TIME_ZONE, type ParkingSession } from "./parking";

export function spokenClock(value: string | number | Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === "hour")!.value);
  const minute = Number(parts.find((part) => part.type === "minute")!.value);
  return `${hour} นาฬิกา ${minute} นาที`;
}
export function spokenDuration(milliseconds: number) {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} นาที`;
  return remainder ? `${hours} ชั่วโมง ${remainder} นาที` : `${hours} ชั่วโมง`;
}
export function spokenMoney(satang: number) {
  const baht = Math.floor(satang / 100);
  const remainder = satang % 100;
  return remainder ? `${baht} บาท ${remainder} สตางค์` : `${baht} บาท`;
}
export function parkingMessage(
  action: string,
  result: {
    state: string;
    session: ParkingSession | null;
    server_time: string;
  },
) {
  const row = result.session;
  if (!row) return "ยังไม่มีรายการที่กำลังจอด";
  if (action === "start")
    return result.state === "already_active"
      ? `คุณกำลังจอดรถอยู่ เริ่มเวลา ${spokenClock(row.started_at)}`
      : `เริ่มบันทึกเวลาจอดรถแล้ว เวลา ${spokenClock(row.started_at)}`;
  const parking = calculateParking(
    row.started_at,
    row.ended_at ?? result.server_time,
    row.free_minutes,
    row.hourly_rate_satang,
    row.billing_model,
  );
  if (action === "stop")
    return `สิ้นสุดการจอดแล้ว รวม ${spokenDuration(parking.elapsedMs)} ค่าจอด ${spokenMoney(row.cost_satang ?? parking.costSatang)}`;
  return `จอดไป ${spokenDuration(parking.elapsedMs)} ค่าจอด ${spokenMoney(parking.costSatang)}`;
}
