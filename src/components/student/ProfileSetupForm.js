'use client';

import { useState } from 'react';
import { db } from '../../lib/firebase'; // ปรับ path ให้ถูกต้อง
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Component ฟอร์มสำหรับให้ผู้ใช้ใหม่สร้างโปรไฟล์นักเรียน
 * @param {object} props - Props ที่รับเข้ามา
 * @param {object} props.liffProfile - โปรไฟล์ที่ได้จาก LIFF (เพื่อใช้ userId)
 * @param {function} props.onProfileCreated - Callback function ที่จะทำงานเมื่อสร้างโปรไฟล์สำเร็จ
 */
export default function ProfileSetupForm({ liffProfile, onProfileCreated }) {
  // 👇 แก้ไข: ให้ fullName เริ่มต้นเป็นค่าว่างเสมอ
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    const profileData = { 
      fullName: fullName.trim(), 
      studentId: studentId.trim() || null, // ให้เป็น null หากไม่กรอก
      nationalId: nationalId.trim(), 
      createdAt: serverTimestamp() 
    };

    try {
      // ใช้ lineUserId เป็น ID ของ document เพื่อให้เชื่อมโยงกัน
      const studentDocRef = doc(db, 'studentProfiles', liffProfile.userId);
      await setDoc(studentDocRef, profileData);
      
      // ส่งข้อมูลที่เพิ่งสร้างกลับไปให้หน้าหลักเพื่ออัปเดต UI ทันที
      onProfileCreated(profileData); 
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการบันทึกโปรไฟล์");
      console.error("Profile creation error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 md:p-8">
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-2">ตั้งค่าโปรไฟล์นักเรียน</h1>
        <p className="text-gray-600 mb-6">ข้อมูลนี้จะถูกใช้ในการลงทะเบียนกิจกรรมต่างๆ</p>
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">ชื่อ-สกุล</label>
            <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1 w-full p-3 border border-gray-300 rounded-md" placeholder="กรุณากรอกชื่อและนามสกุล"/>
          </div>
          <div>
            <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">รหัสนักศึกษา (ไม่บังคับ)</label>
            <input id="studentId" type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="mt-1 w-full p-3 border border-gray-300 rounded-md" placeholder="กรุณากรอกรหัสนักศึกษา (หากมี)"/>
          </div>
          <div>
            <label htmlFor="nationalId" className="block text-sm font-medium text-gray-700">เลขบัตรประชาชน (13 หลัก)</label>
            <input id="nationalId" type="tel" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required pattern="\d{13}" className="mt-1 w-full p-3 border border-gray-300 rounded-md" placeholder="กรุณากรอกเลขบัตรประชาชน"/>
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-primary text-white font-bold rounded-md hover:bg-primary-hover transition-colors">
            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกและเริ่มต้นใช้งาน'}
          </button>
        </form>
      </div>
    </div>
  );
}