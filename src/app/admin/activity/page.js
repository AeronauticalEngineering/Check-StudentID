'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { useModal } from '../../../context/ModalContext';


const translateStatus = (status) => {
  switch (status) {
    case 'checked-in': return 'เช็คอินแล้ว';
    case 'registered': return 'ลงทะเบียนแล้ว';
    case 'calling': return 'กำลังเรียก';
    case 'called': return 'เรียกคิวแล้ว';
    case 'interviewing':
    case 'serving': return 'สอบสัมภาษณ์';
    case 'completed': return 'สำเร็จแล้ว';
    case 'waitlisted': return 'รอคิว';
    case 'cancelled': return 'ยกเลิกแล้ว';
    case 'absent': return 'ไม่มารายงานตัว';
    case 'skipped': return 'ข้ามคิว';
    default: {
      if (!status) return 'ลงทะเบียนแล้ว';
      const lower = String(status).toLowerCase();
      if (lower.includes('call')) return 'กำลังเรียก';
      if (lower.includes('interview')) return 'สอบสัมภาษณ์';
      if (lower.includes('check')) return 'เช็คอินแล้ว';
      if (lower.includes('complete')) return 'สำเร็จแล้ว';
      if (lower.includes('cancel')) return 'ยกเลิกแล้ว';
      if (lower.includes('wait')) return 'รอคิว';
      return status;
    }
  }
};

