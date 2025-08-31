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
      };
      const activityDocRef = doc(db, 'activities', activityId);
      await updateDoc(activityDocRef, updatedData);
      setMessage("✅ อัปเดตข้อมูลกิจกรรมสำเร็จ!");
    } catch (error) {
      console.error("Error updating document:", error);
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
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
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
              <select id="category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md">
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
             <div>
              <label htmlFor="activityType" className="block text-sm font-medium text-gray-700 mb-1">ประเภทกิจกรรม</label>
              <select id="activityType" value={activityType} onChange={(e) => setActivityType(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md">
                <option value="event">ปกติ</option>
                <option value="queue">เรียกคิว</option>
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