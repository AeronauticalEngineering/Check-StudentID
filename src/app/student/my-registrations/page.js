'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import useLiff from '../../../hooks/useLiff';
import { QRCodeSVG } from 'qrcode.react';
import ProfileSetupForm from '../../../components/student/ProfileSetupForm'; // 👈 1. Import ฟอร์มเข้ามา

// --- Helper Components (defined at the top level for stability) ---

const QRModal = ({ registrationId, onClose }) => (
  <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50" onClick={onClose}>
    <div className="bg-white p-6 rounded-lg text-center" onClick={e => e.stopPropagation()}>
      <h3 className="font-bold mb-4">QR Code สำหรับเช็คอิน</h3>
      <QRCodeSVG value={registrationId} size={256} />
      <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-300 rounded-lg">ปิด</button>
    </div>
  </div>
);

const CheckmarkIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
);



const TicketIcon = () => (
  <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    {/* เก้าอี้ */}
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" 
          d="M5 10V8a2 2 0 012-2h10a2 2 0 012 2v2M5 10h14M5 10v8a1 1 0 001 1h1m0 0v2m0-2h10m0 0v2m0-2h1a1 1 0 001-1v-8" />
  </svg>
);


const RegistrationCard = ({ reg, activities, courses, onShowQr }) => {
  const activity = activities[reg.activityId];
  const course = activity ? courses[activity.courseId] : null;
  if (!activity) return null;
  const activityDate = activity.activityDate.toDate();
  return (
    <div className="bg-white rounded-xl shadow-lg flex overflow-hidden">
      <div className="flex-none w-32 bg-primary text-white flex flex-col justify-center items-center p-4 text-center">
        {reg.seatNumber ? (
          <>
            <span className="text-xs opacity-75">เลขที่นั่งของคุณ</span>
            <span className="text-4xl font-bold tracking-wider">{reg.seatNumber}</span>
          </>
        ) : (
          <>
            <TicketIcon />
            <span className="text-xs font-semibold mt-2">ยังไม่ได้รับ</span>
          </>
        )}
      </div>
      <div className="flex flex-col flex-grow">
        <div className="p-4 flex-grow">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 text-sm text-green-600 font-semibold">
              <CheckmarkIcon />
              {reg.status === 'checked-in' ? 'เช็คอินแล้ว' : 'ยืนยันการเข้าร่วม'}
            </div>
            {reg.status !== 'checked-in' && (
              <button onClick={() => onShowQr(reg.id)} className="px-3 py-1 bg-gray-800 text-white text-xs font-bold rounded-full hover:bg-gray-600">
                QR Code
              </button>
            )}
          </div>
          <h2 className="text-lg font-bold text-gray-800 mt-2">{activity.name}</h2>
          <p className="text-sm text-gray-500">{course?.name || 'หลักสูตรทั่วไป'}</p>
        </div>
        <div className="bg-gray-100 p-2 text-center text-sm text-gray-600 border-t">
          {activityDate.toLocaleString('th-TH', { dateStyle: 'full', timeStyle: 'short' })} น.
        </div>
      </div>
    </div>
  );
};


