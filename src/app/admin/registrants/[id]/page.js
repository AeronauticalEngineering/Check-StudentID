'use client';

import { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import Papa from 'papaparse';
import { upsertStudentProfile, resetStudentLineBinding, deleteStudentProfile } from '../../../../lib/studentService';
import ExaminerScoringModal from '../../../../components/ExaminerScoringModal';
import { useModal } from '../../../../context/ModalContext';

const getThaiStatus = (status) => {
  switch (status) {
    case 'checked-in':
      return { label: 'เช็คอินแล้ว', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'completed':
      return { label: 'จบกิจกรรมแล้ว', className: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'cancelled':
      return { label: 'ยกเลิกแล้ว', className: 'bg-red-50 text-red-700 border-red-200' };
    case 'calling':
      return { label: 'กำลังเรียก', className: 'bg-amber-50 text-amber-700 border-amber-300 font-semibold animate-pulse' };
    case 'called':
      return { label: 'เรียกคิวแล้ว', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'interviewing':
    case 'serving':
      return { label: 'สอบสัมภาษณ์', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'waitlisted':
      return { label: 'รอคิว', className: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'absent':
      return { label: 'ไม่มารายงานตัว', className: 'bg-red-50 text-red-700 border-red-200' };
    case 'registered':
    default: {
      const lower = String(status || '').toLowerCase();
      if (lower.includes('call')) return { label: 'กำลังเรียก', className: 'bg-amber-50 text-amber-700 border-amber-300 font-semibold animate-pulse' };
      if (lower.includes('interview')) return { label: 'สอบสัมภาษณ์', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      return { label: 'ลงทะเบียนแล้ว', className: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  }
};

export default function StudentDetailPage({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const paramId = unwrappedParams.id;
  const { showAlert, showConfirm, showToast } = useModal();


  const [isLoading, setIsLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);
  const [studentRegistrations, setStudentRegistrations] = useState([]);
  const [activitiesMap, setActivitiesMap] = useState({});
  const [message, setMessage] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    studentId: '',
    nationalId: '',
    lineUserId: ''
  });

  // Fetch activities map
  useEffect(() => {
    const fetchActivities = async () => {
      const snap = await getDocs(collection(db, 'activities'));
      const map = {};
      snap.forEach(d => map[d.id] = { id: d.id, ...d.data() });
      setActivitiesMap(map);
    };
    fetchActivities();
  }, []);

  // Fetch student data and all registered activities
  const fetchStudentData = async () => {
    if (!paramId) return;
    setIsLoading(true);
    try {
      let nationalId = paramId;
      let lineUserId = null;
      let studentId = null;
      let primaryRecord = null;

      // 1. Try to fetch as direct registration document
      const regRef = doc(db, 'registrations', paramId);
      const regSnap = await getDoc(regRef);

      if (regSnap.exists()) {
        primaryRecord = { id: regSnap.id, ...regSnap.data() };
        nationalId = primaryRecord.nationalId || nationalId;
        lineUserId = primaryRecord.lineUserId;
        studentId = primaryRecord.studentId;
      }

      // 2. Fetch all registrations matching nationalId, lineUserId, or studentId
      const allRegsSnap = await getDocs(query(collection(db, 'registrations'), orderBy('registeredAt', 'desc')));
      const matched = [];

      allRegsSnap.forEach(docSnap => {
        const d = {
          id: docSnap.id,
          ...docSnap.data(),
          registeredAtDate: docSnap.data().registeredAt ? docSnap.data().registeredAt.toDate() : null
        };

        const isMatch =
          (nationalId && d.nationalId && d.nationalId.trim() === nationalId.trim()) ||
          (lineUserId && d.lineUserId && d.lineUserId.trim() === lineUserId.trim()) ||
          (studentId && d.studentId && d.studentId.trim() === studentId.trim()) ||
          docSnap.id === paramId;

        if (isMatch) {
          matched.push(d);
          if (!primaryRecord) primaryRecord = d;
        }
      });

      setStudentRegistrations(matched);

      if (primaryRecord) {
        setStudentInfo(primaryRecord);
        setProfileForm({
          fullName: primaryRecord.fullName || '',
          studentId: primaryRecord.studentId || '',
          nationalId: primaryRecord.nationalId || '',
          lineUserId: primaryRecord.lineUserId || ''
        });
      }
    } catch (error) {
      console.error(error);
      setMessage(`❌ ไม่สามารถโหลดข้อมูลได้: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [paramId]);

  // Statistics
  const stats = useMemo(() => {
    const total = studentRegistrations.length;
    const checkedIn = studentRegistrations.filter(r => r.status === 'checked-in').length;
    const completed = studentRegistrations.filter(r => r.status === 'completed').length;
    const registered = studentRegistrations.filter(r => !r.status || r.status === 'registered').length;

    return { total, checkedIn, completed, registered };
  }, [studentRegistrations]);

  // Save profile updates
  const handleSaveProfile = async () => {
    try {
      const updatedNationalId = profileForm.nationalId.trim();
      const updatedFullName = profileForm.fullName.trim();
      const updatedStudentId = profileForm.studentId.trim() || null;
      const updatedLineUserId = profileForm.lineUserId.trim() || null;

      // Update all matched registrations
      for (const reg of studentRegistrations) {
        await updateDoc(doc(db, 'registrations', reg.id), {
          fullName: updatedFullName,
          nationalId: updatedNationalId,
          studentId: updatedStudentId,
          lineUserId: updatedLineUserId
        });
      }

      // Upsert student global profile
      if (updatedNationalId) {
        await upsertStudentProfile({
          nationalId: updatedNationalId,
          fullName: updatedFullName,
          studentId: updatedStudentId,
          lineUserId: updatedLineUserId,
          source: 'admin_edit_page'
        });
      }

      setMessage('✅ บันทึกข้อมูลโปรไฟล์นักเรียนสำเร็จ');
      setIsEditingProfile(false);
      fetchStudentData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  // Reset LINE binding
  const handleResetLine = async () => {
    if (!studentInfo?.lineUserId) return;
    const confirmed = await showConfirm({
      title: 'ยืนยันรีเซตการผูกบัญชี LINE',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการ "รีเซตการผูกบัญชี LINE" สำหรับนักเรียนคนนี้?\n\n(นักเรียนจะสามารถกรอกข้อมูลและผูกบัญชี LINE ใหม่อีกครั้งได้)',
      type: 'warning',
      confirmText: 'รีเซต LINE',
      cancelText: 'ยกเลิก'
    });

    if (confirmed) {
      try {
        await resetStudentLineBinding(studentInfo.lineUserId, studentInfo.id);
        showToast({ message: 'รีเซตการผูกบัญชี LINE สำเร็จ', type: 'success' });
        fetchStudentData();
      } catch (error) {
        showAlert({
          title: 'เกิดข้อผิดพลาด',
          message: `ไม่สามารถรีเซต LINE ได้: ${error.message}`,
          type: 'error'
        });
      }
    }
  };

  // Delete a specific registration
  const handleDeleteRegistration = async (registrationId) => {
    const confirmed = await showConfirm({
      title: 'ยืนยันการลบรายการลงทะเบียน',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการลบรายการลงทะเบียนกิจกรรมนี้?',
      type: 'danger',
      confirmText: 'ลบรายการ',
      cancelText: 'ยกเลิก'
    });

    if (confirmed) {
      try {
        await deleteDoc(doc(db, 'registrations', registrationId));
        showToast({ message: 'ลบรายการลงทะเบียนกิจกรรมสำเร็จ', type: 'success' });
        fetchStudentData();
      } catch (error) {
        showAlert({
          title: 'เกิดข้อผิดพลาด',
          message: `ไม่สามารถลบรายการได้: ${error.message}`,
          type: 'error'
        });
      }
    }
  };


  const [scoringRegistrant, setScoringRegistrant] = useState(null);
  const [activeActivityForModal, setActiveActivityForModal] = useState(null);

  // Export CSV for this student
  const handleExportCSV = () => {
    try {
      const csvData = studentRegistrations.map((reg, index) => {
        const activity = activitiesMap[reg.activityId] || {};
        const evalScore = reg.evaluationScore || {};
        const attached = reg.attachedDocuments || {};

        const row = {
          'ลำดับ': index + 1,
          'ชื่อ-สกุล': reg.fullName || '',
          'รหัสนักศึกษา': reg.studentId || '',
          'เลขบัตรประชาชน': reg.nationalId || '',
          'กิจกรรม': activity?.name || 'Unknown',
          'ประเภทโควตา': reg.quota || evalScore.quota || '-',
          'หลักสูตร': reg.course || '-',
          'รอบเวลา': reg.timeSlot || '-',
          'ที่นั่ง': reg.seatNumber || '-',
          'คิว': reg.displayQueueNumber || '-',
          'สถานะ': getThaiStatus(reg.status).label,
          'คะแนนรวม (%)': evalScore.isScored ? `${evalScore.finalTotalScore}` : '-',
          'สถานะการประเมิน': evalScore.isScored ? 'ประเมินแล้ว' : 'รอประเมิน',
          'กรรมการผู้ประเมิน': evalScore.examinerName || '-',
          'ข้อเสนอแนะ': evalScore.notes || '-',
          'วันที่ลงทะเบียน': reg.registeredAtDate ? reg.registeredAtDate.toLocaleString('th-TH') : ''
        };

        // Attach evidence photo URLs
        const evidenceUrls = [];
        if (Array.isArray(attached.evidence)) {
          evidenceUrls.push(...attached.evidence);
        } else if (Array.isArray(attached)) {
          evidenceUrls.push(...attached);
        } else if (typeof attached === 'object') {
          Object.values(attached).forEach(val => {
            if (Array.isArray(val)) evidenceUrls.push(...val);
            else if (typeof val === 'string' && val) evidenceUrls.push(val);
          });
        }
        evidenceUrls.forEach((url, i) => {
          row[`ลิงก์รูปถ่ายหลักฐาน (${i + 1})`] = url || '';
        });

        return row;
      });

      const csv = Papa.unparse(csvData, { quotes: true, delimiter: ',', header: true });
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `student_${studentInfo?.studentId || studentInfo?.nationalId || 'history'}.csv`;
      link.click();
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 font-sans">
      {/* Top Toolbar Navigation */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link
            href="/admin/registrants"
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded border border-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <span>←</span>
            <span>กลับหน้ารายชื่อ</span>
          </Link>

          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-bold text-slate-900 truncate">
              {studentInfo?.fullName ? `ประวัติการลงทะเบียน: ${studentInfo.fullName}` : 'ประวัตินักเรียน'}
            </h1>
            <p className="text-[11px] text-slate-500 truncate">
              บัตร ปชช: {studentInfo?.nationalId || '-'} • รหัสผู้สมัคร: {studentInfo?.studentId || '-'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={fetchStudentData}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded border border-slate-200 flex items-center gap-1.5 whitespace-nowrap"
            title="รีเฟรชข้อมูล"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>รีเฟรช</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={studentRegistrations.length === 0}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded border border-slate-200 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>ส่งออก CSV ({studentRegistrations.length})</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-xs border ${message.includes('❌') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {message}
        </div>
      )}

      {/* Student Profile Card & Summary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profile Card */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>👤</span> ข้อมูลส่วนตัว
            </h2>
            {!isEditingProfile ? (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                แก้ไข
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveProfile}
                  className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
                >
                  บันทึก
                </button>
                <button
                  onClick={() => setIsEditingProfile(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ยกเลิก
                </button>
              </div>
            )}
          </div>

          {!isEditingProfile ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">ชื่อ-สกุล:</span>
                <span className="font-semibold text-slate-900">{studentInfo?.fullName || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">รหัสผู้สมัคร / นศ.:</span>
                <span className="font-mono font-semibold text-slate-800">{studentInfo?.studentId || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">เลขบัตรประชาชน:</span>
                <span className="font-mono font-semibold text-slate-800">{studentInfo?.nationalId || '-'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">สถานะ LINE:</span>
                {studentInfo?.lineUserId ? (
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ ผูกบัญชีแล้ว
                    </span>
                    <button
                      onClick={handleResetLine}
                      className="text-[11px] text-amber-600 hover:underline"
                      title="รีเซตเพื่อให้นักเรียนผูก LINE ใหม่"
                    >
                      รีเซต
                    </button>
                  </div>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-500 border border-slate-200">
                    ยังไม่ผูก
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">ชื่อ-สกุล</label>
                <input
                  type="text"
                  value={profileForm.fullName}
                  onChange={e => setProfileForm(p => ({ ...p, fullName: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">รหัสผู้สมัคร / นศ.</label>
                <input
                  type="text"
                  value={profileForm.studentId}
                  onChange={e => setProfileForm(p => ({ ...p, studentId: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">เลขบัตรประชาชน</label>
                <input
                  type="text"
                  value={profileForm.nationalId}
                  onChange={e => setProfileForm(p => ({ ...p, nationalId: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">LINE User ID</label>
                <input
                  type="text"
                  value={profileForm.lineUserId}
                  onChange={e => setProfileForm(p => ({ ...p, lineUserId: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-mono"
                  placeholder="Uxxxxxxxxxxxx"
                />
              </div>
            </div>
          )}
        </div>

        {/* 4 Summary Stat Boxes */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between">
            <span className="text-slate-500 text-xs">กิจกรรมทั้งหมด</span>
            <div className="text-2xl md:text-3xl font-black text-slate-900 font-mono mt-2">
              {stats.total}
            </div>
            <span className="text-[10px] text-slate-400 mt-1">รายการที่ลงทะเบียน</span>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between">
            <span className="text-slate-500 text-xs">เช็คอินแล้ว</span>
            <div className="text-2xl md:text-3xl font-black text-emerald-600 font-mono mt-2">
              {stats.checkedIn}
            </div>
            <span className="text-[10px] text-slate-400 mt-1">มาเข้าร่วมงานแล้ว</span>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between">
            <span className="text-slate-500 text-xs">จบกิจกรรม</span>
            <div className="text-2xl md:text-3xl font-black text-blue-600 font-mono mt-2">
              {stats.completed}
            </div>
            <span className="text-[10px] text-slate-400 mt-1">เสร็จสิ้นสมบูรณ์</span>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between">
            <span className="text-slate-500 text-xs">รอเข้างาน</span>
            <div className="text-2xl md:text-3xl font-black text-amber-600 font-mono mt-2">
              {stats.registered}
            </div>
            <span className="text-[10px] text-slate-400 mt-1">ยังไม่เช็คอิน</span>
          </div>
        </div>
      </div>

      {/* Main Table: Registered Activities List */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            รายการกิจกรรมที่ลงทะเบียนทั้งหมด ({studentRegistrations.length})
          </h2>
          <span className="text-[11px] text-slate-500">เรียงตามวันที่ลงทะเบียนล่าสุด</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-3 py-2.5 w-12 text-center border-r border-slate-200 whitespace-nowrap">#</th>
                <th className="px-3 py-2.5 min-w-[200px] border-r border-slate-200 whitespace-nowrap">กิจกรรม</th>
                <th className="px-3 py-2.5 min-w-[150px] border-r border-slate-200 whitespace-nowrap">รายละเอียดที่นั่ง / คิว</th>
                <th className="px-3 py-2.5 min-w-[120px] text-center border-r border-slate-200 whitespace-nowrap">สถานะ</th>
                <th className="px-3 py-2.5 min-w-[130px] text-right border-r border-slate-200 whitespace-nowrap">วันที่ลงทะเบียน</th>
                <th className="px-3 py-2.5 w-24 text-center whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังโหลดประวัติกิจกรรม...</span>
                    </div>
                  </td>
                </tr>
              ) : studentRegistrations.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-slate-400">
                    ไม่พบรายการลงทะเบียนกิจกรรมสำหรับนักเรียนคนนี้
                  </td>
                </tr>
              ) : (
                studentRegistrations.map((reg, index) => {
                  const activity = activitiesMap[reg.activityId];
                  const statusObj = getThaiStatus(reg.status);
                  const evalScore = reg.evaluationScore || {};
                  const attached = reg.attachedDocuments || {};
                  const totalAttachedFiles = Object.values(attached).reduce((acc, arr) => acc + (arr?.length || 0), 0);

                  return (
                    <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 text-center text-slate-400 border-r border-slate-100 bg-slate-50/40 whitespace-nowrap">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900 border-r border-slate-100">
                        <div className="font-semibold text-sm text-slate-900">
                          {activity?.name || 'ไม่ระบุชื่อกิจกรรม'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span>ประเภท: {activity?.type === 'queue' ? 'คิวบริการ / สอบสัมภาษณ์' : activity?.type === 'event' ? 'กิจกรรมทั่วไป' : activity?.type === 'exam' ? 'สอบข้อเขียน' : activity?.type === 'graduation' ? 'รับปริญญาบัตร' : 'ทั่วไป'}</span>
                          {activity?.location && <span>• สถานที่: {activity.location}</span>}
                          {reg.quota && <span className="font-semibold text-indigo-700">• โควตา: {reg.quota}</span>}
                        </div>
                        {/* Score & Document Badges */}
                        {(evalScore.isScored || totalAttachedFiles > 0) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {evalScore.isScored && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                คะแนน: {evalScore.finalTotalScore}%
                              </span>
                            )}
                            {totalAttachedFiles > 0 && (
                              <span className="px-2 py-0.5 rounded text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                                📷 รูปถ่ายหลักฐาน {totalAttachedFiles} รูป
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {reg.course && (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                              หลักสูตร: {reg.course}
                            </span>
                          )}
                          {reg.timeSlot && (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                              รอบ: {reg.timeSlot}
                            </span>
                          )}
                          {reg.seatNumber && (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                              ที่นั่ง: {reg.seatNumber}
                            </span>
                          )}
                          {reg.displayQueueNumber && (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-amber-50 text-amber-700 border border-amber-200 font-semibold font-mono">
                              คิว: {reg.displayQueueNumber}
                            </span>
                          )}
                          {!reg.course && !reg.timeSlot && !reg.seatNumber && !reg.displayQueueNumber && (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap border ${statusObj.className}`}>
                          {statusObj.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 border-r border-slate-100 whitespace-nowrap font-mono text-[11px]">
                        {reg.registeredAtDate ? reg.registeredAtDate.toLocaleString('th-TH') : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setScoringRegistrant(reg);
                              setActiveActivityForModal(activity || { id: reg.activityId, name: 'กิจกรรม' });
                            }}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded border border-transparent hover:border-indigo-200 transition-colors"
                            title="ดูคะแนน/รูปถ่ายหลักฐาน"
                          >
                            📝
                          </button>
                          <button
                            onClick={() => handleDeleteRegistration(reg.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors"
                            title="ลบรายการนี้"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Examiner Scoring Modal */}
      <ExaminerScoringModal
        isOpen={Boolean(scoringRegistrant)}
        onClose={() => {
          setScoringRegistrant(null);
          setActiveActivityForModal(null);
        }}
        registrant={scoringRegistrant}
        activity={activeActivityForModal}
        onScoreSaved={(updated) => {
          setStudentRegistrations(prev => prev.map(r => r.id === updated.id ? updated : r));
        }}
      />
    </div>
  );
}
