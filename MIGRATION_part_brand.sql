-- ยี่ห้อของอะไหล่ (เช่น ยี่ห้อแบตเทียบ Leeplus, Meago, Dissing) แยกจากเกรด (แท้/แท้ถอด/OEM/incell/oled ฯลฯ)
alter table public.parts add column if not exists brand text;
