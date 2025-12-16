'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '../../../lib/firebase';
import { collection, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, orderBy, limit, where, startAfter } from 'firebase/firestore';
import Papa from 'papaparse';

export default function AllRegistrantsPage() {
  const [registrations, setRegistrations] = useState([]);
  const [activitiesMap, setActivitiesMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editStates, setEditStates] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastVisible, setLastVisible] = useState(null);

  // โหลดรายชื่อกิจกรรมมาเก็บไว้ก่อน (Activities มักจะไม่เยอะมาก)
  useEffect(() => {
    const fetchActivities = async () => {
      const snap = await getDocs(collection(db, 'activities'));
      const map = {};
      snap.forEach(d => map[d.id] = d.data().name);
      setActivitiesMap(map);
    };
    fetchActivities();
  }, []);

  const fetchRegistrations = async (isSearch = false) => {
    setIsLoading(true);
    try {
      let q;
      const regsRef = collection(db, 'registrations');

      if (searchTerm.trim()) {
        // [โหมดค้นหา] ค้นหาจาก nationalId หรือ studentId (ต้องตรงเป๊ะเพราะ Firestore Search มีข้อจำกัด)
        // หมายเหตุ: เพื่อความง่ายและประหยัด เราจะค้นหาด้วย nationalId เป็นหลัก
        q = query(regsRef, where('nationalId', '==', searchTerm.trim()));
      } else {
        // [โหมดปกติ] โหลด 50 รายการล่าสุด
        q = query(regsRef, orderBy('registeredAt', 'desc'), limit(50));
      }

      const snapshot = await getDocs(q);
      
      // แปลงข้อมูล
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // แปลง timestamp เป็น object เพื่อการ sort/display
        registeredAtDate: doc.data().registeredAt ? doc.data().registeredAt.toDate() : null
      }));

      // ถ้าเป็นการค้นหาด้วยชื่อ (Client-side filter workaround)
      // *หมายเหตุ: ถ้าต้องการค้นหาชื่อบางส่วน (Partial Search) จริงๆ ต้องใช้ Algolia/Meilisearch 
      // แต่ในที่นี้เราใช้การโหลดล่าสุดมาแสดงแทน
      
      setRegistrations(data);
      
      // Prepare edit states
      const initialEdits = {};
      data.forEach(r => {
        initialEdits[r.id] = {
          fullName: r.fullName || '',
          studentId: r.studentId || '',
          nationalId: r.nationalId || '',
          lineUserId: r.lineUserId || '',
        };
      });
      setEditStates(initialEdits);

    } catch (error) {
      console.error(error);
      setMessage(`❌ ไม่สามารถโหลดข้อมูลได้: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // โหลดข้อมูลเมื่อเปิดหน้า หรือกดค้นหา
  useEffect(() => {
    // Debounce search เล็กน้อย
    const timeoutId = setTimeout(() => {
        fetchRegistrations(!!searchTerm);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleInputChange = (registrantId, field, value) => {
    setEditStates(prev => ({
      ...prev,
      [registrantId]: { ...prev[registrantId], [field]: value }
    }));
  };

  const handleUpdateRegistrant = async (registrantId) => {
    const dataToUpdate = editStates[registrantId];
    try {
      const batch = writeBatch(db);
      
      // อัปเดตใน registrations
      batch.update(doc(db, 'registrations', registrantId), {
        fullName: dataToUpdate.fullName,
        studentId: dataToUpdate.studentId,
        nationalId: dataToUpdate.nationalId,
        lineUserId: dataToUpdate.lineUserId
      });

      // พยายามอัปเดตใน studentProfiles ด้วย (ค้นหาจาก nationalId เดิม)
      const oldData = registrations.find(r => r.id === registrantId);
      if (oldData && oldData.nationalId) {
        const profileQ = query(collection(db, 'studentProfiles'), where('nationalId', '==', oldData.nationalId), limit(1));
        const profileSnap = await getDocs(profileQ);
        if (!profileSnap.empty) {
             batch.update(doc(db, 'studentProfiles', profileSnap.docs[0].id), dataToUpdate);
        }
      }

      await batch.commit();
      setMessage('✅ อัปเดตข้อมูลสำเร็จ');
      setEditingId(null);
      fetchRegistrations(); // โหลดข้อมูลใหม่
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const handleDeleteRegistrant = async (registrantId) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?`)) {
      try {
        await deleteDoc(doc(db, 'registrations', registrantId));
        setMessage('✅ ลบข้อมูลสำเร็จ');
        fetchRegistrations();
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        setMessage(`❌ เกิดข้อผิดพลาดในการลบ: ${error.message}`);
      }
    }
  };

  const handleCancelEdit = (registrantId) => {
    setEditingId(null);
  };

  // CSV Functions (Simplified for quota safety)
  const handleExportCSV = async () => {
    // Export เฉพาะที่เห็น หรือต้องระวังถ้าระบบใหญ่มาก
    // ในที่นี้ Export ข้อมูลที่โหลดมาปัจจุบัน
    try {
      const csvData = registrations.map((reg, index) => ({
        'ลำดับ': index + 1,
        'ชื่อ-สกุล': reg.fullName || '',
        'รหัสนักศึกษา': reg.studentId || '',
        'เลขบัตรประชาชน': reg.nationalId || '',
        'Line User ID': reg.lineUserId || '',
        'กิจกรรม': activitiesMap[reg.activityId] || 'Unknown',
        'สถานะ': reg.status || '-',
        'วันที่ลงทะเบียน': reg.registeredAtDate ? reg.registeredAtDate.toLocaleString('th-TH') : ''
      }));

      const csv = Papa.unparse(csvData, { quotes: true, delimiter: ",", header: true });
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `registrants_export.csv`;
      link.click();
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    }
  };

  const handleImportCSV = (event) => {
      // (คงไว้ตามเดิม หรือปรับปรุงตามความเหมาะสม)
      alert("ฟีเจอร์ Import ปิดชั่วคราวเพื่อประหยัด Quota ในการตรวจสอบซ้ำซ้อนจำนวนมาก");
  };
  
  const handleSelectOne = (id) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.has(id) ? newSet.delete(id) : newSet.add(id);
        return newSet;
    });
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-8 font-sans">
      <main className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">ฐานข้อมูลการลงทะเบียน (ล่าสุด)</h1>
            <p className="text-gray-500 mt-1">แสดง 50 รายการล่าสุด หรือค้นหาด้วยเลขบัตรประชาชน</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="🔍 ค้นหาด้วยเลขบัตรประชาชน..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <button onClick={handleExportCSV} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-2 text-sm font-medium">
            Export CSV (หน้านี้)
          </button>
           <button onClick={() => fetchRegistrations(!!searchTerm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2 text-sm font-medium">
            รีเฟรชข้อมูล
          </button>
        </div>

        {message && <div className={`mb-6 p-4 rounded-xl border ${message.includes('❌') ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'} flex items-center shadow-sm`}>{message}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-500 font-medium">
                <tr>
                  <th className="p-4 w-10">#</th>
                  <th className="p-4 min-w-[200px]">ชื่อ-สกุล</th>
                  <th className="p-4 min-w-[120px]">รหัสนักศึกษา</th>
                  <th className="p-4 min-w-[150px]">เลขบัตรประชาชน</th>
                  <th className="p-4 min-w-[150px]">กิจกรรม</th>
                  <th className="p-4 min-w-[150px]">สถานะ</th>
                  <th className="p-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                    <tr><td colSpan="7" className="p-10 text-center">กำลังโหลดข้อมูล...</td></tr>
                ) : registrations.map((reg, index) => {
                  const isEditing = editingId === reg.id;
                  return (
                    <tr key={reg.id} className={`group transition-colors ${isEditing ? 'bg-amber-50' : 'hover:bg-gray-50/50'}`}>
                      <td className="p-4">
                        <input type="checkbox" checked={selectedIds.has(reg.id)} onChange={() => handleSelectOne(reg.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      </td>
                      <td className="p-4 font-medium text-gray-900">
                        {isEditing ? <input type="text" value={editStates[reg.id]?.fullName} onChange={e => handleInputChange(reg.id, 'fullName', e.target.value)} className="w-full p-1.5 border rounded-lg text-sm" /> : reg.fullName}
                      </td>
                      <td className="p-4 text-gray-600">
                        {isEditing ? <input type="text" value={editStates[reg.id]?.studentId} onChange={e => handleInputChange(reg.id, 'studentId', e.target.value)} className="w-full p-1.5 border rounded-lg text-sm" /> : reg.studentId || '-'}
                      </td>
                      <td className="p-4 text-gray-600 font-mono text-xs">
                        {isEditing ? <input type="text" value={editStates[reg.id]?.nationalId} onChange={e => handleInputChange(reg.id, 'nationalId', e.target.value)} className="w-full p-1.5 border rounded-lg text-sm" /> : reg.nationalId}
                      </td>
                      <td className="p-4 text-gray-600">
                         <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs border border-blue-100 truncate max-w-[140px]">
                            {activitiesMap[reg.activityId] || 'Unknown'}
                         </span>
                      </td>
                      <td className="p-4 text-gray-600">
                         {reg.status}
                      </td>
                      <td className="p-4 text-center">
                        {isEditing ? (
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleUpdateRegistrant(reg.id)} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                            <button onClick={() => handleCancelEdit(reg.id)} className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                          </div>
                        ) : (
                          <div className="flex justify-center gap-2">
                            <button onClick={() => setEditingId(reg.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                            <button onClick={() => handleDeleteRegistrant(reg.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!isLoading && registrations.length === 0 && <div className="p-12 text-center text-gray-400">ไม่พบข้อมูล</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
