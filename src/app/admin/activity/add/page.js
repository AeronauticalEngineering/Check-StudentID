'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { collection, getDocs, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';

export default function AddActivityPage() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activityName, setActivityName] = useState('');
  const [activityType, setActivityType] = useState('event');
  const [capacity, setCapacity] = useState(50);
  const [activityDate, setActivityDate] = useState('');
  const [activityTime, setActivityTime] = useState('');
  const [location, setLocation] = useState('');

  // Evaluation State
  const [enableEvaluation, setEnableEvaluation] = useState(true);
  const [evaluationQuestions, setEvaluationQuestions] = useState([
    { id: 'default_1', text: 'ความพึงพอใจโดยรวม', type: 'rating' },
    { id: 'default_2', text: 'ข้อเสนอแนะเพิ่มเติม', type: 'text' }
  ]);

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
      alert("กรุณาใส่ชื่อหมวดหมู่"); return;
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
      setMessage("✅ เพิ่มหมวดหมู่สำเร็จ!");
    } catch (error) {
      console.error("Error adding category: ", error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSavingCategory(false);
    }
  };

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

  const handleOptionChange = (qId, optionIndex, value) => {
    setEvaluationQuestions(evaluationQuestions.map(q => {
      if (q.id === qId) {
        const newOptions = [...(q.options || [])];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const handleAddOption = (qId) => {
    setEvaluationQuestions(evaluationQuestions.map(q => {
      if (q.id === qId) {
        const newOptions = [...(q.options || []), `ตัวเลือก ${(q.options?.length || 0) + 1}`];
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const handleRemoveOption = (qId, optionIndex) => {
    setEvaluationQuestions(evaluationQuestions.map(q => {
      if (q.id === qId) {
        const newOptions = q.options.filter((_, idx) => idx !== optionIndex);
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsLoading(true);
    try {
      const dateTimeString = `${activityDate}T${activityTime}`;
      const jsDate = new Date(dateTimeString);
      const firestoreTimestamp = Timestamp.fromDate(jsDate);

      const newActivity = {
        categoryId: selectedCategory,
        name: activityName,
        type: activityType,
        capacity: Number(capacity),
        location: location,
        activityDate: firestoreTimestamp,
        createdAt: serverTimestamp(),
        // Evaluation Config
        enableEvaluation,
        evaluationQuestions: enableEvaluation ? evaluationQuestions : [],
        isRegistrationOpen // Use state value
      };

      await addDoc(collection(db, 'activities'), newActivity);
      setMessage("✅ สร้างกิจกรรมสำเร็จ! กำลังกลับหน้าหลัก...");

      // Redirect after short delay
      setTimeout(() => {
        router.push('/admin/activity');
      }, 1000);

    } catch (error) {
      console.error("Error adding activity: ", error);
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">เพิ่มหมวดหมู่ใหม่</h2>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="ชื่อหมวดหมู่..."
              className="w-full p-2 border border-gray-300 rounded-md mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} disabled={isSavingCategory} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">
                ยกเลิก
              </button>
              <button onClick={handleSaveCategory} disabled={isSavingCategory} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">
                {isSavingCategory ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">สร้างกิจกรรมใหม่</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Hidden Category Selection - Defaulting to first available or empty */}
            <div className="hidden">
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
              <div className="flex items-center gap-2">
                <select id="category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                  {categories.length === 0
                    ? <option>ไม่มีหมวดหมู่</option>
                    : categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)
                  }
                </select>
                <button type="button" onClick={() => setIsModalOpen(true)} className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-lg font-bold">+</button>
              </div>
            </div>

            <div>
              <label htmlFor="activityType" className="block text-sm font-medium text-gray-700 mb-1">ประเภทกิจกรรม</label>
              <select id="activityType" value={activityType} onChange={(e) => setActivityType(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                <option value="event">ปกติ</option>
                <option value="exam">สอบข้อเขียน</option>
                <option value="graduation">รับปริญญาบัตร</option>
                <option value="queue">คิว</option>
              </select>
            </div>

            <div>
              <label htmlFor="activityName" className="block text-sm font-medium text-gray-700 mb-1">ชื่อกิจกรรม</label>
              <input type="text" id="activityName" value={activityName} onChange={(e) => setActivityName(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">จำนวนคน</label>
                <input type="number" id="capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">สถานที่</label>
                <input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="activityDate" className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                <input type="date" id="activityDate" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="activityTime" className="block text-sm font-medium text-gray-700 mb-1">เวลา</label>
                <input type="time" id="activityTime" value={activityTime} onChange={(e) => setActivityTime(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>

            {/* Registration Settings */}
            <div className="border-t pt-5 mt-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">สถานะการลงทะเบียน</h3>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={isRegistrationOpen} onChange={(e) => setIsRegistrationOpen(e.target.checked)} />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${isRegistrationOpen ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isRegistrationOpen ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-gray-700 font-medium">{isRegistrationOpen ? 'เปิดรับลงทะเบียน' : 'ปิดรับลงทะเบียน'}</span>
                </label>
              </div>
            </div>

            {/* Evaluation Settings */}
            <div className="border-t pt-5 mt-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">การตั้งค่าการประเมิน</h3>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={enableEvaluation} onChange={(e) => setEnableEvaluation(e.target.checked)} />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${enableEvaluation ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${enableEvaluation ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-gray-700 font-medium">{enableEvaluation ? 'เปิดรับการประเมิน' : 'ปิดการประเมิน'}</span>
                </label>
              </div>

              {enableEvaluation && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-3">กำหนดหัวข้อคำถามที่ต้องการให้ผู้เข้าร่วมประเมิน</p>
                  <div className="space-y-3">
                    {evaluationQuestions.map((q, index) => (
                      <div key={q.id} className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-gray-100">
                        <div className="flex gap-2 items-start">
                          <span className="pt-2 text-gray-400 font-bold text-sm w-4">{index + 1}.</span>
                          <input
                            type="text"
                            value={q.text}
                            onChange={(e) => handleQuestionChange(q.id, 'text', e.target.value)}
                            placeholder="คำถาม..."
                            className="flex-grow p-2 border border-gray-300 rounded-md text-sm"
                          />
                          <select
                            value={q.type}
                            onChange={(e) => handleQuestionChange(q.id, 'type', e.target.value)}
                            className="p-2 border border-gray-300 rounded-md text-sm w-36 bg-gray-50"
                          >
                            <option value="rating">ให้คะแนน (1-5)</option>
                            <option value="text">ข้อความ</option>
                            <option value="radio">ตัวเลือก (ข้อเดียว)</option>
                            <option value="checkbox">ตัวเลือก (หลายข้อ)</option>
                          </select>
                          <label className="flex items-center gap-1 mt-2 text-sm text-gray-600 whitespace-nowrap cursor-pointer">
                            <input
                              type="checkbox"
                              checked={q.isRequired !== false} // Default is true if undefined
                              onChange={(e) => handleQuestionChange(q.id, 'isRequired', e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                            บังคับตอบ
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(q.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>

                        {/* Options Editor for Checkbox / Radio */}
                        {(q.type === 'checkbox' || q.type === 'radio') && (
                          <div className="ml-6 pl-2 border-l-2 border-gray-200 mt-2 space-y-2">
                            {q.options && q.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <div className={`w-3 h-3 border border-gray-400 ${q.type === 'radio' ? 'rounded-full' : 'rounded-sm'}`}></div>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => handleOptionChange(q.id, optIdx, e.target.value)}
                                  className="text-sm p-1.5 border-b border-gray-200 focus:border-blue-500 focus:outline-none flex-grow bg-transparent"
                                />
                                {q.options.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(q.id, optIdx)}
                                    className="text-red-400 hover:text-red-600 p-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleAddOption(q.id)}
                              className="text-xs text-blue-500 hover:text-blue-700 font-medium ml-5 flex items-center gap-1 mt-1"
                            >
                              + เพิ่มตัวเลือก
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="mt-3 text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    เพิ่มคำถาม
                  </button>
                </div>
              )}
            </div>

            {message && <p className={`font-bold text-center ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}

            <button type="submit" disabled={isLoading} className="w-full py-3 px-4 mt-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300">
              {isLoading ? 'กำลังสร้างกิจกรรม...' : 'สร้างกิจกรรม'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}