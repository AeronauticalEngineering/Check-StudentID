'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { CSVLink } from "react-csv"; // For CSV Export

// Helper function to translate status to Thai
const translateStatus = (status) => {
  switch (status) {
    case 'checked-in': return 'เช็คอินแล้ว';
    case 'registered': return 'ลงทะเบียนแล้ว';
    default: return status || '';
  }
};

// --- Modal Component for Displaying Registrants ---
const RegistrantsModal = ({ activity, registrants, onClose }) => {
    if (!activity) return null;

    // Prepare headers for the CSV file
    const headers = [
        { label: "ชื่อ-สกุล", key: "fullName" },
        { label: "รหัสนักศึกษา", key: "studentId" },
        { label: "เลขบัตรประชาชน", key: "nationalId" },
        { label: "สถานะ", key: "status" },
        { label: "เลขที่นั่ง", key: "seatNumber" },
        { label: "LINE User ID", key: "lineUserId" },
    ];

    // Prepare data for the CSV file
    const dataForCsv = registrants.map((reg) => ({
        fullName: reg.fullName || '',
        studentId: reg.studentId || '',
        nationalId: reg.nationalId || '',
        status: translateStatus(reg.status),
        seatNumber: reg.seatNumber || '',
        lineUserId: reg.lineUserId || '',
    }));

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
                <footer className="p-3 bg-gray-50 border-t flex justify-between items-center">
                    <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">ปิด</button>
                </footer>
            </div>
        </div>
    );
};


export default function ActivityDashboardPage() {
  const [activities, setActivities] = useState([]);
  const [courses, setCourses] = useState({});
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingActivity, setViewingActivity] = useState(null);
  const [selectedActivityRegistrants, setSelectedActivityRegistrants] = useState([]);
  const [activeTab, setActiveTab] = useState('ongoing'); // เพิ่ม state สำหรับแท็บ

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [activitiesSnapshot, coursesSnapshot, registrationsSnapshot] = await Promise.all([
          getDocs(collection(db, 'activities')),
          getDocs(collection(db, 'courses')),
          getDocs(collection(db, 'registrations'))
        ]);

        const coursesMap = {};
        coursesSnapshot.forEach(doc => { coursesMap[doc.id] = doc.data().name; });
        setCourses(coursesMap);
        
        setAllRegistrations(registrationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const activitiesData = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        activitiesData.sort((a, b) => b.activityDate.seconds - a.activityDate.seconds);
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

  // แยกกิจกรรมตามวันที่
  const now = new Date();
  const today = new Date();
  today.setHours(23, 59, 59, 999); // สิ้นสุดวันนี้
  
  const ongoingActivities = activities.filter(activity => {
    const activityDate = activity.activityDate?.toDate ? activity.activityDate.toDate() : new Date(activity.activityDate?.seconds * 1000);
    return activityDate >= now || activityDate.toDateString() === now.toDateString(); // รวมวันปัจจุบัน
  });

  const completedActivities = activities.filter(activity => {
    const activityDate = activity.activityDate?.toDate ? activity.activityDate.toDate() : new Date(activity.activityDate?.seconds * 1000);
    return activityDate < now && activityDate.toDateString() !== now.toDateString(); // ไม่รวมวันปัจจุบัน
  });

  // เลือกกิจกรรมที่จะแสดงตามแท็บ
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
        <main className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">จัดการ หมวดหมู่ กิจกรรม</h1>
            <Link href="/admin/activity/add" className="px-4 py-2 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-green-700">
              + เพิ่มกิจกรรม
            </Link>
          </div>

          {/* แท็บเลือกประเภทกิจกรรม */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
              <button
                onClick={() => setActiveTab('ongoing')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'ongoing'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                กิจกรรมที่เปิดรับ ({ongoingActivities.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'completed'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                กิจกรรมที่จบแล้ว ({completedActivities.length})
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayActivities.map(activity => {
              const count = registrationsCount[activity.id] || 0;
              const activityDate = activity.activityDate?.toDate ? activity.activityDate.toDate() : new Date(activity.activityDate?.seconds * 1000);
              const isFullyBooked = count >= activity.capacity;
              const isPastEvent = activityDate < new Date() && activityDate.toDateString() !== new Date().toDateString();
              const isToday = activityDate.toDateString() === new Date().toDateString();
              
              // กำหนดสถานะและสี
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
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-gray-800 line-clamp-2">{activity.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}>
                        {statusText}
                      </span>
                    </div>

                    {/* Course Category */}
                    <div className="mb-3">
                      <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
                        {courses[activity.courseId] || 'N/A'}
                      </span>
                    </div>

                    {/* Date & Time */}
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm">
                          {activityDate.toLocaleDateString('th-TH', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            weekday: 'long' 
                          })}
                        </span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm">
                          {activityDate.toLocaleTimeString('th-TH', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })} น.
                        </span>
                      </div>
                    </div>

                    {/* Registration Count */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">ผู้ลงทะเบียน</span>
                        <span className="text-sm font-semibold text-gray-800">{count} / {activity.capacity}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isFullyBooked ? 'bg-red-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min((count / activity.capacity) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Location (if available) */}
                    {activity.location && (
                      <div className="mb-4">
                        <div className="flex items-center text-gray-600">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-sm">{activity.location}</span>
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {activity.description && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 line-clamp-2">{activity.description}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-2 pt-4 border-t border-gray-100">
                      <Link 
                        href={`/admin/activity/seats/${activity.id}`} 
                        className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors text-center font-medium"
                      >
                        ข้อมูล
                      </Link>
                      <Link 
                        href={`/admin/activity/edit/${activity.id}`} 
                        className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors text-center font-medium"
                      >
                        แก้ไข
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {displayActivities.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h9.586a1 1 0 00.707-.293l5.414-5.414A1 1 0 0023 13.586V7a2 2 0 00-2-2h-3m-5 5V4a1 1 0 011-1h4a1 1 0 011 1v4M9 9v10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                {activeTab === 'ongoing' ? 'ไม่มีกิจกรรมที่เปิดรับ' : 'ไม่มีกิจกรรมที่จบแล้ว'}
              </h3>
              <p className="text-gray-500 mb-4">
                {activeTab === 'ongoing' 
                  ? 'เริ่มต้นสร้างกิจกรรมแรกของคุณ' 
                  : 'กิจกรรมที่จบแล้วจะแสดงที่นี่'
                }
              </p>
              {activeTab === 'ongoing' && (
                <Link 
                  href="/admin/activity/add" 
                  className="inline-flex items-center px-4 py-2 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-green-700"
                >
                  + เพิ่มกิจกรรมใหม่
                </Link>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}