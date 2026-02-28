'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import useLiff from '../../../hooks/useLiff';
import { QRCodeSVG } from 'qrcode.react';
import ProfileSetupForm from '../../../components/student/ProfileSetupForm';
import Link from 'next/link';

// --- (Helper Components remain the same) ---
const QRModal = ({ registrationId, onClose }) => (
  <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50" onClick={onClose}>
    <div className="bg-white p-6 rounded-lg text-center" onClick={e => e.stopPropagation()}>
      <h3 className="font-bold mb-4">แสดง QR Code นี้กับเจ้าหน้าที่</h3>
      <QRCodeSVG value={registrationId} size={256} />
      <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-300 rounded-lg">ปิด</button>
    </div>
  </div>
);
const CheckmarkIcon = ({ className }) => (
  <svg className={`w-5 h-5 ${className}`} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
);
const TicketIcon = () => (
  <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
      d="M5 10V8a2 2 0 012-2h10a2 2 0 012 2v2M5 10h14M5 10v8a1 1 0 001 1h1m0 0v2m0-2h10m0 0v2m0-2h1a1 1 0 001-1v-8" />
  </svg>
);
const RegistrationCard = ({ reg, activities, courses, onShowQr, hasEvaluated }) => {
  const activity = activities[reg.activityId];
  const course = activity ? courses[activity.categoryId] : null; // ✅ Use categoryId
  if (!activity) return null;
  const activityDate = activity.activityDate?.toDate();
  const getStatusDisplay = () => {
    switch (reg.status) {
      case 'checked-in': return <><CheckmarkIcon className="text-green-600" /> <span className="text-green-600">เช็คอินแล้ว</span></>;
      case 'interviewing': return <><CheckmarkIcon className="text-purple-600" /> <span className="text-purple-600">เข้าสอบสัมภาษณ์</span></>;
      case 'completed': return <><CheckmarkIcon className="text-blue-600" /> <span className="text-blue-600">จบกิจกรรมแล้ว</span></>;
      default: return <><CheckmarkIcon className="text-yellow-600" /> <span className="text-yellow-600">ลงทะเบียนแล้ว</span></>;
    }
  }
  return (
    <div className="bg-white rounded-xl shadow-lg flex flex-col overflow-hidden">
      <div className="w-full bg-primary text-white flex flex-col justify-center items-center py-4 px-6 text-center shadow-inner">
        {activity.type === 'queue' ? (
          reg.displayQueueNumber ? ( // ✅ Check for displayQueueNumber first
            <><span className="text-xs opacity-75">คิวของคุณ</span><span className="text-4xl font-bold tracking-wider">{reg.displayQueueNumber}</span></>
          ) : (
            <>
              <span className="text-xs opacity-75">เวลาที่ลงทะเบียน</span>
              <span className="text-2xl font-bold tracking-wider my-1">{reg.timeSlot || '-'}</span>
              <span className="text-xs font-semibold">รอรับคิวเมื่อเช็คอิน</span>
            </>
          )
        ) : reg.seatNumber ? (
          <Link href={`/student/activity/${reg.activityId}/chart?seat=${reg.seatNumber}`} className="flex flex-col items-center hover:opacity-80 transition-opacity group">
            <span className="text-xs opacity-75">เลขที่นั่งของคุณ</span>
            <span className="text-4xl font-bold tracking-wider underline decoration-dotted decoration-2 underline-offset-4 group-hover:text-white">{reg.seatNumber}</span>
            <span className="text-[12px] mt-4 bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              กดเพื่อดูผัง
            </span>
          </Link>
        ) : (
          <><TicketIcon /><span className="text-xs font-semibold mt-2">ยังไม่ได้รับ</span></>
        )}
      </div>
      <div className="flex flex-col flex-grow min-w-0">
        <div className="p-4 flex-grow relative">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 text-sm font-semibold">{getStatusDisplay()}</div>
            <div className="flex flex-col items-end gap-2">
              {((reg.status === 'registered') ||
                ((reg.status === 'checked-in' || reg.status === 'interviewing') &&
                  (!(activity.enableEvaluation === true || activity.enableEvaluation === undefined) || hasEvaluated))) && (
                  <button
                    onClick={() => onShowQr(reg.id)}
                    className="px-3 py-1.5 bg-gray-800 text-white text-[12px] font-bold rounded-full hover:bg-gray-900 transition-all active:scale-95 whitespace-nowrap"
                  >
                    {reg.status === 'registered' ? 'QR เช็คอิน' : 'QR จบกิจกรรม'}
                  </button>
                )}
              {(reg.status === 'completed' || reg.status === 'interviewing' || reg.status === 'checked-in') && !hasEvaluated && (activity.enableEvaluation === true || activity.enableEvaluation === undefined) && (
                <Link
                  href={`/student/evaluation/${reg.activityId}`}
                  className="px-3 py-1.5 bg-yellow-500 text-white text-[12px] font-bold rounded-full hover:bg-yellow-600 transition-all active:scale-95 whitespace-nowrap"
                >
                  ประเมินกิจกรรม
                </Link>
              )}
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mt-2 line-clamp-2">{activity.name}</h2>
          <p className="text-sm text-gray-500 truncate">{course?.name || reg.course || 'ทั่วไป'}</p>
        </div>
      </div>
    </div>
  );
};

