'use client';

import { useState } from 'react';
import { db } from '../../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function EditProfileForm({ currentProfile, liffProfile, onProfileUpdated, onCancel }) {
  const [fullName, setFullName] = useState(currentProfile.fullName || '');
  const [studentId, setStudentId] = useState(currentProfile.studentId || '');
  const [nationalId, setNationalId] = useState(currentProfile.nationalId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    const updatedData = { 
      fullName: fullName.trim(), 
      studentId: studentId.trim() || null,
      nationalId: nationalId.trim(), 
      updatedAt: serverTimestamp() 
    };

    try {
      const studentDocRef = doc(db, 'studentProfiles', liffProfile.userId);
      await updateDoc(studentDocRef, updatedData);
      
      onProfileUpdated({ ...currentProfile, ...updatedData });
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์");
      console.error("Profile update error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">แก้ไขโปรไฟล์</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="editFullName" className="block text-sm font-medium text-gray-700">ชื่อ-สกุล</label>
            <input 
              id="editFullName" 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              required 
              className="mt-1 w-full p-3 border border-gray-300 rounded-md" 
              placeholder="กรุณากรอกชื่อและนามสกุล"
            />
          </div>
          
          <div>
            <label htmlFor="editStudentId" className="block text-sm font-medium text-gray-700">รหัสผู้สมัคร (ไม่บังคับ)</label>
            <input 
              id="editStudentId" 
              type="text" 
              value={studentId} 
              onChange={(e) => setStudentId(e.target.value)} 
              className="mt-1 w-full p-3 border border-gray-300 rounded-md" 
              placeholder="กรุณากรอกรหัสผู้สมัคร (หากมี)"
            />
          </div>
          
          <div>
            <label htmlFor="editNationalId" className="block text-sm font-medium text-gray-700">เลขบัตรประชาชน (13 หลัก)</label>
            <input 
              id="editNationalId" 
              type="tel" 
              value={nationalId} 
              onChange={(e) => setNationalId(e.target.value)} 
              required 
              pattern="\d{13}" 
              className="mt-1 w-full p-3 border border-gray-300 rounded-md" 
              placeholder="กรุณากรอกเลขบัตรประชาชน"
            />
          </div>
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 py-2 px-4 bg-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-400"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 bg-primary text-white font-semibold rounded-md hover:bg-primary-hover disabled:bg-gray-400"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}