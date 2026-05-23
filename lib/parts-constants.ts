// Constants สำหรับอะไหล่งานซ่อม

export const PART_CATEGORIES = [
  { id: 'battery', label: '🔋 แบตเตอรี่', short: 'แบต' },
  { id: 'screen', label: '📱 หน้าจอ', short: 'จอ' },
  { id: 'charging_port', label: '🔌 แพรชาร์จ', short: 'แพรชาร์จ' },
  { id: 'camera', label: '📷 กล้อง', short: 'กล้อง' },
  { id: 'speaker', label: '🔊 ลำโพง', short: 'ลำโพง' },
  { id: 'mic', label: '🎤 ไมค์', short: 'ไมค์' },
  { id: 'back_cover', label: '🔙 ฝาหลัง', short: 'ฝาหลัง' },
  { id: 'button', label: '⚪ ปุ่ม', short: 'ปุ่ม' },
  { id: 'ic', label: '💡 IC', short: 'IC' },
  { id: 'cable', label: '🧵 สาย', short: 'สาย' },
  { id: 'other', label: '🔧 อื่นๆ', short: 'อื่นๆ' },
] as const;

export const PART_GRADES = [
  { id: 'original', label: 'แท้', color: '#10b981' },
  { id: 'refurb', label: 'แท้ถอด', color: '#3b82f6' },
  { id: 'oem', label: 'OEM', color: '#8b5cf6' },
  { id: 'oled', label: 'OLED', color: '#ec4899' },
  { id: 'incell', label: 'Incell', color: '#f59e0b' },
  { id: 'aaa', label: 'AAA', color: '#6b7280' },
] as const;

export function getCategoryLabel(id: string): string {
  return PART_CATEGORIES.find(c => c.id === id)?.label || id;
}

export function getCategoryShort(id: string): string {
  return PART_CATEGORIES.find(c => c.id === id)?.short || id;
}

export function getGradeInfo(id: string) {
  return PART_GRADES.find(g => g.id === id);
}

// Phone model presets ที่ใช้บ่อย (autocomplete suggestions)
export const COMMON_PHONE_MODELS = [
  // iPhone
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
  'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
  'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini',
  'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini',
  'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
  'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X',
  'iPhone 8 Plus', 'iPhone 8', 'iPhone 7 Plus', 'iPhone 7',
  'iPhone SE 3', 'iPhone SE 2',
  // Samsung
  'Samsung S24 Ultra', 'Samsung S24', 'Samsung S23', 'Samsung S22',
  'Samsung Note 20', 'Samsung Note 10',
  'Samsung A54', 'Samsung A34', 'Samsung A24', 'Samsung A14',
  'Samsung A52', 'Samsung A32', 'Samsung A22', 'Samsung A12',
  // Xiaomi
  'Xiaomi 13', 'Xiaomi 12', 'Xiaomi 11',
  'Redmi Note 12', 'Redmi Note 11', 'Redmi Note 10',
  'Redmi 12', 'Redmi 11', 'Redmi 10',
  'POCO X5', 'POCO X4',
  // OPPO
  'OPPO A78', 'OPPO A58', 'OPPO A18',
  'OPPO Reno 10', 'OPPO Reno 8',
  // Vivo
  'Vivo Y36', 'Vivo Y27', 'Vivo Y17',
  // Realme
  'Realme C53', 'Realme 10', 'Realme 9',
];
