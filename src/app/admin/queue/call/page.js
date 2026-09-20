'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';

export default function SelectQueueActivityPage() {
  const [queueActivities, setQueueActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQueueActivities = async () => {
      try {
        const activitiesRef = collection(db, 'activities');
        const q = query(activitiesRef, where('type', '==', 'queue'));
        const querySnapshot = await getDocs(q);
        const activities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const now = new Date();
        const ongoingActivities = activities.filter(activity => {
          if (!activity.activityDate?.toDate) return true;
          const dt = activity.activityDate.toDate();
          const endOfDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);
          return endOfDay >= now;
        });

        setQueueActivities(ongoingActivities);
      } catch (error) {
        console.error("Error fetching queue activities:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQueueActivities();
  }, []);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm font-normal">
        <div className="w-8 h-8 border-2 border-[#000946] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        กำลังโหลดรายการกิจกรรมประเภทคิว...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto font-sans">
      {/* Top Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-base font-bold text-slate-900">ระบบเรียกคิว (Queue Calling System)</h1>
          <p className="text-sm font-normal text-slate-500">เลือกกิจกรรมประเภทคิวเพื่อจัดการช่องบริการ เรียกคิวนักเรียน และแสดงผลจอประชาสัมพันธ์</p>
        </div>
      </div>

      {/* Activities Grid */}
      {queueActivities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {queueActivities.map(activity => {
            const actDate = activity.activityDate?.toDate ? activity.activityDate.toDate() : (activity.activityDate ? new Date(activity.activityDate) : null);
            return (
              <div
                key={activity.id}
                className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-sm transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex px-2.5 py-0.5 rounded-md text-sm font-normal bg-blue-50 text-blue-700 border border-blue-200">
                      ระบบเรียกคิว
                    </span>
                    {actDate && (
                      <span className="text-sm font-normal text-slate-500">
                        {actDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-slate-900 line-clamp-2" title={activity.name}>
                    {activity.name}
                  </h2>
                  <div className="text-sm font-normal text-slate-500 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{activity.location || 'ไม่ระบุสถานที่'}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                  <Link
                    href={`/admin/queue/call/${activity.id}`}
                    className="px-4 py-2 bg-[#000946] hover:bg-[#000c5a] text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>เข้าสู่หน้าเรียกคิว</span>
                    <span>→</span>
                  </Link>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center space-y-2">
          <svg className="w-12 h-12 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-800">ไม่พบกิจกรรมประเภทเรียกคิวในขณะนี้</h3>
          <p className="text-sm font-normal text-slate-400">สร้างกิจกรรมใหม่และเลือกประเภทเป็น &quot;ระบบคิว (Queue)&quot; เพื่อเริ่มใช้งาน</p>
        </div>
      )}
    </div>
  );
}