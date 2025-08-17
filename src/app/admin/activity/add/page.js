'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, getDocs, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';

export default function AddActivityPage() {
  // --- State ทั้งหมดเหมือนเดิม ไม่มีการเปลี่ยนแปลงในส่วน Logic ---
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [activityName, setActivityName] = useState('');
  const [capacity, setCapacity] = useState(50);
  const [activityDate, setActivityDate] = useState('');
  const [activityTime, setActivityTime] = useState('');
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [isSavingCourse, setIsSavingCourse] = useState(false);

  // --- Logic ทั้งหมดเหมือนเดิม ---
  const fetchCourses = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'courses'));
      const coursesData = querySnapshot.docs.map(doc => ({
        id: doc.id, ...doc.data()
      }));
      setCourses(coursesData);
      if (!selectedCourse && coursesData.length > 0) {
        setSelectedCourse(coursesData[0].id);
      }
    } catch (error) {
      console.error("Error fetching courses: ", error);
      setMessage("เกิดข้อผิดพลาดในการดึงข้อมูลหลักสูตร");
    }
  }, [selectedCourse]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleSaveCourse = async () => {
    if (!newCourseName.trim()) {
      alert("กรุณาใส่ชื่อหลักสูตร"); return;
    }
    setIsSavingCourse(true);
    try {
      const docRef = await addDoc(collection(db, 'courses'), {
        name: newCourseName, createdAt: serverTimestamp()
      });
      await fetchCourses();
      setSelectedCourse(docRef.id);
      setIsModalOpen(false);
      setNewCourseName('');
      setMessage("✅ เพิ่มหลักสูตรใหม่สำเร็จ!");
    } catch (error) {
      console.error("Error adding course: ", error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSavingCourse(false);
    }
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
        courseId: selectedCourse,
        name: activityName,
        capacity: Number(capacity),
        location: location,
        activityDate: firestoreTimestamp,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'activities'), newActivity);
      setMessage("✅ สร้างกิจกรรมสำเร็จ!");
      // Clear form
      setActivityName(''); setCapacity(50); setActivityDate(''); setActivityTime(''); setLocation('');
    } catch (error) {
      console.error("Error adding activity: ", error);
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };


  // --- ส่วน JSX ที่แปลงเป็น Tailwind CSS ---
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Modal สำหรับเพิ่มหลักสูตรใหม่ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">เพิ่มหลักสูตรใหม่</h2>
            <input
              type="text"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              placeholder="ชื่อหลักสูตร..."
              className="w-full p-2 border border-gray-300 rounded-md mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} disabled={isSavingCourse} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">
                ยกเลิก
              </button>
              <button onClick={handleSaveCourse} disabled={isSavingCourse} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">
                {isSavingCourse ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">สร้างกิจกรรมใหม่</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="course" className="block text-sm font-medium text-gray-700 mb-1">หลักสูตร</label>
              <div className="flex items-center gap-2">
                <select id="course" value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                  {courses.length === 0 
                    ? <option>ไม่มีหลักสูตร</option> 
                    : courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)
                  }
                </select>
                <button type="button" onClick={() => setIsModalOpen(true)} className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-lg font-bold">+</button>
              </div>
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