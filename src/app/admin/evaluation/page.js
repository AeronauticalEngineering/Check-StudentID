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
    activity.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans">
      <main className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ผลการประเมินกิจกรรม</h1>
            <p className="text-gray-500 mt-1">เลือกกิจกรรมเพื่อดูรายงานสรุปผลการประเมินและความคิดเห็น</p>
          </div>
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="ค้นหากิจกรรม..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredActivities.map(activity => {
            const activityDate = activity.activityDate?.toDate();
            const isPast = activityDate && activityDate < new Date();

            return (
              <Link key={activity.id} href={`/admin/evaluation/${activity.id}`}>
                <div className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-100 transition-all duration-300 h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-medium ${activity.enableEvaluation
                        ? 'bg-green-50 text-green-700 border border-green-100'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                      {activity.enableEvaluation ? 'เปิดรับการประเมิน' : 'ปิดการประเมิน'}
                    </div>
                    {isPast && (
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">จบแล้ว</span>
                    )}
                  </div>

                  <h2 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {activity.name}
                  </h2>

                  <div className="mt-auto space-y-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {activityDate ? activityDate.toLocaleDateString('th-TH', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      }) : 'ไม่ระบุวันที่'}
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {activity.location || 'ไม่ระบุสถานที่'}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-50 flex justify-end items-center text-blue-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                    ดูผลการประเมิน
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {filteredActivities.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">ไม่พบกิจกรรมที่ค้นหา</h3>
            <p className="text-gray-500">ลองค้นหาด้วยคำค้นอื่น</p>
          </div>
        )}
      </main>
    </div>
  );
}