import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  branch_id: string | null;
  shop_id: string | null;
  is_super_admin?: boolean | null;
};

type TransferItemType = 'stock' | 'parts' | 'goods';

const ITEM_CONFIG: Record<TransferItemType, {
  table: string;
  label: string;
  unit: string;
  select: string;
}> = {
  stock: {
    table: 'stock',
    label: 'เครื่องในสต๊อก',
    unit: 'เครื่อง',
    select: 'id, imei, model, color, spec, price, branch_id, shop_id, branches(name)',
  },
  parts: {
    table: 'parts',
    label: 'อะไหล่',
    unit: 'รายการ',
    select: 'id, sku, name, category, phone_model, grade, stock_qty, sell_price, branch_id, shop_id',
  },
  goods: {
    table: 'goods',
    label: 'สินค้า',
    unit: 'รายการ',
    select: 'id, sku, name, category, stock_qty, sell_price, branch_id, shop_id, branch:branches(name)',
  },
};

function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function isAdmin(profile: Profile) {
  return profile.role === 'admin' || !!profile.is_super_admin;
}

function itemLine(item: any, index: number) {
  const parts = [
    `${index + 1}. ${item.model || item.name || '-'}`,
    item.imei ? `IMEI ${item.imei}` : '',
    item.sku ? `SKU ${item.sku}` : '',
    item.color || '',
    item.spec || '',
    item.phone_model || '',
    item.stock_qty != null ? `จำนวน ${item.stock_qty}` : '',
  ].filter(Boolean);
  return parts.join(' | ');
}

function normalizeItemType(value: any): TransferItemType {
  return value === 'parts' || value === 'goods' ? value : 'stock';
}

function normalizeTransferItem(row: any, itemType: TransferItemType) {
  if (itemType === 'stock') {
    return {
      id: row.id,
      type: itemType,
      imei: row.imei,
      model: row.model,
      color: row.color,
      spec: row.spec,
      price: row.price,
    };
  }
  if (itemType === 'parts') {
    return {
      id: row.id,
      type: itemType,
      sku: row.sku,
      name: row.name,
      category: row.category,
      phone_model: row.phone_model,
      grade: row.grade,
      stock_qty: row.stock_qty,
      price: row.sell_price,
    };
  }
  return {
    id: row.id,
    type: itemType,
    sku: row.sku,
    name: row.name,
    category: row.category,
    stock_qty: row.stock_qty,
    price: row.sell_price,
  };
}

function thaiDateTime() {
  return new Date().toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  });
}

async function pushLine(admin: ReturnType<typeof adminClient>, shopId: string, message: string) {
  const channelToken = process.env.LINE_MESSAGING_CHANNEL_TOKEN;

  const { data: shop } = await admin
    .from('shops')
    .select('line_group_id, line_token')
    .eq('id', shopId)
    .single();

  const text = `${message}\n\nเวลา: ${thaiDateTime()}`;

  if (channelToken && shop?.line_group_id) {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${channelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: shop.line_group_id,
        messages: [{ type: 'text', text }],
      }),
    });
    if (res.ok) return;
  }

  if (channelToken) {
    const { data: admins } = await admin
      .from('profiles')
      .select('line_user_id')
      .eq('shop_id', shopId)
      .eq('role', 'admin')
      .not('line_user_id', 'is', null);

    const results = await Promise.allSettled((admins || []).map((p: any) => fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${channelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: p.line_user_id,
        messages: [{ type: 'text', text }],
      }),
    })));
    if (results.some(r => r.status === 'fulfilled')) return;
  }

  if (!shop?.line_token) return;

  const params = new URLSearchParams();
  params.append('message', text);
  await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${shop.line_token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
}

async function getProfile() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, branch_id, shop_id, is_super_admin')
    .eq('id', user.id)
    .single();

  return { user, profile: profile as Profile | null };
}

