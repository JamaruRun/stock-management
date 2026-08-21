# 🔧 คู่มือ Setup LINE OAuth (สำหรับเจ้าของระบบ - ทำครั้งเดียว)

> ✨ หลังตั้งค่านี้ ลูกค้าทุกร้านจะกดปุ่ม "เชื่อม LINE" ครั้งเดียวจบ!

---

## 📋 ขั้นที่ 1: สร้าง LINE Official Account

1. ไป **https://www.linebiz.com/th/entry/**
2. กด **"เริ่มต้นใช้งานฟรี"** → Login ด้วย LINE
3. กรอก:
   - ชื่อ: **"Stock Manager"** หรือชื่อระบบของคุณ
   - ประเภท: ร้านค้าปลีก
   - หมวด: บริการ
4. สร้าง → ได้ OA ใหม่

## 📋 ขั้นที่ 2: เปิด Messaging API

1. ไป **https://manager.line.biz/** → เลือก OA ที่สร้าง
2. **การตั้งค่า** → **Messaging API**
3. **"ใช้ Messaging API"** → ยอมรับเงื่อนไข
4. เลือก Provider (ถ้ายังไม่มี ให้สร้างใหม่)

## 📋 ขั้นที่ 3: สร้าง LINE Login channel

1. ไป **https://developers.line.biz/console/**
2. เลือก Provider เดียวกับ OA ที่สร้าง
3. กด **"Create new channel"** → เลือก **"LINE Login"**
4. กรอก:
   - Channel name: **"Stock Manager Login"**
   - Channel description: "สำหรับ login เข้าระบบ"
   - App types: เลือก **"Web app"**
5. สร้าง

## 📋 ขั้นที่ 4: ตั้งค่า Callback URL

1. เข้า LINE Login channel ที่สร้าง
2. tab **"LINE Login"** → **"Callback URL"**
3. ใส่:
   ```
   https://your-domain.com/api/line/callback
   ```
   (เปลี่ยน `your-domain.com` เป็นโดเมนจริง)
4. **Update**

## 📋 ขั้นที่ 5: เอา Credentials

### จาก LINE Login channel:
- tab **"Basic settings"** → copy:
  - **Channel ID** → `LINE_LOGIN_CHANNEL_ID`
  - **Channel secret** → `LINE_LOGIN_CHANNEL_SECRET`

### จาก Messaging API channel:
- tab **"Messaging API"** → scroll ลงสุด
- **Channel access token (long-lived)** → กด **"Issue"** → copy
  - → `LINE_MESSAGING_CHANNEL_TOKEN`
- tab **"Basic settings"** ของ Messaging API channel (คนละอันกับ LINE Login channel) → copy:
  - **Channel secret** → `LINE_MESSAGING_CHANNEL_SECRET` (ใช้ตรวจลายเซ็นของ webhook กันคนยิง event ปลอมเข้ามา)

## 📋 ขั้นที่ 5.5: เปิด Webhook (จำเป็นสำหรับฟีเจอร์ Group ID + ถามข้อมูลผ่าน LINE)

1. เข้า Messaging API channel → tab **"Messaging API"**
2. ที่ **Webhook settings** → **Webhook URL** ใส่:
   ```
   https://your-domain.com/api/line/webhook
   ```
3. กด **Verify** (ต้องได้ Success — ถ้า fail เช็คว่า deploy โดเมนนี้แล้วหรือยัง)
4. เปิด **"Use webhook"** เป็น ON
5. ปิด **"Auto-reply messages"** และ **"Greeting messages"** เป็น OFF (กันชนกับข้อความที่บอทตอบเอง)

## 📋 ขั้นที่ 6: ใส่ใน Vercel

