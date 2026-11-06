# การตรวจสอบและข้อจำกัด

## ผ่านแล้วในเครื่อง

รุ่นปัจจุบันเพิ่ม migration ขั้นชั่วโมงและทดสอบก่อน/ตรง/หลัง 120, 180, 240 นาที พร้อมรักษา legacy pricing


- `npm test`: 32 กรณี ครอบคลุมการคำนวณแบบขั้นชั่วโมง ราคา snapshot เขตเวลา การแก้ไขที่รักษามิลลิวินาที สถิติ และ migration PostgreSQL
- SQL migration รันจริงบน PGlite (PostgreSQL แบบ WASM พร้อม btree_gist) ตรวจต้นทุน SQL เทียบ TypeScript ทดสอบ key ซ้ำ/คนละ action เวลาซ้อน future edit สิทธิ์ผู้ใช้ การเพิกถอน และ quota
- `npm run test:api`: 23 ข้อ ใช้ Next.js HTTP handlers จริง + PostgreSQL PGlite จริง โดยจำลองเฉพาะ Supabase PostgREST transport ในเครื่อง ครอบคลุม bearer scope, Origin guard, ไม่มี auth cookie, การส่งคำขอพร้อมกัน, stop replay, UI direct-open/start/stop/reload/edit/delete/token/offline และกรณี response หายแต่ข้อมูลบันทึกแล้ว retry หลัง reload ต้องไม่ซ้ำ
- `npm run typecheck` และ `npm run build` ผ่าน
- Production PWA check ผ่าน: service worker ควบคุมหน้าได้, manifest/ไอคอนครบ, เปิดหน้า offline ได้ และไม่มี API ใน cache
- Chromium/Google Chrome ตรวจ desktop 1440×1000 และ mobile 390×844 ไม่มี page runtime error หรือ horizontal overflow
- ตรวจ dark mode หลัง transition เสร็จแล้ว อ่านปุ่มเลือกธีมได้ชัดเจน
- Impeccable mechanical detector: พบ advisory เกี่ยวกับขนาดตัวอักษรเดิมที่ไม่ได้แจกแจงครบใน type ramp ของ DESIGN.md; ไม่พบปัญหา runtime จาก browser checks

ภาพ `docs/screenshots/*test-fixture.png` เป็นข้อมูลสังเคราะห์จากฐานข้อมูลทดสอบชั่วคราว ไม่มีการ seed ข้อมูลเหล่านั้นลงระบบจริง ภาพ setup/empty แสดงสถานะเมื่อยังไม่เชื่อม Supabase

## วิธีทดสอบซ้ำ

```sh
npm test
npm run typecheck
npm run build
npm run test:api
node tests/pwa-check.mjs
```

API/browser/PWA checks ต้องมี Google Chrome และเปิด port ในเครื่องได้ API test ใช้ port 3001 และ 54329, PWA check ใช้ 3002 ไม่ใช้ credentials จริง ไม่เขียน .env.local และปิด process/ฐานข้อมูลทดสอบเมื่อเสร็จ สำหรับภาพ setup ให้เปิด `npm run dev` ที่ port 3000 แล้วรัน `node tests/browser-check.mjs`

## ต้องตรวจเมื่อเชื่อมบริการจริง

- รัน migration ทั้งสามตามลำดับ และตรวจว่าประวัติ/โทเคนเดิมยังอยู่
- เปิดเว็บโดยไม่มี cookies แล้วเริ่ม–หยุดและเปิดใหม่ ต้องเห็นข้อมูลเดิม
- ทดสอบหลาย connection PostgreSQL จริง; PGlite ใช้ connection เดียว
- ทดสอบ Safari, PWA และ Siri บน iPhone จริงผ่าน HTTPS

ไม่มีการรัน migration บน Supabase ภายนอกหรือ deploy ในงานนี้

## ขอบเขตการออกแบบ

ใช้ Figma reference screen 2:89 เป็นแนวทางและตรวจภาพต้นฉบับผ่านเครื่องมือ Figma แล้ว ผู้ตรวจรอบสุดท้ายได้รับคำอธิบาย reference และภาพแอป ผล review จึงเป็นการตรวจความสอดคล้องกับแนวทาง ไม่ใช่การยืนยัน pixel-perfect กับไฟล์ต้นฉบับ

ผลตรวจรอบแรกก่อนปรับเป็น flat layout: **ship**

| ข้อสังเกต | ผล |
| --- | --- |
| ความคมชัดของปุ่มเลือกโหมดมืด | resolved — ภาพใหม่หลัง transition เสร็จอ่านได้ชัด |

ไม่มี material fixes ค้างอยู่

## Single-owner revision

เพิ่มการทดสอบฐานข้อมูลใหม่ที่ไม่มี auth account, การย้ายประวัติ/โทเคนเดิมโดยไม่ผูกกับ auth.users และการปฏิเสธ migration ที่มีหลายเจ้าของ แก้ API/browser checks ให้เปิดใช้งานโดยไม่มี login และยืนยันว่า route login ถูกนำออก
