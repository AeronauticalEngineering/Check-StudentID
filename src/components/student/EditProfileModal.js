'use client';

import { useState } from 'react';
import { db } from '../../lib/firebase';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function EditProfileModal({ currentProfile, liffProfile, onProfileUpdated, onCancel }) {
  const [fullName, setFullName] = useState(currentProfile?.fullName || '');
  const [studentId, setStudentId] = useState(currentProfile?.studentId || '');
  const [nationalId, setNationalId] = useState(currentProfile?.nationalId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    const profileData = { 
      fullName: fullName.trim(), 
      studentId: studentId.trim() || null, // ไม่บังคับ
      nationalId: nationalId.trim(), 
      updatedAt: serverTimestamp() 
    };

    try {
      const studentDocRef = doc(db, 'studentProfiles', liffProfile.userId);
      
      if (currentProfile) {
        // อัปเดตโปรไฟล์ที่มีอยู่
        await updateDoc(studentDocRef, profileData);
      } else {
        // สร้างโปรไฟล์ใหม่
        await setDoc(studentDocRef, {
          ...profileData,
          createdAt: serverTimestamp()
        });
      }
      
      onProfileUpdated(profileData);
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการบันทึกโปรไฟล์");
      console.error("Profile update error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {currentProfile ? 'แก้ไขโปรไฟล์' : 'ตั้งค่าโปรไฟล์'}
          </h2>
          <button 
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="editFullName" className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อ-สกุล <span className="text-red-500">*</span>
            </label>
            <input 
              id="editFullName" 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              required 
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              placeholder="กรุณากรอกชื่อและนามสกุล"
            />
          </div>
          
          <div>
            <label htmlFor="editStudentId" className="block text-sm font-medium text-gray-700 mb-1">
              รหัสผู้สมัคร (ไม่บังคับ)
            </label>
            <input 
              id="editStudentId" 
              type="text" 
              value={studentId} 
              onChange={(e) => setStudentId(e.target.value)} 
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              placeholder="กรุณากรอกรหัสผู้สมัคร (หากมี)"
            />
          </div>
          
          <div>
            <label htmlFor="editNationalId" className="block text-sm font-medium text-gray-700 mb-1">
              เลขบัตรประชาชน (13 หลัก) <span className="text-red-500">*</span>
            </label>
            <input 
              id="editNationalId" 
              type="tel" 
              value={nationalId} 
              onChange={(e) => setNationalId(e.target.value)} 
              required 
              pattern="\d{13}" 
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              placeholder="กรุณากรอกเลขบัตรประชาชน"
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-400 transition-colors"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}