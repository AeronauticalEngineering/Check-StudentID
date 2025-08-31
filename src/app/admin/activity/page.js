'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

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
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
                <header className="p-4 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">รายชื่อผู้ลงทะเบียน</h2>
                        <p className="text-sm text-gray-600">{activity.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
                </header>
                <div className="p-4 flex-grow overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="p-2">#</th>
                                <th className="p-2">ชื่อ-สกุล</th>
                                <th className="p-2">รหัส นศ.</th>
                                <th className="p-2">ที่นั่ง</th>
                                <th className="p-2">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {registrants.map((reg, index) => (
                                <tr key={reg.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2">{index + 1}</td>
                                    <td className="p-2 font-medium">{reg.fullName}</td>
                                    <td className="p-2">{reg.studentId}</td>
                                    <td className="p-2 font-semibold">{reg.seatNumber || '-'}</td>
                                    <td className="p-2">{translateStatus(reg.status)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {registrants.length === 0 && <p className="text-center p-6 text-gray-500">ไม่มีผู้ลงทะเบียนสำหรับกิจกรรมนี้</p>}
                </div>
                <footer className="p-3 bg-gray-50 border-t flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">ปิด</button>
                </footer>
            </div>
        </div>
    );
};

export default function ActivityDashboardPage() {
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState({}); // ✅ Changed from courses to categories
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
          getDocs(collection(db, 'categories')), // ✅ Fetch from 'categories' collection
          getDocs(collection(db, 'registrations'))
        ]);

        const categoriesMap = {}; // ✅ Create a map for categories
        categoriesSnapshot.forEach(doc => { categoriesMap[doc.id] = doc.data().name; });
        setCategories(categoriesMap);
        
        setAllRegistrations(registrationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const activitiesData = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

  if (isLoading) return <div className="flex justify-center items-center h-screen">Loading data...</div>;

  return (
    <>
      {isModalOpen && (
        <RegistrantsModal 
            activity={viewingActivity}
            registrants={selectedActivityRegistrants}
            onClose={() => setIsModalOpen(false)}
        />
      )}
      <div className="bg-gray-100 min-h-screen p-4 md:p-8">
        <main className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">จัดการกิจกรรม</h1>
            <Link href="/admin/activity/add" className="px-4 py-2 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-green-700">
              + เพิ่มกิจกรรม
            </Link>
          </div>

          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
              <button onClick={() => setActiveTab('ongoing')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'ongoing' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                กิจกรรมที่เปิดรับ ({ongoingActivities.length})
              </button>
              <button onClick={() => setActiveTab('completed')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'completed' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                กิจกรรมที่จบแล้ว ({completedActivities.length})
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayActivities.map(activity => {
              const count = registrationsCount[activity.id] || 0;
              const activityDate = activity.activityDate?.toDate();
              const isFullyBooked = count >= activity.capacity;
              const isPastEvent = activityDate && activityDate < new Date() && activityDate.toDateString() !== new Date().toDateString();
              const isToday = activityDate && activityDate.toDateString() === new Date().toDateString();
              
              let statusText = 'เปิดรับ';
              let statusColor = 'bg-green-100 text-green-800';
              
              if (isPastEvent) {
                statusText = 'จบแล้ว';
                statusColor = 'bg-gray-100 text-gray-800';
              } else if (isToday) {
                statusText = 'เริ่มกิจกรรม';
                statusColor = 'bg-orange-100 text-orange-800';
              } else if (isFullyBooked) {
                statusText = 'เต็มแล้ว';
                statusColor = 'bg-red-100 text-red-800';
              }
              
              return (
                <div key={activity.id} className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200 ${isPastEvent ? 'opacity-75' : ''}`}>
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex-grow">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-gray-800 line-clamp-2">{activity.name}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}>{statusText}</span>
                      </div>
                      <div className="mb-3">
                        <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
                          {categories[activity.categoryId] || 'ทั่วไป'} {/* ✅ Use categories map */}
                        </span>
                      </div>
                      <div className="mb-4 space-y-2">
                        <div className="flex items-center text-gray-600">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span className="text-sm">
                            {activityDate ? activityDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric'}) : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-sm">{activityDate ? activityDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''} น.</span>
                        </div>
                         <div className="flex items-center text-gray-600">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span className="text-sm">{activity.location}</span>
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">ผู้ลงทะเบียน</span>
                          <span className="text-sm font-semibold text-gray-800">{count} / {activity.capacity}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-300 ${isFullyBooked ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min((count / activity.capacity) * 100, 100)}%` }}></div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-auto flex space-x-2 pt-4 border-t border-gray-100">
                      <Link href={`/admin/activity/seats/${activity.id}`} className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors text-center font-medium">
                        จัดการข้อมูล
                      </Link>
                      <Link href={`/admin/activity/edit/${activity.id}`} className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors text-center font-medium">
                        แก้ไข
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {displayActivities.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-500">{activeTab === 'ongoing' ? 'ไม่มีกิจกรรมที่กำลังจะมาถึง' : 'ไม่มีกิจกรรมที่จบแล้ว'}</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}