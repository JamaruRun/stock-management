'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const links: Record<string, { href: string; label: string; admin?: boolean }[]> = {
  stock: [{ href: '/v3/tools', label: 'นำเข้า / พิมพ์ป้าย' }, { href: '/v3/sales/history', label: 'จัดการประวัติขายเครื่อง', admin: true }],
  goods: [{ href: '/v3/tools', label: 'พิมพ์ป้าย' }, { href: '/v3/goods/print', label: 'ป้าย A4' }, { href: '/v3/goods/history', label: 'จัดการประวัติขาย', admin: true }],
  parts: [{ href: '/v3/tools', label: 'พิมพ์ป้ายอะไหล่' }],
  pawn: [{ href: '/v3/tools', label: 'นำเข้า Excel', admin: true }],
  installment: [{ href: '/v3/tools', label: 'นำเข้า Excel', admin: true }, { href: '/v3/installment/history', label: 'ประวัติสัญญาที่จบแล้ว', admin: true }],
  history: [{ href: '/v3/sales/history', label: 'ประวัติขายเครื่อง', admin: true }, { href: '/v3/goods/history', label: 'ประวัติขายอุปกรณ์', admin: true }, { href: '/v3/installment/history', label: 'ประวัติผ่อน', admin: true }],
  reports: [{ href: '/v3/reports', label: 'ภาพรวมรายงาน', admin: true }, { href: '/v3/reports/detailed', label: 'รายงานรายวัน / CSV', admin: true }],
};
export default function V3ModuleLinks({ admin }: { admin: boolean }) {
  const path = usePathname();
  const adminLinks = path.startsWith('/v3/super-admin/users') ? [{ href: '/v3/super-admin/users/manage', label: 'แก้ไขบัญชีผู้ใช้' }]
    : path.startsWith('/v3/super-admin/feedback') ? [{ href: '/v3/super-admin/feedback/manage', label: 'จัดการสถานะ / หมายเหตุ / ลบ' }] : [];
  const list = [...(links[path.split('/')[2]] || []), ...adminLinks].filter(link => link.href !== path && (!('admin' in link && link.admin) || admin));
  if (!list.length) return null;
  return <details key={path} className="v3-module-tools"><summary>เครื่องมือเพิ่มเติม · {list.length} เมนู</summary>
    <nav className="v3-module-links" aria-label="เครื่องมือของหน้านี้">{list.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
  </details>;
}