const RegistrantsModal = ({ activity, registrants, onClose }) => {
  if (!activity) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl border border-slate-300 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden font-sans">
        <header className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-900">รายชื่อผู้ลงทะเบียน</h2>
            <p className="text-sm font-normal text-slate-500">{activity.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors text-sm font-normal"
          >
            ✕
          </button>
        </header>
        <div className="flex-grow overflow-y-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="px-3 py-2.5 border-r border-slate-200 w-12 text-center font-semibold">#</th>
                <th className="px-3 py-2.5 border-r border-slate-200 min-w-[160px] font-semibold">ชื่อ-สกุล</th>
                <th className="px-3 py-2.5 border-r border-slate-200 w-32 font-semibold">รหัสผู้สมัคร</th>
                <th className="px-3 py-2.5 border-r border-slate-200 w-28 text-center font-semibold">ที่นั่ง</th>
                <th className="px-3 py-2.5 w-28 text-center font-semibold">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {registrants.map((reg, index) => (
                <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-center text-slate-400 border-r border-slate-100 bg-slate-50/40 font-normal">{index + 1}</td>
                  <td className="px-3 py-2.5 font-normal text-slate-900 border-r border-slate-100">{reg.fullName}</td>
                  <td className="px-3 py-2.5 text-slate-600 font-normal border-r border-slate-100">{reg.studentId || '-'}</td>
                  <td className="px-3 py-2.5 text-center text-[#000946] font-normal border-r border-slate-100">{reg.seatNumber || '-'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-sm font-normal border ${
                      reg.status === 'checked-in'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {translateStatus(reg.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {registrants.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 text-sm font-normal">
                    ไม่มีผู้ลงทะเบียนสำหรับกิจกรรมนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-normal rounded-lg hover:bg-slate-100 transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </footer>
      </div>
    </div>
  );
};

export default function ActivityDashboardPage() {
  const { showAlert, showToast } = useModal();
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState({});
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ongoing'); // ongoing, completed, all
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingActivity, setViewingActivity] = useState(null);
  const [selectedActivityRegistrants, setSelectedActivityRegistrants] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [activitiesSnapshot, categoriesSnapshot, registrationsSnapshot] = await Promise.all([
          getDocs(collection(db, 'activities')),
          getDocs(collection(db, 'categories')),
          getDocs(collection(db, 'registrations'))
        ]);

        const categoriesMap = {};
        categoriesSnapshot.forEach(doc => { categoriesMap[doc.id] = doc.data().name; });
        setCategories(categoriesMap);

        setAllRegistrations(registrationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const activitiesData = activitiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isRegistrationOpen: doc.data().isRegistrationOpen !== undefined ? doc.data().isRegistrationOpen : true,
          enableEvaluation: doc.data().enableEvaluation !== undefined ? doc.data().enableEvaluation : false
        }));
        activitiesData.sort((a, b) => (b.activityDate?.seconds || 0) - (a.activityDate?.seconds || 0));
        setActivities(activitiesData);
      } catch (error) {
        console.error("Error fetching data: ", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleToggleRegistration = async (activityId, currentStatus) => {
    try {
      const activityRef = doc(db, 'activities', activityId);
      await updateDoc(activityRef, {
        isRegistrationOpen: !currentStatus
      });
      setActivities(prev => prev.map(act =>
        act.id === activityId ? { ...act, isRegistrationOpen: !currentStatus } : act
      ));
      showToast({ message: !currentStatus ? 'เปิดรับลงทะเบียนแล้ว' : 'ปิดรับลงทะเบียนแล้ว', type: 'info' });
    } catch (error) {
      console.error("Error updating registration status:", error);
      showAlert({ title: 'เกิดข้อผิดพลาด', message: 'ไม่สามารถอัปเดตสถานะการลงทะเบียนได้', type: 'error' });
    }
  };

  const handleToggleEvaluation = async (activityId, currentStatus) => {
    try {
      const activityRef = doc(db, 'activities', activityId);
      await updateDoc(activityRef, {
        enableEvaluation: !currentStatus
      });
      setActivities(prev => prev.map(act =>
        act.id === activityId ? { ...act, enableEvaluation: !currentStatus } : act
      ));
      showToast({ message: !currentStatus ? 'เปิดทำแบบประเมินแล้ว' : 'ปิดทำแบบประเมินแล้ว', type: 'info' });
    } catch (error) {
      console.error("Error updating evaluation status:", error);
      showAlert({ title: 'เกิดข้อผิดพลาด', message: 'ไม่สามารถอัปเดตสถานะการประเมินได้', type: 'error' });
    }
  };


  const registrationsCount = useMemo(() => {
    const acc = {};
    allRegistrations.forEach(reg => {
      acc[reg.activityId] = (acc[reg.activityId] || 0) + 1;
    });
    return acc;
  }, [allRegistrations]);

  const now = new Date();

  const ongoingActivities = useMemo(() => {
    return activities.filter(activity => {
      const activityDate = activity.activityDate?.toDate();
      if (!activityDate) return true;
      const endOfActivityDay = new Date(activityDate);
      endOfActivityDay.setHours(23, 59, 59, 999);
      return endOfActivityDay >= now;
    });
  }, [activities, now]);

  const completedActivities = useMemo(() => {
    return activities.filter(activity => {
      const activityDate = activity.activityDate?.toDate();
      if (!activityDate) return false;
      const endOfActivityDay = new Date(activityDate);
      endOfActivityDay.setHours(23, 59, 59, 999);
      return endOfActivityDay < now;
    });
  }, [activities, now]);

  const filteredActivities = useMemo(() => {
    let list = activities;
    if (activeTab === 'ongoing') list = ongoingActivities;
    else if (activeTab === 'completed') list = completedActivities;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      return list.filter(act =>
        (act.name || '').toLowerCase().includes(term) ||
        (act.location || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [activities, activeTab, ongoingActivities, completedActivities, searchTerm]);

  return (
    <>
      {isModalOpen && (
        <RegistrantsModal
          activity={viewingActivity}
          registrants={selectedActivityRegistrants}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <div className="p-4 md:p-6 space-y-4 font-sans">
        {/* Control Bar: Filters, Search & Add Activity */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { key: 'ongoing', label: 'กำลังเปิดรับ', count: ongoingActivities.length },
              { key: 'completed', label: 'จบแล้ว', count: completedActivities.length },
              { key: 'all', label: 'ทั้งหมด', count: activities.length }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-2 rounded-lg text-sm font-normal transition-colors whitespace-nowrap flex items-center gap-2 border ${
                  activeTab === tab.key
                    ? 'bg-[#000946] text-white border-[#000946]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box & Add Button */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="ค้นหากิจกรรม, สถานที่..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-6 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-800 outline-none focus:border-slate-400 placeholder:text-slate-400"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-sm font-normal"
                >
                  ✕
                </button>
              )}
            </div>

            <Link
              href="/admin/activity/add"
              className="px-4 py-2 bg-[#000946] hover:bg-[#00125e] text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>+ เพิ่มกิจกรรมใหม่</span>
            </Link>
          </div>
        </div>

        {/* Activity Cards Grid */}
        {isLoading ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 text-sm font-normal flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
            <span>กำลังโหลดรายการกิจกรรม...</span>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 text-sm font-normal">
            ไม่พบกิจกรรมที่ตรงกับเงื่อนไข
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredActivities.map(activity => {
              const count = registrationsCount[activity.id] || 0;
              const activityDate = activity.activityDate?.toDate ? activity.activityDate.toDate() : (activity.activityDate ? new Date(activity.activityDate) : null);
              const isFullyBooked = count >= activity.capacity;
              const isPastEvent = activityDate && activityDate < new Date() && activityDate.toDateString() !== new Date().toDateString();
              const isToday = activityDate && activityDate.toDateString() === new Date().toDateString();

              let statusConfig = { text: 'เปิดรับ', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
              if (isPastEvent) {
                statusConfig = { text: 'สิ้นสุด', bg: 'bg-slate-100 text-slate-600 border-slate-200' };
              } else if (isToday) {
                statusConfig = { text: 'วันนี้', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
              } else if (isFullyBooked) {
                statusConfig = { text: 'เต็ม', bg: 'bg-red-50 text-red-700 border-red-200' };
              }

              const typeLabel = activity.type === 'exam' ? 'สอบ' : activity.type === 'interview' ? 'สัมภาษณ์' : activity.type === 'queue' ? 'คิว' : activity.type === 'graduation' ? 'รับปริญญา' : activity.type === 'event' ? 'กิจกรรม' : 'ทั่วไป';

              return (
                <div
                  key={activity.id}
                  className={`bg-white rounded-xl border border-slate-200 flex flex-col justify-between overflow-hidden shadow-xs transition-colors ${
                    isPastEvent ? 'opacity-75 bg-slate-50/50' : 'hover:border-slate-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-0.5 text-sm rounded-md border font-normal ${statusConfig.bg}`}>
                        {statusConfig.text}
                      </span>
                      <span className="text-sm font-normal text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                        {typeLabel}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug" title={activity.name}>
                      {activity.name}
                    </h3>

                    {/* Metadata */}
                    <div className="space-y-1.5 text-sm font-normal text-slate-600 pt-1">
                      <div className="flex items-center gap-2 truncate">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>
                          {activityDate ? activityDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                          {activityDate && ` (${activityDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{activity.location || 'ไม่ระบุสถานที่'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Switches & Progress */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-2.5 text-sm">
                    {/* Toggles */}
                    <div className="flex items-center justify-between text-slate-700 font-normal">
                      <span>เปิดรับลงทะเบียน</span>
                      <button
                        onClick={() => handleToggleRegistration(activity.id, activity.isRegistrationOpen)}
                        className={`px-2.5 py-1 rounded-md text-sm font-normal border transition-colors ${
                          activity.isRegistrationOpen
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                        title={activity.isRegistrationOpen ? 'เปิดให้นักเรียนลงทะเบียนได้ทั่วไป' : 'เฉพาะผู้มีสิทธิ์ (เจ้าหน้าที่ลงทะเบียนให้)'}
                      >
                        {activity.isRegistrationOpen ? 'เปิด' : 'เฉพาะผู้มีสิทธิ์'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-slate-700 font-normal">
                      <span>เปิดทำแบบประเมิน</span>
                      <button
                        onClick={() => handleToggleEvaluation(activity.id, activity.enableEvaluation)}
                        className={`px-2.5 py-1 rounded-md text-sm font-normal border transition-colors ${
                          activity.enableEvaluation
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-slate-200 text-slate-600 border-slate-300'
                        }`}
                      >
                        {activity.enableEvaluation ? 'เปิด' : 'ปิด'}
                      </button>
                    </div>

                    {/* Progress */}
                    <div className="pt-1 space-y-1">
                      <div className="flex justify-between text-sm text-slate-600 font-normal">
                        <span>ผู้ลงทะเบียน</span>
                        <span className="font-semibold text-slate-900">
                          {count} / {activity.capacity} คน
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${isFullyBooked ? 'bg-red-500' : 'bg-[#000946]'}`}
                          style={{ width: `${Math.min((count / (activity.capacity || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
                    <Link
                      href={`/admin/activity/seats/${activity.id}`}
                      className="flex-1 bg-[#000946] hover:bg-[#00125e] text-white text-sm font-normal py-2 rounded-lg text-center shadow-xs transition-all active:scale-95"
                    >
                      {activity.type === 'queue' ? 'จัดการคิว' : activity.type === 'event' ? 'จัดการผู้ลงทะเบียน' : 'จัดการที่นั่ง'}
                    </Link>
                    <Link
                      href={`/admin/activity/edit/${activity.id}`}
                      className="px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-normal py-2 rounded-lg text-center transition-colors"
                    >
                      แก้ไข
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}