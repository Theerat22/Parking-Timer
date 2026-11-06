# Parking Timer

เว็บบันทึกเวลาจอดรถภาษาไทยสำหรับใช้คนเดียว เปิดเว็บแล้วใช้งานได้เลย ไม่มีสมัครบัญชี เข้าสู่ระบบ หรือรหัสผ่าน ใช้ Next.js, TypeScript, Tailwind CSS, Supabase PostgreSQL และ Lucide พร้อม PWA และ API สำหรับ Apple Shortcuts

## เปิดในเครื่อง

ใช้ Node.js 22 LTS ขึ้นไป

```sh
npm install
npm run dev
```

เปิด http://localhost:3000 หากยังไม่ได้ตั้งค่าฐานข้อมูล ปุ่มบันทึกจะถูกปิด ไม่มีข้อมูลตัวอย่างในระบบจริง

## ตั้งค่า Supabase

1. สร้างโปรเจกต์ใน Supabase
2. เปิด SQL Editor แล้วรันไฟล์ใน `supabase/migrations/` ตามลำดับ อย่างละหนึ่งครั้ง:
   - `202611060001_parking.sql`
   - `202611070001_hourly_steps.sql`
   - `202611070002_single_owner.sql`
3. คัดลอก `.env.example` เป็น `.env.local` แล้วกรอก:

| ตัวแปร | ค่า |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key สำหรับเซิร์ฟเวอร์เท่านั้น |
| `APP_ORIGIN` | `http://localhost:3000` หรือ HTTPS origin ของเว็บจริง ไม่มี path |

ไม่ใช้ publishable key หรือ Supabase Auth แล้ว ไม่ต้องตั้งค่าอีเมล SMTP หรือ callback URL ห้ามนำ service role key ไปใส่ Shortcuts หรือ commit ลง Git

4. เปิดเว็บใหม่ เริ่มจอดได้ทันที

### อัปเดตจากรุ่นที่มีบัญชี

หากรันสอง migration แรกแล้ว ให้รันเฉพาะ `202611070002_single_owner.sql` ก่อน deploy โค้ดใหม่นี้ Migration จะเก็บ ID เจ้าของ ประวัติ กติการาคา และ Siri tokens เดิมไว้ แล้วเปลี่ยน foreign key ให้ไม่ผูกกับ auth.users ไม่ลบบัญชี Auth หรือข้อมูลเดิม หากมีข้อมูลหลายเจ้าของ migration จะหยุดแทนการนำข้อมูลมารวมกันโดยไม่ตั้งใจ

ฐานข้อมูลใหม่สร้างเจ้าของหนึ่งรายให้อัตโนมัติ ไม่ต้องสร้างผู้ใช้ใน Supabase Auth

## ลักษณะการเข้าถึง

เว็บไม่มีด่านเข้าสู่ระบบ ผู้ที่เข้าถึง URL จะเห็นและจัดการข้อมูลชุดเดียวกัน ไม่ใช่ระบบแยกข้อมูลตามบัญชี ผู้ใช้ browser ไม่มีสิทธิ์เข้าตารางโดยตรง: เซิร์ฟเวอร์ใช้ service role และเลือก owner ที่บันทึกในฐานข้อมูล ไม่รับ owner ID จาก browser

คำสั่งแก้ไขข้อมูลจาก browser ต้องมี Origin ตรง APP_ORIGIN หรือโดเมนของโปรเจกต์จากตัวแปรระบบ Vercel เพื่อป้องกันคำขอข้ามเว็บไซต์ นี่ไม่ใช่การยืนยันตัวตนของคนเปิดเว็บ Siri ยังใช้โทเคนเฉพาะที่สร้างและเพิกถอนได้

## นำขึ้น hosting

