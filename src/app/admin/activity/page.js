'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

// Helper function to translate status to Thai
const translateStatus = (status) => {
  switch (status) {
    case 'checked-in': return 'เช็คอินแล้ว';
    case 'registered': return 'ลงทะเบียนแล้ว';
    default: return status || '';
  }
};

const RegistrantsModal = ({ activity, registrants, onClose }) => {
  if (!activity) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <header className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">รายชื่อผู้ลงทะเบียน</h2>
            <p className="text-sm text-gray-500 mt-1">{activity.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="p-0 flex-grow overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10 text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-3 border-b border-gray-100">#</th>
                <th className="px-6 py-3 border-b border-gray-100">ชื่อ-สกุล</th>
                <th className="px-6 py-3 border-b border-gray-100">รหัส นศ.</th>
                <th className="px-6 py-3 border-b border-gray-100">ที่นั่ง</th>
                <th className="px-6 py-3 border-b border-gray-100">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {registrants.map((reg, index) => (
                <tr key={reg.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-6 py-3 text-gray-500">{index + 1}</td>
                  <td className="px-6 py-3 font-medium text-gray-800">{reg.fullName}</td>
                  <td className="px-6 py-3 text-gray-600">{reg.studentId}</td>
                  <td className="px-6 py-3 font-semibold text-primary">{reg.seatNumber || '-'}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${reg.status === 'checked-in' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {translateStatus(reg.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {registrants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              <p>ไม่มีผู้ลงทะเบียนสำหรับกิจกรรมนี้</p>
            </div>
          )}
        </div>
        <footer className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            ปิดหน้าต่าง
          </button>
        </footer>
      </div>
    </div>
  );
};

export default function ActivityDashboardPage() {
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState({});
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingActivity, setViewingActivity] = useState(null);
  const [selectedActivityRegistrants, setSelectedActivityRegistrants] = useState([]);
  const [activeTab, setActiveTab] = useState('ongoing');

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
          // Ensure default values if missing
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
      // Update local state
      setActivities(prev => prev.map(act =>
        act.id === activityId ? { ...act, isRegistrationOpen: !currentStatus } : act
      ));
    } catch (error) {
      console.error("Error updating registration status:", error);
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    }
  };

  const handleToggleEvaluation = async (activityId, currentStatus) => {
    try {
      const activityRef = doc(db, 'activities', activityId);
      await updateDoc(activityRef, {
        enableEvaluation: !currentStatus
      });
      // Update local state
      setActivities(prev => prev.map(act =>
        act.id === activityId ? { ...act, enableEvaluation: !currentStatus } : act
      ));
    } catch (error) {
      console.error("Error updating evaluation status:", error);
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    }
  };

  const handleViewStudents = (activityId) => {
    const activity = activities.find(act => act.id === activityId);
    setViewingActivity(activity);
    const registrants = allRegistrations.filter(reg => reg.activityId === activityId);
    setSelectedActivityRegistrants(registrants);
    setIsModalOpen(true);
  };

  const registrationsCount = allRegistrations.reduce((acc, reg) => {
    acc[reg.activityId] = (acc[reg.activityId] || 0) + 1;
    return acc;
  }, {});

  const now = new Date();

  const ongoingActivities = activities.filter(activity => {
    const activityDate = activity.activityDate?.toDate();
    return !activityDate || activityDate >= now;
  });

  const completedActivities = activities.filter(activity => {
    const activityDate = activity.activityDate?.toDate();
    return activityDate && activityDate < now;
  });

  const displayActivities = activeTab === 'ongoing' ? ongoingActivities : completedActivities;

  if (isLoading) return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="mt-4 text-gray-500 font-medium">กำลังโหลดข้อมูล...</p>
    </div>
  );

  return (
    <>
      {isModalOpen && (
        <RegistrantsModal
          activity={viewingActivity}
          registrants={selectedActivityRegistrants}
          onClose={() => setIsModalOpen(false)}
        />
      )}
      <div className="bg-gray-50/50 min-h-screen p-6 md:p-10">
        <main className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">จัดการกิจกรรม</h1>
              <p className="text-gray-500 mt-1">สร้างและจัดการกิจกรรมทั้งหมดในระบบ</p>
            </div>
            <Link
              href="/admin/activity/add"
              className="group flex items-center px-5 py-2.5 bg-primary text-white font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-hover hover:shadow-primary/40 transition-all duration-200 active:scale-95"
            >
              <svg className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              เพิ่มกิจกรรมใหม่
            </Link>
          </div>

          {/* Tabs */}
          <div className="mb-8">
            <div className="inline-flex bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
              <button
                onClick={() => setActiveTab('ongoing')}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'ongoing'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                กำลังเปิดรับ ({ongoingActivities.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'completed'
                  ? 'bg-gray-800 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                จบแล้ว ({completedActivities.length})
              </button>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
            {displayActivities.map(activity => {
              const count = registrationsCount[activity.id] || 0;
              const activityDate = activity.activityDate?.toDate();
              const isFullyBooked = count >= activity.capacity;
              const isPastEvent = activityDate && activityDate < new Date() && activityDate.toDateString() !== new Date().toDateString();
              const isToday = activityDate && activityDate.toDateString() === new Date().toDateString();

              let statusConfig = { text: 'เปิดรับลงทะเบียน', bg: 'bg-emerald-50', textCol: 'text-emerald-700', border: 'border-emerald-100' };

              if (isPastEvent) {
                statusConfig = { text: 'จบกิจกรรมแล้ว', bg: 'bg-gray-100', textCol: 'text-gray-600', border: 'border-gray-200' };
              } else if (isToday) {
                statusConfig = { text: 'เริ่มวันนี้', bg: 'bg-amber-50', textCol: 'text-amber-700', border: 'border-amber-100' };
              } else if (isFullyBooked) {
                statusConfig = { text: 'ที่นั่งเต็ม', bg: 'bg-rose-50', textCol: 'text-rose-700', border: 'border-rose-100' };
              }

              return (
                <div
                  key={activity.id}
                  className={`group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col h-full overflow-hidden ${isPastEvent ? 'opacity-80 grayscale-[0.3]' : ''}`}
                >
                  {/* Card Header */}
                  <div className="p-6 pb-4 flex-grow">
                    <div className="flex justify-between items-start mb-4 gap-2">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusConfig.bg} ${statusConfig.textCol} ${statusConfig.border}`}>
                        {statusConfig.text}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2 mb-4 group-hover:text-primary transition-colors">
                      {activity.name}
                    </h3>

                    <div className="space-y-3">
                      <div className="flex items-start text-gray-600">
                        <div className="w-8 flex-shrink-0 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">วันที่จัดกิจกรรม</p>
                          <p className="text-sm font-medium text-gray-700">
                            {activityDate ? activityDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'ไม่ระบุ'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start text-gray-600">
                        <div className="w-8 flex-shrink-0 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">เวลา</p>
                          <p className="text-sm font-medium text-gray-700">
                            {activityDate ? `${activityDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.` : '-'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start text-gray-600">
                        <div className="w-8 flex-shrink-0 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">สถานที่</p>
                          <p className="text-sm font-medium text-gray-700 line-clamp-1">{activity.location || 'ไม่ระบุ'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Toggles Section */}
                  <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/30 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">เปิดรับลงทะเบียนสำหรับนักเรียน</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleToggleRegistration(activity.id, activity.isRegistrationOpen);
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${activity.isRegistrationOpen ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${activity.isRegistrationOpen ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">เปิดรับประเมิน</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleToggleEvaluation(activity.id, activity.enableEvaluation);
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${activity.enableEvaluation ? 'bg-blue-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${activity.enableEvaluation ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Progress & Actions */}
                  <div className="px-6 pb-6 pt-2">
                    <div className="mb-5">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-medium text-gray-500">จำนวนที่นั่ง</span>
                        <span className="text-sm font-bold text-gray-800">
                          <span className={isFullyBooked ? 'text-rose-600' : 'text-primary'}>{count}</span>
                          <span className="text-gray-400 text-xs font-normal mx-1">/</span>
                          {activity.capacity}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${isFullyBooked ? 'bg-rose-500' :
                            (count / activity.capacity) > 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          style={{ width: `${Math.min((count / activity.capacity) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Link
                        href={`/admin/activity/seats/${activity.id}`}
                        className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-hover transition-colors text-center shadow-lg shadow-primary/20"
                      >
                        จัดการที่นั่ง
                      </Link>
                      <Link
                        href={`/admin/activity/edit/${activity.id}`}
                        className="px-4 py-2.5 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors text-center"
                      >
                        แก้ไข
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {displayActivities.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center max-w-lg mx-auto mt-12">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">ไม่มีข้อมูลกิจกรรม</h3>
              <p className="text-gray-500">{activeTab === 'ongoing' ? 'ยังไม่มีกิจกรรมที่กำลังเปิดรับในขณะนี้' : 'ไม่มีประวัติกิจกรรมที่จบแล้ว'}</p>
              {activeTab === 'ongoing' && (
                <Link href="/admin/activity/add" className="inline-block mt-6 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium">
                  เริ่มสร้างกิจกรรมแรก
                </Link>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}