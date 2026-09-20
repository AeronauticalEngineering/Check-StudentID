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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-md w-full max-h-screen overflow-y-auto border border-slate-100 font-sans">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-900">
            {currentProfile ? 'แก้ไขโปรไฟล์' : 'ตั้งค่าโปรไฟล์'}
          </h2>
          <button 
            onClick={onCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="editFullName" className="block text-sm font-normal text-slate-700 mb-1">
              ชื่อ-สกุล <span className="text-red-500">*</span>
            </label>
            <input 
              id="editFullName" 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              required 
              className="w-full p-3 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#000946]/20 focus:border-[#000946] outline-none placeholder:text-slate-400 font-normal text-sm transition-all" 
              placeholder="กรุณากรอกชื่อและนามสกุล"
            />
          </div>
          
          <div>
            <label htmlFor="editStudentId" className="block text-sm font-normal text-slate-700 mb-1">
              รหัสผู้สมัคร (ไม่บังคับ)
            </label>
            <input 
              id="editStudentId" 
              type="text" 
              value={studentId} 
              onChange={(e) => setStudentId(e.target.value)} 
              className="w-full p-3 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#000946]/20 focus:border-[#000946] outline-none placeholder:text-slate-400 font-normal text-sm transition-all" 
              placeholder="กรุณากรอกรหัสผู้สมัคร (หากมี)"
            />
          </div>
          
          <div>
            <label htmlFor="editNationalId" className="block text-sm font-normal text-slate-700 mb-1">
              เลขบัตรประชาชน (13 หลัก) <span className="text-red-500">*</span>
            </label>
            <input 
              id="editNationalId" 
              type="tel" 
              value={nationalId} 
              onChange={(e) => setNationalId(e.target.value)} 
              required 
              pattern="\d{13}" 
              className="w-full p-3 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#000946]/20 focus:border-[#000946] outline-none placeholder:text-slate-400 font-normal text-sm tracking-wide transition-all" 
              placeholder="กรุณากรอกเลขบัตรประชาชน"
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-normal">
              {error}
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 font-normal rounded-xl hover:bg-slate-200 transition-colors text-sm"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-[#000946] hover:bg-[#00125e] text-white font-normal rounded-xl shadow-sm hover:shadow transition-all disabled:bg-slate-300 text-sm"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}