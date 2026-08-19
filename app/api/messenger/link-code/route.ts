import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role, shop_id').eq('id', user.id).single();

  if (profile?.role !== 'admin' || !profile?.shop_id) {
    return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('profiles')
    .update({ messenger_link_code: code, messenger_link_code_expires_at: expiresAt })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, code, expiresAt });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { error } = await supabase
    .from('profiles')
    .update({ messenger_psid: null, messenger_link_code: null, messenger_link_code_expires_at: null })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
