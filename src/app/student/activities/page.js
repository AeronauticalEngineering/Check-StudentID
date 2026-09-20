'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, where, Timestamp, getCountFromServer } from 'firebase/firestore';
import useLiff from '../../../hooks/useLiff';

// SVG Icon for Users
const UsersIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const AcademicCapIcon = () => (
  <svg className="w-5 h-5 text-[#000946]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
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
  const [categoriesMap, setCategoriesMap] = useState({});
  const [registrationsCount, setRegistrationsCount] = useState({});
  const [userRegistrations, setUserRegistrations] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !liffProfile?.userId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. ดึงข้อมูล Categories และ Activities
        const [categoriesSnap, activitiesSnapshot] = await Promise.all([
          getDocs(collection(db, 'categories')),
          getDocs(query(collection(db, 'activities'), where("activityDate", ">=", Timestamp.now()))),
        ]);

        const catMap = {};
        categoriesSnap.forEach(doc => { catMap[doc.id] = doc.data().name; });
        setCategoriesMap(catMap);

        const activitiesList = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. ดึงเฉพาะการลงทะเบียนของ "ผู้ใช้คนนี้"
        const identifierField = studentDbProfile?.nationalId ? 'nationalId' : 'lineUserId';
        const identifierValue = studentDbProfile?.nationalId || liffProfile.userId;

        const userRegQuery = query(
          collection(db, 'registrations'),
          where(identifierField, "==", identifierValue)
        );
        const userRegSnapshot = await getDocs(userRegQuery);

        const userActivityIds = new Set();
        userRegSnapshot.forEach(doc => {
          userActivityIds.add(doc.data().activityId);
        });
        setUserRegistrations(userActivityIds);

        // 3. นับจำนวนผู้ลงทะเบียนแต่ละกิจกรรม
        const counts = {};
        await Promise.all(activitiesList.map(async (act) => {
          try {
            const countQuery = query(collection(db, 'registrations'), where('activityId', '==', act.id));
            const snapshot = await getCountFromServer(countQuery);
            counts[act.id] = snapshot.data().count;
          } catch (err) {
            console.error(`Error counting for ${act.id}`, err);
            counts[act.id] = 0;
          }
        }));

        setRegistrationsCount(counts);
        setActivities(activitiesList);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isMounted, liffProfile?.userId, studentDbProfile?.nationalId]);

  if (!isMounted) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 font-sans space-y-3">
        <svg className="w-8 h-8 text-[#000946] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <span className="text-sm font-normal text-slate-500">กำลังโหลดรายการกิจกรรม...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 font-sans space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#000946]">กิจกรรมที่เปิดรับสมัคร</h1>
          <p className="text-sm font-normal text-slate-500 mt-0.5">
            เลือกกิจกรรมที่ต้องการเข้าร่วมและลงทะเบียน
          </p>
        </div>
        <Link
          href="/student/my-registrations"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#000946] text-sm font-normal rounded-xl transition-colors shrink-0"
        >
          <span>การลงทะเบียนของฉัน</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <AcademicCapIcon />
          <h2 className="text-base font-bold text-slate-800">ไม่มีกิจกรรม</h2>
          <p className="text-sm font-normal text-slate-500">ยังไม่มีกิจกรรมที่เปิดรับสมัครในขณะนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activities.map(activity => {
            const activityDate = activity.activityDate?.toDate ? activity.activityDate.toDate() : new Date(activity.activityDate);
            const count = registrationsCount[activity.id] || 0;
            const isFull = count >= activity.capacity;
            const isAlmostFull = !isFull && count / activity.capacity >= 0.9;
            const isRegistered = userRegistrations.has(activity.id);
            const categoryName = categoriesMap[activity.categoryId] || 'กิจกรรมทั่วไป';

            return (
              <div
                key={activity.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="p-5 flex-grow space-y-3">
                  {/* Category & Badge */}
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg truncate max-w-[170px]">
                      {categoryName}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-blue-50 text-[#000946] border border-blue-100 shrink-0">
                      {getActivityTypeLabel(activity.type)}
                    </span>
                  </div>

                  {/* Activity Name */}
                  <h2 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">
                    {activity.name}
                  </h2>

                  {/* Date & Location */}
                  <div className="space-y-1.5 pt-1 text-sm font-normal text-slate-600">
                    <div className="flex items-center gap-2">
                      <CalendarIcon />
                      <span className="truncate">
                        {activityDate ? activityDate.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) + ' น.' : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <LocationIcon />
                      <span className="truncate">{activity.location || '-'}</span>
                    </div>
                  </div>

                  {/* Seats Progress Bar */}
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-1 text-sm font-normal">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <UsersIcon />
                        <span>จำนวนที่นั่ง</span>
                      </div>
                      <div className="text-slate-700">
                        <span className={`font-bold ${isFull ? 'text-red-600' : 'text-slate-900'}`}>{count}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span>{activity.capacity}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFull ? 'bg-red-500' : isAlmostFull ? 'bg-amber-500' : 'bg-[#000946]'
                        }`}
                        style={{ width: `${Math.min(100, (count / (activity.capacity || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer: Directly links to registration page */}
                <div className="bg-slate-50 p-4 border-t border-slate-100 mt-auto">
                  {isRegistered ? (
                    <Link
                      href="/student/my-registrations"
                      className="w-full text-center block px-4 py-2.5 font-normal rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors text-sm"
                    >
                      ✓ เข้าร่วมแล้ว (ดูบัตรคิว)
                    </Link>
                  ) : activity.isRegistrationOpen === false ? (
                    <div className="w-full text-center px-4 py-2.5 font-normal rounded-xl bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed text-sm">
                      เฉพาะผู้มีสิทธิ์ (ปิดรับสมัคร)
                    </div>
                  ) : isFull ? (
                    <div className="w-full text-center px-4 py-2.5 font-normal rounded-xl bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed text-sm">
                      ที่นั่งเต็มแล้ว
                    </div>
                  ) : (
                    <Link
                      href={`/student/register?activityId=${activity.id}`}
                      className="w-full text-center block px-4 py-2.5 font-normal rounded-xl bg-[#000946] hover:bg-[#00125e] text-white shadow-xs transition-all text-sm cursor-pointer active:scale-98"
                    >
                      {activity.type === 'queue' ? 'จองคิว / ลงทะเบียน' : 'ลงทะเบียน'}
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
