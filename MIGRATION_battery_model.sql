-- รุ่น/รหัสแบตเตอรี่ (เช่น รหัสรุ่นที่พิมพ์บนตัวแบต) แยกจาก phone_model (รุ่นมือถือที่ใช้ได้)
-- ใช้ตอนแอดมินถามหาอะไหล่ผ่าน LINE/Messenger ด้วยรหัสแบตแทนชื่อรุ่นมือถือ
alter table public.parts add column if not exists battery_model text;