1. ไป Vercel → Project → **Settings** → **Environment Variables**
2. เพิ่ม 5 ตัวแปร:
   ```
   LINE_LOGIN_CHANNEL_ID = 1234567890
   LINE_LOGIN_CHANNEL_SECRET = abcdef...
   LINE_MESSAGING_CHANNEL_TOKEN = YOUR_TOKEN_HERE
   LINE_MESSAGING_CHANNEL_SECRET = YOUR_MESSAGING_CHANNEL_SECRET_HERE
   GEMINI_API_KEY = YOUR_GEMINI_KEY_HERE
   ```
3. กด **Save**
4. ไป tab **Deployments** → redeploy ล่าสุด

## ✅ ทดสอบ

1. เปิดเว็บ → Login เข้าระบบ
2. ไป **⚙️ ตั้งค่า**
3. หา section LINE → กด **"เชื่อม LINE"**
4. จะ redirect ไป LINE → Login → อนุญาต
5. กลับมาเห็นโปรไฟล์ LINE ของคุณ + ปุ่ม "ส่งทดสอบ"
6. กด **"ทดสอบ"** → ดูใน LINE ของคุณ ✅

---

## 🤖 ถามข้อมูลร้านผ่าน LINE

หลังตั้งค่า Webhook + `GEMINI_API_KEY` แล้ว แอดมินที่กด "เชื่อม LINE" ไว้แล้วสามารถทัก **1:1 หา LINE OA** ถามข้อมูลได้เลย เช่น:
- "รายรับรายจ่ายวันที่ 17"
- "สรุปเดือนนี้"
- "จอ iPhone 11 เหลือกี่ชิ้น ราคาเท่าไหร่"
- "ต้นทุนรวมสต๊อกทั้งหมดเท่าไหร่"
- "จำนำเครื่องไหนใกล้ครบกำหนด"

**ถามในกลุ่ม LINE ก็ได้เหมือนกัน** — แค่พิมพ์ขึ้นต้นด้วยคำว่า **"ถาม"** เช่น "ถาม รายรับวันนี้เท่าไหร่" (ต้องเป็นกลุ่มที่เชื่อมกับร้านไว้แล้วผ่านหน้าตั้งค่า) กำหนดให้ต้องขึ้นต้นด้วย "ถาม" (หรือ "สอน" สำหรับสอนคำย่อ) เพื่อไม่ให้บอทตอบทุกข้อความที่คนในกลุ่มคุยกันเอง

บอทจะดึงตัวเลขจริงจากฐานข้อมูล (ไม่ใช่ AI เดา/สรุปตัวเลขเอง) แล้วตอบกลับทันทีแบบไม่เสียค่า push message เลย (ใช้ LINE reply message ซึ่งฟรีไม่จำกัด) — สมัคร Gemini API key ฟรีได้ที่ https://aistudio.google.com/apikey

### 🎓 สอนคำย่อ/ชื่อเล่นให้บอทจำ

ถ้าถามด้วยคำย่อที่บอทยังไม่เข้าใจ (เช่นรุ่นใหม่ๆ ที่ยังไม่รู้จัก) สอนได้เองเลย ไม่ต้องรอแก้โค้ด พิมพ์:
```
สอน ip13 = iphone 13
สอน ss คือ samsung
```
บอทจะจำไว้เฉพาะร้านของตัวเอง แล้วเข้าใจคำย่อนี้ทุกครั้งที่ถามในอนาคต

## 🛡️ Security Notes

- **Channel Secret + Token** = ห้ามแชร์! เก็บใน Vercel env เท่านั้น
- ลูกค้าแต่ละร้านจะมี `line_user_id` แยกกัน → ส่งหาเฉพาะร้านนั้นๆ
- ระบบไม่เก็บรหัสผ่าน LINE ของลูกค้า (ผ่าน OAuth)

## 💰 ค่าใช้จ่าย

- **Free**: 200 push messages/เดือน (ทั่วระบบรวมกัน)
- ถ้าเกิน 200 → อัพเกรด Light Plan ฿1,500/เดือน = 15,000 messages

## 📊 จัดการลูกค้า

ดูสถิติการส่งข้อความได้ที่:
- **https://manager.line.biz/** → Insights
