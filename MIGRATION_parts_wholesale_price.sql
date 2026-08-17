-- เพิ่มราคาส่ง (wholesale) ให้อะไหล่ นอกเหนือจากราคาทุน (cost_price) และราคาหน้าร้าน (sell_price) เดิม
alter table public.parts
  add column if not exists wholesale_price numeric not null default 0;
