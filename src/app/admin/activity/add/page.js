'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '../../../../lib/firebase';
import { collection, getDocs, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useModal } from '../../../../context/ModalContext';


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
    const name = prompt('กรุณาระบุชื่อประเภทโควตา (เช่น เรียนดี, ความสามารถพิเศษ):');
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
      message: 'ต้องการลบกลุ่มโควตานี้ใช่หรือไม่?',
      type: 'danger',
      confirmText: 'ลบกลุ่มโควตา',
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
        enableScoring,
        scoringConfig: enableScoring ? {
          generalCriteria,
          quotaCriteriaList,
          requiredDocuments
        } : null,
        isRegistrationOpen
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
            </div>

            {/* SCORING & DOCUMENTS BUILDER */}
            {enableScoring && (
              <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-4">
                <div className="border-b border-indigo-100 pb-2.5">
                  <h3 className="text-sm font-bold text-indigo-950">
                    ตั้งค่าเกณฑ์คะแนนและเอกสารแนบ
                  </h3>
                  <p className="text-sm text-indigo-700 font-normal mt-0.5">
                    กำหนดหัวข้อคะแนนทั่วไป, คะแนนเฉพาะตามโควตา, และเอกสารที่นักเรียนต้องแนบ
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
                    <span className="text-sm font-bold text-slate-800">2. เกณฑ์คะแนนเฉพาะตามโควตา (Quota Criteria)</span>
                    <button
                      type="button"
                      onClick={handleAddQuotaGroup}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-normal rounded-lg border border-indigo-200 transition-colors"
                    >
                      + เพิ่มประเภทโควตา
                    </button>
                  </div>

                  <div className="space-y-3">
                    {quotaCriteriaList.map((quotaGroup, qIdx) => {
                      const quotaMaxSum = quotaGroup.criteria.reduce((s, c) => s + (Number(c.maxScore !== undefined ? c.maxScore : c.weight) || 0), 0);
                      return (
                        <div key={qIdx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-indigo-900">โควตา: {quotaGroup.quotaName}</span>
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
                                ลบโควตานี้
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