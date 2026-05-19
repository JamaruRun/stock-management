import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles').select('role, shop_id').eq('id', user.id).single();
  
  if (profile?.role !== 'admin' || !profile?.shop_id) {
    return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  }

  // ลบ LINE info ของร้านนี้เท่านั้น
  const { error } = await supabase
    .from('shops')
    .update({
      line_user_id: null,
      line_display_name: null,
      line_picture_url: null,
      line_connected_at: null,
    })
    .eq('id', profile.shop_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