export default function MyRegistrationsPage() {
  const { liffProfile, studentDbProfile, isLoading, error, setStudentDbProfile } = useLiff();

  const [registrations, setRegistrations] = useState([]);
  const [activities, setActivities] = useState({});
  const [courses, setCourses] = useState({});
  const [evaluatedActivities, setEvaluatedActivities] = useState(new Set());
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [visibleQrCodeId, setVisibleQrCodeId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [activitiesSnap, coursesSnap] = await Promise.all([
          getDocs(collection(db, 'activities')),
          getDocs(collection(db, 'courses'))
        ]);

        const actMap = {};
        activitiesSnap.forEach(doc => { actMap[doc.id] = doc.data(); });
        setActivities(actMap);

        const courseMap = {};
        coursesSnap.forEach(doc => { courseMap[doc.id] = doc.data(); });
        setCourses(courseMap);
      } catch (err) {
        console.error("Error fetching base data:", err);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (isLoading || isLoadingData || !liffProfile?.userId) return;

    const unsubEvaluations = onSnapshot(
      query(collection(db, 'evaluations'), where('userId', '==', liffProfile.userId)),
      (snapshot) => {
        const evaluated = new Set(snapshot.docs.map(doc => doc.data().activityId));
        setEvaluatedActivities(evaluated);
      }
    );

    return () => unsubEvaluations();
  }, [liffProfile, isLoading, isLoadingData]);

  useEffect(() => {
    if (isLoading || isLoadingData || (!liffProfile && !studentDbProfile)) {
      return;
    }

    // Auto-sync unlinked registrations in the background
    const syncUnlinkedRegistrations = async () => {
      if (studentDbProfile && studentDbProfile.nationalId && liffProfile && liffProfile.userId) {
        try {
          const q = query(
            collection(db, 'registrations'),
            where('nationalId', '==', studentDbProfile.nationalId)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const batch = writeBatch(db);
            let updateCount = 0;
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data.lineUserId !== liffProfile.userId) {
                batch.update(doc.ref, { lineUserId: liffProfile.userId });
                updateCount++;
              }
            });
            if (updateCount > 0) {
              await batch.commit();
              console.log(`Auto-synced ${updateCount} registrations.`);
            }
          }
        } catch (error) {
          console.error("Error syncing registrations:", error);
        }
      }
    };
    syncUnlinkedRegistrations();

    const registrationsRef = collection(db, 'registrations');
    let unsubscribe = () => { };

    const q = query(registrationsRef);

    unsubscribe = onSnapshot(q, (snapshot) => {
      const allUserRegistrations = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const matchesLineId = liffProfile?.userId && data.lineUserId === liffProfile.userId;
        const matchesNationalId = studentDbProfile?.nationalId && String(data.nationalId || '').trim() === String(studentDbProfile.nationalId || '').trim();

        if (matchesLineId || matchesNationalId) {
          allUserRegistrations.push({ id: doc.id, ...data });
        }
      });

      const uniqueRegistrations = new Map();
      allUserRegistrations.forEach(reg => uniqueRegistrations.set(reg.id, reg));

      setRegistrations(Array.from(uniqueRegistrations.values()));
    });

    return () => unsubscribe();

  }, [studentDbProfile, liffProfile, isLoading, isLoadingData]);
  if (isLoading || isLoadingData) return <div className="text-center p-10 font-sans">กำลังโหลดข้อมูล...</div>;
  if (error) return <div className="p-4 text-center text-red-500 bg-red-100 font-sans">{error}</div>;

  if (studentDbProfile === null) {
    return (
      <ProfileSetupForm liffProfile={liffProfile} onProfileCreated={setStudentDbProfile} />
    );
  }

  const now = new Date();

  const sortedRegistrations = [...registrations].sort((a, b) => {
    const actA = activities[a.activityId];
    const actB = activities[b.activityId];
    const timeA = actA?.activityDate?.seconds || 0;
    const timeB = actB?.activityDate?.seconds || 0;
    return timeB - timeA;
  });

  const upcomingRegistrations = sortedRegistrations.filter(reg => {
    const activity = activities[reg.activityId];
    if (!activity) return false;
    // Keep completed but unevaluated activities in the upcoming list
    if (reg.status === 'completed' && !evaluatedActivities.has(reg.activityId) && (activity.enableEvaluation === true || activity.enableEvaluation === undefined)) {
      return true;
    }
    if (!activity.activityDate?.toDate) return false;

    // ตั้งเวลาให้หมดในตอนสิ้นสุดของวัน (23:59:59.999)
    const dt = activity.activityDate.toDate();
    const endOfDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);

    return endOfDay >= now && reg.status !== 'completed';
  });

  const pastRegistrations = sortedRegistrations.filter(reg => {
    const activity = activities[reg.activityId];
    if (!activity) return true;
    // Only move to history if it's evaluated
    if (reg.status === 'completed' && !evaluatedActivities.has(reg.activityId) && (activity.enableEvaluation === true || activity.enableEvaluation === undefined)) {
      return false;
    }
    if (!activity.activityDate?.toDate) return true;

    // ตั้งเวลาให้หมดในตอนสิ้นสุดของวัน (23:59:59.999)
    const dt = activity.activityDate.toDate();
    const endOfDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);

    return endOfDay < now || (reg.status === 'completed' && (evaluatedActivities.has(reg.activityId) || activity.enableEvaluation === false));
  });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {visibleQrCodeId && <QRModal registrationId={visibleQrCodeId} onClose={() => setVisibleQrCodeId(null)} />}

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">กิจกรรมที่กำลังจะมาถึง</h2>
        {upcomingRegistrations.length > 0 ? (
          <div className="space-y-6">
            {upcomingRegistrations.map(reg => (
              <RegistrationCard key={reg.id} reg={reg} activities={activities} courses={courses} onShowQr={setVisibleQrCodeId} hasEvaluated={evaluatedActivities.has(reg.activityId)} />
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
                    <RegistrationCard key={reg.id} reg={reg} activities={activities} courses={courses} onShowQr={setVisibleQrCodeId} hasEvaluated={evaluatedActivities.has(reg.activityId)} />
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
    </div>
  );

}
