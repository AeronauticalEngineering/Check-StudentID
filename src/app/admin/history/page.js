'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// ฟังก์ชันสำหรับจัดรูปแบบวันที่ให้อ่านง่าย
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'ไม่มีข้อมูล';
  return timestamp.toDate().toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export default function AdminHistoryPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // ดึงข้อมูลทั้งหมดจาก checkInLogs และเรียงตามเวลาล่าสุดก่อน
        const q = query(collection(db, 'checkInLogs'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const logsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setLogs(logsData);
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (isLoading) {
    return <div className="text-center p-10">กำลังโหลดประวัติ...</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-8">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">ประวัติการเช็คอิน</h1>
        
        {logs.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
            ยังไม่มีประวัติการเช็คอิน
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md">
            <ul className="divide-y divide-gray-200">
              {logs.map(log => (
                <li key={log.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">
                      เช็คอิน <span className="text-blue-600">{log.studentName}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      กิจกรรม: {log.activityName} (ที่นั่ง: {log.assignedSeat})
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{formatTimestamp(log.timestamp)}</p>
                    <p>โดย: {log.adminId}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}