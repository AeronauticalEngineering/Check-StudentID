'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../../context/AdminAuthContext';

export default function AdminLoginPage() {

  const router = useRouter();
  const { currentUser, login, isLoading: isAuthLoading } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to /admin/activity
  useEffect(() => {
    if (!isAuthLoading && currentUser) {
      router.replace('/admin/activity');
    }
  }, [currentUser, isAuthLoading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await login(email, password);
      router.replace('/admin/activity');
    } catch (err) {
      console.error('Login error:', err);
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (err.code === 'auth/too-many-requests') {
        setError('มีการพยายามเข้าสู่ระบบผิดพลาดหลายครั้ง กรุณารอสักครู่');
      } else if (err.code === 'auth/invalid-email') {
        setError('รูปแบบอีเมลไม่ถูกต้อง');
      } else {
        setError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-500 text-xs">
          <div className="w-8 h-8 border-2 border-[#166E7C] border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium">กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4 select-none relative overflow-hidden font-sans">
      {/* Minimal Ambient Glow Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-[#166E7C]/5 rounded-full blur-3xl" />
        <div className="absolute -top-24 right-1/4 w-80 h-80 bg-[#C59B27]/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-in fade-in zoom-in-95 duration-200 space-y-4">
        {/* Minimal Brand Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/60 p-7 sm:p-8 space-y-6 relative overflow-hidden">
          {/* Top 3-Color Minimal Accent Strip */}
          <div className="absolute top-0 left-0 right-0 h-1.5 flex">
            <div className="w-1/3 bg-white" />
            <div className="w-1/3 bg-[#ff741f]" />
            <div className="w-1/3 bg-[#000946]" />
          </div>

          {/* Brand Header */}
          <div className="text-center space-y-3 pt-1">
            {/* Seminar Icon Badge */}
            <div className="relative inline-block">
              <div className="w-13 h-13 rounded-2xl bg-[#000946] flex items-center justify-center text-white shadow-md mx-auto border border-slate-700">
                {/* Seminar / Conference Presentation Icon */}
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="12" rx="2" />
                  <path d="M8 8h8" />
                  <path d="M8 11h5" />
                  <path d="M12 15v6" />
                  <path d="M8 21h8" />
                </svg>
              </div>
              {/* Orange Accent Dot */}
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#ff741f] rounded-full border-2 border-white shadow-xs" />
            </div>

            <div>
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  AERO <span className="text-[#ff741f]">Admin</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-[#c24f04] border border-[#ff741f]/30">
                  PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-normal">
                ระบบจัดการกิจกรรม การจัดที่นั่ง และรันคิวผู้สมัคร
              </p>
            </div>
          </div>

          {/* Error Message Box */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
              <svg className="w-4 h-4 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700">
                อีเมลผู้ดูแลระบบ (Admin Email)
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@aero.ac.th"
                  required
                  autoFocus
                  className="w-full pl-9.5 pr-3.5 py-2.5 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#166E7C] focus:ring-3 focus:ring-[#166E7C]/10 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all font-medium"
                />
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                </svg>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-9.5 pr-10 py-2.5 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#000946] focus:ring-3 focus:ring-[#000946]/10 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all font-medium"
                />
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>

                {/* Show/Hide password toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors cursor-pointer"
                  title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-[#000946] hover:bg-[#00125e] text-white text-xs font-bold rounded-xl shadow-md active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer border border-[#000946]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>กำลังเข้าสู่ระบบ...</span>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span>เข้าสู่ระบบผู้ดูแล</span>
                  <span>→</span>
                </div>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


