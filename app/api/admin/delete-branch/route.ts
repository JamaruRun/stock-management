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
      .select('role, branch_id, shop_id')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    const { branchId, moveToBranchId } = await request.json();
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

    // เช็ค users ในสาขานี้ก่อน
    const { count: usersCount } = await adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId);

    if ((usersCount || 0) > 0) {
      return NextResponse.json({
        error: `ยังมีพนักงาน ${usersCount} คนในสาขานี้ ย้ายพนักงานออกก่อน`,
      }, { status: 400 });
    }

    // ตารางที่ผูกกับ branch_id ทั้งหมด (ครอบคลุมทุก module)
    // ✅ รวม receipts, goods_sales, repair_jobs ที่ขาดไป
    const tablesToMigrate = [
      'stock',
      'sales_history',
      'pawn_stock',
      'pawn_history',
      'installment_stock',
      'installment_history',
      'goods',
      'goods_sales',
      'parts',
      'repair_jobs',
      'receipts',
    ];

    // ตรวจ + เก็บจำนวนทั้งหมด
    let totalRecords = 0;
    const counts: Record<string, number> = {};
    
    for (const table of tablesToMigrate) {
      try {
        const { count } = await adminClient
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('branch_id', branchId);
        const c = count || 0;
        counts[table] = c;
        totalRecords += c;
      } catch (e) {
        // ตารางไม่มี ข้าม
        counts[table] = 0;
      }
    }

    // ถ้ามีข้อมูล → ต้องระบุสาขาที่จะย้ายไป
    if (totalRecords > 0 && !moveToBranchId) {
      // หาสาขาอื่นในร้านเดียวกัน
      const { data: otherBranches } = await adminClient
        .from('branches')
        .select('id, name')
        .eq('shop_id', profile.shop_id)
        .neq('id', branchId);

      return NextResponse.json({
        error: 'สาขานี้มีข้อมูลใช้งานอยู่ ต้องเลือกสาขาที่จะย้ายข้อมูลไป',
        needsMove: true,
        totalRecords,
        details: counts,
        otherBranches: otherBranches || [],
      }, { status: 400 });
    }

    // ถ้าระบุ moveToBranchId → ย้ายข้อมูลทั้งหมด
    if (moveToBranchId && totalRecords > 0) {
      // เช็คว่าสาขาที่จะย้ายไปอยู่ใน shop เดียวกัน
      const { data: targetBranch } = await adminClient
        .from('branches')
        .select('id, shop_id')
        .eq('id', moveToBranchId)
        .single();

      if (!targetBranch || targetBranch.shop_id !== profile.shop_id) {
        return NextResponse.json({
          error: 'สาขาที่จะย้ายไปไม่ถูกต้อง',
        }, { status: 400 });
      }

      if (moveToBranchId === branchId) {
        return NextResponse.json({
          error: 'ย้ายไปสาขาเดิมไม่ได้',
        }, { status: 400 });
      }

      // ย้ายข้อมูลทุกตาราง
      for (const table of tablesToMigrate) {
        if (counts[table] > 0) {
          const { error: moveError } = await adminClient
            .from(table)
            .update({ branch_id: moveToBranchId })
            .eq('branch_id', branchId);

          if (moveError) {
            console.error(`Move ${table} error:`, moveError);
            // ข้าม table ที่ error (อาจไม่มี column branch_id)
          }
        }
      }
    }

    // ลบสาขา
    const { error } = await adminClient.from('branches').delete().eq('id', branchId);
    if (error) {
      return NextResponse.json({ 
        error: `ลบไม่สำเร็จ: ${error.message}` 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      moved: totalRecords,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
