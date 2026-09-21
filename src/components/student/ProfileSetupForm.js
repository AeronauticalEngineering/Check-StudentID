'use client';

import { useState } from 'react';
import { registerOrLinkStudentProfile } from '../../lib/studentService';
import { syncUnlinkedRegistrations } from '../../lib/registrationService';

export default function ProfileSetupForm({ liffProfile, onProfileCreated }) {
  const [fullName, setFullName] = useState(liffProfile?.displayName || '');
  const [nationalId, setNationalId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const trimmedNationalId = nationalId.trim();
      const trimmedFullName = fullName.trim();
      const trimmedStudentId = studentId.trim();

      if (!trimmedFullName) {
        throw new Error('กรุณากรอกชื่อ-นามสกุล');
      }

      if (trimmedNationalId.length !== 13 || !/^\d{13}$/.test(trimmedNationalId)) {
        throw new Error('กรุณากรอกเลขประจำตัวประชาชน 13 หลักให้ถูกต้อง');
      }

      // บันทึก/ผูกบัญชีโปรไฟล์นักเรียน (รองรับทั้งนักเรียนใหม่ และนักเรียนที่มีชื่อในระบบเดิม)
      const profile = await registerOrLinkStudentProfile({
        nationalId: trimmedNationalId,
        fullName: trimmedFullName,
        studentId: trimmedStudentId || null,
        liffProfile
      });

      // ซิงค์การลงทะเบียนเดิมทั้งหมด (ถ้ามี)
      await syncUnlinkedRegistrations(trimmedNationalId, liffProfile.userId);

      onProfileCreated(profile);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกโปรไฟล์');
      console.error('Profile setup error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 font-sans">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200/80 text-center">
        {/* Header Icon / Avatar */}
        <div className="w-16 h-16 bg-gradient-to-br from-[#000946] to-[#001c80] text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#000946]/20">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1.5">ตั้งค่าโปรไฟล์นักเรียน</h1>
        <p className="text-slate-500 text-sm font-normal mb-6 leading-relaxed">
          กรอกข้อมูลของคุณเพื่อสร้างโปรไฟล์และเชื่อมต่อกับบัญชี LINE สำหรับการลงทะเบียนกิจกรรม
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* ชื่อ - สกุล */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">
              ชื่อ - นามสกุล <span className="text-rose-500">*</span>
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#000946]/20 focus:border-[#000946] outline-none transition-all text-sm font-normal"
              placeholder="เช่น นายสมชาย ใจดี"
            />
          </div>

          {/* เลขประจำตัวประชาชน 13 หลัก */}
          <div>
            <label htmlFor="nationalId" className="block text-sm font-medium text-slate-700 mb-1">
              เลขประจำตัวประชาชน (13 หลัก) <span className="text-rose-500">*</span>
            </label>
            <input
              id="nationalId"
              type="tel"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
              required
              pattern="\d{13}"
              className="w-full px-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#000946]/20 focus:border-[#000946] outline-none transition-all text-sm tracking-widest text-center font-mono"
              placeholder="XXXXXXXXXXXXX"
              maxLength={13}
            />
            <p className="text-xs text-slate-400 mt-1 font-normal">
              ใช้สำหรับเชื่อมต่อประวัติการสมัครและตรวจสอบสิทธิ์
            </p>
          </div>

          {/* รหัสนักศึกษา / รหัสผู้สมัคร */}
          <div>
            <label htmlFor="studentId" className="block text-sm font-medium text-slate-700 mb-1">
              รหัสนักศึกษา / รหัสผู้สมัคร <span className="text-slate-400 font-normal text-xs">(ไม่บังคับ)</span>
            </label>
            <input
              id="studentId"
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full px-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#000946]/20 focus:border-[#000946] outline-none transition-all text-sm font-normal"
              placeholder="เช่น 67012345 หรือ AERO-001"
            />
          </div>

          {/* Notice Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <svg className="w-4 h-4 text-[#000946] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>ข้อมูลสำคัญ</span>
            </div>
            <p className="font-normal text-slate-500 leading-relaxed">
              หากท่านมีประวัติการลงทะเบียนในระบบอยู่แล้ว ระบบจะเชื่อมโยงประวัติและบัตรคิวเข้ากับ LINE ของท่านโดยอัตโนมัติ
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 text-rose-700 text-sm font-normal rounded-xl border border-rose-200 flex items-start gap-2 animate-fade-in">
              <svg className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#000946] hover:bg-[#00125e] text-white font-medium rounded-xl shadow-lg shadow-[#000946]/20 active:scale-98 disabled:bg-slate-300 disabled:shadow-none transition-all duration-200 text-sm mt-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                <span>กำลังบันทึกข้อมูล...</span>
              </>
            ) : (
              <span>บันทึกโปรไฟล์และเริ่มต้นใช้งาน</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}