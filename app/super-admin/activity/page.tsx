'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';

interface ShopActivity {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  package: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  
  // จาก profiles
  last_seen_at: string | null;
  user_count: number;
  
  // จาก transactions
  stock_count: number;
  pawn_count: number;
  installment_count: number;
  goods_count: number;
  repair_count: number;
  sales_count: number;
  total_transactions: number;
  
  // activity score
  activity_level: 'active' | 'try-out' | 'ghost';
}

type FilterLevel = 'all' | 'active' | 'try-out' | 'ghost';

export default function ShopActivityPage() {
  const supabase = createClient();
  const [shops, setShops] = useState<ShopActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterLevel>('all');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);

    // ดึงร้านทั้งหมด
    const { data: shopsData } = await supabase
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false });

    if (!shopsData) {
      setLoading(false);
      return;
    }

    // สำหรับแต่ละร้าน ดึงข้อมูล activity
    const enriched = await Promise.all(
      shopsData.map(async (shop: any) => {
        // ดึง profiles ของร้านนี้ - หา last_seen_at ล่าสุด
        const { data: profiles } = await supabase
          .from('profiles')
          .select('last_seen_at')
          .eq('shop_id', shop.id);

        const userCount = profiles?.length || 0;
        const lastSeenList = (profiles || [])
          .map((p: any) => p.last_seen_at)
          .filter(Boolean)
          .sort()
          .reverse();
        const lastSeenAt = lastSeenList[0] || null;

        // นับ transactions ในแต่ละ table
        const [stock, pawn, install, goods, repair, sales] = await Promise.all([
          supabase.from('stock').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
          supabase.from('pawn_stock').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
          supabase.from('installment_stock').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
          supabase.from('goods').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
          supabase.from('repair_jobs').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
          supabase.from('sales_history').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
        ]);

        const stockCount = stock.count || 0;
        const pawnCount = pawn.count || 0;
        const installCount = install.count || 0;
        const goodsCount = goods.count || 0;
        const repairCount = repair.count || 0;
        const salesCount = sales.count || 0;
        const totalTrans = stockCount + pawnCount + installCount + goodsCount + repairCount + salesCount;

        // คำนวณ activity level
        let activityLevel: 'active' | 'try-out' | 'ghost' = 'ghost';
        
        if (lastSeenAt) {
          const daysSinceLastSeen = (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceLastSeen <= 7 && totalTrans >= 5) {
            activityLevel = 'active';
          } else if (daysSinceLastSeen <= 30 || totalTrans >= 3) {
            activityLevel = 'try-out';
          } else {
            activityLevel = 'ghost';
          }
        } else if (totalTrans >= 3) {
          activityLevel = 'try-out';
        }

        return {
          ...shop,
          last_seen_at: lastSeenAt,
          user_count: userCount,
          stock_count: stockCount,
          pawn_count: pawnCount,
          installment_count: installCount,
          goods_count: goodsCount,
          repair_count: repairCount,
          sales_count: salesCount,
          total_transactions: totalTrans,
          activity_level: activityLevel,
        };
      })
    );

    setShops(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = shops;
    if (filter !== 'all') {
      result = result.filter(s => s.activity_level === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) ||
        (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
      );
    }
    return result;
  }, [shops, filter, search]);

  const stats = useMemo(() => ({
    total: shops.length,
    active: shops.filter(s => s.activity_level === 'active').length,
    tryOut: shops.filter(s => s.activity_level === 'try-out').length,
    ghost: shops.filter(s => s.activity_level === 'ghost').length,
  }), [shops]);

  function timeAgo(dateStr: string | null) {
    if (!dateStr) return 'ไม่เคย';
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (s < 60) return 'เมื่อสักครู่';
    if (s < 3600) return `${Math.floor(s/60)} นาทีก่อน`;
    if (s < 86400) return `${Math.floor(s/3600)} ชม.ก่อน`;
    const days = Math.floor(s / 86400);
    if (days < 30) return `${days} วันก่อน`;
    return `${Math.floor(days/30)} เดือนก่อน`;
  }

  function getActivityInfo(level: string) {
    if (level === 'active') return { label: '🟢 Active', color: '#10b981', desc: 'ใช้สม่ำเสมอ - มีโอกาสจ่ายเงิน!' };
    if (level === 'try-out') return { label: '🟡 Try-out', color: '#f59e0b', desc: 'ลองใช้ - ต้อง follow up' };
    return { label: '🔴 Ghost', color: '#ef4444', desc: 'หายไป - โทรถามได้แล้ว' };
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>📊 Shop Activity</h1>
          <div className="desc">ดูว่าร้านไหนใช้งานบ่อย • พร้อมจ่ายเงิน • หายไป</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{
            padding: '8px 14px',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>🔄 Refresh</button>
          <Link href="/super-admin" style={{
            padding: '8px 14px',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 12,
            textDecoration: 'none',
          }}>← กลับ</Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginBottom: 16,
      }}>
        <StatCard 
          label="ทั้งหมด" 
          value={stats.total} 
          color="#3b82f6"
          onClick={() => setFilter('all')}
          active={filter === 'all'}
        />
        <StatCard 
          label="🟢 Active" 
          value={stats.active} 
          color="#10b981"
          onClick={() => setFilter('active')}
          active={filter === 'active'}
        />
        <StatCard 
          label="🟡 Try-out" 
          value={stats.tryOut} 
          color="#f59e0b"
          onClick={() => setFilter('try-out')}
          active={filter === 'try-out'}
        />
        <StatCard 
          label="🔴 Ghost" 
          value={stats.ghost} 
          color="#ef4444"
          onClick={() => setFilter('ghost')}
          active={filter === 'ghost'}
        />
      </div>

      {/* Action Tips */}
      <div style={{
        padding: 14,
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(139, 92, 246, 0.04))',
        borderLeft: '3px solid #3b82f6',
        borderRadius: 6,
        marginBottom: 16,
        fontSize: 12,
        lineHeight: 1.7,
      }}>
        <strong>💡 แนะนำการ Action:</strong><br/>
        <span style={{ color: '#10b981' }}>🟢 Active</span> = พร้อมจ่ายเงิน! โทรเสนอ package เลย<br/>
        <span style={{ color: '#f59e0b' }}>🟡 Try-out</span> = โทรถามว่าติดอะไร ช่วยเหลือไหม<br/>
        <span style={{ color: '#ef4444' }}>🔴 Ghost</span> = โทรหา ถ้าไม่สนใจจริงๆ ค่อยลบ
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 ค้นหา: ชื่อร้าน / เจ้าของ / เบอร์"
        style={{
          width: '100%',
          padding: 12,
          fontSize: 14,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text)',
          fontFamily: 'inherit',
          marginBottom: 12,
        }}
      />

      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
        แสดง {filtered.length} ร้าน
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }}></div>
      ) : filtered.length === 0 ? (
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon" style={{ opacity: 0.3 }}>📊</div>
            <div className="empty-title">ไม่พบร้าน</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(shop => {
            const info = getActivityInfo(shop.activity_level);
            return (
              <div
                key={shop.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${info.color}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: 14,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
                      🏪 {shop.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {shop.owner_name && `👤 ${shop.owner_name} • `}
                      {shop.phone && `📞 ${shop.phone} • `}
                      สมัคร {timeAgo(shop.created_at)}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 10px',
                    background: `${info.color}20`,
                    color: info.color,
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}>
                    {info.label}
                  </div>
                </div>

                {/* Tip */}
                <div style={{ 
                  fontSize: 11, 
                  color: info.color,
                  marginBottom: 10,
                  padding: '6px 10px',
                  background: `${info.color}10`,
                  borderRadius: 4,
                }}>
                  💡 {info.desc}
                </div>

                {/* Stats grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: 6,
                  marginBottom: 10,
                }}>
                  <MiniStat icon="🕐" label="Login ล่าสุด" value={timeAgo(shop.last_seen_at)} highlight={!!shop.last_seen_at} />
                  <MiniStat icon="👥" label="Users" value={shop.user_count.toString()} highlight={shop.user_count > 0} />
                  <MiniStat icon="📊" label="ข้อมูลรวม" value={shop.total_transactions.toString()} highlight={shop.total_transactions > 0} />
                </div>

                {/* Module activity */}
                {shop.total_transactions > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    fontSize: 10,
                  }}>
                    {shop.stock_count > 0 && <Chip text={`📱 สต๊อก ${shop.stock_count}`} />}
                    {shop.pawn_count > 0 && <Chip text={`💰 จำนำ ${shop.pawn_count}`} />}
                    {shop.installment_count > 0 && <Chip text={`💳 ผ่อน ${shop.installment_count}`} />}
                    {shop.goods_count > 0 && <Chip text={`🎒 ของ ${shop.goods_count}`} />}
                    {shop.repair_count > 0 && <Chip text={`🛠️ ซ่อม ${shop.repair_count}`} />}
                    {shop.sales_count > 0 && <Chip text={`💵 ขาย ${shop.sales_count}`} highlight />}
                  </div>
                )}

                {/* Package + Phone Action */}
                <div style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: 'var(--text-dim)',
                }}>
                  <div>
                    📦 {shop.package === 'lifetime' ? 'ตลอดชีพ' : shop.package === 'trial' ? 'Trial' : shop.package}
                    {shop.expires_at && shop.package !== 'lifetime' && (
                      <span> · หมด {new Date(shop.expires_at).toLocaleDateString('th-TH')}</span>
                    )}
                  </div>
                  {shop.phone && (
                    <a 
                      href={`tel:${shop.phone}`}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--accent)',
                        color: '#fff',
                        borderRadius: 4,
                        textDecoration: 'none',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >📞 โทร</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, color, onClick, active }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 12,
        background: active ? color : 'var(--surface)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        textAlign: 'center',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: 10, color: active ? '#fff' : 'var(--text-dim)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: active ? '#fff' : color, marginTop: 2 }}>{value}</div>
    </button>
  );
}

function MiniStat({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: 8,
      background: highlight ? 'rgba(59, 130, 246, 0.06)' : 'var(--surface-2)',
      borderRadius: 4,
      fontSize: 10,
    }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>{icon} {label}</div>
      <div style={{ fontWeight: 600, color: highlight ? 'var(--accent)' : 'var(--text)', fontSize: 11 }}>{value}</div>
    </div>
  );
}

function Chip({ text, highlight }: { text: string; highlight?: boolean }) {
  return (
    <span style={{
      padding: '3px 8px',
      background: highlight ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-2)',
      color: highlight ? '#059669' : 'var(--text-dim)',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
    }}>{text}</span>
  );
}
