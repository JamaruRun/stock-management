// Constants สำหรับใบงานซ่อม

export const REPAIR_STATUSES = [
  { id: 'pending',       label: 'รอตรวจ',       icon: '🕐', color: '#6b7280' },
  { id: 'in_progress',   label: 'กำลังซ่อม',    icon: '🔧', color: '#3b82f6' },
  { id: 'waiting_parts', label: 'รออะไหล่',     icon: '⏳', color: '#f59e0b' },
  { id: 'done',          label: 'ซ่อมเสร็จ',    icon: '✅', color: '#10b981' },
  { id: 'delivered',     label: 'ส่งมอบแล้ว',   icon: '🎉', color: '#8b5cf6' },
  { id: 'cancelled',     label: 'ยกเลิก',       icon: '❌', color: '#ef4444' },
] as const;

export type RepairStatus = typeof REPAIR_STATUSES[number]['id'];

export function getStatusInfo(id: string) {
  return REPAIR_STATUSES.find(s => s.id === id) || REPAIR_STATUSES[0];
}

// Brand presets
export const DEVICE_BRANDS = [
  'Apple', 'Samsung', 'Xiaomi', 'OPPO', 'Vivo', 'Realme', 
  'Huawei', 'Honor', 'Nokia', 'Asus', 'Sony', 'LG', 'อื่นๆ',
];

// อาการที่พบบ่อย (autocomplete)
export const COMMON_PROBLEMS = [
  'จอแตก',
  'จอไม่ติด',
  'จอไม่สัมผัส',
  'แบตเสื่อม',
  'แบตหมดเร็ว',
  'ชาร์จไม่เข้า',
  'เปิดไม่ติด',
  'ค้าง / เด้ง',
  'กล้องเสีย',
  'ลำโพงเสีย',
  'ไมค์ไม่ดัง',
  'ปุ่ม power เสีย',
  'ปุ่ม volume เสีย',
  'ตกน้ำ',
  'ฝาหลังแตก',
  'ลืมรหัส',
];
