'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  createCheckInSuccessFlex,
  createQueueCheckInSuccessFlex,
  createRegistrationSuccessFlex,
  createActivityCompleteFlex,
  createEvaluationRequestFlex,
  createQueueCallFlex
} from '../../../lib/flexMessageTemplates';
import { useModal } from '../../../context/ModalContext';

// Default mock datasets for all 6 Flex types
const DEFAULT_PRESETS = {
  checkin_seat: {
    courseName: 'วิศวกรรมการบินและอวกาศ (Aero Engineering)',
    activityName: 'การทดสอบวัดความรู้พื้นฐานทางวิชาการ ประจำปี 2568',
    fullName: 'นายอนวัช สุวรรณรัตน์',
    studentId: '68010042',
    seatNumber: 'A-12'
  },
  checkin_queue: {
    activityName: 'การสัมภาษณ์คัดเลือกนักเรียนทุนการบินรอบที่ 1',
    fullName: 'นางสาวกนกพร วารินทร์',
    course: 'วิศวกรรมการบินและอวกาศ (Aerospace)',
    timeSlot: '09:00 - 10:30 น.',
    queueNumber: 'A-015'
  },
  registration: {
    categoryName: 'โครงการคัดเลือกนักเรียนที่มีทักษะพิเศษด้านการบิน',
    activityName: 'การอบรมและแนะนำสายอาชีพการบิน (Aero Discovery Day 2026)',
    fullName: 'นายธนกฤต วิริยผล',
    studentId: '68020188'
  },
  queue_call: {
    activityName: 'การสอบสัมภาษณ์รอบคัดเลือก Portfolio',
    channelName: 'ห้องสัมภาษณ์ 1 (โต๊ะ A)',
    queueNumber: 'A-015',
    courseName: 'วิศวกรรมการบินและอวกาศ',
    activityId: 'demo-activity-001',
    requireEvaluation: false
  },
  activity_complete: {
    activityName: 'การสอบสัมภาษณ์และการประเมินทักษะการบิน',
    activityId: 'demo-activity-001',
    isQueueType: true,
    requireEvaluation: true
  },
  evaluation_request: {
    activityName: 'การอบรมเชิงปฏิบัติการเครื่องช่วยฝึกบิน (Flight Simulator)',
    activityId: 'demo-activity-001'
  }
};

const TEMPLATE_TABS = [
  {
    id: 'checkin_seat',
    title: 'เช็คอินระบุที่นั่ง',
    subtitle: 'สำหรับกิจกรรมทั่วไป / สัมมนา / ห้องสอบ',
    badge: 'Check-in (Seat)',
    description: 'ส่งอัตโนมัติเมื่อผู้สมัครสแกน QR Code เข้ากิจกรรมที่กำหนดเลขที่นั่งตายตัว'
  },
  {
    id: 'checkin_queue',
    title: 'เช็คอินรับคิว',
    subtitle: 'สำหรับกิจกรรมคิวสัมภาษณ์',
    badge: 'Check-in (Queue)',
    description: 'ส่งอัตโนมัติเมื่อผู้สมัครสแกนเช็คอินที่ Station สแกนเนอร์เพื่อออกบัตรคิว'
  },
  {
    id: 'registration',
    title: 'ลงทะเบียนกิจกรรม',
    subtitle: 'เมื่อสมัครกิจกรรมสำเร็จ',
    badge: 'Registration',
    description: 'ส่งยืนยันหลังนักเรียนกรอกใบสมัครและเลือกรอบกิจกรรมเรียบร้อย'
  },
  {
    id: 'queue_call',
    title: 'เรียกคิวสัมภาษณ์',
    subtitle: 'ส่งเมื่อกรรมการกดเรียกคิว',
    badge: 'Queue Call',
    description: 'ส่งแจ้งเตือนด่วนไปยัง LINE นักเรียนพร้อมระบุโต๊ะสัมภาษณ์และหมายเลขคิว'
  },
  {
    id: 'activity_complete',
    title: 'เสร็จสิ้นกิจกรรม',
    subtitle: 'จบกิจกรรม / สัมภาษณ์เสร็จ',
    badge: 'Completed',
    description: 'ส่งเมื่อกรรมการประเมินเสร็จหรือกิจกรรมสิ้นสุด พร้อมปุ่มแบบประเมิน LIFF'
  },
  {
    id: 'evaluation_request',
    title: 'ขอให้ประเมิน',
    subtitle: 'ขอความร่วมมือทำแบบประเมิน',
    badge: 'Evaluation',
    description: 'ส่งขอความคิดเห็นและประเมินความพึงพอใจสำหรับกิจกรรม'
  }
];

