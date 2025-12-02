'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import useLiff from '../../../hooks/useLiff';

// Helper component for the person icon
const UsersIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const getActivityTypeLabel = (type) => {
  switch (type) {
    case 'exam': return 'สอบข้อเขียน';
    case 'interview': return 'สอบสัมภาษณ์';
    case 'graduation': return 'งานรับปริญญา';
    case 'queue': return 'จองคิว';
    case 'event': return 'กิจกรรม';
    default: return type || 'กิจกรรม';
  }
};

export default function ActivitiesListPage() {
  const { liffProfile, studentDbProfile } = useLiff();
  const [activities, setActivities] = useState([]);
  const [courses, setCourses] = useState({});
  const [registrationsCount, setRegistrationsCount] = useState({});
  const [userRegistrations, setUserRegistrations] = useState(new Set()); // เก็บ ID ของกิจกรรมที่ผู้ใช้ลงทะเบียนแล้ว
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // This effect runs only on the client after the component mounts
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Only fetch data on the client side
    if (!isMounted || !liffProfile?.userId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [coursesSnapshot, activitiesSnapshot, registrationsSnapshot] = await Promise.all([
          getDocs(collection(db, 'courses')),
          getDocs(query(collection(db, 'activities'), where("activityDate", ">=", Timestamp.now()))),
          getDocs(collection(db, 'registrations'))
        ]);
        
        const coursesMap = {};
        coursesSnapshot.forEach(doc => { coursesMap[doc.id] = doc.data().name; });
        setCourses(coursesMap);

        const counts = {};
        const userActivityIds = new Set();
        
        registrationsSnapshot.forEach(doc => {
          const registration = doc.data();
          const activityId = registration.activityId;
          
          // นับจำนวนการลงทะเบียนทั้งหมด
          counts[activityId] = (counts[activityId] || 0) + 1;
          
          // ตรวจสอบว่าผู้ใช้คนนี้ลงทะเบียนกิจกรรมนี้หรือไม่
          if (registration.lineUserId === liffProfile.userId || 
              (studentDbProfile?.nationalId && registration.nationalId === studentDbProfile.nationalId)) {
            userActivityIds.add(activityId);
          }
        });
        
        setRegistrationsCount(counts);
        setUserRegistrations(userActivityIds);

        const activitiesList = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActivities(activitiesList);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isMounted, liffProfile?.userId, studentDbProfile?.nationalId]);

  // Don't render anything until mounted on the client
  if (!isMounted) {
    return null; 
  }

  if (isLoading) {
    return <div className="text-center p-10 font-sans">กำลังโหลดรายการกิจกรรม...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {activities.length === 0 ? (
        <div className="text-center py-10 px-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-700">ไม่มีกิจกรรม</h2>
            <p className="text-gray-500 mt-2">ยังไม่มีกิจกรรมที่เปิดรับสมัครในขณะนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.map(activity => {
            const activityDate = activity.activityDate.toDate();
            const count = registrationsCount[activity.id] || 0;
            const isFull = count >= activity.capacity;
            const isAlmostFull = !isFull && count / activity.capacity >= 0.9;
            const isRegistered = userRegistrations.has(activity.id);

            return (
              <div key={activity.id} className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col transition-transform hover:scale-105">
                <div className="p-6 flex-grow">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-semibold text-indigo-600">{courses[activity.courseId] || 'หลักสูตรทั่วไป'}</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                      {getActivityTypeLabel(activity.type)}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{activity.name}</h2>
                  <p className="text-gray-600 text-sm mb-1">
                    <strong>วันที่:</strong> {activityDate.toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })} น.
                  </p>
                  <p className="text-gray-600 text-sm mb-4">
                    <strong>สถานที่:</strong> {activity.location}
                  </p>
                  
                  <div className="mt-4">
                    <div className="flex justify-between items-end mb-1">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <UsersIcon />
                        <span>ที่นั่ง</span>
                      </div>
                      <div className="text-sm font-medium">
                        <span className={isFull ? 'text-red-600' : 'text-gray-900'}>{count}</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="text-gray-600">{activity.capacity}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFull ? 'bg-red-500' : 
                          isAlmostFull ? 'bg-amber-500' : 
                          'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, (count / activity.capacity) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-end mt-2 gap-2 min-h-[24px]">
                       {isFull && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">เต็มแล้ว</span>}
                       {isRegistered && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">เข้าร่วมแล้ว</span>}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 mt-auto">
                  {activity.type === 'queue' ? (
                    <div className="w-full text-center px-4 py-2 font-semibold rounded-lg bg-blue-100 text-blue-700 border border-blue-300">
                      กิจกรรมสำหรับผู้ถูกคัดเลือก
                    </div>
                  ) : isRegistered ? (
                    <div className="w-full text-center px-4 py-2 font-semibold rounded-lg bg-green-100 text-green-700 border border-green-300">
                      ✓ เข้าร่วมแล้ว
                    </div>
                  ) : (
                    <Link 
                      href={isFull ? '#' : `/student/register?activityId=${activity.id}`} 
                      className={`w-full text-center block px-4 py-2 font-semibold rounded-lg ${
                        isFull 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-primary text-white hover:bg-primary-hover'
                      }`}
                      aria-disabled={isFull}
                      onClick={(e) => isFull && e.preventDefault()}
                    >
                      {isFull ? 'เต็มแล้ว' : 'ลงทะเบียน'}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}