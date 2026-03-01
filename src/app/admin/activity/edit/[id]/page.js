'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '../../../../../lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs, Timestamp } from 'firebase/firestore';

const toDateInputString = (date) => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
};

const toTimeInputString = (date) => {
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${min}`;
};


export default function EditActivityPage({ params }) {
  const { id: activityId } = use(params);
  const router = useRouter();

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activityName, setActivityName] = useState('');
  const [capacity, setCapacity] = useState(50);
  const [activityDate, setActivityDate] = useState('');
  const [activityTime, setActivityTime] = useState('');
  const [location, setLocation] = useState('');
  const [activityType, setActivityType] = useState('event');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Evaluation State
  const [enableEvaluation, setEnableEvaluation] = useState(true);
  const [evaluationQuestions, setEvaluationQuestions] = useState([]);

  // Registration State
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);

  const handleAddQuestion = () => {
    setEvaluationQuestions([
      ...evaluationQuestions,
      { id: Date.now(), text: '', type: 'rating' }
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

  useEffect(() => {
    if (!activityId) return;

    const fetchData = async () => {
      try {
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categoriesData = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCategories(categoriesData);

        const activityDocRef = doc(db, 'activities', activityId);
        const activitySnap = await getDoc(activityDocRef);

        if (activitySnap.exists()) {
          const data = activitySnap.data();
          setActivityName(data.name);
          setSelectedCategory(data.categoryId);
          setCapacity(data.capacity);
          setLocation(data.location);
          setActivityType(data.type || 'event');
          if (data.activityDate) {
            const dateObj = data.activityDate.toDate();
            setActivityDate(toDateInputString(dateObj));
            setActivityTime(toTimeInputString(dateObj));
          }

          // Load Registration Config
          if (data.isRegistrationOpen !== undefined) {
            setIsRegistrationOpen(data.isRegistrationOpen);
          }

          // Load Evaluation Config
          if (data.enableEvaluation !== undefined) {
            setEnableEvaluation(data.enableEvaluation);
          }
          if (data.evaluationQuestions) {
            setEvaluationQuestions(data.evaluationQuestions);
          } else {
            // Default for existing activities without config
            setEvaluationQuestions([
              { id: 'default_1', text: 'ความพึงพอใจโดยรวม', type: 'rating' },
              { id: 'default_2', text: 'ข้อเสนอแนะเพิ่มเติม', type: 'text' }
            ]);
          }
        } else {
          setMessage("ไม่พบข้อมูลกิจกรรมนี้");
        }
      } catch (error) {
        console.error("Error fetching document:", error);
        setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activityId]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    try {
      const dateTimeString = `${activityDate}T${activityTime}`;
      const firestoreTimestamp = Timestamp.fromDate(new Date(dateTimeString));
      const updatedData = {
        name: activityName,
        categoryId: selectedCategory,
        capacity: Number(capacity),
        location: location,
        type: activityType,
        activityDate: firestoreTimestamp,
        isRegistrationOpen,
        // Evaluation Config
        enableEvaluation,
        evaluationQuestions: enableEvaluation ? evaluationQuestions : []
      };
      const activityDocRef = doc(db, 'activities', activityId);
      await updateDoc(activityDocRef, updatedData);
      setMessage("✅ อัปเดตข้อมูลกิจกรรมสำเร็จ! กำลังกลับหน้าหลัก...");

      // Redirect after short delay
      setTimeout(() => {
        router.push('/admin/activity');
      }, 1000);

    } catch (error) {
      console.error("Error updating document:", error);
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบกิจกรรม "${activityName}" ?`)) {
      return;
    }
    setIsLoading(true);
    try {
      const activityDocRef = doc(db, 'activities', activityId);
      await deleteDoc(activityDocRef);
      alert("ลบกิจกรรมสำเร็จ!");
      router.push('/admin/activity');
    } catch (error) {
      console.error("Error deleting document:", error);
      setMessage(`เกิดข้อผิดพลาดในการลบ: ${error.message}`);
      setIsLoading(false);
    }
  };

  if (isLoading) return <div className="text-center p-10">กำลังโหลดข้อมูลกิจกรรม...</div>;

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-8">
      <main className="max-w-3xl mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">แก้ไขกิจกรรม</h1>
              <p className="text-sm text-gray-500 mt-1">ID: {activityId}</p>
            </div>
            <Link href="/admin/activity" className="text-sm text-blue-600 hover:underline">
              &larr; กลับไปหน้าหลัก
            </Link>
          </div>
          <form onSubmit={handleUpdate} className="flex flex-col gap-5">
            <div className="hidden">
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
              <select id="category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md">
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="activityType" className="block text-sm font-medium text-gray-700 mb-1">ประเภทกิจกรรม</label>
              <select id="activityType" value={activityType} onChange={(e) => setActivityType(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md">
                <option value="event">ปกติ</option>
                <option value="exam">สอบข้อเขียน</option>
                <option value="graduation">รับปริญญาบัตร</option>
                <option value="queue">คิว</option>
              </select>
            </div>
            <div>
              <label htmlFor="activityName" className="block text-sm font-medium text-gray-700 mb-1">ชื่อกิจกรรม</label>
              <input type="text" id="activityName" value={activityName} onChange={(e) => setActivityName(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">จำนวนคน</label>
                <input type="number" id="capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">สถานที่</label>
                <input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="activityDate" className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                <input type="date" id="activityDate" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label htmlFor="activityTime" className="block text-sm font-medium text-gray-700 mb-1">เวลา</label>
                <input type="time" id="activityTime" value={activityTime} onChange={(e) => setActivityTime(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md" />
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
            <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-4">
              <button type="button" onClick={handleDelete} disabled={isLoading} className="w-full md:w-auto px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-red-300">
                ลบกิจกรรมนี้
              </button>
              <button type="submit" disabled={isLoading} className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-300">
                {isLoading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}