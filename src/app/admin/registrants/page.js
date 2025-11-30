'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '../../../lib/firebase';
import { collection, doc, updateDoc, deleteDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import Papa from 'papaparse';

export default function AllRegistrantsPage() {
  const [registrations, setRegistrations] = useState([]);
  const [activitiesMap, setActivitiesMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editStates, setEditStates] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const fileInputRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    setIsLoading(true);

    let rawProfiles = [];
    let rawRegistrations = [];
    let rawActivities = {};

    const unsubActivities = onSnapshot(collection(db, 'activities'), (snap) => {
      const map = {};
      snap.forEach(d => map[d.id] = d.data().name);
      rawActivities = map;
      setActivitiesMap(map);
      mergeData();
    });

    const unsubProfiles = onSnapshot(collection(db, 'studentProfiles'), (snap) => {
      rawProfiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      mergeData();
    });

    const unsubRegistrations = onSnapshot(collection(db, 'registrations'), (snap) => {
      rawRegistrations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      mergeData();
    });

    const mergeData = () => {
      const mergedMap = new Map();

      // 1. Process Profiles
      rawProfiles.forEach(p => {
        if (p.nationalId) {
          mergedMap.set(p.nationalId, {
            ...p,
            hasProfile: true,
            profileId: p.id,
            registeredList: []
          });
        }
      });

      // 2. Process Registrations
      rawRegistrations.forEach(r => {
        if (r.nationalId) {
          let student = mergedMap.get(r.nationalId);
          if (!student) {
            // New student found in registrations (no profile yet)
            student = {
              id: r.id, // Temporary ID from registration
              nationalId: r.nationalId,
              fullName: r.fullName,
              studentId: r.studentId,
              lineUserId: r.lineUserId,
              hasProfile: false,
              registeredList: [],
              createdAt: r.registeredAt || r.createdAt
            };
            mergedMap.set(r.nationalId, student);
          }

          // Add to list
          student.registeredList.push({
            id: r.id,
            activityId: r.activityId,
            status: r.status,
            course: r.course,
            registeredAt: r.registeredAt
          });

          student.hasRegistration = true;
          // Update latest info if needed
          if (r.registeredAt && (!student.createdAt || r.registeredAt.seconds > student.createdAt.seconds)) {
            // Keep the latest timestamp for sorting
            student.latestInteraction = r.registeredAt;
          }
        }
      });

      // Convert to array and sort
      const sortedData = Array.from(mergedMap.values()).sort((a, b) => {
        const timeA = a.latestInteraction?.seconds || a.createdAt?.seconds || 0;
        const timeB = b.latestInteraction?.seconds || b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setRegistrations(sortedData);

      // Init edit states
      const initialEdits = {};
      sortedData.forEach(r => {
        initialEdits[r.id] = {
          fullName: r.fullName || '',
          studentId: r.studentId || '',
          nationalId: r.nationalId || '',
          lineUserId: r.lineUserId || '',
        };
      });
      setEditStates(initialEdits);
      setIsLoading(false);
    };

    return () => {
      unsubActivities();
      unsubProfiles();
      unsubRegistrations();
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
      const batch = writeBatch(db);

      // Update Profile
      if (reg?.profileId) {
        batch.update(doc(db, 'studentProfiles', reg.profileId), dataToUpdate);
      }

      // Update ALL registrations for this user to keep consistent
      if (reg.registeredList && reg.registeredList.length > 0) {
        reg.registeredList.forEach(r => {
          batch.update(doc(db, 'registrations', r.id), {
            fullName: dataToUpdate.fullName,
            studentId: dataToUpdate.studentId,
            nationalId: dataToUpdate.nationalId,
            lineUserId: dataToUpdate.lineUserId
          });
        });
      }

      await batch.commit();

      setMessage('✅ อัปเดตข้อมูลสำเร็จ');
      setEditingId(null);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const handleDeleteRegistrant = async (registrantId) => {
    const reg = registrations.find(r => r.id === registrantId);

    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลของ ${reg.fullName}? ข้อมูลการลงทะเบียนทั้งหมดจะถูกลบด้วย`)) {
      try {
        const batch = writeBatch(db);

        if (reg?.profileId) {
          batch.delete(doc(db, 'studentProfiles', reg.profileId));
        }

        if (reg.registeredList && reg.registeredList.length > 0) {
          reg.registeredList.forEach(r => {
            batch.delete(doc(db, 'registrations', r.id));
          });
        }

        await batch.commit();

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

  const totalPages = Math.ceil(filteredRegistrations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredRegistrations.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    setSelectAll(false);
  }, [searchTerm]);

  const handleSelectOne = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      const currentPageIds = new Set(currentPageData.map(reg => reg.id));
      setSelectedIds(currentPageIds);
      setSelectAll(true);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูล ${selectedIds.size} รายการ?`)) {
      try {
        setIsLoading(true);
        const batch = writeBatch(db);
        let deleteCount = 0;

        for (const id of selectedIds) {
          const reg = registrations.find(r => r.id === id);
          if (reg) {
            if (reg.profileId) {
              batch.delete(doc(db, 'studentProfiles', reg.profileId));
            }
            if (reg.registeredList) {
              reg.registeredList.forEach(r => {
                batch.delete(doc(db, 'registrations', r.id));
              });
            }
            deleteCount++;
          }
        }

        await batch.commit();
        setSelectedIds(new Set());
        setSelectAll(false);
        setIsLoading(false);
        setMessage(`✅ ลบข้อมูลสำเร็จ ${deleteCount} รายการ`);
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        setIsLoading(false);
        setMessage(`❌ เกิดข้อผิดพลาดในการลบ: ${error.message}`);
      }
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    try {
      const csvData = filteredRegistrations.map((reg, index) => ({
        'ลำดับ': index + 1,
        'ชื่อ-สกุล': reg.fullName || '',
        'รหัสนักศึกษา': reg.studentId || '',
        'เลขบัตรประชาชน': reg.nationalId || '',
        'Line User ID': reg.lineUserId || '',
        'กิจกรรมที่ลงทะเบียน': reg.registeredList?.map(r => activitiesMap[r.activityId] || 'Unknown').join(', ') || '-',
        'วันที่ลงทะเบียนล่าสุด': reg.latestInteraction
          ? new Date(reg.latestInteraction.seconds * 1000).toLocaleString('th-TH')
          : ''
      }));

      const csv = Papa.unparse(csvData, { quotes: true, delimiter: ",", header: true });
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `registrants_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setMessage('✅ ส่งออกข้อมูล CSV สำเร็จ');
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    }
  };

  // Import CSV (Simplified for brevity, same logic as before but ensures profile creation)
  const handleImportCSV = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          let count = 0;
          results.data.forEach(row => {
            if (row['ชื่อ-สกุล'] && row['เลขบัตรประชาชน']) {
              const ref = doc(collection(db, 'studentProfiles'));
              batch.set(ref, {
                fullName: row['ชื่อ-สกุล'],
                studentId: row['รหัสนักศึกษา'] || '',
                nationalId: row['เลขบัตรประชาชน'],
                lineUserId: row['Line User ID'] || '',
                createdAt: new Date(),
                importedFrom: 'CSV'
              });
              count++;
            }
          });
          await batch.commit();
          setMessage(`✅ นำเข้า ${count} รายการสำเร็จ`);
        } catch (e) {
          setMessage(`❌ Error: ${e.message}`);
        }
      }
    });
  };

  if (isLoading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-8 font-sans">
      <main className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">ฐานข้อมูลนักเรียน</h1>
            <p className="text-gray-500 mt-1">จัดการข้อมูลนักเรียนและประวัติการลงทะเบียนทั้งหมด</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="ค้นหาชื่อ, รหัส, หรือ Line ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <button onClick={handleExportCSV} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-2 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export CSV
          </button>
          <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2 text-sm font-medium cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>
          {selectedIds.size > 0 && (
            <button onClick={handleDeleteSelected} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm flex items-center gap-2 text-sm font-medium ml-auto">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              ลบ {selectedIds.size} รายการ
            </button>
          )}
        </div>

        {message && <div className={`mb-6 p-4 rounded-xl border ${message.includes('❌') ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'} flex items-center shadow-sm`}>{message}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-500 font-medium">
                <tr>
                  <th className="p-4 w-10">
                    <input type="checkbox" checked={selectAll && currentPageData.length > 0} onChange={handleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  </th>
                  <th className="p-4">#</th>
                  <th className="p-4 min-w-[200px]">ชื่อ-สกุล</th>
                  <th className="p-4 min-w-[120px]">รหัสนักศึกษา</th>
                  <th className="p-4 min-w-[150px]">เลขบัตรประชาชน</th>
                  <th className="p-4 min-w-[150px]">Line Status</th>
                  <th className="p-4 min-w-[250px]">ประวัติการลงทะเบียน</th>
                  <th className="p-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentPageData.map((reg, index) => {
                  const isEditing = editingId === reg.id;
                  const globalIndex = startIndex + index + 1;
                  return (
                    <tr key={reg.id} className={`group transition-colors ${isEditing ? 'bg-amber-50' : 'hover:bg-gray-50/50'}`}>
                      <td className="p-4">
                        <input type="checkbox" checked={selectedIds.has(reg.id)} onChange={() => handleSelectOne(reg.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      </td>
                      <td className="p-4 text-gray-500">{globalIndex}</td>
                      <td className="p-4 font-medium text-gray-900">
                        {isEditing ? <input type="text" value={editStates[reg.id]?.fullName} onChange={e => handleInputChange(reg.id, 'fullName', e.target.value)} className="w-full p-1.5 border rounded-lg text-sm" /> : reg.fullName}
                      </td>
                      <td className="p-4 text-gray-600">
                        {isEditing ? <input type="text" value={editStates[reg.id]?.studentId} onChange={e => handleInputChange(reg.id, 'studentId', e.target.value)} className="w-full p-1.5 border rounded-lg text-sm" /> : reg.studentId || '-'}
                      </td>
                      <td className="p-4 text-gray-600 font-mono text-xs">
                        {isEditing ? <input type="text" value={editStates[reg.id]?.nationalId} onChange={e => handleInputChange(reg.id, 'nationalId', e.target.value)} className="w-full p-1.5 border rounded-lg text-sm" /> : reg.nationalId}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <input type="text" value={editStates[reg.id]?.lineUserId} onChange={e => handleInputChange(reg.id, 'lineUserId', e.target.value)} className="w-full p-1.5 border rounded-lg text-sm" placeholder="Line User ID" />
                        ) : (
                          reg.lineUserId ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              Connected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                              Not Connected
                            </span>
                          )
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2 max-w-[300px]">
                          {reg.registeredList && reg.registeredList.length > 0 ? (
                            <>
                              {reg.registeredList.slice(0, 2).map((r, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs border border-blue-100 truncate max-w-[140px]" title={activitiesMap[r.activityId] || 'Unknown Activity'}>
                                  {activitiesMap[r.activityId] || 'Unknown Activity'}
                                </span>
                              ))}
                              {reg.registeredList.length > 2 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs border border-gray-200 cursor-help" title={reg.registeredList.slice(2).map(r => activitiesMap[r.activityId] || 'Unknown').join(', ')}>
                                  +{reg.registeredList.length - 2} more
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs italic">ยังไม่มีประวัติ</span>
                          )}
                        </div>
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
            {filteredRegistrations.length === 0 && <div className="p-12 text-center text-gray-400">ไม่พบข้อมูลนักเรียน</div>}
          </div>
        </div>

        {/* Pagination (Simplified) */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 rounded border disabled:opacity-50">Prev</button>
            <span className="px-3 py-1 text-gray-600">Page {currentPage} of {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 rounded border disabled:opacity-50">Next</button>
          </div>
        )}
      </main>
    </div>
  );
}