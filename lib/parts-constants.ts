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

// ป้ายประเภทแบบไม่มีอิโมจิ เช่น "หน้าจอ" (ใช้ตั้งชื่ออะไหล่อัตโนมัติ)
export function getCategoryPlainLabel(id: string): string {
  return getCategoryLabel(id).replace(/^\S+\s*/, '');
}

export function getGradeInfo(id: string) {
  return PART_GRADES.find(g => g.id === id);
}

// Phone model presets ที่ใช้บ่อย (autocomplete suggestions) — ครอบคลุมรุ่นเก่า-ใหม่ที่พบบ่อยในร้านซ่อมไทย
export const COMMON_PHONE_MODELS = [
  // iPhone
  'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16', 'iPhone 16e',
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
  'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
  'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini',
  'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini',
  'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
  'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X',
  'iPhone 8 Plus', 'iPhone 8', 'iPhone 7 Plus', 'iPhone 7', 'iPhone 6S Plus', 'iPhone 6S', 'iPhone 6 Plus', 'iPhone 6',
  'iPhone SE 3', 'iPhone SE 2', 'iPhone SE',
  // Samsung Galaxy S / Note / Fold / Flip
  'Samsung S25 Ultra', 'Samsung S25+', 'Samsung S25',
  'Samsung S24 Ultra', 'Samsung S24+', 'Samsung S24', 'Samsung S24 FE',
  'Samsung S23 Ultra', 'Samsung S23+', 'Samsung S23', 'Samsung S23 FE',
  'Samsung S22 Ultra', 'Samsung S22+', 'Samsung S22',
  'Samsung S21 Ultra', 'Samsung S21+', 'Samsung S21', 'Samsung S21 FE',
  'Samsung S20 Ultra', 'Samsung S20+', 'Samsung S20', 'Samsung S20 FE',
  'Samsung S10+', 'Samsung S10', 'Samsung S10e', 'Samsung S9+', 'Samsung S9', 'Samsung S8+', 'Samsung S8',
  'Samsung Note 20 Ultra', 'Samsung Note 20', 'Samsung Note 10+', 'Samsung Note 10', 'Samsung Note 9', 'Samsung Note 8',
  'Samsung Z Fold6', 'Samsung Z Fold5', 'Samsung Z Fold4', 'Samsung Z Fold3',
  'Samsung Z Flip6', 'Samsung Z Flip5', 'Samsung Z Flip4', 'Samsung Z Flip3',
  // Samsung A series
  'Samsung A55', 'Samsung A54', 'Samsung A53', 'Samsung A52', 'Samsung A51', 'Samsung A50', 'Samsung A50s',
  'Samsung A35', 'Samsung A34', 'Samsung A33', 'Samsung A32', 'Samsung A31', 'Samsung A30', 'Samsung A30s',
  'Samsung A25', 'Samsung A24', 'Samsung A23', 'Samsung A22', 'Samsung A21s', 'Samsung A20', 'Samsung A20s',
  'Samsung A16', 'Samsung A15', 'Samsung A14', 'Samsung A13', 'Samsung A12', 'Samsung A11', 'Samsung A10', 'Samsung A10s',
  'Samsung A05', 'Samsung A05s', 'Samsung A04', 'Samsung A04s', 'Samsung A03', 'Samsung A03 Core',
  'Samsung A73', 'Samsung A72', 'Samsung A71', 'Samsung A70', 'Samsung A70s',
  'Samsung M12', 'Samsung M13', 'Samsung M14', 'Samsung M32', 'Samsung M33', 'Samsung M34',
  // Xiaomi / Redmi / POCO
  'Xiaomi 14T', 'Xiaomi 14', 'Xiaomi 13T', 'Xiaomi 13', 'Xiaomi 12T', 'Xiaomi 12', 'Xiaomi 11T', 'Xiaomi 11',
  'Xiaomi Mi 11', 'Xiaomi Mi 10', 'Xiaomi Mi 9',
  'Redmi Note 13 Pro', 'Redmi Note 13', 'Redmi Note 12 Pro', 'Redmi Note 12',
  'Redmi Note 11 Pro', 'Redmi Note 11', 'Redmi Note 10 Pro', 'Redmi Note 10',
  'Redmi Note 9 Pro', 'Redmi Note 9', 'Redmi Note 8 Pro', 'Redmi Note 8',
  'Redmi 13C', 'Redmi 13', 'Redmi 12C', 'Redmi 12', 'Redmi 11', 'Redmi 10C', 'Redmi 10A', 'Redmi 10',
  'Redmi 9C', 'Redmi 9A', 'Redmi 9', 'Redmi 8A', 'Redmi 8',
  'POCO X6 Pro', 'POCO X6', 'POCO X5 Pro', 'POCO X5', 'POCO X4 Pro', 'POCO X3',
  'POCO M6', 'POCO M5', 'POCO M4 Pro', 'POCO F6', 'POCO F5', 'POCO C65', 'POCO C55', 'POCO C50',
  // OPPO
  'OPPO Reno12', 'OPPO Reno11', 'OPPO Reno10', 'OPPO Reno9', 'OPPO Reno8', 'OPPO Reno7', 'OPPO Reno6', 'OPPO Reno5', 'OPPO Reno4',
  'OPPO Find X7', 'OPPO Find X6', 'OPPO Find X5',
  'OPPO A3', 'OPPO A3s', 'OPPO A5', 'OPPO A5s', 'OPPO A5 2020', 'OPPO A7', 'OPPO A9', 'OPPO A9 2020',
  'OPPO A11', 'OPPO A11k', 'OPPO A12', 'OPPO A15', 'OPPO A15s', 'OPPO A16', 'OPPO A16k', 'OPPO A17', 'OPPO A18',
  'OPPO A31', 'OPPO A33', 'OPPO A37', 'OPPO A52', 'OPPO A53', 'OPPO A54', 'OPPO A55', 'OPPO A57', 'OPPO A58', 'OPPO A59',
  'OPPO A71', 'OPPO A74', 'OPPO A76', 'OPPO A77', 'OPPO A78', 'OPPO A83', 'OPPO A91', 'OPPO A92', 'OPPO A93', 'OPPO A95', 'OPPO A96',
  'OPPO F9', 'OPPO F11',
  // Vivo
  'Vivo X100', 'Vivo X90', 'Vivo X80', 'Vivo X70', 'Vivo X60', 'Vivo X50',
  'Vivo V30', 'Vivo V29', 'Vivo V27', 'Vivo V25', 'Vivo V23', 'Vivo V21', 'Vivo V20', 'Vivo V17', 'Vivo V15',
  'Vivo Y100', 'Vivo Y50', 'Vivo Y51', 'Vivo Y53', 'Vivo Y55', 'Vivo Y66', 'Vivo Y69',
  'Vivo Y71', 'Vivo Y81', 'Vivo Y91', 'Vivo Y91c', 'Vivo Y93', 'Vivo Y95',
  'Vivo Y11', 'Vivo Y12', 'Vivo Y15', 'Vivo Y17', 'Vivo Y19', 'Vivo Y20', 'Vivo Y21', 'Vivo Y21s',
  'Vivo Y22', 'Vivo Y22s', 'Vivo Y27', 'Vivo Y30', 'Vivo Y33s', 'Vivo Y36',
  // Realme
  'Realme 12 Pro', 'Realme 12', 'Realme 11 Pro', 'Realme 11', 'Realme 10 Pro', 'Realme 10',
  'Realme 9 Pro', 'Realme 9i', 'Realme 9', 'Realme 8 Pro', 'Realme 8i', 'Realme 8',
  'Realme 7 Pro', 'Realme 7i', 'Realme 7', 'Realme 6i', 'Realme 6', 'Realme 5s', 'Realme 5i', 'Realme 5', 'Realme 3 Pro', 'Realme 3', 'Realme 2', 'Realme 1',
  'Realme C61', 'Realme C55', 'Realme C53', 'Realme C51', 'Realme C35', 'Realme C33', 'Realme C31', 'Realme C30',
  'Realme C25Y', 'Realme C25', 'Realme C21Y', 'Realme C21', 'Realme C20', 'Realme C17', 'Realme C15', 'Realme C12', 'Realme C11', 'Realme C3', 'Realme C2', 'Realme C1',
  'Realme Narzo 70', 'Realme Narzo 50', 'Realme GT Neo',
  // Huawei
  'Huawei Mate 50', 'Huawei Mate 40', 'Huawei Mate 30', 'Huawei Mate 20',
  'Huawei P40 Pro', 'Huawei P40', 'Huawei P30 Pro', 'Huawei P30', 'Huawei P20 Pro', 'Huawei P20',
  'Huawei Nova 9', 'Huawei Nova 7', 'Huawei Nova 5T', 'Huawei Nova 3',
  'Huawei Y9', 'Huawei Y7', 'Huawei Y6', 'Huawei Y5',
  // Honor
  'Honor Magic6', 'Honor Magic5', 'Honor 90', 'Honor 70', 'Honor 50', 'Honor X9', 'Honor X8', 'Honor 10X', 'Honor 9X', 'Honor 8X',
  // Google Pixel
  'Pixel 9 Pro', 'Pixel 9', 'Pixel 8a', 'Pixel 8 Pro', 'Pixel 8', 'Pixel 7a', 'Pixel 7 Pro', 'Pixel 7', 'Pixel 6a', 'Pixel 6 Pro', 'Pixel 6', 'Pixel 5a', 'Pixel 5', 'Pixel 4a', 'Pixel 4',
  // ASUS
  'ASUS ROG Phone 8', 'ASUS ROG Phone 7', 'ASUS ROG Phone 6', 'ASUS ROG Phone 5',
  'ASUS Zenfone 10', 'ASUS Zenfone 9', 'ASUS Zenfone 8',
  // Nokia (HMD)
  'Nokia G42', 'Nokia G21', 'Nokia C32', 'Nokia C30', 'Nokia C20', 'Nokia 7.2', 'Nokia 6.2', 'Nokia 5.4', 'Nokia 3.4',
  // Infinix
  'Infinix Zero 20', 'Infinix Note 30', 'Infinix Note 12', 'Infinix Hot 30', 'Infinix Hot 12', 'Infinix Hot 11', 'Infinix Hot 10', 'Infinix Smart 7',
  // Tecno
  'Tecno Pova 5', 'Tecno Camon 20', 'Tecno Camon 19', 'Tecno Camon 18', 'Tecno Spark 10', 'Tecno Spark 9', 'Tecno Spark 8',
  // Nothing
  'Nothing Phone 2a', 'Nothing Phone 2', 'Nothing Phone 1',
];