1. Import Git repository ใน Vercel เลือก Next.js และ Node.js 22 LTS ตั้ง Build Command เป็น `npm run build`
2. ตั้ง environment variables สามค่า โดย APP_ORIGIN ต้องเป็น HTTPS origin ของเว็บจริง
3. รัน migration ที่ยังไม่ได้ติดตั้ง แล้ว deploy
4. เปิดเว็บ ทดสอบเริ่ม–สิ้นสุด และตรวจประวัติ ก่อนตั้งค่า Siri

การแก้ไขครั้งนี้เตรียมโค้ดและ migration ในโปรเจกต์ ยังไม่ได้รัน SQL กับ Supabase ภายนอกหรือ deploy แทนคุณ

## ค่าจอด

| ระยะเวลา | ค่าจอด |
| --- | ---: |
| ก่อนครบ 120 นาที | 0 บาท |
| ครบ 120 นาที | 20 บาท |
| ครบ 180 นาที | 40 บาท |
| ครบ 240 นาที | 60 บาท |

เพิ่ม 20 บาททุก 60 นาทีที่ครบหลังจุด 120 นาที เก็บ billing_model และอัตราไว้ในแต่ละรายการ รายการก่อนอัปเดตราคาแบบขั้นยังรักษากติกาคิดตามนาทีเดิมไว้

เก็บเวลา UTC และแสดงผล/จัดกลุ่มวันด้วย Asia/Bangkok รายการข้ามวันนับตามวันเริ่ม สถิติรวมเฉพาะรายการสิ้นสุดแล้ว ค่าเฉลี่ยรายวันหารด้วยวันที่มีรายการ

## Siri และ API

อ่าน [คู่มือ Shortcuts](docs/SIRI.md) และ [รายละเอียด API](docs/API.md)

- Browser เปิดใช้งานได้ทันที ไม่มี cookie session
- Siri ใช้ Bearer token ที่เก็บเฉพาะ SHA-256 hash ในฐานข้อมูล เรียกได้เฉพาะ start/stop/status
- Start/stop ใช้ transaction, advisory lock, unique active index และ idempotency key
- ป้องกันช่วงเวลาซ้อนด้วย exclusion constraint
- จำกัดคำขอเจ้าของร่วมกัน 90 ครั้ง/นาทีใน PostgreSQL

## PWA และออฟไลน์

Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม Service worker ทำงานใน production บน HTTPS หรือ localhost ไม่แคช API เมื่อไม่มีอินเทอร์เน็ตจะไม่แจ้งว่าบันทึกสำเร็จ

ปิดเว็บไม่กระทบเวลาเริ่มในฐานข้อมูล เมื่อกลับมาเปิดจะอ่านสถานะใหม่ ตัวเลขอัปเดตทุกวินาที และดึงข้อมูลทุก 30 วินาทีหรือเมื่อกลับมาที่หน้าเว็บ

## ตรวจสอบ

```sh
npm test
npm run typecheck
npm run build
npm run test:api
```

[ขอบเขตการทดสอบ](docs/TESTING.md) — การทดสอบ API ใช้ PostgreSQL ในเครื่องและจำลอง PostgREST ไม่ได้ทดสอบเสียง Siri บน iPhone จริง

## ปุ่มเริ่ม–หยุดบน Vercel ตอบ 403

ตั้ง `APP_ORIGIN=https://parking-timer-wheat.vercel.app` (หรือโดเมนจริงของคุณ) ใน Environment Variables ของ Production แล้ว Redeploy การเปลี่ยน environment จะไม่แก้ deployment ที่กำลังรันอยู่ทันที

โค้ดรองรับ `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL` และ `VERCEL_BRANCH_URL` เป็น origin ที่เชื่อถือได้เพิ่มเติมโดยอัตโนมัติ โดยไม่เชื่อถือ Host/Forwarded จากคำขอ และไม่อนุญาตโดเมน Vercel อื่นแบบ wildcard หากใช้ custom domain ที่ไม่ได้อยู่ในตัวแปรเหล่านี้ ให้ตั้ง APP_ORIGIN ให้ตรง
