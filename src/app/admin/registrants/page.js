'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where, writeBatch, onSnapshot, addDoc } from 'firebase/firestore';
import Papa from 'papaparse';

export default function AllRegistrantsPage() {
  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editStates, setEditStates] = useState({});
  const [editingId, setEditingId] = useState(null); // ID ของแถวที่กำลังแก้ไข
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const fileInputRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(new Set()); // เก็บ ID ที่เลือก
  const [selectAll, setSelectAll] = useState(false); // สถานะเลือกทั้งหมด

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
    } catch (error) {
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

        // อัพเดท state ทันทีโดยไม่ต้องรอ realtime update
        setRegistrations(prev => prev.filter(r => r.id !== registrantId));
        setSelectedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(registrantId);
          return newSet;
        });

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
    setSelectedIds(new Set()); // ล้างการเลือกเมื่อค้นหาใหม่
    setSelectAll(false);
  }, [searchTerm]);

  // จัดการการเลือก checkbox แต่ละรายการ
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

  // จัดการการเลือกทั้งหมดในหน้าปัจจุบัน
  const handleSelectAll = () => {
    if (selectAll) {
      // ยกเลิกการเลือกทั้งหมด
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      // เลือกทั้งหมดในหน้าปัจจุบัน
      const currentPageIds = new Set(currentPageData.map(reg => reg.id));
      setSelectedIds(currentPageIds);
      setSelectAll(true);
    }
  };

  // จัดการการลบหลายรายการ
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      setMessage('⚠️ กรุณาเลือกรายการที่ต้องการลบ');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูล ${selectedIds.size} รายการ?`)) {
      try {
        setIsLoading(true);
        const batch = writeBatch(db);
        let deleteCount = 0;
        const deletedIds = new Set();

        for (const id of selectedIds) {
          const reg = registrations.find(r => r.id === id);
          if (reg) {
            // ลบจาก studentProfiles
            if (reg.profileId) {
              batch.delete(doc(db, 'studentProfiles', reg.profileId));
              deleteCount++;
              deletedIds.add(id);
            }
            // ลบจาก registrations (ถ้าแยกกัน)
            if (reg.registrationId && reg.registrationId !== reg.profileId) {
              batch.delete(doc(db, 'registrations', reg.registrationId));
            }
          }
        }

        await batch.commit();

        // อัพเดท state ทันทีโดยไม่ต้องรอ realtime update
        setRegistrations(prev => prev.filter(r => !deletedIds.has(r.id)));
        setSelectedIds(new Set());
        setSelectAll(false);
        setIsLoading(false);
        setMessage(`✅ ลบข้อมูลสำเร็จ ${deleteCount} รายการ`);
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        setIsLoading(false);
        setMessage(`❌ เกิดข้อผิดพลาดในการลบ: ${error.message}`);
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };

  // ฟังก์ชัน Export CSV
  const handleExportCSV = () => {
    try {
      // เตรียมข้อมูลสำหรับ export
      const csvData = filteredRegistrations.map((reg, index) => ({
        'ลำดับ': index + 1,
        'ชื่อ-สกุล': reg.fullName || '',
        'รหัสนักศึกษา': reg.studentId || '',
        'เลขบัตรประชาชน': reg.nationalId || '',
        'Line User ID': reg.lineUserId || '',
        'สถานะ Line': reg.lineUserId ? 'เชื่อมต่อแล้ว' : 'ยังไม่เชื่อมต่อ',
        'แหล่งข้อมูล': `${reg.hasProfile ? 'Profile' : ''}${reg.hasProfile && reg.hasRegistration ? ', ' : ''}${reg.hasRegistration ? 'Registration' : ''}`,
        'วันที่ลงทะเบียน': reg.createdAt
          ? new Date(reg.createdAt.seconds * 1000).toLocaleString('th-TH', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
          : ''
      }));

      // แปลงเป็น CSV โดยใช้ PapaParse (รองรับภาษาไทย)
      const csv = Papa.unparse(csvData, {
        quotes: true, // ใส่ quotes รอบๆ field เพื่อความปลอดภัย
        delimiter: ",",
        header: true,
        encoding: "utf-8"
      });

      // สร้าง Blob พร้อม BOM สำหรับภาษาไทย
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });

      // สร้าง download link
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().slice(0, 10);

      link.setAttribute('href', url);
      link.setAttribute('download', `registrants_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage('✅ ส่งออกข้อมูล CSV สำเร็จ');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาดในการส่งออก: ${error.message}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // ฟังก์ชัน Import CSV
  const handleImportCSV = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      encoding: 'UTF-8',
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          setIsLoading(true);
          const batch = writeBatch(db);
          let importCount = 0;
          let errorCount = 0;
          const errors = [];

          for (const row of results.data) {
            try {
              // ตรวจสอบข้อมูลที่จำเป็น
              const fullName = row['ชื่อ-สกุล']?.trim();
              const nationalId = row['เลขบัตรประชาชน']?.trim();

              if (!fullName || !nationalId) {
                errorCount++;
                errors.push(`แถว ${importCount + errorCount + 1}: ขาดข้อมูลที่จำเป็น (ชื่อ-สกุล หรือ เลขบัตรประชาชน)`);
                continue;
              }

              // ตรวจสอบว่ามีข้อมูลนี้อยู่แล้วหรือไม่
              const existingQuery = query(
                collection(db, 'studentProfiles'),
                where('nationalId', '==', nationalId)
              );
              const existingDocs = await getDocs(existingQuery);

              const studentData = {
                fullName: fullName,
                studentId: row['รหัสนักศึกษา']?.trim() || '',
                nationalId: nationalId,
                lineUserId: row['Line User ID']?.trim() || '',
                createdAt: new Date(),
                updatedAt: new Date(),
                importedFrom: 'CSV'
              };

              if (existingDocs.empty) {
                // เพิ่มข้อมูลใหม่
                const docRef = doc(collection(db, 'studentProfiles'));
                batch.set(docRef, studentData);
                importCount++;
              } else {
                // อัพเดตข้อมูลที่มีอยู่
                const existingDoc = existingDocs.docs[0];
                batch.update(doc(db, 'studentProfiles', existingDoc.id), {
                  ...studentData,
                  updatedAt: new Date()
                });
                importCount++;
              }
            } catch (rowError) {
              errorCount++;
              errors.push(`แถว ${importCount + errorCount + 1}: ${rowError.message}`);
            }
          }

          if (importCount > 0) {
            await batch.commit();
          }

          setIsLoading(false);

          let resultMessage = `✅ นำเข้าข้อมูลสำเร็จ ${importCount} รายการ`;
          if (errorCount > 0) {
            resultMessage += ` | ข้อผิดพลาด ${errorCount} รายการ`;
            console.error('Import errors:', errors);
          }

          setMessage(resultMessage);
          setTimeout(() => setMessage(''), 5000);

          // รีเซ็ต file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (error) {
          setIsLoading(false);
          setMessage(`❌ เกิดข้อผิดพลาดในการนำเข้า: ${error.message}`);
          setTimeout(() => setMessage(''), 3000);
        }
      },
      error: (error) => {
        setIsLoading(false);
        setMessage(`❌ เกิดข้อผิดพลาดในการอ่านไฟล์: ${error.message}`);
        setTimeout(() => setMessage(''), 3000);
      }
    });
  };

  // ฟังก์ชันดาวน์โหลดเทมเพลต CSV
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'ชื่อ-สกุล': 'สมชาย ใจดี',
        'รหัสนักศึกษา': '6501234567',
        'เลขบัตรประชาชน': '1234567890123',
        'Line User ID': ''
      },
      {
        'ชื่อ-สกุล': 'สมหญิง สวยงาม',
        'รหัสนักศึกษา': '6507654321',
        'เลขบัตรประชาชน': '9876543210987',
        'Line User ID': ''
      }
    ];

    const csv = Papa.unparse(templateData, {
      quotes: true,
      delimiter: ",",
      header: true,
      encoding: "utf-8"
    });

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'template_registrants.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setMessage('✅ ดาวน์โหลดเทมเพลตสำเร็จ');
    setTimeout(() => setMessage(''), 3000);
  };

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

        {/* Import/Export Buttons */}
        <div className="mb-4 flex flex-wrap gap-3 items-center">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            ส่งออก CSV
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            นำเข้า CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />

          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            ดาวน์โหลดเทมเพลต
          </button>

          {/* ปุ่มลบหลายรายการ */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-600">เลือก {selectedIds.size} รายการ</span>
              <button
                onClick={handleDeleteSelected}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                ลบที่เลือก ({selectedIds.size})
              </button>
            </div>
          )}
        </div>

        {message && <p className="text-center mb-4 font-semibold text-blue-700">{message}</p>}

        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">
                  <input
                    type="checkbox"
                    checked={selectAll && currentPageData.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 cursor-pointer"
                    title="เลือก/ยกเลิกทั้งหมดในหน้านี้"
                  />
                </th>
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
                const isSelected = selectedIds.has(reg.id);
                return (
                  <tr key={reg.id} className={`border-b ${isEditing ? 'bg-yellow-50' : isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectOne(reg.id)}
                        className="w-4 h-4 cursor-pointer"
                        disabled={isEditing}
                      />
                    </td>
                    <td className="p-3">{globalIndex}</td>
                    <td className="p-3 font-medium">
                      {isEditing ? (
                        <input type="text" value={editStates[reg.id]?.fullName} onChange={e => handleInputChange(reg.id, 'fullName', e.target.value)} className="p-1 border rounded w-full" />
                      ) : (
                        reg.fullName || '-'
                      )}
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <input type="text" value={editStates[reg.id]?.studentId} onChange={e => handleInputChange(reg.id, 'studentId', e.target.value)} className="p-1 border rounded w-full" />
                      ) : (
                        reg.studentId || '-'
                      )}
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <input type="text" value={editStates[reg.id]?.nationalId} onChange={e => handleInputChange(reg.id, 'nationalId', e.target.value)} className="p-1 border rounded w-full" />
                      ) : (
                        reg.nationalId || '-'
                      )}
                    </td>
                    <td className="p-3 text-gray-600">
                      {isEditing ? (
                        <input type="text" value={editStates[reg.id]?.lineUserId} onChange={e => handleInputChange(reg.id, 'lineUserId', e.target.value)} className="p-1 border rounded w-full" />
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
                )
              })}
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
                        className={`px-3 py-2 rounded-md ${currentPage === pageNum
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