export default function TestFlexMessagePage() {
  const { showAlert, showToast } = useModal();

  // Selected template type
  const [selectedTemplate, setSelectedTemplate] = useState('checkin_seat');

  // Form states per template
  const [formData, setFormData] = useState(DEFAULT_PRESETS);

  // Recipient Line User ID
  const [userId, setUserId] = useState('');
  const [saveUserId, setSaveUserId] = useState(true);

  // Sending and Preview states
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const [showJson, setShowJson] = useState(false);

  // Load cached Line User ID from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aero_test_line_user_id');
      if (saved) {
        setUserId(saved);
      }
    } catch {
      // ignore storage access restrictions
    }
  }, []);

  // Update form fields for current template
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [selectedTemplate]: {
        ...prev[selectedTemplate],
        [field]: value
      }
    }));
  };

  // Reset current template data to defaults
  const handleResetCurrentPreset = () => {
    setFormData(prev => ({
      ...prev,
      [selectedTemplate]: { ...DEFAULT_PRESETS[selectedTemplate] }
    }));
    if (showToast) {
      showToast('รีเซ็ตข้อมูลตัวอย่างเรียบร้อย', 'info');
    }
  };

  // Generate current Flex Object based on selected template & form data
  const currentFlexObject = useMemo(() => {
    const cur = formData[selectedTemplate] || {};
    switch (selectedTemplate) {
      case 'checkin_seat':
        return createCheckInSuccessFlex({
          courseName: cur.courseName,
          activityName: cur.activityName,
          fullName: cur.fullName,
          studentId: cur.studentId,
          seatNumber: cur.seatNumber
        });
      case 'checkin_queue':
        return createQueueCheckInSuccessFlex({
          activityName: cur.activityName,
          fullName: cur.fullName,
          course: cur.course,
          timeSlot: cur.timeSlot,
          queueNumber: cur.queueNumber
        });
      case 'registration':
        return createRegistrationSuccessFlex({
          categoryName: cur.categoryName,
          activityName: cur.activityName,
          fullName: cur.fullName,
          studentId: cur.studentId
        });
      case 'queue_call':
        return createQueueCallFlex({
          activityName: cur.activityName,
          channelName: cur.channelName,
          queueNumber: cur.queueNumber,
          courseName: cur.courseName,
          activityId: cur.activityId,
          requireEvaluation: cur.requireEvaluation
        });
      case 'activity_complete':
        return createActivityCompleteFlex({
          activityName: cur.activityName,
          activityId: cur.activityId,
          requireEvaluation: cur.requireEvaluation,
          isQueueType: cur.isQueueType
        });
      case 'evaluation_request':
        return createEvaluationRequestFlex({
          activityName: cur.activityName,
          activityId: cur.activityId
        });
      default:
        return createCheckInSuccessFlex(DEFAULT_PRESETS.checkin_seat);
    }
  }, [selectedTemplate, formData]);

  // Send Flex message to LINE API
  const handleSendFlex = async () => {
    const cleanUserId = userId.trim();
    if (!cleanUserId) {
      showAlert({
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาระบุ LINE User ID ของผู้รับก่อนทำการส่ง',
        type: 'warning'
      });
      return;
    }

    if (!cleanUserId.startsWith('U') || cleanUserId.length < 30) {
      showAlert({
        title: 'รูปแบบ LINE User ID ไม่ถูกต้อง',
        message: 'LINE User ID ควรขึ้นต้นด้วยตัวอักษร "U" และมีความยาวประมาณ 33 ตัวอักษร เช่น U1234567890abcdef1234567890abcdef',
        type: 'warning'
      });
      return;
    }

    // Save to localStorage if enabled
    if (saveUserId) {
      try {
        localStorage.setItem('aero_test_line_user_id', cleanUserId);
      } catch {
        // ignore
      }
    }

    setIsLoading(true);
    setApiResponse(null);

    const activeTab = TEMPLATE_TABS.find(t => t.id === selectedTemplate);
    const altText = `แจ้งเตือน: ${activeTab?.title || 'ข้อความแจ้งเตือนจากระบบ'}`;

    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: cleanUserId,
          flexMessage: currentFlexObject,
          altText: altText
        })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || `HTTP Error ${res.status}`);
      }

      setApiResponse({
        success: true,
        message: `ส่งข้อความ Flex Message (${activeTab?.title}) สำเร็จเรียบร้อย!`,
        details: result,
        timestamp: new Date().toLocaleTimeString('th-TH')
      });

      if (showToast) {
        showToast('ส่งข้อความสำเร็จแล้ว', 'success');
      }
    } catch (error) {
      console.error('Test Flex push error:', error);
      setApiResponse({
        success: false,
        message: `เกิดข้อผิดพลาดในการส่ง: ${error.message}`,
        details: error.toString(),
        timestamp: new Date().toLocaleTimeString('th-TH')
      });

      showAlert({
        title: 'ส่งไม่สำเร็จ',
        message: `เกิดข้อผิดพลาดจาก LINE API: ${error.message}\nโปรดตรวจสอบว่า LINE_CHANNEL_ACCESS_TOKEN ในระบบถูกต้อง และผู้รับได้เป็นเพื่อนกับ LINE Official Account แล้ว`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Copy JSON to clipboard
  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(currentFlexObject, null, 2));
    if (showToast) {
      showToast('คัดลอก JSON แล้ว', 'info');
    }
  };

  const currentValues = formData[selectedTemplate] || {};

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans bg-slate-50/50 min-h-screen">
      {/* Header Banner */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#000946] text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-[#000946]">
              ระบบทดสอบ LINE Flex Message
            </h1>
          </div>
          <p className="text-sm font-normal text-slate-600">
            เครื่องมือทดสอบ ตรวจสอบความถูกต้องของแบบจำลอง Flex Message ทุกประเภท พร้อมระบบแสดงตัวอย่าง (Live Preview) และจำลองการส่งจริง
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-sm font-normal text-slate-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            LINE API Push Ready
          </div>
        </div>
      </div>

      {/* Recipient User ID Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label htmlFor="lineUserId" className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <span>ระบุ LINE User ID ผู้รับการทดสอบ</span>
            <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="saveUserId"
              checked={saveUserId}
              onChange={(e) => setSaveUserId(e.target.checked)}
              className="w-4 h-4 rounded text-[#000946] focus:ring-[#000946]"
            />
            <label htmlFor="saveUserId" className="text-sm font-normal text-slate-600 cursor-pointer">
              จำ User ID นี้ไว้ในเครื่อง
            </label>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              type="text"
              id="lineUserId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="เช่น U1234567890abcdef1234567890abcdef"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946] focus:ring-2 focus:ring-[#000946]/10 transition-all placeholder:text-slate-400"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setUserId('');
              try { localStorage.removeItem('aero_test_line_user_id'); } catch {}
            }}
            disabled={!userId}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-sm font-normal rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            ล้างค่า
          </button>
        </div>
        <p className="text-sm font-normal text-slate-500">
          คำแนะนำ: LINE User ID สามารถดูได้จากระบบสแกนเนอร์, ข้อมูลการลงทะเบียนในระบบ หรือผ่าน LINE Developers Console
        </p>
      </div>

      {/* Template Selector Tabs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            เลือกรูปแบบ Flex Message ที่ต้องการทดสอบ (ทั้งหมด 6 รูปแบบ)
          </h2>
          <button
            type="button"
            onClick={handleResetCurrentPreset}
            className="text-sm font-normal text-[#FF741F] hover:text-[#e06114] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            คืนค่าข้อมูลตัวอย่างสำหรับแบบนี้
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {TEMPLATE_TABS.map((tab) => {
            const isSelected = selectedTemplate === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTemplate(tab.id)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-[#000946] text-white border-[#000946] shadow-md shadow-[#000946]/15'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {tab.badge}
                    </span>
                  </div>
                  <div className="text-sm font-bold truncate">
                    {tab.title}
                  </div>
                </div>
                <div className={`text-xs mt-2 line-clamp-2 font-normal ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
                  {tab.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Form Controls (Left) & Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Inputs (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-normal text-[#FF741F] uppercase tracking-wider">
                  แบบฟอร์มปรับแต่งข้อมูล
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {TEMPLATE_TABS.find(t => t.id === selectedTemplate)?.title}
                </h3>
              </div>
              <span className="px-2.5 py-1 bg-blue-50 text-[#000946] rounded-lg text-xs font-normal border border-blue-100">
                {TEMPLATE_TABS.find(t => t.id === selectedTemplate)?.badge}
              </span>
            </div>
            <p className="text-sm font-normal text-slate-500 mt-1.5">
              {TEMPLATE_TABS.find(t => t.id === selectedTemplate)?.description}
            </p>
          </div>

          {/* Dynamic Form Fields */}
          <div className="space-y-4">
            {selectedTemplate === 'checkin_seat' && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">ชื่อหลักสูตร (courseName)</label>
                  <input
                    type="text"
                    value={currentValues.courseName || ''}
                    onChange={(e) => handleFieldChange('courseName', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">ชื่อกิจกรรม (activityName)</label>
                  <input
                    type="text"
                    value={currentValues.activityName || ''}
                    onChange={(e) => handleFieldChange('activityName', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">ชื่อ-นามสกุล (fullName)</label>
                    <input
                      type="text"
                      value={currentValues.fullName || ''}
                      onChange={(e) => handleFieldChange('fullName', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">รหัสผู้สมัคร (studentId)</label>
                    <input
                      type="text"
                      value={currentValues.studentId || ''}
                      onChange={(e) => handleFieldChange('studentId', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">เลขที่นั่ง (seatNumber)</label>
                  <input
                    type="text"
                    value={currentValues.seatNumber || ''}
                    onChange={(e) => handleFieldChange('seatNumber', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                  />
                </div>
              </>
            )}

            {selectedTemplate === 'checkin_queue' && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">ชื่อกิจกรรม (activityName)</label>
                  <input
                    type="text"
                    value={currentValues.activityName || ''}
                    onChange={(e) => handleFieldChange('activityName', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">ชื่อ-นามสกุล (fullName)</label>
                    <input
                      type="text"
                      value={currentValues.fullName || ''}
                      onChange={(e) => handleFieldChange('fullName', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">หลักสูตร (course)</label>
                    <input
                      type="text"
                      value={currentValues.course || ''}
                      onChange={(e) => handleFieldChange('course', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">ช่วงเวลา (timeSlot)</label>
                    <input
                      type="text"
                      value={currentValues.timeSlot || ''}
                      onChange={(e) => handleFieldChange('timeSlot', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">หมายเลขคิว (queueNumber)</label>
                    <input
                      type="text"
                      value={currentValues.queueNumber || ''}
                      onChange={(e) => handleFieldChange('queueNumber', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                </div>
              </>
            )}

            {selectedTemplate === 'registration' && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">หมวดหมู่กิจกรรม (categoryName)</label>
                  <input
                    type="text"
                    value={currentValues.categoryName || ''}
                    onChange={(e) => handleFieldChange('categoryName', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">ชื่อกิจกรรม (activityName)</label>
                  <input
                    type="text"
                    value={currentValues.activityName || ''}
                    onChange={(e) => handleFieldChange('activityName', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">ชื่อ-นามสกุล (fullName)</label>
                    <input
                      type="text"
                      value={currentValues.fullName || ''}
                      onChange={(e) => handleFieldChange('fullName', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">รหัสผู้สมัคร (studentId)</label>
                    <input
                      type="text"
                      value={currentValues.studentId || ''}
                      onChange={(e) => handleFieldChange('studentId', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                </div>
              </>
            )}

            {selectedTemplate === 'queue_call' && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">ชื่อกิจกรรม (activityName)</label>
                  <input
                    type="text"
                    value={currentValues.activityName || ''}
                    onChange={(e) => handleFieldChange('activityName', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">ช่องบริการ/โต๊ะสัมภาษณ์ (channelName)</label>
                    <input
                      type="text"
                      value={currentValues.channelName || ''}
                      onChange={(e) => handleFieldChange('channelName', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">หมายเลขคิว (queueNumber)</label>
                    <input
                      type="text"
                      value={currentValues.queueNumber || ''}
                      onChange={(e) => handleFieldChange('queueNumber', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">ชื่อหลักสูตร (courseName)</label>
                    <input
                      type="text"
                      value={currentValues.courseName || ''}
                      onChange={(e) => handleFieldChange('courseName', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-normal text-slate-700">รหัสกิจกรรม (activityId สำหรับแบบประเมิน)</label>
                    <input
                      type="text"
                      value={currentValues.activityId || ''}
                      onChange={(e) => handleFieldChange('activityId', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="call_eval"
                    checked={Boolean(currentValues.requireEvaluation)}
                    onChange={(e) => handleFieldChange('requireEvaluation', e.target.checked)}
                    className="w-4 h-4 rounded text-[#000946] focus:ring-[#000946]"
                  />
                  <label htmlFor="call_eval" className="text-sm font-normal text-slate-700 cursor-pointer">
                    แนบปุ่มทำแบบประเมินไปด้วยในข้อความ
                  </label>
                </div>
              </>
            )}

            {selectedTemplate === 'activity_complete' && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">ชื่อกิจกรรม (activityName)</label>
                  <input
                    type="text"
                    value={currentValues.activityName || ''}
                    onChange={(e) => handleFieldChange('activityName', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">รหัสกิจกรรม (activityId สำหรับลิงก์ LIFF)</label>
                  <input
                    type="text"
                    value={currentValues.activityId || ''}
                    onChange={(e) => handleFieldChange('activityId', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                  />
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isQueueType"
                      checked={Boolean(currentValues.isQueueType)}
                      onChange={(e) => handleFieldChange('isQueueType', e.target.checked)}
                      className="w-4 h-4 rounded text-[#000946] focus:ring-[#000946]"
                    />
                    <label htmlFor="isQueueType" className="text-sm font-normal text-slate-700 cursor-pointer">
                      แสดงหัวข้อเป็น &quot;สัมภาษณ์เสร็จสมบูรณ์&quot; (หากไม่เลือกจะเป็น &quot;จบกิจกรรมเรียบร้อย&quot;)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="requireEvaluation"
                      checked={Boolean(currentValues.requireEvaluation)}
                      onChange={(e) => handleFieldChange('requireEvaluation', e.target.checked)}
                      className="w-4 h-4 rounded text-[#000946] focus:ring-[#000946]"
                    />
                    <label htmlFor="requireEvaluation" className="text-sm font-normal text-slate-700 cursor-pointer">
                      แสดงปุ่มลิงก์ &quot;ทำแบบประเมิน&quot; ที่ด้านล่างของข้อความ
                    </label>
                  </div>
                </div>
              </>
            )}

            {selectedTemplate === 'evaluation_request' && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">ชื่อกิจกรรม (activityName)</label>
                  <input
                    type="text"
                    value={currentValues.activityName || ''}
                    onChange={(e) => handleFieldChange('activityName', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">รหัสกิจกรรม (activityId สำหรับเปิดแบบประเมินใน LINE)</label>
                  <input
                    type="text"
                    value={currentValues.activityId || ''}
                    onChange={(e) => handleFieldChange('activityId', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:border-[#000946]"
                  />
                </div>
              </>
            )}
          </div>

          {/* Action Trigger Buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={handleSendFlex}
              disabled={isLoading || !userId.trim()}
              className="flex-1 px-5 py-3 bg-[#000946] hover:bg-[#00135c] text-white text-sm font-normal rounded-xl shadow-sm transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                  <span>กำลังส่งข้อความไปยัง LINE...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-[#FF741F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>ส่งข้อความทดสอบจริง (Push LINE)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowJson(!showJson)}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-normal rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span>{showJson ? 'ซ่อนโครงสร้าง JSON' : 'ดูโครงสร้าง JSON'}</span>
            </button>
          </div>

          {/* API Response Feedback */}
          {apiResponse && (
            <div className={`p-4 rounded-xl border space-y-2 ${
              apiResponse.success
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-red-50/80 border-red-200 text-red-900'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${apiResponse.success ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  <span className="text-sm font-bold">
                    {apiResponse.success ? 'การส่งข้อความสำเร็จ (Success)' : 'การส่งข้อความล้มเหลว (Failed)'}
                  </span>
                </div>
                <span className="text-xs font-normal text-slate-500">{apiResponse.timestamp}</span>
              </div>
              <p className="text-sm font-normal">{apiResponse.message}</p>
            </div>
          )}

          {/* JSON Inspector */}
          {showJson && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-normal text-slate-500">
                  โครงสร้าง LINE Flex Container (ตรงตามมาตรฐาน LINE Messaging API)
                </span>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="text-xs font-normal text-[#FF741F] hover:underline cursor-pointer"
                >
                  คัดลอก JSON ทั้งหมด
                </button>
              </div>
              <div className="p-4 bg-slate-900 text-slate-100 rounded-xl text-sm font-normal overflow-x-auto max-h-72 border border-slate-800">
                <pre className="whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(currentFlexObject, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive LINE Flex Live Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#000946]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>ตัวอย่างการแสดงผลใน LINE (Live Preview)</span>
            </h2>
            <span className="text-xs font-normal text-slate-500">อัปเดตแบบเรียลไทม์</span>
          </div>

          {/* Smartphone / LINE Chat Screen Mockup */}
          <div className="bg-[#788896] rounded-3xl p-4 shadow-xl border-4 border-slate-800 max-w-sm mx-auto">
            {/* Phone Top Speaker & Camera Notch */}
            <div className="flex items-center justify-center pb-3">
              <div className="w-16 h-1.5 bg-slate-700/60 rounded-full"></div>
            </div>

            {/* LINE Chat Header */}
            <div className="bg-[#000946] text-white px-3 py-2 rounded-t-xl flex items-center justify-between mb-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#FF741F] flex items-center justify-center font-bold text-xs text-white">
                  AERO
                </div>
                <div>
                  <div className="font-bold text-xs">AERO Official</div>
                  <div className="text-[11px] text-slate-300 font-normal">การแจ้งเตือนอัตโนมัติ</div>
                </div>
              </div>
              <span className="text-[11px] text-slate-300 font-normal">วันนี้</span>
            </div>

            {/* Bubble Container (Visual Simulation of the LINE Flex) */}
            <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
              {/* Checkin Seat Bubble Preview */}
              {selectedTemplate === 'checkin_seat' && (
                <div>
                  <div className="bg-[#F8FAFC] px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-[#000946]">ยืนยันการเข้าร่วมกิจกรรม</span>
                    <span className="w-2 h-2 rounded-full bg-[#FF741F]"></span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="text-xs font-normal text-slate-400">หลักสูตร</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                        {currentValues.courseName || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-normal text-slate-400">กิจกรรม</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                        {currentValues.activityName || '-'}
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-normal">ชื่อ</span>
                        <span className="text-slate-700 font-normal text-right">{currentValues.fullName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-normal">รหัสผู้สมัคร</span>
                        <span className="text-slate-700 font-normal text-right">{currentValues.studentId || '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#000946] text-white p-4 text-center">
                    <div className="text-xs font-normal text-slate-300 mb-0.5">เลขที่นั่ง</div>
                    <div className="text-3xl font-bold tracking-wider">{currentValues.seatNumber || '-'}</div>
                  </div>
                </div>
              )}

              {/* Checkin Queue Bubble Preview */}
              {selectedTemplate === 'checkin_queue' && (
                <div>
                  <div className="bg-[#F8FAFC] px-4 py-3.5 border-b border-slate-100 text-center">
                    <span className="text-sm font-bold text-[#000946]">ได้รับคิวเรียบร้อยแล้ว</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="text-xs font-normal text-slate-400">กิจกรรม</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                        {currentValues.activityName || '-'}
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-normal">ชื่อ</span>
                        <span className="text-slate-700 font-normal text-right">{currentValues.fullName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-normal">หลักสูตร</span>
                        <span className="text-slate-700 font-normal text-right">{currentValues.course || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-normal">ช่วงเวลา</span>
                        <span className="text-slate-700 font-normal text-right">{currentValues.timeSlot || '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#000946] text-white p-4 text-center">
                    <div className="text-xs font-normal text-slate-300 mb-0.5">หมายเลขคิวของคุณคือ</div>
                    <div className="text-3xl font-bold tracking-wider">{currentValues.queueNumber || '-'}</div>
                  </div>
                </div>
              )}

              {/* Registration Bubble Preview */}
              {selectedTemplate === 'registration' && (
                <div>
                  <div className="bg-[#F8FAFC] px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-[#000946]">ลงทะเบียนกิจกรรมสำเร็จ</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="text-xs font-normal text-slate-400">หมวดหมู่</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                        {currentValues.categoryName || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-normal text-slate-400">กิจกรรม</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                        {currentValues.activityName || '-'}
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-normal">ชื่อ</span>
                        <span className="text-slate-700 font-normal text-right">{currentValues.fullName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-normal">รหัสผู้สมัคร</span>
                        <span className="text-slate-700 font-normal text-right">{currentValues.studentId || '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#F1F5F9] p-3 text-center border-t border-slate-100">
                    <span className="text-xs font-normal text-slate-500">โปรดเตรียม QR Code สำหรับสแกนเข้างาน</span>
                  </div>
                </div>
              )}

              {/* Queue Call Bubble Preview */}
              {selectedTemplate === 'queue_call' && (
                <div>
                  <div className="bg-[#000946] text-white p-4">
                    <div className="text-[11px] text-slate-300 uppercase tracking-widest font-normal">NOTIFICATION</div>
                    <div className="text-lg font-bold text-white mt-0.5">ถึงคิวของคุณแล้ว</div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="text-sm font-bold text-slate-900">
                      {currentValues.activityName || '-'}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-400 font-normal">หลักสูตร:</span>
                      <span className="text-slate-700 font-normal">{currentValues.courseName || '-'}</span>
                    </div>
                  </div>
                  <div className="bg-[#F8FAFC] p-4 text-center border-t border-slate-100 space-y-1">
                    <div className="text-xs font-normal text-slate-500">กรุณาไปที่</div>
                    <div className="text-xl font-bold text-[#000946]">{currentValues.channelName || '-'}</div>
                    <div className="text-base font-bold text-slate-900 pt-1">
                      หมายเลขคิว {currentValues.queueNumber || '-'}
                    </div>
                    {currentValues.requireEvaluation && (
                      <div className="pt-2">
                        <button type="button" className="w-full py-2 bg-[#FF741F] text-white rounded-lg text-sm font-normal shadow-sm">
                          ทำแบบประเมิน
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Activity Complete Bubble Preview */}
              {selectedTemplate === 'activity_complete' && (
                <div>
                  <div className="bg-[#F8FAFC] p-4 border-b border-slate-100">
                    <div className="text-[11px] text-slate-400 uppercase tracking-widest font-normal">NOTIFICATION</div>
                    <div className="text-lg font-bold text-[#000946] mt-0.5">
                      {currentValues.isQueueType ? 'สัมภาษณ์เสร็จสมบูรณ์' : 'จบกิจกรรมเรียบร้อย'}
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="text-xs font-normal text-slate-400">กิจกรรม</div>
                    <div className="text-sm font-bold text-slate-900">
                      {currentValues.activityName || '-'}
                    </div>
                    <div className="border-t border-slate-100 pt-2 text-sm font-normal text-slate-600">
                      {currentValues.requireEvaluation
                        ? 'กรุณาทำแบบประเมินด้านล่างเพื่อสำเร็จกระบวนการ'
                        : 'ขอขอบคุณที่เข้าร่วมกิจกรรมในครั้งนี้'}
                    </div>
                  </div>
                  <div className="p-3 bg-white border-t border-slate-100">
                    {currentValues.requireEvaluation ? (
                      <button type="button" className="w-full py-2.5 bg-[#000946] text-white rounded-xl text-sm font-normal shadow-sm">
                        ทำแบบประเมิน
                      </button>
                    ) : (
                      <div className="text-center text-xs font-normal text-slate-400 py-1">
                        ขอบคุณที่ให้ความร่วมมือ
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Evaluation Request Bubble Preview */}
              {selectedTemplate === 'evaluation_request' && (
                <div>
                  <div className="bg-[#F8FAFC] p-4 border-b border-slate-100">
                    <div className="text-[11px] text-slate-400 uppercase tracking-widest font-normal">NOTIFICATION</div>
                    <div className="text-lg font-bold text-[#000946] mt-0.5">
                      สัมภาษณ์เสร็จสมบูรณ์
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="text-xs font-normal text-slate-400">กิจกรรม</div>
                    <div className="text-sm font-bold text-slate-900">
                      {currentValues.activityName || '-'}
                    </div>
                    <div className="border-t border-slate-100 pt-2 text-sm font-normal text-slate-600">
                      กรุณาทำแบบประเมินด้านล่างเพื่อสำเร็จกระบวนการ
                    </div>
                  </div>
                  <div className="p-3 bg-white border-t border-slate-100">
                    <button type="button" className="w-full py-2.5 bg-[#000946] text-white rounded-xl text-sm font-normal shadow-sm">
                      ทำแบบประเมิน
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Time Indicator */}
            <div className="text-center pt-2">
              <span className="text-[10px] text-slate-300 font-normal">อ่านแล้ว • เพิ่งส่งเมื่อสักครู่</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}