export async function GET() {
  try {
    const { profile } = await getProfile();
    if (!profile) return NextResponse.json({ error: 'ต้อง login' }, { status: 401 });
    if (!profile.shop_id) return NextResponse.json({ error: 'ไม่พบ shop_id' }, { status: 400 });

    const admin = adminClient();

    let query = admin
      .from('stock_transfers')
      .select(`
        *,
        from_branch:branches!stock_transfers_from_branch_id_fkey(id, name),
        to_branch:branches!stock_transfers_to_branch_id_fkey(id, name)
      `)
      .eq('shop_id', profile.shop_id)
      .order('created_at', { ascending: false })
      .limit(60);

    if (!isAdmin(profile)) {
      query = query.or(`from_branch_id.eq.${profile.branch_id},to_branch_id.eq.${profile.branch_id}`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ transfers: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await getProfile();
    if (!profile) return NextResponse.json({ error: 'ต้อง login' }, { status: 401 });
    if (!profile.shop_id) return NextResponse.json({ error: 'ไม่พบ shop_id' }, { status: 400 });

    const body = await request.json();
    const action = body.action || 'create';
    const admin = adminClient();

    if (action === 'create') {
      const itemType = normalizeItemType(body.itemType);
      const config = ITEM_CONFIG[itemType];
      const stockIds = Array.isArray(body.stockIds || body.itemIds) ? (body.stockIds || body.itemIds).filter(Boolean) : [];
      const toBranchId = body.toBranchId;
      const note = String(body.note || '').trim() || null;

      if (stockIds.length === 0) {
        return NextResponse.json({ error: `กรุณาเลือก${config.label}ที่จะย้าย` }, { status: 400 });
      }
      if (!toBranchId) {
        return NextResponse.json({ error: 'กรุณาเลือกสาขาปลายทาง' }, { status: 400 });
      }

      const { data: toBranch } = await admin
        .from('branches')
        .select('id, name, shop_id')
        .eq('id', toBranchId)
        .eq('shop_id', profile.shop_id)
        .single();

      if (!toBranch) return NextResponse.json({ error: 'สาขาปลายทางไม่ถูกต้อง' }, { status: 400 });

      const { data: stockRows, error: stockError } = await admin
        .from(config.table)
        .select(config.select)
        .in('id', stockIds)
        .eq('shop_id', profile.shop_id);

      if (stockError) return NextResponse.json({ error: stockError.message }, { status: 400 });
      if (!stockRows || stockRows.length !== stockIds.length) {
        return NextResponse.json({ error: `พบรายการ${config.label}ไม่ครบ หรือไม่อยู่ในร้านนี้` }, { status: 400 });
      }

      const rows = stockRows as any[];
      const fromBranchId = rows[0].branch_id;
      const mixedBranch = rows.some((s: any) => s.branch_id !== fromBranchId);
      if (mixedBranch) {
        return NextResponse.json({ error: `ย้ายพร้อมกันได้เฉพาะ${config.label}จากสาขาเดียวกัน` }, { status: 400 });
      }
      if (fromBranchId === toBranchId) {
        return NextResponse.json({ error: 'ปลายทางต้องเป็นคนละสาขา' }, { status: 400 });
      }
      if (!isAdmin(profile) && profile.branch_id !== fromBranchId) {
        return NextResponse.json({ error: `พนักงานย้ายได้เฉพาะ${config.label}ในสาขาตัวเอง` }, { status: 403 });
      }

      const { data: existingPending } = await admin
        .from('stock_transfers')
        .select('id, stock_ids')
        .eq('shop_id', profile.shop_id)
        .eq('item_type', itemType)
        .eq('status', 'pending')
        .overlaps('stock_ids', stockIds);

      if (existingPending && existingPending.length > 0) {
        return NextResponse.json({ error: `มี${config.label}บางรายการอยู่ในคำขอย้ายที่ยังไม่เสร็จ` }, { status: 400 });
      }

      const { data: fromBranch } = await admin
        .from('branches')
        .select('id, name')
        .eq('id', fromBranchId)
        .single();

      const stockItems = rows.map((s: any) => normalizeTransferItem(s, itemType));

      const { data: transfer, error } = await admin
        .from('stock_transfers')
        .insert({
          shop_id: profile.shop_id,
          from_branch_id: fromBranchId,
          to_branch_id: toBranchId,
          item_type: itemType,
          requested_by: profile.id,
          requested_by_name: profile.full_name,
          status: 'pending',
          stock_ids: stockIds,
          stock_items: stockItems,
          item_count: stockItems.length,
          note,
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const list = stockItems.map(itemLine).join('\n');
      await pushLine(admin, profile.shop_id, [
        'แจ้งย้ายสต๊อก: กำลังดำเนินการ',
        `ผู้ทำรายการ: ${profile.full_name || '-'}`,
        `หมวดหมู่: ${config.label}`,
        `จากสาขา: ${fromBranch?.name || '-'}`,
        `ไปสาขา: ${toBranch.name}`,
        `จำนวน: ${stockItems.length} ${config.unit}`,
        'รายการ:',
        list,
        note ? `หมายเหตุ: ${note}` : '',
      ].filter(Boolean).join('\n'));

      return NextResponse.json({ success: true, transfer });
    }

    const transferId = body.transferId;
    if (!transferId) return NextResponse.json({ error: 'ไม่พบ transferId' }, { status: 400 });

    const { data: transfer } = await admin
      .from('stock_transfers')
      .select('*, from_branch:branches!stock_transfers_from_branch_id_fkey(name), to_branch:branches!stock_transfers_to_branch_id_fkey(name)')
      .eq('id', transferId)
      .eq('shop_id', profile.shop_id)
      .single();

    if (!transfer) return NextResponse.json({ error: 'ไม่พบคำขอย้าย' }, { status: 404 });
    if (transfer.status !== 'pending') {
      return NextResponse.json({ error: 'รายการนี้ไม่ได้อยู่ในสถานะรอรับแล้ว' }, { status: 400 });
    }
    if (!isAdmin(profile) && profile.branch_id !== transfer.to_branch_id) {
      return NextResponse.json({ error: 'เฉพาะพนักงานสาขาปลายทางเท่านั้นที่รับ/ยกเลิกรายการนี้ได้' }, { status: 403 });
    }

    const itemType = normalizeItemType(transfer.item_type);
    const config = ITEM_CONFIG[itemType];

    if (action === 'receive') {
      const { error: stockError } = await admin
        .from(config.table)
        .update({ branch_id: transfer.to_branch_id })
        .in('id', transfer.stock_ids)
        .eq('shop_id', profile.shop_id);

      if (stockError) return NextResponse.json({ error: stockError.message }, { status: 400 });

      const { data: updated, error } = await admin
        .from('stock_transfers')
        .update({
          status: 'received',
          received_by: profile.id,
          received_by_name: profile.full_name,
          received_at: new Date().toISOString(),
        })
        .eq('id', transfer.id)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const list = (transfer.stock_items || []).map(itemLine).join('\n');
      await pushLine(admin, profile.shop_id, [
        'แจ้งย้ายสต๊อก: สำเร็จ',
        `ผู้รับของ: ${profile.full_name || '-'}`,
        `หมวดหมู่: ${config.label}`,
        `รับเข้าที่สาขา: ${transfer.to_branch?.name || '-'}`,
        `ย้ายจากสาขา: ${transfer.from_branch?.name || '-'}`,
        `จำนวน: ${transfer.item_count} ${config.unit}`,
        'รายการ:',
        list,
        'สถานะสต๊อก: เปลี่ยนสาขาเรียบร้อย',
      ].join('\n'));

      return NextResponse.json({ success: true, transfer: updated });
    }

    if (action === 'cancel') {
      const { data: updated, error } = await admin
        .from('stock_transfers')
        .update({
          status: 'cancelled',
          cancelled_by: profile.id,
          cancelled_by_name: profile.full_name,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', transfer.id)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const list = (transfer.stock_items || []).map(itemLine).join('\n');
      await pushLine(admin, profile.shop_id, [
        'แจ้งย้ายสต๊อก: ยกเลิก',
        `ผู้ยกเลิก: ${profile.full_name || '-'}`,
        `หมวดหมู่: ${config.label}`,
        `ปลายทาง: ${transfer.to_branch?.name || '-'}`,
        `ต้นทาง: ${transfer.from_branch?.name || '-'}`,
        `จำนวน: ${transfer.item_count} ${config.unit}`,
        'รายการ:',
        list,
        'สถานะสต๊อก: ยังอยู่สาขาเดิม',
      ].join('\n'));

      return NextResponse.json({ success: true, transfer: updated });
    }

    return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
