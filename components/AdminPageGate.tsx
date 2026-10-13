import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
export default async function AdminPageGate({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await supabase.from('profiles').select('role,is_super_admin,shop_id').eq('id', user.id).single();
  if (error || !data?.shop_id || (data.role !== 'admin' && !data.is_super_admin)) redirect('/v3/home');
  return <>{children}</>;
}
