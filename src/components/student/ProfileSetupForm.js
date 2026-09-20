'use client';

import { useState } from 'react';
import { linkStudentLineAccount } from '../../lib/studentService';
import { syncUnlinkedRegistrations } from '../../lib/registrationService';

export default function ProfileSetupForm({ liffProfile, onProfileCreated }) {
  const [nationalId, setNationalId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const trimmedNationalId = nationalId.trim();

      // ใช้ Service เพื่อผูกบัญชี LINE กับโปรไฟล์นักเรียน
      const linkedProfile = await linkStudentLineAccount(trimmedNationalId, liffProfile);

      // อัปเดตประวัติการลงทะเบียนเดิมทั้งหมดให้ผูกกับ LINE ID ปัจจุบัน
      await syncUnlinkedRegistrations(trimmedNationalId, liffProfile.userId);

      onProfileCreated(linkedProfile);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกโปรไฟล์');
      console.error('Profile setup error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 md:p-8 font-sans">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100 text-center">
        <div className="w-16 h-16 bg-slate-100 text-[#000946] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">ตั้งค่าโปรไฟล์นักเรียน</h1>
        <p className="text-gray-500 text-sm font-normal mb-6">กรุณากรอกเลขประจำตัวประชาชนเพื่อเชื่อมต่อประวัติกิจกรรม</p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label htmlFor="nationalId" className="block text-sm font-normal text-gray-700 mb-1">
              เลขประจำตัวประชาชน (13 หลัก)
            </label>
            <input
              id="nationalId"
              type="tel"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              required
              pattern="\d{13}"
              className="w-full px-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#000946]/20 focus:border-[#000946] outline-none transition-all text-base tracking-wider text-center font-normal"
              placeholder="XXXXXXXXXXXXX"
              maxLength={13}
            />
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 text-red-700 text-sm font-normal rounded-xl border border-red-100 flex items-center gap-2 animate-fade-in">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#000946] hover:bg-[#00125e] text-white font-normal rounded-xl shadow-lg shadow-[#000946]/20 active:scale-95 disabled:bg-gray-300 transition-all duration-200 text-sm mt-2"
          >
            {isSubmitting ? 'กำลังตรวจสอบข้อมูล...' : 'ยืนยันและเริ่มต้นใช้งาน'}
          </button>
        </form>
      </div>
    </div>
  );
}