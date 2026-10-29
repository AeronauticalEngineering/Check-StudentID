'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db, storage } from '../../../../lib/firebase';
import { collection, getDocs, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useModal } from '../../../../context/ModalContext';
import { getCertificatePreviewDataUrl } from '../../../../lib/certificateGenerator';
import { STATION_ICONS, StationSvgIcon } from '../../../../components/StationIcons';

const DEFAULT_CERT_LAYOUT = {
  nameY: 385,
  nameFontSize: 32,
  nameColor: '#063826',
  projectY: 453,
  projectFontSize: 21,
  projectColor: '#1e293b',
  dateY: 521,
  dateFontSize: 16,
  dateColor: '#1e293b'
};

const isValidHex = (hex) => /^#[0-9A-Fa-f]{6}$/.test(hex || '');

export default function AddActivityPage() {
  const router = useRouter();
  const { showAlert, showConfirm, showToast } = useModal();
  const [categories, setCategories] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [activityName, setActivityName] = useState('');
  const [activityType, setActivityType] = useState('queue');
  const [capacity, setCapacity] = useState(50);
  const [activityDate, setActivityDate] = useState('');
  const [activityTime, setActivityTime] = useState('');
  const [location, setLocation] = useState('');

  // Evaluation State
  const [enableEvaluation, setEnableEvaluation] = useState(false);
  const [evaluationQuestions, setEvaluationQuestions] = useState([
    { id: 'default_1', text: 'ความพึงพอใจโดยรวม', type: 'rating', isRequired: true },
    { id: 'default_2', text: 'ข้อเสนอแนะเพิ่มเติม', type: 'text', isRequired: false }
  ]);

  // Stations System State
  const [enableStations, setEnableStations] = useState(false);
  const [stations, setStations] = useState([
    { id: 'st_1', name: 'กิจกรรมที่ 1', icon: 'wrench' },
    { id: 'st_2', name: 'กิจกรรมที่ 2', icon: 'airplane' },
    { id: 'st_3', name: 'กิจกรรมที่ 3', icon: 'pilot-hat' },
    { id: 'st_4', name: 'กิจกรรมที่ 4', icon: 'paper-plane' }
  ]);

  // Scoring & Required Documents State
  const [enableScoring, setEnableScoring] = useState(false);
  const [generalCriteria, setGeneralCriteria] = useState([
    { id: 'g1', name: 'บุคลิกภาพและการสื่อสาร (A)', weight: 25, maxScore: 100 },
    { id: 'g2', name: 'ทัศนคติและความพร้อม (B)', weight: 25, maxScore: 100 },
    { id: 'g3', name: 'ความรู้และทักษะพื้นฐาน (C)', weight: 50, maxScore: 100 }
  ]);
  const [quotaCriteriaList, setQuotaCriteriaList] = useState([
    {
      quotaName: 'เรียนดี',
      criteria: [
        { id: 'q1', name: 'ผลการเรียนเฉลี่ยสะสม (A)', weight: 70, maxScore: 100 },
        { id: 'q2', name: 'การทดสอบวิชาการ (B)', weight: 30, maxScore: 100 }
      ]
    },
    {
      quotaName: 'กิจกรรม',
      criteria: [
        { id: 'q1', name: 'ผลงานและเกียรติประวัติ (A)', weight: 50, maxScore: 100 },
        { id: 'q2', name: 'การนำเสนอผลงาน (B)', weight: 30, maxScore: 100 },
        { id: 'q3', name: 'ความสามารถพิเศษ (C)', weight: 20, maxScore: 100 }
      ]
    }
  ]);
  const [requiredDocuments, setRequiredDocuments] = useState([]);

  // Registration State
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);

  // Post-Activity Actions (Certificate & Photo) State
  const [enablePostActivity, setEnablePostActivity] = useState(false);
  const [enableCertificate, setEnableCertificate] = useState(true);
  const [certificateButtonLabel, setCertificateButtonLabel] = useState('Certificate');
  const [certificateMode, setCertificateMode] = useState('template'); // 'template' | 'individual_link'
  const [certificateProjectName, setCertificateProjectName] = useState('');
  const [certificateDateText, setCertificateDateText] = useState('');
  const [certificateTemplateUrl, setCertificateTemplateUrl] = useState('');
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [certificateLayout, setCertificateLayout] = useState(DEFAULT_CERT_LAYOUT);
  const [livePreviewUrl, setLivePreviewUrl] = useState('');
  const [isGeneratingLivePreview, setIsGeneratingLivePreview] = useState(false);
  const [enablePhoto, setEnablePhoto] = useState(true);
  const [photoButtonLabel, setPhotoButtonLabel] = useState('Photo');
  const [photoUrl, setPhotoUrl] = useState('');

  // Real-time Live Preview Generator for Certificate Template
  useEffect(() => {
    if (!certificateTemplateUrl || certificateMode !== 'template') {
      setLivePreviewUrl('');
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        setIsGeneratingLivePreview(true);
        const url = await getCertificatePreviewDataUrl({
          templateUrl: certificateTemplateUrl,
          fullNameEn: 'MR. SOMCHAI JAIDEE',
          projectName: certificateProjectName || activityName || 'WORKSHOP TRAINING PROGRAM',
          dateText: certificateDateText || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          certificateLayout
        });
        if (isMounted) {
          setLivePreviewUrl(url);
        }
      } catch (err) {
        console.warn('Live preview generation error:', err);
      } finally {
        if (isMounted) setIsGeneratingLivePreview(false);
      }
    }, 120);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [certificateTemplateUrl, certificateMode, certificateProjectName, certificateDateText, certificateLayout, activityName]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'categories'));
      const categoriesData = querySnapshot.docs.map(doc => ({
        id: doc.id, ...doc.data()
      }));
      setCategories(categoriesData);
      if (!selectedCategory && categoriesData.length > 0) {
        setSelectedCategory(categoriesData[0].id);
      }
    } catch (error) {
      console.error("Error fetching categories: ", error);
      setMessage("เกิดข้อผิดพลาดในการดึงข้อมูลหมวดหมู่");
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) {
      showAlert({
        title: 'แจ้งเตือน',
        message: 'กรุณากรอกชื่อหมวดหมู่',
        type: 'warning'
      });
      return;
    }
    setIsSavingCategory(true);
    try {
      const docRef = await addDoc(collection(db, 'categories'), {
        name: newCategoryName, createdAt: serverTimestamp()
      });
      await fetchCategories();
      setSelectedCategory(docRef.id);
      setIsModalOpen(false);
      setNewCategoryName('');
      showToast({ message: 'เพิ่มหมวดหมู่สำเร็จ!', type: 'success' });
    } catch (error) {
      console.error("Error adding category: ", error);
      showAlert({
        title: 'เกิดข้อผิดพลาด',
        message: `ไม่สามารถเพิ่มหมวดหมู่ได้: ${error.message}`,
        type: 'error'
      });
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Evaluation helpers
  const handleAddQuestion = () => {
    setEvaluationQuestions([
      ...evaluationQuestions,
      { id: Date.now(), text: '', type: 'rating', isRequired: true }
    ]);
  };

  const handleRemoveQuestion = (id) => {
    setEvaluationQuestions(evaluationQuestions.filter(q => q.id !== id));
  };

  const handleQuestionChange = (id, field, value) => {
    setEvaluationQuestions(evaluationQuestions.map(q => {
      if (q.id === id) {
        let newQ = { ...q, [field]: value };
        if (field === 'type' && (value === 'checkbox' || value === 'radio') && (!newQ.options || newQ.options.length === 0)) {
          newQ.options = ['ตัวเลือก 1', 'ตัวเลือก 2'];
        }
        return newQ;
      }
      return q;
    }));
  };

  const handleAddOption = (questionId) => {
    setEvaluationQuestions(evaluationQuestions.map(q => {
      if (q.id === questionId) {
        const currentOptions = Array.isArray(q.options) && q.options.length > 0 ? q.options : ['ตัวเลือก 1'];
        return {
          ...q,
          options: [...currentOptions, `ตัวเลือก ${currentOptions.length + 1}`]
        };
      }
      return q;
    }));
  };

  const handleOptionChange = (questionId, optionIndex, value) => {
    setEvaluationQuestions(evaluationQuestions.map(q => {
      if (q.id === questionId) {
        const currentOptions = Array.isArray(q.options) ? [...q.options] : [];
        currentOptions[optionIndex] = value;
        return { ...q, options: currentOptions };
      }
      return q;
    }));
  };

  const handleRemoveOption = (questionId, optionIndex) => {
    setEvaluationQuestions(evaluationQuestions.map(q => {
      if (q.id === questionId) {
        const currentOptions = Array.isArray(q.options) ? q.options.filter((_, idx) => idx !== optionIndex) : [];
        return {
          ...q,
          options: currentOptions.length > 0 ? currentOptions : ['ตัวเลือก 1']
        };
      }
      return q;
    }));
  };

  // Stations Helpers
  const handleAddStation = () => {
    const nextNum = stations.length + 1;
    const defaultIcons = ['wrench', 'airplane', 'pilot-hat', 'paper-plane', 'gear', 'radar', 'compass', 'rocket'];
    const chosenIcon = defaultIcons[(nextNum - 1) % defaultIcons.length];
    setStations([
      ...stations,
      {
        id: `st_${Date.now()}`,
        name: `กิจกรรมที่ ${nextNum}`,
        icon: chosenIcon
      }
    ]);
  };

  const handleRemoveStation = (id) => {
    if (stations.length <= 1) {
      showAlert({ title: 'แจ้งเตือน', message: 'ต้องมีฐานกิจกรรมอย่างน้อย 1 ฐาน', type: 'warning' });
      return;
    }
    setStations(stations.filter(s => s.id !== id));
  };

  const handleStationChange = (id, field, value) => {
    setStations(stations.map(s => {
      if (s.id === id) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  // General Criteria helpers
  const handleAddGeneralCriterion = () => {
    setGeneralCriteria([
      ...generalCriteria,
      { id: `g_${Date.now()}`, name: '', weight: 10, maxScore: 10 }
    ]);
  };

  const handleRemoveGeneralCriterion = (id) => {
    setGeneralCriteria(generalCriteria.filter(g => g.id !== id));
  };

  const handleGeneralCriterionChange = (id, field, value) => {
    setGeneralCriteria(generalCriteria.map(g => {
      if (g.id === id) {
        const num = Number(value) || 0;
        if (field === 'weight' || field === 'maxScore') {
          return { ...g, weight: num, maxScore: num };
        }
        return { ...g, [field]: value };
      }
      return g;
    }));
  };

  // Quota Criteria helpers
  const handleAddQuotaGroup = () => {
    const name = prompt('กรุณาระบุชื่อประเภท (เช่น เรียนดี, ความสามารถพิเศษ):');
    if (!name || !name.trim()) return;
    setQuotaCriteriaList([
      ...quotaCriteriaList,
      {
        quotaName: name.trim(),
        criteria: [{ id: `q_${Date.now()}`, name: 'เกณฑ์ที่ 1', weight: 50, maxScore: 50 }]
      }
    ]);
  };

  const handleRemoveQuotaGroup = async (index) => {
    const confirmed = await showConfirm({
      title: 'ยืนยันการลบ',
      message: 'ต้องการลบกลุ่มประเภทนี้ใช่หรือไม่?',
      type: 'danger',
      confirmText: 'ลบกลุ่มประเภท',
      cancelText: 'ยกเลิก'
    });
    if (confirmed) {
      setQuotaCriteriaList(quotaCriteriaList.filter((_, idx) => idx !== index));
    }
  };


  const handleAddCriterionToQuota = (quotaIdx) => {
    const updated = [...quotaCriteriaList];
    updated[quotaIdx].criteria.push({
      id: `q_${Date.now()}`,
      name: '',
      weight: 10,
      maxScore: 10
    });
    setQuotaCriteriaList(updated);
  };

  const handleRemoveCriterionFromQuota = (quotaIdx, critId) => {
    const updated = [...quotaCriteriaList];
    updated[quotaIdx].criteria = updated[quotaIdx].criteria.filter(c => c.id !== critId);
    setQuotaCriteriaList(updated);
  };

  const handleCriterionInQuotaChange = (quotaIdx, critId, field, value) => {
    const updated = [...quotaCriteriaList];
    updated[quotaIdx].criteria = updated[quotaIdx].criteria.map(c => {
      if (c.id === critId) {
        const num = Number(value) || 0;
        if (field === 'weight' || field === 'maxScore') {
          return { ...c, weight: num, maxScore: num };
        }
        return { ...c, [field]: value };
      }
      return c;
    });
    setQuotaCriteriaList(updated);
  };

  // Required Documents helpers
  const handleAddRequiredDoc = () => {
    setRequiredDocuments([
      ...requiredDocuments,
      { id: `doc_${Date.now()}`, name: '', maxFiles: 1, required: true }
    ]);
  };

  const handleRemoveRequiredDoc = (id) => {
    setRequiredDocuments(requiredDocuments.filter(d => d.id !== id));
  };

  const handleRequiredDocChange = (id, field, value) => {
    setRequiredDocuments(requiredDocuments.map(d => {
      if (d.id === id) {
        return { ...d, [field]: field === 'maxFiles' ? Math.max(1, Number(value)) : value };
      }
      return d;
    }));
  };

  const generalMaxScoreSum = generalCriteria.reduce((sum, g) => sum + (Number(g.maxScore !== undefined ? g.maxScore : g.weight) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsLoading(true);
    try {
      const dateTimeString = `${activityDate}T${activityTime}`;
      const jsDate = new Date(dateTimeString);
      const firestoreTimestamp = Timestamp.fromDate(jsDate);

      const newActivity = {
        categoryId: selectedCategory || null,
        name: activityName.trim(),
        type: activityType,
        capacity: Number(capacity),
        location: location.trim(),
        activityDate: firestoreTimestamp,
        createdAt: serverTimestamp(),
        enableEvaluation,
        evaluationQuestions: enableEvaluation ? evaluationQuestions.map(q => {
          if (q.type === 'radio' || q.type === 'checkbox') {
            const cleanOptions = (q.options || []).map(o => String(o).trim()).filter(Boolean);
            return {
              ...q,
              options: cleanOptions.length > 0 ? cleanOptions : ['ตัวเลือก 1', 'ตัวเลือก 2']
            };
          }
          return q;
        }) : [],
        enableStations,
        stations: enableStations ? stations.map((s, idx) => ({
          id: s.id || `st_${idx + 1}`,
          name: s.name.trim() || `กิจกรรมที่ ${idx + 1}`,
          icon: s.icon || 'wrench'
        })) : [],
        enableScoring,
        scoringConfig: enableScoring ? {
          generalCriteria,
          quotaCriteriaList,
          requiredDocuments
        } : null,
        isRegistrationOpen,
        enablePostActivity,
        enableCertificate: enablePostActivity ? Boolean(enableCertificate) : false,
        certificateButtonLabel: certificateButtonLabel.trim() || 'Certificate',
        certificateMode: certificateMode || 'template',
        certificateProjectName: certificateProjectName.trim(),
        certificateDateText: certificateDateText.trim(),
        certificateTemplateUrl: certificateMode === 'individual_link' ? '' : (certificateTemplateUrl ? certificateTemplateUrl.trim() : ''),
        certificateLayout: certificateLayout || DEFAULT_CERT_LAYOUT,
        enablePhoto: enablePostActivity ? enablePhoto : false,
        photoButtonLabel: photoButtonLabel.trim() || 'Photo',
        photoUrl: photoUrl.trim() || ''
      };

      await addDoc(collection(db, 'activities'), newActivity);
      setMessage("✅ สร้างกิจกรรมสำเร็จ! กำลังกลับหน้าหลัก...");

      setTimeout(() => {
        router.push('/admin/activity');
      }, 1000);

    } catch (error) {
      console.error("Error adding activity: ", error);
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 font-sans">
      {/* Top Breadcrumb / Header Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
        <div>
          <h1 className="text-base font-bold text-slate-900">สร้างกิจกรรมใหม่</h1>
          <p className="text-sm font-normal text-slate-500">กรอกข้อมูลเพื่อเปิดรับสมัคร จัดสรรที่นั่ง และตั้งค่าระบบคะแนน/เอกสาร</p>
        </div>
        <Link
          href="/admin/activity"
          className="px-3 py-1.5 text-sm font-normal text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          ← ย้อนกลับ
        </Link>
      </div>

      {/* Main Form Container */}
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic Info Section */}
          <div className="space-y-3.5">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">ข้อมูลทั่วไปของกิจกรรม</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label htmlFor="activityName" className="block text-sm font-normal text-slate-700 mb-1">
                  ชื่อกิจกรรม <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="activityName"
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  placeholder="เช่น สัมภาษณ์นักศึกษาใหม่ ประจำปี 2568"
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-800 outline-none focus:border-slate-400 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label htmlFor="activityType" className="block text-sm font-normal text-slate-700 mb-1">
                  ประเภทกิจกรรม <span className="text-red-500">*</span>
                </label>
                <select
                  id="activityType"
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-800 outline-none focus:border-slate-400"
                >
                  <option value="queue">คิวบริการ / สอบสัมภาษณ์</option>
                  <option value="event">กิจกรรมทั่วไป</option>
                  <option value="exam">สอบข้อเขียน</option>
                  <option value="graduation">รับปริญญาบัตร</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor="capacity" className="block text-sm font-normal text-slate-700 mb-1">
                  จำนวนที่นั่ง / ความจุ (คน) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="capacity"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-800 outline-none focus:border-slate-400"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="location" className="block text-sm font-normal text-slate-700 mb-1">
                  สถานที่จัดกิจกรรม <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="เช่น ห้องประชุม 1 อาคาร 3 ชั้น 2"
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-800 outline-none focus:border-slate-400 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="activityDate" className="block text-sm font-normal text-slate-700 mb-1">
                  วันที่จัดกิจกรรม <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="activityDate"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-800 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label htmlFor="activityTime" className="block text-sm font-normal text-slate-700 mb-1">
                  เวลาเริ่มต้น <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="activityTime"
                  value={activityTime}
                  onChange={(e) => setActivityTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-800 outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Operational Settings Section */}
          <div className="border-t border-slate-100 pt-5 space-y-3.5">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">การตั้งค่าระบบเปิดรับ & ระบบคะแนน</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Registration Status Toggle Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-800 block truncate">เปิดรับลงทะเบียน</span>
                  <span className="text-xs text-slate-500 font-normal block truncate">ให้นักเรียนลงทะเบียนได้</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRegistrationOpen(!isRegistrationOpen)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-normal border transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                    isRegistrationOpen
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {isRegistrationOpen ? 'เปิดรับ' : 'ปิดรับ'}
                </button>
              </div>

              {/* Scoring System Toggle Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-800 block truncate">ระบบบันทึกคะแนน & เอกสาร</span>
                  <span className="text-xs text-slate-500 font-normal block truncate">ให้กรรมการประเมินคะแนน</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableScoring(!enableScoring)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-normal border transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                    enableScoring
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {enableScoring ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </button>
              </div>

              {/* Evaluation Status Toggle Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-800 block truncate">ระบบแบบประเมิน</span>
                  <span className="text-xs text-slate-500 font-normal block truncate">ความพึงพอใจผู้เข้าร่วม</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableEvaluation(!enableEvaluation)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-normal border transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                    enableEvaluation
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {enableEvaluation ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </button>
              </div>

              {/* Station System Toggle Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-800 block truncate">
                    ระบบฐานกิจกรรม
                  </span>
                  <span className="text-xs text-slate-500 font-normal block truncate">
                    สแกนเช็คผ่านแต่ละฐาน
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableStations(!enableStations)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-normal border transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                    enableStations
                      ? 'bg-orange-50 text-orange-700 border-orange-300'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {enableStations ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </button>
              </div>

              {/* Post-Activity Buttons (Certificate & Photo) Toggle Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-800 block truncate">
                    ปุ่มหลังจบกิจกรรม
                  </span>
                  <span className="text-xs text-slate-500 font-normal block truncate">
                    Certificate & Photo
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !enablePostActivity;
                    setEnablePostActivity(next);
                    if (next && !enableCertificate && !enablePhoto) {
                      setEnableCertificate(true);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-normal border transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                    enablePostActivity
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {enablePostActivity ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </button>
              </div>
            </div>

            {/* STATIONS BUILDER (ตามแบบร่างในภาพที่คุณส่งมา) */}
            {enableStations && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>ระบบฐานกิจกรรม</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-normal bg-orange-50 text-[#ff741f] border border-[#ff741f]/30">
                        {stations.length} ฐาน
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 font-normal mt-0.5">
                      กำหนดชื่อฐานและเลือกสัญลักษณ์ไอคอน (SVG) สำหรับสะสมการเข้าฐานของนักเรียน
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStation}
                    className="px-3 py-1.5 bg-[#000946] hover:bg-[#00125e] text-white text-xs font-medium rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>+ เพิ่มฐานกิจกรรม</span>
                  </button>
                </div>

                {/* Stations List Table/Grid */}
                <div className="space-y-2.5">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-600 px-3 py-1 bg-slate-100/70 rounded-lg">
                    <div className="col-span-1 text-center">ลำดับ</div>
                    <div className="col-span-6 sm:col-span-7">ชื่อฐานกิจกรรม</div>
                    <div className="col-span-4 sm:col-span-3 text-center">สัญลักษณ์ไอคอน</div>
                    <div className="col-span-1 text-center">ลบ</div>
                  </div>

                  {stations.map((st, idx) => (
                    <div
                      key={st.id || idx}
                      className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-colors"
                    >
                      <div className="col-span-1 text-center font-bold text-slate-400 text-xs">
                        {idx + 1}
                      </div>

                      <div className="col-span-6 sm:col-span-7">
                        <input
                          type="text"
                          value={st.name}
                          onChange={(e) => handleStationChange(st.id, 'name', e.target.value)}
                          placeholder={`กิจกรรมที่ ${idx + 1}`}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-colors"
                        />
                      </div>

                      {/* Icon Selector with Preview */}
                      <div className="col-span-4 sm:col-span-3 flex items-center justify-center gap-2">
                        <div className="w-9 h-9 rounded-full border-2 border-slate-200 flex items-center justify-center bg-slate-50 text-slate-700 shrink-0">
                          <StationSvgIcon iconId={st.icon} className="w-5 h-5 text-slate-800" />
                        </div>
                        <select
                          value={st.icon || 'wrench'}
                          onChange={(e) => handleStationChange(st.id, 'icon', e.target.value)}
                          className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-slate-400 cursor-pointer"
                        >
                          {STATION_ICONS.map(ic => (
                            <option key={ic.id} value={ic.id}>{ic.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveStation(st.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="ลบฐานนี้"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCORING & DOCUMENTS BUILDER */}
            {enableScoring && (
              <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-4">
                <div className="border-b border-indigo-100 pb-2.5">
                  <h3 className="text-sm font-bold text-indigo-950">
                    ตั้งค่าเกณฑ์คะแนนและเอกสารแนบ
                  </h3>
                  <p className="text-sm text-indigo-700 font-normal mt-0.5">
                    กำหนดหัวข้อคะแนนทั่วไป, คะแนนเฉพาะตามประเภท, และเอกสารที่นักเรียนต้องแนบ
                  </p>
                </div>

                {/* 1. General Criteria Section */}
                <div className="bg-white p-4 rounded-xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">1. เกณฑ์คะแนนทั่วไป (General Criteria)</span>
                      <span className="text-sm px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        คะแนนเต็มรวม: {generalMaxScoreSum} คะแนน
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddGeneralCriterion}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-normal rounded-lg border border-indigo-200 transition-colors"
                    >
                      + เพิ่มหัวข้อคะแนน
                    </button>
                  </div>

                  <div className="space-y-2">
                    {generalCriteria.map((crit, idx) => (
                      <div key={crit.id} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <span className="text-sm text-slate-400 w-5 text-center font-normal">{idx + 1}.</span>
                        <input
                          type="text"
                          value={crit.name}
                          onChange={(e) => handleGeneralCriterionChange(crit.id, 'name', e.target.value)}
                          placeholder="ชื่อหัวข้อคะแนน เช่น บุคลิกภาพ (A)"
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-normal outline-none focus:border-indigo-400"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-slate-500 font-normal">คะแนนเต็ม:</span>
                          <input
                            type="number"
                            min="0"
                            value={crit.maxScore !== undefined ? crit.maxScore : (crit.weight || 0)}
                            onChange={(e) => handleGeneralCriterionChange(crit.id, 'maxScore', e.target.value)}
                            className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-center font-normal outline-none focus:border-indigo-400"
                          />
                          <span className="text-sm text-slate-500 font-normal">คะแนน</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveGeneralCriterion(crit.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-200 text-sm font-normal"
                          title="ลบหัวข้อนี้"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Quota-Specific Criteria Section */}
                <div className="bg-white p-4 rounded-xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-bold text-slate-800">2. เกณฑ์คะแนนเฉพาะตามประเภท (Type Criteria)</span>
                    <button
                      type="button"
                      onClick={handleAddQuotaGroup}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-normal rounded-lg border border-indigo-200 transition-colors"
                    >
                      + เพิ่มประเภท
                    </button>
                  </div>

                  <div className="space-y-3">
                    {quotaCriteriaList.map((quotaGroup, qIdx) => {
                      const quotaMaxSum = quotaGroup.criteria.reduce((s, c) => s + (Number(c.maxScore !== undefined ? c.maxScore : c.weight) || 0), 0);
                      return (
                        <div key={qIdx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-indigo-900">ประเภท: {quotaGroup.quotaName}</span>
                              <span className="text-sm px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                คะแนนเต็มรวม: {quotaMaxSum} คะแนน
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleAddCriterionToQuota(qIdx)}
                                className="text-sm text-indigo-600 hover:underline font-normal"
                              >
                                + เพิ่มเกณฑ์
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveQuotaGroup(qIdx)}
                                className="text-sm text-red-500 hover:underline font-normal"
                              >
                                ลบประเภทนี้
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {quotaGroup.criteria.map((crit, cIdx) => (
                              <div key={crit.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                <span className="text-sm text-slate-400 w-5 text-center font-normal">{cIdx + 1}.</span>
                                <input
                                  type="text"
                                  value={crit.name}
                                  onChange={(e) => handleCriterionInQuotaChange(qIdx, crit.id, 'name', e.target.value)}
                                  placeholder="ชื่อเกณฑ์ เช่น GPAX"
                                  className="flex-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-normal outline-none focus:border-indigo-400"
                                />
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-slate-500 font-normal">คะแนนเต็ม:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={crit.maxScore !== undefined ? crit.maxScore : (crit.weight || 0)}
                                    onChange={(e) => handleCriterionInQuotaChange(qIdx, crit.id, 'maxScore', e.target.value)}
                                    className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm text-center font-normal"
                                  />
                                  <span className="text-sm text-slate-500 font-normal">คะแนน</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCriterionFromQuota(qIdx, crit.id)}
                                  className="text-slate-400 hover:text-red-600 px-1.5 text-sm font-normal"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Photo Evidence Section */}
                <div className="bg-teal-50/80 border border-teal-200 p-4 rounded-xl flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-teal-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <span className="font-semibold text-teal-950 block">ระบบแนบรูปถ่ายหลักฐานหน้างาน (Photo Evidence)</span>
                      <span className="text-sm text-teal-700 font-normal">กรรมการสามารถถ่ายภาพหรือแนบรูปถ่ายหลักฐานประกอบการสัมภาษณ์/ให้คะแนนได้ทันที โดยนักเรียนไม่มีสิทธิ์แนบ</span>
                    </div>
                  </div>
                  <span className="text-sm font-normal text-[#000946] bg-white px-3 py-1 rounded-lg border border-teal-200 shrink-0">
                    เปิดใช้งานอัตโนมัติ
                  </span>
                </div>
              </div>
            )}

            {/* Evaluation Questions Builder */}
            {enableEvaluation && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">
                    หัวข้อคำถามในแบบประเมิน ({evaluationQuestions.length} ข้อ)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 text-sm font-normal rounded-lg border border-slate-200 transition-colors"
                  >
                    + เพิ่มคำถาม
                  </button>
                </div>

                <div className="space-y-2.5">
                  {evaluationQuestions.map((q, index) => (
                    <div key={q.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-slate-400 font-normal pt-2 w-5 text-center">{index + 1}</span>
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) => handleQuestionChange(q.id, 'text', e.target.value)}
                          placeholder="ระบุข้อคำถาม เช่น ความตรงต่อเวลาของวิทยากร"
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-800 outline-none focus:border-slate-400"
                        />
                        <select
                          value={q.type}
                          onChange={(e) => handleQuestionChange(q.id, 'type', e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-700 outline-none"
                        >
                          <option value="rating">คะแนน (1-5)</option>
                          <option value="text">ข้อความปลายเปิด</option>
                          <option value="radio">ตัวเลือกเดี่ยว (Radio)</option>
                          <option value="checkbox">ตัวเลือกหลายข้อ (Checkbox)</option>
                        </select>
                        <label className="flex items-center gap-1.5 text-sm font-normal text-slate-600 pt-2 whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.isRequired !== false}
                            onChange={(e) => handleQuestionChange(q.id, 'isRequired', e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          <span>จำเป็น</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(q.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 font-normal text-sm"
                          title="ลบคำถาม"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Options Configuration for Radio & Checkbox */}
                      {(q.type === 'radio' || q.type === 'checkbox') && (
                        <div className="ml-7 pl-3 border-l-2 border-slate-200 space-y-2 pt-1 pb-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-normal text-slate-700 flex items-center gap-1.5">
                              <span>
                                {q.type === 'radio' ? 'ตัวเลือกคำตอบ (เลือกได้ข้อเดียว)' : 'ตัวเลือกคำตอบ (เลือกได้หลายข้อ)'}
                              </span>
                              <span className="text-sm text-slate-400 font-normal">
                                ({q.options?.length || 0} ตัวเลือก)
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddOption(q.id)}
                              className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-[#000946] hover:text-[#00125e] text-sm font-normal rounded-lg border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span>+</span>
                              <span>เพิ่มตัวเลือก</span>
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            {(q.options && q.options.length > 0 ? q.options : ['ตัวเลือก 1', 'ตัวเลือก 2']).map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm w-4 text-center select-none font-normal">
                                  {q.type === 'radio' ? '○' : '□'}
                                </span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => handleOptionChange(q.id, optIdx, e.target.value)}
                                  placeholder={`ระบุข้อความตัวเลือกที่ ${optIdx + 1}`}
                                  className="flex-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-800 outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(q.id, optIdx)}
                                  disabled={(q.options?.length || 0) <= 1}
                                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg disabled:opacity-20 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer text-sm font-normal"
                                  title="ลบตัวเลือกนี้"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* POST-ACTIVITY BUTTONS BUILDER (Certificate & Photo) */}
            {enablePostActivity && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span>🎖️</span>
                  <span>ปุ่มกดหลังจบกิจกรรม (Certificate & Photo)</span>
                </h3>
              </div>

              <div className="space-y-3 pt-1">
                {/* 1. Photo Button Configuration (อยู่ด้านบน กะทัดรัด แนวนอน) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <span>📷</span>
                      <span>Photo (รูปภาพกิจกรรม)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEnablePhoto(!enablePhoto)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-normal border transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                        enablePhoto
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      {enablePhoto ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                    <div className="sm:col-span-1">
                      <label className="block text-xs text-slate-600 font-normal mb-1">
                        ชื่อปุ่ม
                      </label>
                      <input
                        type="text"
                        value={photoButtonLabel}
                        onChange={(e) => setPhotoButtonLabel(e.target.value)}
                        placeholder="Photo"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-800 outline-none focus:border-[#000946]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 font-normal mb-1">
                        ลิงก์อัลบั้มรูปภาพกิจกรรม
                      </label>
                      <input
                        type="url"
                        value={photoUrl}
                        onChange={(e) => setPhotoUrl(e.target.value)}
                        placeholder="https://drive.google.com/... หรือ Google Photos"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-800 outline-none focus:border-[#000946]"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Certificate Button Configuration (อยู่ด้านล่าง พื้นที่เต็มความกว้าง) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <span>📜</span>
                      <span>Certificate (เกียรติบัตร)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEnableCertificate(!enableCertificate)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-normal border transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                        enableCertificate
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      {enableCertificate ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-xs text-slate-600 font-normal mb-1">
                        ชื่อปุ่ม
                      </label>
                      <input
                        type="text"
                        value={certificateButtonLabel}
                        onChange={(e) => setCertificateButtonLabel(e.target.value)}
                        placeholder="Certificate"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-800 outline-none focus:border-[#000946]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        รูปแบบเกียรติบัตร
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setCertificateMode('template')}
                          className={`p-1.5 px-2.5 rounded-lg border text-left cursor-pointer transition-colors flex items-center justify-between ${
                            certificateMode === 'template'
                              ? 'bg-emerald-50/70 border-emerald-400 text-emerald-900 font-medium ring-1 ring-emerald-300'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-semibold">🎨 Template อัตโนมัติ</span>
                          <span className="text-[10px] text-slate-500 font-normal">ระบบสร้างให้</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCertificateMode('individual_link')}
                          className={`p-1.5 px-2.5 rounded-lg border text-left cursor-pointer transition-colors flex items-center justify-between ${
                            certificateMode === 'individual_link'
                              ? 'bg-emerald-50/70 border-emerald-400 text-emerald-900 font-medium ring-1 ring-emerald-300'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-semibold">🔗 แนบลิงก์รายบุคคล</span>
                          <span className="text-[10px] text-slate-500 font-normal">CSV/ใส่เอง</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {certificateMode === 'template' ? (
                    <div className="space-y-2.5 pt-1 bg-amber-50/40 p-3 rounded-xl border border-amber-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-800 mb-0.5">
                            ชื่อโครงการบนเกียรติบัตร
                          </label>
                          <input
                            type="text"
                            value={certificateProjectName}
                            onChange={(e) => setCertificateProjectName(e.target.value)}
                            placeholder="เช่น CIVIL AVIATION WORKSHOP 2026 (เว้นว่าง = ใช้ชื่อกิจกรรม)"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-[#000946]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-800 mb-0.5">
                            วันที่ระบุบนเกียรติบัตร
                          </label>
                          <input
                            type="text"
                            value={certificateDateText}
                            onChange={(e) => setCertificateDateText(e.target.value)}
                            placeholder="เช่น 21 ตุลาคม 2569 หรือ 21 October 2026"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-[#000946]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-0.5">
                          ไฟล์ Template (รูปพื้นหลังเกียรติบัตร) <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingTemplate}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setIsUploadingTemplate(true);
                              try {
                                const reader = new FileReader();
                                reader.onload = async (ev) => {
                                  try {
                                    const rawBase64 = ev.target?.result;
                                    if (!rawBase64) throw new Error('ไม่พบข้อมูลรูปภาพ');

                                    // บีบอัดและปรับขนาดรูปภาพให้อยู่ในขนาดที่เหมาะสม (Max 1280px) เพื่อให้โหลดเร็วและไม่เกินข้อจำกัด
                                    const optimizedBase64 = await new Promise((resolve) => {
                                      const img = new Image();
                                      img.onload = () => {
                                        let w = img.width;
                                        let h = img.height;
                                        const maxDim = 1280;
                                        if (w > maxDim || h > maxDim) {
                                          if (w > h) {
                                            h = Math.round((h * maxDim) / w);
                                            w = maxDim;
                                          } else {
                                            w = Math.round((w * maxDim) / h);
                                            h = maxDim;
                                          }
                                        }
                                        const c = document.createElement('canvas');
                                        c.width = w;
                                        c.height = h;
                                        const ctx = c.getContext('2d');
                                        ctx.drawImage(img, 0, 0, w, h);
                                        resolve(c.toDataURL('image/jpeg', 0.88));
                                      };
                                      img.onerror = () => resolve(rawBase64);
                                      img.src = rawBase64;
                                    });

                                    let uploadedUrl = '';

                                    // 1. ลองอัปโหลดไปยัง Firebase Storage ก่อน
                                    if (storage) {
                                      try {
                                        const storagePath = `cert-templates/template_${Date.now()}.jpg`;
                                        const storageRef = ref(storage, storagePath);
                                        const snap = await uploadString(storageRef, optimizedBase64, 'data_url');
                                        uploadedUrl = await getDownloadURL(snap.ref);
                                      } catch (storageErr) {
                                        console.warn('Firebase Storage upload error, falling back to server upload:', storageErr?.message);
                                      }
                                    }

                                    // 2. ถ้า Storage อัปโหลดไม่ได้ ให้ลองผ่าน /api/upload
                                    if (!uploadedUrl) {
                                      try {
                                        const res = await fetch('/api/upload', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            base64: optimizedBase64,
                                            file: optimizedBase64,
                                            path: `cert-templates/template_${Date.now()}.jpg`
                                          })
                                        });
                                        const json = await res.json();
                                        if (json.url) {
                                          uploadedUrl = json.url;
                                        }
                                      } catch (apiErr) {
                                        console.warn('/api/upload fallback error:', apiErr?.message);
                                      }
                                    }

                                    // 3. Fallback ขั้นสุดท้าย: ใช้ Data URL ที่บีบอัดแล้วโดยตรง (ทำงานได้ 100% บน Vercel แม้ไม่มี Storage)
                                    if (!uploadedUrl) {
                                      uploadedUrl = optimizedBase64;
                                    }

                                    setCertificateTemplateUrl(uploadedUrl);
                                    showToast({ message: 'อัปโหลด Template เกียรติบัตรเรียบร้อย!', type: 'success' });
                                  } catch (err) {
                                    console.error('Template upload error:', err);
                                    showAlert({ title: 'อัปโหลดไม่สำเร็จ', message: err.message, type: 'error' });
                                  } finally {
                                    setIsUploadingTemplate(false);
                                  }
                                };
                                reader.readAsDataURL(file);
                              } catch (err) {
                                setIsUploadingTemplate(false);
                              }
                            }}
                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                          />
                          {certificateTemplateUrl && (
                            <button
                              type="button"
                              onClick={() => setCertificateTemplateUrl('')}
                              className="text-[11px] text-red-600 hover:text-red-800 underline whitespace-nowrap cursor-pointer"
                              title="ลบไฟล์รูปภาพเทมเพลต"
                            >
                              ลบเทมเพลต
                            </button>
                          )}
                        </div>
                        {isUploadingTemplate && (
                          <div className="text-xs text-indigo-600 mt-1 flex items-center gap-1.5">
                            <span className="w-3 h-3 border border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                            <span>กำลังอัปโหลดไฟล์เทมเพลต...</span>
                          </div>
                        )}
                        {certificateTemplateUrl ? (
                          <div className="space-y-3 pt-2">
                            {/* Live Preview Header & Controls */}
                            <div className="flex items-center justify-between border-t border-slate-200/80 pt-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-800">👁️ ตัวอย่างผลลัพธ์จริง (Live Preview)</span>
                                {isGeneratingLivePreview ? (
                                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 animate-pulse">
                                    กำลังปรับตำแหน่ง...
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    ⚡ อัปเดตสด
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setCertificateLayout({ ...DEFAULT_CERT_LAYOUT })}
                                className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors cursor-pointer"
                                title="คืนค่าตำแหน่งและขนาดฟอนต์มาตรฐาน"
                              >
                                ↺ รีเซ็ตตำแหน่งเริ่มต้น
                              </button>
                            </div>

                            {/* Canvas Live Preview Container */}
                            <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-950 flex items-center justify-center min-h-[200px] max-h-[380px]">
                              {livePreviewUrl ? (
                                <img
                                  src={livePreviewUrl}
                                  alt="Certificate Live Preview"
                                  className="max-h-[360px] w-auto object-contain"
                                />
                              ) : (
                                <div className="text-xs text-slate-400 py-6">กำลังประมวลผลตัวอย่าง...</div>
                              )}
                              {isGeneratingLivePreview && (
                                <div className="absolute top-2 right-2 px-2 py-1 bg-black/75 backdrop-blur-xs text-[10px] text-white rounded-md flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                  <span>เรนเดอร์ตำแหน่งใหม่...</span>
                                </div>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-normal">
                              * ตัวอย่างใช้ชื่อจำลอง <span className="font-semibold text-slate-700">MR. SOMCHAI JAIDEE</span> เพื่อให้คุณกะระยะบรรทัดได้ตรงช่อง
                            </p>

                            {/* Dynamic Position & Size Controls for 3 Sections */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <span>🎛️</span>
                                  <span>ปรับตำแหน่งแนวตั้ง (Y) และขนาดฟอนต์ 3 ส่วน</span>
                                </span>
                                <span className="text-[10px] text-slate-500 font-normal">เลื่อนแถบเพื่อขยับข้อความ</span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                {/* Section 1: NAME SURNAME */}
                                <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full inline-block border border-black/20"
                                        style={{ backgroundColor: certificateLayout.nameColor || '#063826' }}
                                      ></span>
                                      <span>1. ชื่อ-สกุล (NAME)</span>
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                                      Y:{certificateLayout.nameY} | {certificateLayout.nameFontSize}px
                                    </span>
                                  </div>

                                  <div className="space-y-1.5 text-xs">
                                    <div>
                                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                        <span>ตำแหน่ง (Y)</span>
                                        <span className="font-mono text-slate-700">{certificateLayout.nameY}</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="150"
                                        max="600"
                                        step="1"
                                        value={certificateLayout.nameY}
                                        onChange={(e) => setCertificateLayout(p => ({ ...p, nameY: Number(e.target.value) }))}
                                        className="w-full accent-emerald-600 cursor-pointer"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                        <span>ขนาดฟอนต์</span>
                                        <span className="font-mono text-slate-700">{certificateLayout.nameFontSize}px</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="16"
                                        max="60"
                                        step="1"
                                        value={certificateLayout.nameFontSize}
                                        onChange={(e) => setCertificateLayout(p => ({ ...p, nameFontSize: Number(e.target.value) }))}
                                        className="w-full accent-emerald-600 cursor-pointer"
                                      />
                                    </div>
                                  </div>

                                  {/* Color Swatch Box + HEX Text Input */}
                                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-[11px] text-slate-600 font-medium">สี:</span>
                                    <div className="flex items-center gap-1.5">
                                      <label
                                        className="relative w-5 h-5 rounded-md border border-slate-300 hover:border-slate-400 cursor-pointer overflow-hidden flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: certificateLayout.nameColor || '#063826' }}
                                        title="คลิกเพื่อเลือกสี"
                                      >
                                        <input
                                          type="color"
                                          value={isValidHex(certificateLayout.nameColor) ? certificateLayout.nameColor : '#063826'}
                                          onChange={(e) => setCertificateLayout(p => ({ ...p, nameColor: e.target.value }))}
                                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                      </label>
                                      <div className="flex items-center bg-white border border-slate-200 rounded overflow-hidden h-5">
                                        <span className="px-0.5 text-[10px] text-slate-400 font-mono">#</span>
                                        <input
                                          type="text"
                                          maxLength={6}
                                          value={(certificateLayout.nameColor || '#063826').replace(/^#/, '')}
                                          onChange={(e) => {
                                            const hex = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
                                            setCertificateLayout(p => ({ ...p, nameColor: '#' + hex }));
                                          }}
                                          placeholder="063826"
                                          className="w-14 text-[10px] font-mono uppercase text-slate-800 outline-none"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Section 2: PROJECT NAME */}
                                <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full inline-block border border-black/20"
                                        style={{ backgroundColor: certificateLayout.projectColor || '#1e293b' }}
                                      ></span>
                                      <span>2. โครงการ (PROJECT)</span>
                                    </span>
                                    <span className="text-[10px] font-mono text-blue-800 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                                      Y:{certificateLayout.projectY} | {certificateLayout.projectFontSize}px
                                    </span>
                                  </div>

                                  <div className="space-y-1.5 text-xs">
                                    <div>
                                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                        <span>ตำแหน่ง (Y)</span>
                                        <span className="font-mono text-slate-700">{certificateLayout.projectY}</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="200"
                                        max="680"
                                        step="1"
                                        value={certificateLayout.projectY}
                                        onChange={(e) => setCertificateLayout(p => ({ ...p, projectY: Number(e.target.value) }))}
                                        className="w-full accent-blue-600 cursor-pointer"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                        <span>ขนาดฟอนต์</span>
                                        <span className="font-mono text-slate-700">{certificateLayout.projectFontSize}px</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="12"
                                        max="44"
                                        step="1"
                                        value={certificateLayout.projectFontSize}
                                        onChange={(e) => setCertificateLayout(p => ({ ...p, projectFontSize: Number(e.target.value) }))}
                                        className="w-full accent-blue-600 cursor-pointer"
                                      />
                                    </div>
                                  </div>

                                  {/* Color Swatch Box + HEX Text Input */}
                                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-[11px] text-slate-600 font-medium">สี:</span>
                                    <div className="flex items-center gap-1.5">
                                      <label
                                        className="relative w-5 h-5 rounded-md border border-slate-300 hover:border-slate-400 cursor-pointer overflow-hidden flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: certificateLayout.projectColor || '#1e293b' }}
                                        title="คลิกเพื่อเลือกสี"
                                      >
                                        <input
                                          type="color"
                                          value={isValidHex(certificateLayout.projectColor) ? certificateLayout.projectColor : '#1e293b'}
                                          onChange={(e) => setCertificateLayout(p => ({ ...p, projectColor: e.target.value }))}
                                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                      </label>
                                      <div className="flex items-center bg-white border border-slate-200 rounded overflow-hidden h-5">
                                        <span className="px-0.5 text-[10px] text-slate-400 font-mono">#</span>
                                        <input
                                          type="text"
                                          maxLength={6}
                                          value={(certificateLayout.projectColor || '#1e293b').replace(/^#/, '')}
                                          onChange={(e) => {
                                            const hex = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
                                            setCertificateLayout(p => ({ ...p, projectColor: '#' + hex }));
                                          }}
                                          placeholder="1E293B"
                                          className="w-14 text-[10px] font-mono uppercase text-slate-800 outline-none"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Section 3: DATE MONTH YEAR */}
                                <div className="bg-white p-2.5 rounded-lg border border-amber-200/80 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full inline-block border border-black/20"
                                        style={{ backgroundColor: certificateLayout.dateColor || '#1e293b' }}
                                      ></span>
                                      <span>3. วันที่ (DATE)</span>
                                    </span>
                                    <span className="text-[10px] font-mono text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                                      Y:{certificateLayout.dateY} | {certificateLayout.dateFontSize}px
                                    </span>
                                  </div>

                                  <div className="space-y-1.5 text-xs">
                                    <div>
                                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                        <span>ตำแหน่ง (Y)</span>
                                        <span className="font-mono text-slate-700">{certificateLayout.dateY}</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="250"
                                        max="710"
                                        step="1"
                                        value={certificateLayout.dateY}
                                        onChange={(e) => setCertificateLayout(p => ({ ...p, dateY: Number(e.target.value) }))}
                                        className="w-full accent-amber-600 cursor-pointer"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                        <span>ขนาดฟอนต์</span>
                                        <span className="font-mono text-slate-700">{certificateLayout.dateFontSize}px</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="10"
                                        max="32"
                                        step="1"
                                        value={certificateLayout.dateFontSize}
                                        onChange={(e) => setCertificateLayout(p => ({ ...p, dateFontSize: Number(e.target.value) }))}
                                        className="w-full accent-amber-600 cursor-pointer"
                                      />
                                    </div>
                                  </div>

                                  {/* Color Swatch Box + HEX Text Input */}
                                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-[11px] text-slate-600 font-medium">สี:</span>
                                    <div className="flex items-center gap-1.5">
                                      <label
                                        className="relative w-5 h-5 rounded-md border border-slate-300 hover:border-slate-400 cursor-pointer overflow-hidden flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: certificateLayout.dateColor || '#1e293b' }}
                                        title="คลิกเพื่อเลือกสี"
                                      >
                                        <input
                                          type="color"
                                          value={isValidHex(certificateLayout.dateColor) ? certificateLayout.dateColor : '#1e293b'}
                                          onChange={(e) => setCertificateLayout(p => ({ ...p, dateColor: e.target.value }))}
                                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                      </label>
                                      <div className="flex items-center bg-white border border-slate-200 rounded overflow-hidden h-5">
                                        <span className="px-0.5 text-[10px] text-slate-400 font-mono">#</span>
                                        <input
                                          type="text"
                                          maxLength={6}
                                          value={(certificateLayout.dateColor || '#1e293b').replace(/^#/, '')}
                                          onChange={(e) => {
                                            const hex = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
                                            setCertificateLayout(p => ({ ...p, dateColor: '#' + hex }));
                                          }}
                                          placeholder="1E293B"
                                          className="w-14 text-[10px] font-mono uppercase text-slate-800 outline-none"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-700 mt-1 bg-amber-50 p-2 rounded-lg border border-amber-200">
                            ⚠️ กรุณาอัปโหลดรูปภาพเทมเพลตเกียรติบัตร (PNG/JPG)
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-normal">
                      💡 <span className="font-semibold text-slate-700">ลิงก์รายบุคคล:</span> แนบลิงก์รายบุคคลในหน้ารายชื่อผู้ลงทะเบียน หรือนำเข้าจาก CSV
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm font-normal border ${message.startsWith('✅') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {message}
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="border-t border-slate-100 pt-5 flex items-center justify-end gap-3">
            <Link
              href="/admin/activity"
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-normal rounded-lg transition-colors cursor-pointer"
            >
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-[#000946] hover:bg-[#00125e] text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? 'กำลังสร้าง...' : 'บันทึกและสร้างกิจกรรม'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}