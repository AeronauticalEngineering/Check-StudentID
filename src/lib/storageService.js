import { storage } from './firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

/**
 * บีบอัดรูปภาพฝั่ง Client ก่อนอัปโหลด (Canvas resize & JPEG quality)
 * ปรับขนาดให้คมชัดพอดีสำหรับเอกสารและหลักฐาน (~12-20 KB)
 * @param {File} file 
 * @param {number} maxWidth 
 * @param {number} quality 
 * @returns {Promise<string>} Base64 Data URL
 */
export async function compressImageToBase64(file, maxWidth = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const elem = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        elem.width = width;
        elem.height = height;
        const ctx = elem.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = elem.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * อัปโหลดรูปภาพเอกสารเข้า Firebase Storage
 * หาก Firebase Storage ยังไม่ได้เปิดใช้งานใน Firebase Console
 * ระบบจะใช้ Base64 Data URL ที่บีบอัดแล้วโดยอัตโนมัติ
 * ทำให้รูปภาพแสดงผลได้ 100% ทุกแพลตฟอร์ม ทั้ง Mobile LINE LIFF, PC และ Vercel
 * @param {string} base64DataUrl 
 * @param {string} path 
 * @returns {Promise<string>} Public URL หรือ Base64 Data URL
 */
export async function uploadDocumentImage(base64DataUrl, path) {
  // 1. ลองอัปโหลดผ่าน Firebase Storage (หากโปรเจกต์เปิดใช้งาน Bucket แล้ว)
  if (storage) {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadString(storageRef, base64DataUrl, 'data_url');
      const downloadURL = await getDownloadURL(snapshot.ref);
      if (downloadURL) {
        return downloadURL;
      }
    } catch (storageErr) {
      console.warn('Firebase Storage not accessible (using compressed Base64 Data URL):', storageErr?.message);
    }
  }

  // 2. ใช้ Base64 Data URL ที่บีบอัดแล้วโดยตรง (~12-18 KB)
  // ไม่ขึ้นกับ Localhost, ไม่ติด CORS, ไม่ติด 404 บน Vercel และแสดงผลใน LINE LIFF ได้ทันที
  return base64DataUrl;
}
