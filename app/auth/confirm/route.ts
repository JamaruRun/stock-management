import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// รับ magic link จาก Supabase (token_hash + type)
// ใช้สำหรับ impersonate / login as
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard/home';

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // สำเร็จ → redirect ไป dashboard
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // ล้มเหลว → กลับ login พร้อม error
  return NextResponse.redirect(new URL('/login?error=magic_link_failed', request.url));
}
