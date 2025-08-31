'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where, writeBatch } from 'firebase/firestore';

export default function AllRegistrantsPage() {
  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editStates, setEditStates] = useState({});
  const [editingId, setEditingId] = useState(null); // ID ของแถวที่กำลังแก้ไข
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    try {
      const registrationsSnapshot = await getDocs(query(collection(db, 'registrations'), orderBy('registeredAt', 'desc')));
      
      const registrantsData = [];
      const seenNationalIds = new Set();
      
      registrationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.nationalId && !seenNationalIds.has(data.nationalId)) {
          registrantsData.push({ id: doc.id, ...data });
          seenNationalIds.add(data.nationalId);
        } else if (!data.nationalId) {
            registrantsData.push({ id: doc.id, ...data });
        }
      });
      
      setRegistrations(registrantsData);

      const initialEdits = {};
      registrantsData.forEach(r => {
        initialEdits[r.id] = { 
          fullName: r.fullName || '',
          studentId: r.studentId || '',
          nationalId: r.nationalId || '',
          lineUserId: r.lineUserId || '',
        };
      });
      setEditStates(initialEdits);

    } catch (error) {
      console.error("Error fetching data: ", error);
      setMessage("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  const handleInputChange = (registrantId, field, value) => {
    setEditStates(prev => ({
      ...prev,
      [registrantId]: { ...prev[registrantId], [field]: value }
    }));
  };

  const handleUpdateRegistrant = async (registrantId) => {
    const dataToUpdate = editStates[registrantId];
    try {
      const registrantDocRef = doc(db, 'registrations', registrantId);
      await updateDoc(registrantDocRef, dataToUpdate);

      setMessage('✅ อัปเดตข้อมูลสำเร็จ');
      setEditingId(null);
      fetchData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error)      {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const handleDeleteRegistrant = async (nationalIdToDelete) => {
     if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลและทุกการลงทะเบียนของบุคคลนี้?`)) {
        try {
            const q = query(collection(db, 'registrations'), where("nationalId", "==", nationalIdToDelete));
            const snapshot = await getDocs(q);
            
            const batch = writeBatch(db);
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            setMessage('✅ ลบข้อมูลทั้งหมดที่เกี่ยวข้องสำเร็จ');
            fetchData();
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

  if (isLoading) {
    return <div className="text-center p-10 font-sans">กำลังโหลดข้อมูลผู้ลงทะเบียน...</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-8">
      <main className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-800">ข้อมูลนักเรียนทั้งหมด</h1>
          <div className="w-full md:w-auto">
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
                <th className="p-3">วันที่ลงทะเบียนล่าสุด</th>
                <th className="p-3">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegistrations.map((reg, index) => {
                const isEditing = editingId === reg.id;
                return(
                <tr key={reg.id} className={`border-b ${isEditing ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                  <td className="p-3">{index + 1}</td>
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
                  <td className="p-3 text-gray-500">
                    {reg.registeredAt ? new Date(reg.registeredAt.seconds * 1000).toLocaleString('th-TH', {
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
                             <button onClick={() => handleDeleteRegistrant(reg.nationalId)} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">ลบ</button>
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
      </main>
    </div>
  );
}