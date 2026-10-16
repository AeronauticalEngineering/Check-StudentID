'use client';

import { useState } from 'react';
import { upsertStudentProfile } from '../../lib/studentService';

export default function EditProfileForm({ currentProfile, liffProfile, onProfileUpdated, onCancel }) {
  const [fullName, setFullName] = useState(currentProfile?.fullName || '');
  const [fullNameEn, setFullNameEn] = useState(currentProfile?.fullNameEn || '');
  const [studentId, setStudentId] = useState(currentProfile?.studentId || '');
  const [nationalId, setNationalId] = useState(currentProfile?.nationalId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const updated = await upsertStudentProfile({
        nationalId: nationalId.trim(),
        fullName: fullName.trim(),
        fullNameEn: fullNameEn.trim().toUpperCase() || null,
        studentId: studentId.trim() || null,
        lineUserId: liffProfile?.userId || currentProfile?.lineUserId || null,
        lineDisplayName: liffProfile?.displayName || currentProfile?.lineDisplayName || null,
        linePictureUrl: liffProfile?.pictureUrl || currentProfile?.linePictureUrl || null,
        source: 'user_edit'
      });

      onProfileUpdated({ ...currentProfile, ...updated });
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์');
      console.error('Profile update error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 font-sans">
        <h2 className="text-xl font-bold text-gray-900 mb-4">แก้ไขข้อมูลโปรไฟล์</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="editFormFullNameEn" className="block text-sm font-semibold text-gray-800">
                NAME SURNAME (ENG)
              </label>
              <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                ตัวพิมพ์ใหญ่
              </span>
            </div>
            <input
              id="editFormFullNameEn"
              type="text"
              value={fullNameEn}
              onChange={(e) => setFullNameEn(e.target.value.toUpperCase())}
              className="w-full p-3 bg-white text-slate-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#000946]/20 focus:border-[#000946] outline-none transition-all text-sm font-medium placeholder:text-slate-400 uppercase tracking-wide"
              placeholder="FIRSTNAME LASTNAME"
            />
            <p className="text-xs text-rose-600 mt-1 font-medium">
              * No title (Mr./Miss) - ไม่ต้องใส่คำนำหน้าชื่อ
            </p>
          </div>

          <div>
            <label htmlFor="editFullName" className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อ-นามสกุล (ไทย) <span className="text-red-500">*</span>
            </label>
            <input
              id="editFullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full p-3 bg-white text-slate-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#000946]/20 focus:border-[#000946] outline-none transition-all text-sm font-normal placeholder:text-slate-400"
              placeholder="กรุณากรอกชื่อและนามสกุล"
            />
          </div>

          <div>
            <label htmlFor="editStudentId" className="block text-sm font-normal text-gray-700 mb-1">
              รหัสผู้สมัคร / รหัสนักศึกษา (ถ้ามี)
            </label>
            <input
              id="editStudentId"
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full p-3 bg-white text-slate-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#000946]/20 focus:border-[#000946] outline-none transition-all text-sm font-normal placeholder:text-slate-400"
              placeholder="กรุณากรอกรหัสผู้สมัคร"
            />
          </div>

          <div>
            <label htmlFor="editNationalId" className="block text-sm font-normal text-gray-700 mb-1">
              เลขบัตรประชาชน (13 หลัก)
            </label>
            <input
              id="editNationalId"
              type="tel"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              required
              pattern="\d{13}"
              className="w-full p-3 bg-white text-slate-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#000946]/20 focus:border-[#000946] outline-none transition-all text-sm font-normal placeholder:text-slate-400"
              placeholder="เลขบัตรประชาชน 13 หลัก"
              maxLength={13}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm font-normal rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 font-normal rounded-xl hover:bg-gray-200 transition-colors text-sm"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-[#000946] text-white font-normal rounded-xl hover:bg-[#00125e] disabled:bg-gray-300 transition-all text-sm shadow-md"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}