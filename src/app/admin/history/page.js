'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

// ฟังก์ชันสำหรับจัดรูปแบบวันที่ให้อ่านง่าย
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'ไม่มีข้อมูล';
  return timestamp.toDate().toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

// Status Badge Component
const StatusBadge = ({ type }) => {
  const colors = {
    'check-in': 'bg-green-100 text-green-800 border-green-200',
    'check-out': 'bg-blue-100 text-blue-800 border-blue-200',
    'queue-call': 'bg-purple-100 text-purple-800 border-purple-200',
  };

  const labels = {
    'check-in': 'เช็คอิน',
    'check-out': 'เช็คเอาท์',
    'queue-call': 'เรียกคิว',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[type] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
      {labels[type] || type}
    </span>
  );
};

export default function AdminHistoryPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, check-in, check-out, queue-call

  useEffect(() => {
    const q = query(collection(db, 'checkInLogs'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const logsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.type === filter);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-gray-500 font-medium">กำลังโหลดประวัติ...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50/50 min-h-screen p-6 md:p-10 font-sans">
      <main className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">ประวัติการเช็คอิน</h1>
          <p className="text-gray-500 mt-1">ดูประวัติการเช็คอิน เช็คเอาท์ และการเรียกคิวทั้งหมด</p>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 mb-6 inline-flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${filter === 'all'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            ทั้งหมด ({logs.length})
          </button>
          <button
            onClick={() => setFilter('check-in')}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${filter === 'check-in'
                ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            เช็คอิน ({logs.filter(l => l.type === 'check-in').length})
          </button>
          <button
            onClick={() => setFilter('check-out')}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${filter === 'check-out'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            เช็คเอาท์ ({logs.filter(l => l.type === 'check-out').length})
          </button>
          <button
            onClick={() => setFilter('queue-call')}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${filter === 'queue-call'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            เรียกคิว ({logs.filter(l => l.type === 'queue-call').length})
          </button>
        </div>

        {/* Logs List */}
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">ยังไม่มีประวัติ{filter !== 'all' ? 'ในหมวดนี้' : ''}</p>
            <p className="text-sm text-gray-400 mt-1">ประวัติจะแสดงที่นี่เมื่อมีการเช็คอินหรือเช็คเอาท์</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 w-32">ประเภท</th>
                    <th className="px-6 py-4">ชื่อนักเรียน</th>
                    <th className="px-6 py-4">กิจกรรม</th>
                    <th className="px-6 py-4 w-32">ที่นั่ง/คิว</th>
                    <th className="px-6 py-4 w-48">เวลา</th>
                    <th className="px-6 py-4 w-32">ผู้ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLogs.map((log, index) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <StatusBadge type={log.type || 'check-in'} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs">
                            {log.studentName?.charAt(0) || 'N'}
                          </div>
                          <span className="font-medium text-gray-900">{log.studentName || 'ไม่ระบุชื่อ'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {log.activityName || 'ไม่ระบุกิจกรรม'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-600">
                          {log.assignedSeat || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {log.adminId || 'ระบบ'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Info */}
            <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                แสดง {filteredLogs.length} รายการ
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                อัปเดตแบบเรียลไทม์
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}