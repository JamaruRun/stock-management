export interface CompatRow {
  device_model_id?: string;
  model_name: string;
  cost_price: string;
  labor_cost: string;
  sell_price: string;
}

// โหลดรุ่นที่ compatible อยู่แล้วของอะไหล่ (สำหรับฟอร์มแก้ไข)
export async function loadCompatibilityRows(supabase: any, partId: string): Promise<CompatRow[]> {
  const { data } = await supabase
    .from('part_compatibility')
    .select('device_model_id, cost_price, labor_cost, sell_price, device_models(model_name)')
    .eq('part_id', partId);
  return (data || []).map((r: any) => ({
    device_model_id: r.device_model_id,
    model_name: r.device_models?.model_name || '',
    cost_price: String(r.cost_price ?? ''),
    labor_cost: String(r.labor_cost ?? ''),
    sell_price: String(r.sell_price ?? ''),
  }));
}

// resolve ชื่อรุ่น -> device_model_id (upsert รุ่นใหม่เข้า catalog กลางถ้ายังไม่มี) แล้วแทนที่ part_compatibility
// ทั้งหมดของอะไหล่ตัวนี้ด้วยรายการล่าสุด (ลบของเดิมแล้วใส่ใหม่ ง่ายกว่า diff)
export async function saveCompatibilityRows(supabase: any, partId: string, rows: CompatRow[]): Promise<CompatRow[]> {
  const resolved: CompatRow[] = [];
  for (const row of rows) {
    const name = row.model_name.trim();
    if (!name) continue;
    let deviceModelId = row.device_model_id;
    if (!deviceModelId) {
      const { data: existing } = await supabase
        .from('device_models').select('id').ilike('model_name', name).maybeSingle();
      if (existing) {
        deviceModelId = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from('device_models').insert({ model_name: name }).select('id').single();
        if (error || !created) continue;
        deviceModelId = created.id;
      }
    }
    resolved.push({ ...row, device_model_id: deviceModelId });
  }

  await supabase.from('part_compatibility').delete().eq('part_id', partId);
  if (resolved.length > 0) {
    await supabase.from('part_compatibility').insert(
      resolved.map((r) => ({
        part_id: partId,
        device_model_id: r.device_model_id,
        cost_price: parseFloat(r.cost_price) || 0,
        labor_cost: parseFloat(r.labor_cost) || 0,
        sell_price: parseFloat(r.sell_price) || 0,
      }))
    );
  }
  return resolved;
}
