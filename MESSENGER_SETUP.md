# 🔧 คู่มือ Setup Facebook Messenger (สำหรับเจ้าของระบบ - ทำครั้งเดียว)

> ✨ หลังตั้งค่านี้ ลูกค้าทุกร้านจะกดปุ่ม "เชื่อม Messenger" ที่หน้าตั้งค่าเว็บ → พิมพ์โค้ดยืนยันในแชท Messenger ครั้งเดียวจบ แล้วทักถามข้อมูลร้านได้เหมือน LINE

---

## 📋 ขั้นที่ 1: สร้าง Facebook Page (ถ้ายังไม่มี)

1. ไป **https://www.facebook.com/pages/create**
2. ตั้งชื่อเพจ (เช่น "Stock Manager" หรือชื่อร้าน) → สร้าง

## 📋 ขั้นที่ 2: สร้าง Facebook App

1. ไป **https://developers.facebook.com/apps/**
2. กด **"Create App"** → เลือกประเภท **"Business"**
3. กรอกชื่อ App → สร้าง

## 📋 ขั้นที่ 3: เพิ่ม Messenger product

1. ในหน้า App → **"Add Product"** → หา **"Messenger"** → กด **"Set up"**
2. ไปที่ **Messenger** → **Settings** ในเมนูซ้าย

## 📋 ขั้นที่ 4: เชื่อม Page + เอา Page Access Token

1. ที่ section **"Access Tokens"** → กด **"Add or Remove Pages"** → เลือก Page ที่สร้างไว้ → อนุญาต
2. หลังเชื่อมแล้ว จะเห็น Page อยู่ในลิสต์ → กด **"Generate Token"**
3. Copy token → `MESSENGER_PAGE_ACCESS_TOKEN`

## 📋 ขั้นที่ 5: เอา App Secret

1. ไปที่ **App settings** → **Basic** (เมนูซ้าย)
2. **App Secret** → กด **"Show"** → copy → `MESSENGER_VERIFY_TOKEN` (ตั้งเองเป็น string สุ่มอะไรก็ได้ ไม่ต้องเป็นค่าเดียวกับ App Secret)
3. `MESSENGER_APP_SECRET` = ค่า App Secret ที่ copy มา

## 📋 ขั้นที่ 6: ตั้งค่า Webhook

1. กลับไปที่ **Messenger** → **Settings** → section **"Webhooks"**
2. กด **"Add Callback URL"** ใส่:
   ```
   Callback URL: https://your-domain.com/api/messenger/webhook
   Verify Token: (ค่าเดียวกับ MESSENGER_VERIFY_TOKEN ที่ตั้งไว้ขั้นที่ 5)
   ```
   (เปลี่ยน `your-domain.com` เป็นโดเมนจริง — ต้อง deploy โดเมนนี้แล้วก่อนถึงจะ Verify ผ่าน)
3. กด **Verify and Save**
4. เลือก Page → subscribe field: ติ๊ก **"messages"** เป็นอย่างน้อย

## 📋 ขั้นที่ 7: ใส่ใน Vercel

1. ไป Vercel → Project → **Settings** → **Environment Variables**
2. เพิ่ม 3 ตัวแปร:
   ```
   MESSENGER_PAGE_ACCESS_TOKEN = YOUR_TOKEN_HERE
   MESSENGER_APP_SECRET = YOUR_APP_SECRET_HERE
   MESSENGER_VERIFY_TOKEN = ตั้งเองเป็น string สุ่มยาวๆ
   ```
3. กด **Save**
4. ไป tab **Deployments** → redeploy ล่าสุด (ต้อง redeploy ก่อนถึงจะ Verify webhook ในขั้นที่ 6 ผ่าน — ถ้ายังไม่เคย deploy โดเมนนี้ ให้ทำขั้นที่ 7 ก่อนขั้นที่ 6)

## ✅ ทดสอบ

1. เปิดเว็บ → Login เข้าระบบ (ต้องเป็น admin)
2. ไป **⚙️ ตั้งค่า** → tab **แจ้งเตือน**
3. หา section **"เชื่อม Messenger"** → กด **"สร้างโค้ดเชื่อม Messenger"**
4. จะได้โค้ด 6 หลัก → ไปแชทกับ Page ที่สร้างไว้ (ผ่าน Messenger) → พิมพ์ `เชื่อม XXXXXX` (โค้ดจากขั้นที่ 3)
5. บอทตอบ "✅ เชื่อมสำเร็จ!" → ลองถามคำถาม เช่น "รายรับรายจ่ายวันนี้" ✅

---

## 🤖 ถามข้อมูลร้านผ่าน Messenger

เหมือน LINE ทุกประการ — ใช้ core logic เดียวกัน (`lib/assistant.ts`) หลังเชื่อมบัญชีแล้ว ถามได้ เช่น:
- "รายรับรายจ่ายวันที่ 17"
- "อะไหล่จอ iPhone 11 เหลือกี่ชิ้น"
- "จอ iPhone 11 ราคาเท่าไหร่"
- "จำนำเครื่องไหนใกล้ครบกำหนด"
- "อะไหล่ตัวไหนใกล้เป็นเดดสต็อคบ้าง"

บอทดึงตัวเลขจริงจากฐานข้อมูลเสมอ (AI ใช้แค่แปลคำถามเป็น intent/พารามิเตอร์ ไม่ได้สร้างตัวเลขเอง)

สอนคำย่อที่บอทยังไม่รู้จักได้เหมือน LINE เช่นกัน พิมพ์ `สอน ip13 = iphone 13`

## 🛡️ Security Notes

- **App Secret + Page Access Token** = ห้ามแชร์! เก็บใน Vercel env เท่านั้น
- Webhook ตรวจ signature (`X-Hub-Signature-256`) ทุกครั้งก่อนประมวลผล กันคนยิง event ปลอมเข้ามา
- ลูกค้าแต่ละร้านจะมี `messenger_psid` แยกกัน → ผูกกับ `shop_id` ของแอดมินที่สร้างโค้ด ไม่ปนกันข้ามร้าน
- โค้ดเชื่อมหมดอายุใน 15 นาที และใช้ได้ครั้งเดียว (เคลียร์ทิ้งทันทีหลังเชื่อมสำเร็จ)
- มี rate limit กันสแปม/กัน quota Gemini หมด (5 คำถาม/นาที, 50 คำถาม/วัน ต่อบัญชี)

## 💰 ค่าใช้จ่าย

- Messenger Send API (reply ข้อความ) ฟรี ไม่มี quota แบบ LINE push message
- Gemini API free tier ใช้ร่วมกับ LINE (ดู [LINE_OAUTH_SETUP.md](./LINE_OAUTH_SETUP.md))
