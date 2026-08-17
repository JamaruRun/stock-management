-- แก้บั๊ก: MIGRATION_pawn_updates.sql เดิม drop not null ให้ pawn_stock.imei ไปแล้ว
-- แต่ลืมทำกับ pawn_history.imei ทำให้ไถ่คืน/ยึดเครื่องพัง (null value in column "imei" violates not-null constraint)
-- เพราะเครื่องจำนำที่รับเข้าใหม่ (หลังตัดฟีเจอร์ IMEI ออก) ไม่มี imei ให้ insert ตอนย้ายไป pawn_history
alter table public.pawn_history alter column imei drop not null;
