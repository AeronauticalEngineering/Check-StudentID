'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where, writeBatch, onSnapshot } from 'firebase/firestore';

export default function AllRegistrantsPage() {
  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editStates, setEditStates] = useState({});
  const [editingId, setEditingId] = useState(null); // ID ของแถวที่กำลังแก้ไข
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    setIsLoading(true);
    
    // Subscribe to studentProfiles realtime
    const unsubProfiles = onSnapshot(collection(db, 'studentProfiles'), (profilesSnapshot) => {
      const profilesMap = new Map();
      profilesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.nationalId) {
          profilesMap.set(data.nationalId, {
            id: doc.id,
            ...data,
            hasProfile: true,
            profileId: doc.id,
            createdAt: data.createdAt
          });
        }
      });
      
      // Subscribe to registrations realtime
      const unsubRegistrations = onSnapshot(collection(db, 'registrations'), (registrationsSnapshot) => {
        registrationsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.nationalId) {
            if (profilesMap.has(data.nationalId)) {
              // มีใน profiles แล้ว - เพิ่มข้อมูล registrations
              const existing = profilesMap.get(data.nationalId);
              existing.hasRegistration = true;
              existing.registrationId = doc.id;
              // อัพเดตวันที่ถ้า registration ใหม่กว่า
              const regTime = data.registeredAt || data.createdAt;
              if (regTime && (!existing.createdAt || regTime.seconds > existing.createdAt.seconds)) {
                existing.createdAt = regTime;
              }
            } else {
              // ยังไม่มีใน profiles - สร้างใหม่จาก registration
              profilesMap.set(data.nationalId, {
                id: doc.id,
                ...data,
                hasRegistration: true,
                registrationId: doc.id,
                createdAt: data.registeredAt || data.createdAt
              });
            }
          }
        });
        
        // แปลง Map เป็น Array และเรียงตามวันที่
        const allData = Array.from(profilesMap.values()).sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA; // เรียงจากใหม่ไปเก่า
        });
        
        setRegistrations(allData);

        const initialEdits = {};
        allData.forEach(r => {
          initialEdits[r.id] = { 
            fullName: r.fullName || '',
            studentId: r.studentId || '',
            nationalId: r.nationalId || '',
            lineUserId: r.lineUserId || '',
          };
        });
        setEditStates(initialEdits);
        setIsLoading(false);
      }, (error) => {
        console.error("Error listening to registrations: ", error);
        setMessage("เกิดข้อผิดพลาดในการดึงข้อมูล");
        setIsLoading(false);
      });
      
      // Store unsubRegistrations for cleanup
      return unsubRegistrations;
    }, (error) => {
      console.error("Error listening to profiles: ", error);
      setMessage("เกิดข้อผิดพลาดในการดึงข้อมูล");
      setIsLoading(false);
    });

    // Cleanup subscriptions
    return () => {
      unsubProfiles();
    };
  }, []);
  
  const handleInputChange = (registrantId, field, value) => {
    setEditStates(prev => ({
      ...prev,
      [registrantId]: { ...prev[registrantId], [field]: value }
    }));
  };

  const handleUpdateRegistrant = async (registrantId) => {
    const dataToUpdate = editStates[registrantId];
    const reg = registrations.find(r => r.id === registrantId);
    
    try {
      // อัพเดตทั้งสอง collection ถ้ามีข้อมูลในทั้งคู่
      if (reg?.profileId) {
        await updateDoc(doc(db, 'studentProfiles', reg.profileId), dataToUpdate);
      }
      if (reg?.registrationId && reg.registrationId !== reg.profileId) {
        await updateDoc(doc(db, 'registrations', reg.registrationId), dataToUpdate);
      }

      setMessage('✅ อัปเดตข้อมูลสำเร็จ');
      setEditingId(null);
      setTimeout(() => setMessage(''), 3000);
    } catch (error)      {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const handleDeleteRegistrant = async (registrantId) => {
     const reg = registrations.find(r => r.id === registrantId);
     
     if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้? ${reg?.hasProfile && reg?.hasRegistration ? '(จะลบทั้ง Profile และ Registration)' : ''}`)) {
        try {
            // ลบทั้งสอง collection ถ้ามี
            if (reg?.profileId) {
              await deleteDoc(doc(db, 'studentProfiles', reg.profileId));
            }
            if (reg?.registrationId && reg.registrationId !== reg.profileId) {
              await deleteDoc(doc(db, 'registrations', reg.registrationId));
            }
            
            setMessage('✅ ลบข้อมูลสำเร็จ');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setMessage(`❌ เกิดข้อผิดพลาดในการลบ: ${error.message}`);
        }
     }
  };
  
  const handleCancelEdit = (registrantId) => {
     const originalData = registrations.find(r => r.id === registrantId);
     setEditStates(prev => ({
         ...prev,
         [registrantId]: {
            fullName: originalData.fullName || '',
            studentId: originalData.studentId || '',
            nationalId: originalData.nationalId || '',
            lineUserId: originalData.lineUserId || ''
         }
     }));
     setEditingId(null);
  };

  const filteredRegistrations = registrations.filter(reg => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      (reg.fullName && reg.fullName.toLowerCase().includes(searchTermLower)) ||
      (reg.studentId && reg.studentId.includes(searchTerm)) ||
      (reg.nationalId && reg.nationalId.includes(searchTerm)) ||
      (reg.lineUserId && reg.lineUserId.toLowerCase().includes(searchTermLower))
    );
  });

  // คำนวณข้อมูลสำหรับ pagination
  const totalPages = Math.ceil(filteredRegistrations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredRegistrations.slice(startIndex, endIndex);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (isLoading) {
    return <div className="text-center p-10 font-sans">กำลังโหลดข้อมูลผู้ลงทะเบียน...</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-8">
      <main className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-800">ข้อมูลนักเรียนทั้งหมด</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">ทั้งหมด {filteredRegistrations.length} รายการ</span>
            <input
              type="text"
              placeholder="ค้นหา (ชื่อ, รหัส, Line ID)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-80 p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        
        {message && <p className="text-center mb-4 font-semibold text-blue-700">{message}</p>}

        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">ชื่อ-สกุล</th>
                <th className="p-3">รหัสนักศึกษา</th>
                <th className="p-3">เลขบัตรประชาชน</th>
                <th className="p-3">สถานะ Line</th>
                <th className="p-3">แหล่งข้อมูล</th>
                <th className="p-3">วันที่ลงทะเบียนล่าสุด</th>
                <th className="p-3">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.map((reg, index) => {
                const isEditing = editingId === reg.id;
                const globalIndex = startIndex + index + 1; // เลขลำดับที่แท้จริง
                return(
                <tr key={reg.id} className={`border-b ${isEditing ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                  <td className="p-3">{globalIndex}</td>
                  <td className="p-3 font-medium">
                    {isEditing ? (
                        <input type="text" value={editStates[reg.id]?.fullName} onChange={e => handleInputChange(reg.id, 'fullName', e.target.value)} className="p-1 border rounded w-full"/>
                    ) : (
                        reg.fullName || '-'
                    )}
                  </td>
                  <td className="p-3">
                     {isEditing ? (
                        <input type="text" value={editStates[reg.id]?.studentId} onChange={e => handleInputChange(reg.id, 'studentId', e.target.value)} className="p-1 border rounded w-full"/>
                    ) : (
                        reg.studentId || '-'
                    )}
                  </td>
                  <td className="p-3">
                     {isEditing ? (
                        <input type="text" value={editStates[reg.id]?.nationalId} onChange={e => handleInputChange(reg.id, 'nationalId', e.target.value)} className="p-1 border rounded w-full"/>
                    ) : (
                        reg.nationalId || '-'
                    )}
                  </td>
                  <td className="p-3 text-gray-600">
                     {isEditing ? (
                        <input type="text" value={editStates[reg.id]?.lineUserId} onChange={e => handleInputChange(reg.id, 'lineUserId', e.target.value)} className="p-1 border rounded w-full"/>
                    ) : (
                        reg.lineUserId ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                เชื่อมต่อ Line แล้ว
                            </span>
                        ) : (
                            <span>-</span>
                        )
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {reg.hasProfile && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          Profile
                        </span>
                      )}
                      {reg.hasRegistration && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          Registration
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-gray-500">
                    {reg.createdAt ? new Date(reg.createdAt.seconds * 1000).toLocaleString('th-TH', {
                        year: 'numeric', month: 'short', day: 'numeric',
                    }) : '-'}
                  </td>
                  <td className="p-3">
                    {isEditing ? (
                        <div className="flex gap-2">
                            <button onClick={() => handleUpdateRegistrant(reg.id)} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">บันทึก</button>
                            <button onClick={() => handleCancelEdit(reg.id)} className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600">ยกเลิก</button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                             <button onClick={() => setEditingId(reg.id)} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">แก้ไข</button>
                             <button onClick={() => handleDeleteRegistrant(reg.id)} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">ลบ</button>
                        </div>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          {filteredRegistrations.length === 0 && (
            <p className="text-center p-6 text-gray-500">
              {searchTerm ? 'ไม่พบข้อมูลที่ตรงกับการค้นหา' : 'ยังไม่มีข้อมูลผู้ลงทะเบียน'}
            </p>
          )}
        </div>

        {/* Pagination Controls */}
        {filteredRegistrations.length > 0 && (
          <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600">
              แสดง {startIndex + 1} - {Math.min(endIndex, filteredRegistrations.length)} จาก {filteredRegistrations.length} รายการ
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← ก่อนหน้า
              </button>
              
              <div className="flex gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  // แสดงหน้าปัจจุบัน และหน้าใกล้เคียง ±2
                  if (
                    pageNum === 1 || 
                    pageNum === totalPages || 
                    (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-md ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (pageNum === currentPage - 3 || pageNum === currentPage + 3) {
                    return <span key={pageNum} className="px-2 py-2">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ถัดไป →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}