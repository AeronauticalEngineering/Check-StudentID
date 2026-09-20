'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import Link from 'next/link';

export default function SelectEvaluationPage() {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const q = query(collection(db, 'activities'), orderBy('activityDate', 'desc'));
        const activitiesSnapshot = await getDocs(q);
        const activitiesList = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActivities(activitiesList);
      } catch (error) {
        console.error("Error fetching activities:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const filteredActivities = activities.filter(activity =>
    activity.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs font-medium">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        กำลังโหลดรายการกิจกรรม...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto font-sans">
      {/* Top Toolbar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-bold text-slate-900">ผลการประเมินกิจกรรม (Evaluation Reports)</h1>
          <p className="text-xs text-slate-500">เลือกกิจกรรมเพื่อดูรายงานสรุปผลการประเมินความพึงพอใจและข้อเสนอแนะ</p>
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="ค้นหากิจกรรม หรือสถานที่..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-6 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 outline-none focus:border-slate-400 placeholder:text-slate-400"
          />
          <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-700 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredActivities.map(activity => {
          const activityDate = activity.activityDate?.toDate ? activity.activityDate.toDate() : (activity.activityDate ? new Date(activity.activityDate) : null);
          const isPast = activityDate && activityDate < new Date();

          return (
            <div
              key={activity.id}
              className="bg-white p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                    activity.enableEvaluation
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {activity.enableEvaluation ? '● เปิดรับการประเมิน' : '○ ปิดการประเมิน'}
                  </span>
                  {isPast && (
                    <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                      จบกิจกรรมแล้ว
                    </span>
                  )}
                </div>

                <h2 className="text-xs font-bold text-slate-900 line-clamp-2" title={activity.name}>
                  {activity.name}
                </h2>

                <div className="space-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span>📅</span>
                    <span>
                      {activityDate ? activityDate.toLocaleDateString('th-TH', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      }) : 'ไม่ระบุวันที่'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate" title={activity.location}>
                    <span>📍</span>
                    <span className="truncate">{activity.location || 'ไม่ระบุสถานที่'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  ประเภท: {activity.type === 'exam' ? 'สอบข้อเขียน' : 'หอประชุม/กิจกรรม'}
                </span>
                <Link
                  href={`/admin/evaluation/${activity.id}`}
                  className="px-4 py-2 bg-[#166E7C] hover:bg-[#0F5661] text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <span>ดูผลประเมิน</span>
                  <span>→</span>
                </Link>

              </div>
            </div>
          );
        })}
      </div>

      {filteredActivities.length === 0 && (
        <div className="bg-white p-12 rounded-lg border border-slate-200 text-center space-y-2">
          <div className="text-2xl">📋</div>
          <h3 className="text-xs font-semibold text-slate-800">ไม่พบกิจกรรมที่ค้นหา</h3>
          <p className="text-xs text-slate-400">กรุณาลองเปลี่ยนคำค้นหาใหม่อีกครั้ง</p>
        </div>
      )}
    </div>
  );
}