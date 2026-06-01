// ============================================
// lib/image-upload.ts
// Upload รูปไป Supabase Storage + resize ก่อนส่ง
// ============================================

import { createClient } from './supabase-client';

const BUCKET = 'stock-images';
const MAX_SIZE = 1200; // px
const QUALITY = 0.85;

/**
 * Resize image ก่อน upload เพื่อประหยัด storage
 */
async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Scale down ถ้าใหญ่กว่า MAX_SIZE
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const scale = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      // Use white background สำหรับ PNG ที่มี transparency
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to convert'));
        },
        'image/jpeg',
        QUALITY
      );
    };

    img.onerror = () => reject(new Error('Image load failed'));
    reader.onerror = () => reject(new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload รูปไป Supabase Storage
 * คืน URL ที่ใช้แสดงได้เลย (public)
 */
export async function uploadStockImage(
  file: File,
  shopId: string
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('ไฟล์ที่อัปโหลดไม่ใช่รูปภาพ');
  }

  // Check size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('ไฟล์ใหญ่เกิน 5MB กรุณาเลือกไฟล์เล็กกว่า');
  }

  // Resize
  const resized = await resizeImage(file);

  // Generate unique filename
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const filename = `${timestamp}-${random}.jpg`;
  const path = `${shopId}/${filename}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, resized, {
      contentType: 'image/jpeg',
      cacheControl: '31536000', // 1 year
    });

  if (error) {
    throw new Error(`อัปโหลดไม่สำเร็จ: ${error.message}`);
  }

  // Get public URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * ลบรูปจาก Storage (ใช้ตอนเปลี่ยนรูป หรือลบเครื่อง)
 */
export async function deleteStockImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;
  
  // แยก path จาก URL
  const match = imageUrl.match(/stock-images\/(.+)$/);
  if (!match) return;
  
  const path = match[1];
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
