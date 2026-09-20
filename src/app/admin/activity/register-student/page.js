'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { registerStudentForActivity } from '../../../../lib/registrationService';
import { upsertStudentProfile } from '../../../../lib/studentService';
import { useModal } from '../../../../context/ModalContext';

export default function AdminRegisterStudentPage() {
  const { showToast } = useModal();
  const [activities, setActivities] = useState([]);

  const [courses, setCourses] = useState({});
  const [selectedActivity, setSelectedActivity] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [nationalId, setNationalId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activitiesSnapshot, categoriesSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'activities'), orderBy('activityDate', 'desc'))),
          getDocs(collection(db, 'categories'))
        ]);

        const coursesMap = {};
        categoriesSnapshot.forEach(doc => {
          coursesMap[doc.id] = doc.data().name;
        });
        setCourses(coursesMap);

        const activitiesList = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActivities(activitiesList);
      } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', error);
        setMessage({ type: 'error', text: 'ไม่สามารถโหลดข้อมูลเริ่มต้นได้' });
      }
    };
    fetchData();
  }, []);

  const handleRegisterNext = () => {
    setGeneratedLink('');
    setMessage(null);
    setFullName('');
    setStudentId('');
    setNationalId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedActivity) {
      setMessage({ type: 'error', text: 'กรุณาเลือกกิจกรรมที่ต้องการลงทะเบียน' });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setGeneratedLink('');

    try {
      const trimmedNationalId = nationalId.trim();
      const trimmedFullName = fullName.trim();
      const trimmedStudentId = studentId.trim() || null;

      // 1. บันทึกโปรไฟล์นักเรียนเป็น Master Record
      await upsertStudentProfile({
        nationalId: trimmedNationalId,
        fullName: trimmedFullName,
        studentId: trimmedStudentId,
        source: 'admin_register'
      });

      // 2. ลงทะเบียนเข้าร่วมกิจกรรมผ่าน Registration Service
      const act = activities.find(a => a.id === selectedActivity);
      await registerStudentForActivity({
        activityId: selectedActivity,
        nationalId: trimmedNationalId,
        fullName: trimmedFullName,
        studentId: trimmedStudentId,
        courseId: act?.courseId || act?.categoryId || null,
        registeredBy: 'admin'
      });

      const link = `${window.location.origin}/student/my-registrations`;
      setGeneratedLink(link);

      setMessage({
        type: 'success',
        text: `ลงทะเบียนให้ "${trimmedFullName}" สำเร็จ! ให้นักเรียนสแกน QR Code เพื่อเปิดระบบใน LINE`
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto font-sans">
      {/* Top Header Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
        <h1 className="text-base font-bold text-slate-900">ลงทะเบียนนักเรียนโดยผู้ดูแล (Direct Student Registration)</h1>
        <p className="text-sm font-normal text-slate-500">สร้างประวัตินักเรียนและลงทะเบียนเข้าร่วมกิจกรรมโดยตรง พร้อมสร้าง QR Code ให้ผู้เข้าร่วม</p>
      </div>

      {/* Main Container Card */}
      <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
        {/* Feedback Message */}
        {message && (
          <div className={`p-3 rounded-lg text-sm font-normal border flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {message.type === 'success' ? (
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span>{message.text}</span>
          </div>
        )}

        {generatedLink ? (
          <div className="text-center space-y-4 py-4">
            <div className="p-4 bg-slate-50 border border-slate-200 inline-block rounded-xl">
              <QRCodeSVG value={generatedLink} size={200} />
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                ให้นักเรียนสแกน QR Code นี้เพื่อเปิดข้อมูลการลงทะเบียนในแอป LINE
              </p>
              <p className="text-sm text-slate-500 font-normal break-all max-w-md mx-auto">
                {generatedLink}
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedLink);
                  showToast({ message: 'คัดลอกลิงก์สำเร็จ', type: 'success' });
                }}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-normal rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                คัดลอกลิงก์
              </button>

              <button
                type="button"
                onClick={handleRegisterNext}
                className="px-5 py-2 bg-[#000946] hover:bg-[#000c5a] text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                ลงทะเบียนคนถัดไป →
              </button>
            </div>

          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: Select Activity */}
            <div className="space-y-1.5">
              <label htmlFor="activity" className="block text-sm font-normal text-slate-700">
                1. เลือกกิจกรรม <span className="text-red-500">*</span>
              </label>
              <select
                id="activity"
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                required
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-900 outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20 transition-all"
              >
                <option value="">-- กรุณาเลือกกิจกรรม --</option>
                {activities.map(act => (
                  <option key={act.id} value={act.id}>
                    {act.name} {act.location ? `(${act.location})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Student Information */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <span className="text-sm font-bold text-slate-900 block uppercase tracking-wide">
                2. ข้อมูลนักเรียน
              </span>

              <div className="space-y-1.5">
                <label className="block text-sm font-normal text-slate-700">
                  ชื่อ-สกุล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น นาย สมชาย ใจดี"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-900 outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-normal text-slate-700">
                  รหัสผู้สมัคร / รหัสนักศึกษา (ถ้ามี)
                </label>
                <input
                  type="text"
                  placeholder="เช่น ST-1001"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-900 outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-normal text-slate-700">
                  เลขประจำตัวประชาชน (13 หลัก) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="กรอกเลขบัตรประชาชน 13 หลัก"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  required
                  pattern="\d{13}"
                  maxLength={13}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-900 outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-[#000946] hover:bg-[#000c5a] disabled:opacity-50 text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-5 h-5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{isLoading ? 'กำลังบันทึกข้อมูล...' : 'ลงทะเบียนและสร้าง QR Code'}</span>
                </button>
              </div>

            </div>
          </form>
        )}
      </div>
    </div>
  );
}