// --- Main Page Component ---
export default function MyRegistrationsPage() {
  const { liffProfile, studentDbProfile, isLoading, error, setStudentDbProfile } = useLiff(); // 👈 2. ดึง setStudentDbProfile มาใช้
  
  const [registrations, setRegistrations] = useState([]);
  const [activities, setActivities] = useState({});
  const [courses, setCourses] = useState({});
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [visibleQrCodeId, setVisibleQrCodeId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Effect for fetching base data and listening for real-time registration updates
  useEffect(() => {
    if (!studentDbProfile || !liffProfile) {
      // Don't set loading to false here if studentDbProfile is null, 
      // because we might be showing the setup form.
      if (studentDbProfile === null) {
          setIsLoadingData(false);
      }
      return;
    }
    setIsLoadingData(true);
    
    const fetchBaseData = async () => {
      const [actSnapshot, courseSnapshot] = await Promise.all([
        getDocs(collection(db, 'activities')),
        getDocs(collection(db, 'courses'))
      ]);
      const actMap = {};
      actSnapshot.forEach(doc => { actMap[doc.id] = doc.data(); });
      setActivities(actMap);
      const courseMap = {};
      courseSnapshot.forEach(doc => { courseMap[doc.id] = doc.data(); });
      setCourses(courseMap);
    };
    
    fetchBaseData();

    const regQuery = query(collection(db, 'registrations'), where('lineUserId', '==', liffProfile.userId));
    const unsubscribe = onSnapshot(regQuery, (querySnapshot) => {
      setRegistrations(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingData(false);
    });

    return () => unsubscribe();
  }, [studentDbProfile, liffProfile]);

  // Effect to automatically close the QR modal when status updates
  useEffect(() => {
    if (!visibleQrCodeId) return;
    const currentReg = registrations.find(reg => reg.id === visibleQrCodeId);
    if (currentReg && currentReg.status === 'checked-in') {
      setVisibleQrCodeId(null);
    }
  }, [registrations, visibleQrCodeId]);

  // Effect for auto-syncing registrations created by an admin
  useEffect(() => {
    if (!studentDbProfile || !liffProfile) return;

    const syncAdminRegistrations = async () => {
        try {
            // Check only if the profile is not yet linked (`studentDbProfile` exists but might be from form setup)
            const nationalId = studentDbProfile.nationalId;
            if (!nationalId) return; // Cannot sync without nationalId

            const unlinkedRegQuery = query(
                collection(db, 'registrations'),
                where("nationalId", "==", nationalId),
                where("lineUserId", "==", null)
            );
            const snapshot = await getDocs(unlinkedRegQuery);
            if (!snapshot.empty) {
                const batch = writeBatch(db);
                snapshot.forEach(doc => {
                    batch.update(doc.ref, { lineUserId: liffProfile.userId });
                });
                await batch.commit();
                console.log(`Auto-synced ${snapshot.size} admin-created registrations.`);
            }
        } catch (err) {
            console.error("Auto-sync failed:", err);
        }
    };
    syncAdminRegistrations();
  }, [studentDbProfile, liffProfile]);

  
  if (isLoading) return <div className="text-center p-10 font-sans">กำลังโหลดข้อมูลผู้ใช้...</div>;
  if (error) return <div className="p-4 text-center text-red-500 bg-red-100 font-sans">{error}</div>;

  // 👇 3. เปลี่ยน Logic ตรงนี้: ถ้า studentDbProfile เป็น null ให้แสดงฟอร์มสร้างโปรไฟล์
  if (studentDbProfile === null) {
    return (
      <ProfileSetupForm 
        liffProfile={liffProfile}
        onProfileCreated={(newProfile) => {
            // เมื่อสร้างโปรไฟล์สำเร็จ ให้อัปเดต state ใน useLiff hook
            setStudentDbProfile(newProfile); 
        }}
      />
    );
  }
  
  // Filtering logic for upcoming and past events
  const now = new Date();
  const readyToFilter = Object.keys(activities).length > 0;
  const sortedRegistrations = readyToFilter ? [...registrations].sort((a, b) => {
    const actA = activities[a.activityId];
    const actB = activities[b.activityId];
    if (!actA || !actB) return 0;
    return actB.activityDate.seconds - actA.activityDate.seconds;
  }) : [];
  const upcomingRegistrations = readyToFilter ? sortedRegistrations.filter(reg => {
    const activity = activities[reg.activityId];
    if (!activity) return false;
    const activityEndDate = new Date(activity.activityDate.toDate().getTime() + 3 * 60 * 60 * 1000);
    return activityEndDate >= now;
  }) : [];
  const pastRegistrations = readyToFilter ? sortedRegistrations.filter(reg => {
    const activity = activities[reg.activityId];
    if (!activity) return false; 
    const activityEndDate = new Date(activity.activityDate.toDate().getTime() + 3 * 60 * 60 * 1000);
    return activityEndDate < now;
  }) : [];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {visibleQrCodeId && <QRModal registrationId={visibleQrCodeId} onClose={() => setVisibleQrCodeId(null)} />}
      
      {isLoadingData ? (
        <p className="text-center text-gray-500">กำลังโหลดรายการลงทะเบียน...</p>
      ) : (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">กิจกรรมที่กำลังจะมาถึง</h2>
          {upcomingRegistrations.length > 0 ? (
            <div className="space-y-6">
              {upcomingRegistrations.map(reg => (
                <RegistrationCard key={reg.id} reg={reg} activities={activities} courses={courses} onShowQr={setVisibleQrCodeId} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 px-4 bg-white rounded-lg shadow-md">
              <p className="text-gray-500">คุณยังไม่มีกิจกรรมที่กำลังจะมาถึง</p>
            </div>
          )}

          <div className="mt-10 text-center">
            <button onClick={() => setShowHistory(!showHistory)} className="px-4 py-2 text-sm text-blue-600 font-semibold rounded-lg hover:bg-blue-100">
              {showHistory ? '▲ ซ่อนประวัติ' : '▼ ดูประวัติกิจกรรมที่ผ่านมา'}
            </button>
          </div>

          {showHistory && (
            <div className="mt-6 animate-fade-in">
              <h2 className="text-xl font-bold text-gray-800 mb-4">ประวัติ</h2>
              {pastRegistrations.length > 0 ? (
                <div className="space-y-6">
                  {pastRegistrations.map(reg => (
                    <div key={reg.id} className="opacity-75">
                      <RegistrationCard reg={reg} activities={activities} courses={courses} onShowQr={setVisibleQrCodeId} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 px-4 bg-white rounded-lg shadow-md">
                  <p className="text-gray-500">ยังไม่มีประวัติกิจกรรมที่ผ่านมา</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}