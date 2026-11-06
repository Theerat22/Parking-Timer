# API

ทุก endpoint ตอบ JSON และ Cache-Control: no-store เวลาเป็น ISO 8601 UTC มี `ok` และข้อความภาษาไทย `message` สำหรับคำสั่งจอดรถและคำสั่งเปลี่ยนข้อมูล Bootstrap เป็น endpoint อ่านข้อมูลสำหรับหน้าเว็บ

## คำสั่งจอดรถ

| Method | Path | สิทธิ์ |
| --- | --- | --- |
| POST | /api/parking/start | browser หรือ scoped bearer |
| POST | /api/parking/stop | browser หรือ scoped bearer |
| GET | /api/parking/status | browser หรือ scoped bearer |

Bearer header: `Authorization: Bearer pt_...`

POST ต้องมี `Idempotency-Key` ความยาว 16–128 ตัวอักษร ประกอบด้วย a-z, A-Z, 0-9, _ หรือ - แนะนำ UUID ใหม่ต่อคำสั่ง ใช้ค่าเดิมเมื่อ retry คำขอเดียวกัน ไม่ต้องส่ง request body

```json
{
  "ok": true,
  "state": "started",
  "session": {
    "id": "UUID",
    "started_at": "2026-11-06T01:30:00.000Z",
    "ended_at": null,
    "billing_model": "hourly_step",
    "free_minutes": 120,
    "hourly_rate_satang": 2000,
    "cost_satang": null,
    "source": "shortcut"
  },
  "server_time": "2026-11-06T01:30:00.000Z",
  "message": "เริ่มบันทึกเวลาจอดรถแล้ว เวลา 8 นาฬิกา 30 นาที"
}
```

State: started, already_active, active, stopped, idle ถ้าไม่มีรายการ active จะส่ง session:null การใช้ key เดิมกับคนละ action ตอบ 409 แม้รายการเดิมสิ้นสุดไปแล้ว หาก retry คำขอเดิม จะได้ snapshot ผลเดิมและเวลาจากคำขอเดิม ให้ GET status เพื่อดูสถานะปัจจุบัน

## หน้าเว็บ — เจ้าของคนเดียว ไม่ต้องเข้าสู่ระบบ

- GET /api/bootstrap → sessions, tokens (เฉพาะ metadata), owner.id, server_time
- PATCH /api/history/:id → body `{ "started_at": "ISO UTC", "ended_at": "ISO UTC" }` แก้เฉพาะรายการสิ้นสุดแล้ว
- DELETE /api/history/:id → ลบเฉพาะรายการสิ้นสุดแล้ว
- POST /api/tokens → สร้างโทเคน แสดง secret ในผลครั้งเดียว ปกติไม่เกิน 5 โทเคน active
- DELETE /api/tokens/:id → เพิกถอน
ทุก browser mutation ต้องมี `Origin` ตรง APP_ORIGIN หรือโดเมนโปรเจกต์จาก VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL / VERCEL_BRANCH_URL ไม่เปิด CORS ข้าม origin ไม่มี session cookie หรือบัญชีผู้ใช้ API เลือกเจ้าของจากตาราง parking_owner ฝั่งเซิร์ฟเวอร์ Bearer token อ่าน/แก้ประวัติหรือสร้างโทเคนไม่ได้

ทุกคนที่เข้าถึงเว็บใช้ข้อมูลเดียวกัน Origin check ไม่ใช่การยืนยันตัวตนของผู้ใช้

## ข้อผิดพลาด

```json
{"ok":false,"message":"โทเคนไม่ถูกต้องหรือถูกเพิกถอนแล้ว"}
```

400 input/key/time ไม่ครบ, 401 โทเคนไม่ถูกต้อง, 403 origin ไม่ตรง, 404 ไม่พบรายการ, 405 method ไม่ถูกต้อง, 409 key conflict/เวลาซ้อน, 413 body ใหญ่, 429 เกิน quota, 503 ฐานข้อมูลไม่พร้อม

อย่าถือว่า HTTP response ใด ๆ เท่ากับสำเร็จ ต้องตรวจ `ok:true` ถ้าเครือข่ายขัดข้อง ผลการเขียนอาจสำเร็จแล้ว ให้ตรวจ status หรือส่งคำขอเดิมด้วย key เดิม

## กติกาค่าจอดรุ่นปัจจุบัน

รายการใหม่ใช้ hourly_step: ก่อน 120 นาที = 0 บาท, ที่ 120 = 20 บาท, ที่ 180 = 40 บาท, ที่ 240 = 60 บาท ฟิลด์ billing_model ระบุ snapshot ของแต่ละรายการ ค่า minute หมายถึงรายการเดิมก่อนอัปเดตและยังรักษาวิธีคิดเดิมไว้

ฟิลด์ message ของคำสั่งจอดรถใช้คำเต็มสำหรับอ่านออกเสียง: ชั่วโมง, นาที, นาฬิกา, บาท และสตางค์ ไม่มี ชม. หรือ น. รูปแบบข้อมูลวันที่ UTC และฟิลด์ตัวเลขยังคงเดิม
