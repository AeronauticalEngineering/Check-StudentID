'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, getDocs, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminRegisterStudentPage() {
  // States for form dropdowns and inputs
  const [activities, setActivities] = useState([]);
  const [courses, setCourses] = useState({});
  const [selectedActivity, setSelectedActivity] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [nationalId, setNationalId] = useState('');

  // States for UI control
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [generatedLink, setGeneratedLink] = useState(''); 

  // Fetch activities and courses for the dropdown menu
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activitiesSnapshot, coursesSnapshot] = await Promise.all([
          getDocs(collection(db, 'activities')),
          getDocs(collection(db, 'courses'))
        ]);
        
        const coursesMap = {};
        coursesSnapshot.forEach(doc => {
          coursesMap[doc.id] = doc.data().name;
        });
        setCourses(coursesMap);

        const activitiesList = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActivities(activitiesList);
      } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
        setMessage({type: 'error', text: 'ไม่สามารถโหลดข้อมูลเริ่มต้นได้'});
      }
    };
    fetchData();
  }, []);
  
  // Reset form to register another student
  const handleRegisterNext = () => {
      setGeneratedLink('');
      setMessage('');
      setFullName('');
      setStudentId('');
      setNationalId('');
  }

  // Handle the form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedActivity) {
      setMessage({ type: 'error', text: 'กรุณาเลือกกิจกรรม' });
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    setGeneratedLink('');

    try {
      // Check for duplicate registration before creating a new one
      const registrationsRef = collection(db, 'registrations');
      const q = query(registrationsRef, 
        where("activityId", "==", selectedActivity),
        where("nationalId", "==", nationalId.trim())
      );
      const existingRegistration = await getDocs(q);

      if (!existingRegistration.empty) {
        throw new Error('นักเรียนคนนี้ได้ลงทะเบียนกิจกรรมนี้แล้ว');
      }

      // Prepare the data object for Firestore
      const registrationData = {
        fullName: fullName.trim(),
        studentId: studentId.trim() || null, // Allow empty studentId
        nationalId: nationalId.trim(),
        activityId: selectedActivity,
        courseId: activities.find(act => act.id === selectedActivity)?.courseId || null,
        status: 'registered',
        seatNumber: null,
        registeredAt: serverTimestamp(),
        registeredBy: 'admin',
        lineUserId: null // Explicitly set lineUserId to null for later linking
      };
      
      const docRef = await addDoc(registrationsRef, registrationData);

      // Create the unique linking URL and QR code
      const link = `${window.location.origin}/student/link?token=${docRef.id}`;
      setGeneratedLink(link);
      
      setMessage({ type: 'success', text: `ลงทะเบียนให้ ${fullName} สำเร็จ! ให้นักเรียนสแกน QR Code ด้านล่างเพื่อเชื่อมต่อบัญชี LINE` });

    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-8 font-sans">
      <main className="max-w-2xl mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">ลงทะเบียนนักเรียน (โดย Admin)</h1>
          
          {message && (
            <div className={`p-4 mb-4 rounded-md text-center ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message.text}
            </div>
          )}
          
          {/* If a link has been generated, show the QR code result */}
          {generatedLink ? (
            <div className="text-center animate-fade-in">
                <div className="p-4 bg-white border inline-block rounded-lg shadow">
                    <QRCodeSVG value={generatedLink} size={256} />
                </div>
                <p className="mt-4 text-sm text-gray-500 break-all">หรือส่งลิงก์นี้: {generatedLink}</p>
                <button onClick={handleRegisterNext} className="mt-6 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    ลงทะเบียนคนถัดไป
                </button>
            </div>
          ) : (
             // Otherwise, show the registration form
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="activity" className="block text-sm font-medium text-gray-700">1. เลือกกิจกรรม</label>
                <select id="activity" value={selectedActivity} onChange={(e) => setSelectedActivity(e.target.value)} required className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm">
                  <option value="">-- กรุณาเลือกกิจกรรม --</option>
                  {activities.map(act => (
                    <option key={act.id} value={act.id}>
                      {courses[act.courseId] || 'ไม่มีหลักสูตร'} - {act.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="border-t pt-6 space-y-4">
                 <h2 className="text-xl font-semibold text-gray-700">2. กรอกข้อมูลนักเรียน</h2>
                <input type="text" placeholder="ชื่อ-สกุล" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-md"/>
                <input type="text" placeholder="รหัสนักศึกษา (ไม่บังคับ)" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md"/>
                <input type="tel" placeholder="เลขบัตรประชาชน (13 หลัก)" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required pattern="\d{13}" className="w-full p-3 border border-gray-300 rounded-md"/>
                
                <button type="submit" disabled={isLoading} className="w-full py-3 px-4 bg-purple-600 text-white font-bold rounded-md hover:bg-purple-700 disabled:bg-purple-300 transition-colors">
                  {isLoading ? 'กำลังบันทึก...' : 'ลงทะเบียนและรับลิงก์'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}