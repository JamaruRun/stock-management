import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'ต้อง login' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, branch_id')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    const { branchId, force } = await request.json();
    if (!branchId) {
      return NextResponse.json({ error: 'ต้องระบุ branchId' }, { status: 400 });
    }

    // ห้ามลบสาขาที่ตัวเองอยู่
    if (profile.branch_id === branchId) {
      return NextResponse.json(
        { error: 'ลบสาขาที่คุณอยู่ไม่ได้ - ย้ายตัวเองไปสาขาอื่นก่อน' },
        { status: 400 }
      );
    }

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) {
      return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า SERVICE_ROLE_KEY' }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // เช็คว่ามีข้อมูลที่อ้างอิงสาขานี้ไหม
    const [
      { count: usersCount },
      { count: stockCount },
      { count: salesCount },
      { count: pawnCount },
      { count: pawnHistCount },
      { count: instCount },
      { count: instHistCount },
    ] = await Promise.all([
      adminClient.from('profiles').select('*', { count: 'exact', head: true }).eq('branch_id', branchId),
      adminClient.from('stock').select('*', { count: 'exact', head: true }).eq('branch_id', branchId),
      adminClient.from('sales_history').select('*', { count: 'exact', head: true }).eq('branch_id', branchId),
      adminClient.from('pawn_stock').select('*', { count: 'exact', head: true }).eq('branch_id', branchId),
      adminClient.from('pawn_history').select('*', { count: 'exact', head: true }).eq('branch_id', branchId),
      adminClient.from('installment_stock').select('*', { count: 'exact', head: true }).eq('branch_id', branchId),
      adminClient.from('installment_history').select('*', { count: 'exact', head: true }).eq('branch_id', branchId),
    ]);

    const total = (usersCount || 0) + (stockCount || 0) + (salesCount || 0) +
      (pawnCount || 0) + (pawnHistCount || 0) + (instCount || 0) + (instHistCount || 0);

    if (total > 0 && !force) {
      return NextResponse.json({
        error: 'สาขานี้มีข้อมูลใช้งานอยู่',
        details: {
          users: usersCount || 0,
          stock: stockCount || 0,
          sales: salesCount || 0,
          pawn: pawnCount || 0,
          pawnHistory: pawnHistCount || 0,
          installment: instCount || 0,
          installmentHistory: instHistCount || 0,
        },
        canForce: (usersCount || 0) === 0, // ลบได้ถ้าไม่มี user (force ลบข้อมูลอื่น)
      }, { status: 400 });
    }

    // ถ้า force = true → ลบข้อมูลทั้งหมดในสาขาก่อน (อันตราย!)
    if (force) {
      // ห้าม force ถ้ามี user ในสาขานี้
      if ((usersCount || 0) > 0) {
        return NextResponse.json({
          error: 'ยังมีพนักงานในสาขานี้ ย้ายพนักงานก่อน',
        }, { status: 400 });
      }
      
      await adminClient.from('stock').delete().eq('branch_id', branchId);
      await adminClient.from('sales_history').delete().eq('branch_id', branchId);
      await adminClient.from('pawn_stock').delete().eq('branch_id', branchId);
      await adminClient.from('pawn_history').delete().eq('branch_id', branchId);
      await adminClient.from('installment_stock').delete().eq('branch_id', branchId);
      await adminClient.from('installment_history').delete().eq('branch_id', branchId);
    }

    // ลบสาขา
    const { error } = await adminClient.from('branches').delete().eq('id', branchId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
