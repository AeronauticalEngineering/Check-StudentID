'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { CSVLink } from "react-csv"; // For CSV Export

// --- Modal Component for Displaying Registrants ---
const RegistrantsModal = ({ activity, registrants, onClose }) => {
    if (!activity) return null;

    // Prepare headers for the CSV file
    const headers = [
        { label: "ลำดับ", key: "index" },
        { label: "ชื่อ-สกุล", key: "fullName" },
        { label: "รหัสนักศึกษา", key: "studentId" },
        { label: "เลขบัตรประชาชน", key: "nationalId" },
        { label: "สถานะ", key: "status" },
        { label: "เลขที่นั่ง", key: "seatNumber" },
        { label: "ลงทะเบียนโดย", key: "registeredBy" },
        { label: "LINE User ID", key: "lineUserId" },
    ];

    // Prepare data for the CSV file
    const dataForCsv = registrants.map((reg, index) => ({
        ...reg,
        index: index + 1,
        seatNumber: reg.seatNumber || '-',
        lineUserId: reg.lineUserId || '-',
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
                                    <td className="p-2">{reg.status === 'checked-in' ? 'เช็คอินแล้ว' : 'ลงทะเบียน'}</td>
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
            <h1 className="text-3xl font-bold text-gray-800">จัดการ หลักสูตร กิจกรรม</h1>
            <Link href="/admin/activity/add" className="px-4 py-2 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-green-700">
              + เพิ่มกิจกรรม
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-4 font-semibold">กิจกรรม</th>
                  <th className="p-4 font-semibold">หลักสูตร</th>
                  <th className="p-4 font-semibold text-center">ลงทะเบียน</th>
                  <th className="p-4 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {activities.map(activity => {
                  const count = registrationsCount[activity.id] || 0;
                  return (
                    <tr key={activity.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium">{activity.name}</td>
                      <td className="p-4 text-gray-600">{courses[activity.courseId] || 'N/A'}</td>
                      <td className="p-4 text-center font-mono">{count} / {activity.capacity}</td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <Link href={`/admin/activity/seats/${activity.id}`} className="px-3 py-1 bg-card text-white text-sm rounded-md hover:bg-purple-700">
                          ข้อมูล
                        </Link>
                        <Link href={`/admin/activity/edit/${activity.id}`} className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600">
                          แก้ไข
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </>
  );
}