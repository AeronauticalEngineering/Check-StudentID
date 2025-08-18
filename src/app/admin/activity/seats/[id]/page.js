'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { db } from '../../../../../lib/firebase';
import {
  doc, getDoc, updateDoc, collection, query,
  where, getDocs, writeBatch, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import { CSVLink } from "react-csv";
import Papa from "papaparse";

// Helper function to translate status to Thai
const translateStatus = (status) => {
  switch (status) {
    case 'checked-in': return 'เช็คอินแล้ว';
    case 'registered': return 'ลงทะเบียนแล้ว';
    default: return status || '';
  }
};

// Helper function to translate Thai status back to English for database
const translateStatusToEn = (status) => {
  switch (status) {
    case 'เช็คอินแล้ว': return 'checked-in';
    case 'ลงทะเบียนแล้ว': return 'registered';
    default: return status || 'registered';
  }
};

export default function SeatAssignmentPage({ params }) {
  const { id: activityId } = use(params);

  const [activity, setActivity] = useState(null);
  const [registrants, setRegistrants] = useState([]);
  const [seatInputs, setSeatInputs] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [savingStates, setSavingStates] = useState({});
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [editingRegistrant, setEditingRegistrant] = useState(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    studentId: '',
    nationalId: ''
  });

  // Function to fetch the latest data for the page
  const fetchData = useCallback(async () => {
    try {
      const activityDoc = await getDoc(doc(db, 'activities', activityId));
      if (activityDoc.exists()) {
        setActivity({ id: activityDoc.id, ...activityDoc.data() });
      }

      const q = query(collection(db, 'registrations'), where('activityId', '==', activityId));
      const snapshot = await getDocs(q);
      const registrantsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      registrantsData.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      setRegistrants(registrantsData);

      const initialInputs = {};
      registrantsData.forEach(r => {
        initialInputs[r.id] = r.seatNumber || '';
      });
      setSeatInputs(initialInputs);

    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [activityId, fetchData]);

  // Handle CSV file upload and parsing
  const handleFileUpload = (e) => {
    if (!e.target.files.length) return;
    const file = e.target.files[0];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log('CSV parsed data:', results.data); // Debug log
        
        // ตรวจสอบ headers ที่มีในไฟล์
        const headers = results.meta.fields || [];
        console.log('CSV headers:', headers); // Debug log
        
        // ตรวจสอบฟิลด์ที่จำเป็น (รองรับทั้งภาษาไทยและอังกฤษ)
        const hasFullName = headers.includes('fullName') || headers.includes('ชื่อ-สกุล');
        const hasNationalId = headers.includes('nationalId') || headers.includes('เลขบัตรประชาชน');
        
        if (!hasFullName || !hasNationalId) {
          const missingFields = [];
          if (!hasFullName) missingFields.push('ชื่อ-สกุล (fullName)');
          if (!hasNationalId) missingFields.push('เลขบัตรประชาชน (nationalId)');
          setMessage(`ไฟล์ CSV ขาดคอลัมน์ที่จำเป็น: ${missingFields.join(', ')}`);
          return;
        }
        
        // กรองข้อมูลที่มีฟิลด์จำเป็น (รองรับทั้งภาษาไทยและอังกฤษ)
        const validData = results.data.filter(row => {
          const fullName = row['ชื่อ-สกุล'] || row.fullName;
          const nationalId = row['เลขบัตรประชาชน'] || row.nationalId;
          return fullName && fullName.trim() !== '' && 
                 nationalId && nationalId.trim() !== '';
        });
        
        if (validData.length > 0) {
            setMessage(`พบข้อมูล ${validData.length} รายการที่ถูกต้อง`);
            handleConfirmImport(validData);
        } else {
            setMessage("ไม่พบข้อมูลที่ถูกต้อง กรุณาตรวจสอบว่ามีข้อมูลในคอลัมน์ 'ชื่อ-สกุล' และ 'เลขบัตรประชาชน'");
        }
      },
      error: (err) => setMessage(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`)
    });
    e.target.value = null;
  };

  // Handle the "upsert" logic for importing CSV data
  const handleConfirmImport = async (csvData) => {
    if (!window.confirm(`พบ ${csvData.length} รายการ จะทำการอัปเดตข้อมูลนักเรียนที่มีอยู่และเพิ่มนักเรียนใหม่ ดำเนินการต่อหรือไม่?`)) return;

    setIsBulkLoading(true);
    setMessage('กำลังนำเข้าข้อมูล...');
    try {
      const batch = writeBatch(db);
      let updatedCount = 0;
      let createdCount = 0;
      const currentRegistrantsMap = new Map(registrants.map(r => [r.nationalId, r]));

      for (const row of csvData) {
        // รองรับทั้งภาษาไทยและอังกฤษ
        const fullName = row['ชื่อ-สกุล'] || row.fullName;
        const nationalId = row['เลขบัตรประชาชน'] || row.nationalId;
        const studentId = row['รหัสนักศึกษา'] || row.studentId;
        const status = row['สถานะ'] || row.status;
        const seatNumber = row['เลขที่นั่ง'] || row.seatNumber;
        const lineUserId = row['LINE User ID'] || row.lineUserId;
        
        // ตรวจสอบข้อมูลที่จำเป็น
        if (!nationalId?.trim() || !fullName?.trim()) {
          console.warn('Skipping row due to missing required data:', row);
          continue;
        }
        
        const existingReg = currentRegistrantsMap.get(nationalId);
        if (existingReg) {
          const docRef = doc(db, 'registrations', existingReg.id);
          batch.update(docRef, { 
            fullName: fullName.trim(), 
            studentId: studentId?.trim() || '',
            status: translateStatusToEn(status) || existingReg.status,
            seatNumber: seatNumber?.trim() || null,
            lineUserId: lineUserId?.trim() || null
          });
          updatedCount++;
        } else {
          const newDocRef = doc(collection(db, 'registrations'));
          batch.set(newDocRef, {
            fullName: fullName.trim(), 
            studentId: studentId?.trim() || '', 
            nationalId: nationalId.trim(),
            activityId: activityId, 
            courseId: activity?.courseId || null,
            status: translateStatusToEn(status) || 'registered', 
            seatNumber: seatNumber?.trim() || null,
            registeredAt: serverTimestamp(), 
            registeredBy: 'admin-import', 
            lineUserId: lineUserId?.trim() || null,
          });
          createdCount++;
        }
      }
      await batch.commit();
      setMessage(`นำเข้าสำเร็จ! เพิ่ม ${createdCount} คน, อัปเดต ${updatedCount} คน`);
      fetchData();
    } catch (err) {
      console.error("เกิดข้อผิดพลาดในการนำเข้า:", err);
      setMessage(`นำเข้าล้มเหลว: ${err.message}`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  // Handle changes to individual seat input fields
  const handleSeatInputChange = (registrantId, value) => {
    setSeatInputs(prev => ({ ...prev, [registrantId]: value }));
  };

  // Save an individual seat number
  const handleAssignSeat = async (registrantId) => {
    setSavingStates(prev => ({ ...prev, [registrantId]: true }));
    const seatToAssign = seatInputs[registrantId]?.trim() || null;
    try {
      const registrantDocRef = doc(db, 'registrations', registrantId);
      await updateDoc(registrantDocRef, { seatNumber: seatToAssign });
      setRegistrants(prev => prev.map(r =>
        r.id === registrantId ? { ...r, seatNumber: seatToAssign } : r
      ));
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการกำหนดที่นั่ง:", error);
      alert('ไม่สามารถบันทึกเลขที่นั่งได้');
    } finally {
      setSavingStates(prev => ({ ...prev, [registrantId]: false }));
    }
  };

  // Delete an individual registrant
  const handleDeleteRegistrant = async (registrantId, registrantName) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "${registrantName}" ออกจากกิจกรรมนี้?`)) return;
    try {
        const docRef = doc(db, 'registrations', registrantId);
        await deleteDoc(docRef);
        setRegistrants(prev => prev.filter(r => r.id !== registrantId));
        setMessage(`ลบ ${registrantName} สำเร็จแล้ว`);
    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการลบ:", err);
        setMessage(`เกิดข้อผิดพลาดในการลบ: ${err.message}`);
    }
  };

  // Save all seat changes at once
  const handleSaveAllSeats = async () => {
    if (!window.confirm("คุณต้องการบันทึกการเปลี่ยนแปลงเลขที่นั่งทั้งหมดหรือไม่?")) return;
    setIsBulkLoading(true);
    setMessage('กำลังบันทึกที่นั่งทั้งหมด...');
    try {
      const batch = writeBatch(db);
      let changesCount = 0;
      registrants.forEach(reg => {
        const newSeat = seatInputs[reg.id]?.trim() || null;
        if (newSeat !== (reg.seatNumber || null)) {
          const docRef = doc(db, 'registrations', reg.id);
          batch.update(docRef, { seatNumber: newSeat });
          changesCount++;
        }
      });
      if (changesCount > 0) {
        await batch.commit();
        setMessage(`✅ บันทึกการเปลี่ยนแปลง ${changesCount} รายการสำเร็จ!`);
        fetchData();
      } else {
        setMessage("ไม่มีการเปลี่ยนแปลงเลขที่นั่ง");
      }
    } catch (err) {
      setMessage(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
    } finally {
      setIsBulkLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Delete all registrants for this activity
  const handleDeleteAll = async () => {
    const confirmationText = "ลบทั้งหมด";
    const promptMessage = `นี่เป็นการกระทำที่ไม่สามารถย้อนกลับได้! หากคุณแน่ใจว่าต้องการลบผู้ลงทะเบียนทั้งหมด ${registrants.length} คน, กรุณาพิมพ์ "${confirmationText}" เพื่อยืนยัน`;
    if (window.prompt(promptMessage) !== confirmationText) {
      alert("การยืนยันไม่ถูกต้อง การลบถูกยกเลิก");
      return;
    }
    setIsBulkLoading(true);
    setMessage('กำลังลบผู้ลงทะเบียนทั้งหมด...');
    try {
      const batch = writeBatch(db);
      registrants.forEach(reg => {
        batch.delete(doc(db, 'registrations', reg.id));
      });
      await batch.commit();
      setMessage(`✅ ลบผู้ลงทะเบียนทั้งหมด ${registrants.length} คนสำเร็จแล้ว`);
      setRegistrants([]);
    } catch (err) {
      setMessage(`เกิดข้อผิดพลาดในการลบ: ${err.message}`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  // Handle edit button click
  const handleEditClick = (registrant) => {
    setEditingRegistrant(registrant.id);
    setEditForm({
      fullName: registrant.fullName || '',
      studentId: registrant.studentId || '',
      nationalId: registrant.nationalId || ''
    });
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingRegistrant(null);
    setEditForm({ fullName: '', studentId: '', nationalId: '' });
  };

  // Handle form input changes
  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // Save edited registrant data
  const handleSaveEdit = async (registrantId) => {
    if (!editForm.fullName.trim() || !editForm.studentId.trim() || !editForm.nationalId.trim()) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setSavingStates(prev => ({ ...prev, [registrantId]: true }));
    try {
      const registrantDocRef = doc(db, 'registrations', registrantId);
      await updateDoc(registrantDocRef, {
        fullName: editForm.fullName.trim(),
        studentId: editForm.studentId.trim(),
        nationalId: editForm.nationalId.trim()
      });

      // Update local state
      setRegistrants(prev => prev.map(r =>
        r.id === registrantId 
          ? { 
              ...r, 
              fullName: editForm.fullName.trim(),
              studentId: editForm.studentId.trim(),
              nationalId: editForm.nationalId.trim()
            } 
          : r
      ));

      setEditingRegistrant(null);
      setEditForm({ fullName: '', studentId: '', nationalId: '' });
      setMessage('✅ แก้ไขข้อมูลสำเร็จแล้ว');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการแก้ไขข้อมูล:", error);
      setMessage(`เกิดข้อผิดพลาดในการแก้ไขข้อมูล: ${error.message}`);
    } finally {
      setSavingStates(prev => ({ ...prev, [registrantId]: false }));
    }
  };

  if (isLoading) return <div className="text-center p-10 font-sans">กำลังโหลดข้อมูลผู้เข้าร่วม...</div>;

  // Prepare data and headers for CSV export
  const headersForCsv = [
    { label: "ชื่อ-สกุล", key: "fullName" }, 
    { label: "รหัสนักศึกษา", key: "studentId" },
    { label: "เลขบัตรประชาชน", key: "nationalId" }, 
    { label: "สถานะ", key: "status" },
    { label: "เลขที่นั่ง", key: "seatNumber" }, 
    { label: "LINE User ID", key: "lineUserId" },
  ];

  const dataForCsv = registrants.map((reg) => ({
    fullName: reg.fullName || '',
    studentId: reg.studentId || '',
    nationalId: reg.nationalId || '',
    status: translateStatus(reg.status),
    seatNumber: reg.seatNumber || '',
    lineUserId: reg.lineUserId || '',
  }));

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-8 font-sans">
      <main className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">จัดการที่นั่งและรายชื่อ</h1>
            <p className="text-gray-600">{activity?.name}</p>
          </div>
          <Link href="/admin/activity" className="text-sm text-blue-600 hover:underline">&larr; กลับไปหน้าแดชบอร์ด</Link>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-2">
            <label htmlFor="csv-upload" className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg cursor-pointer hover:bg-purple-700">นำเข้า CSV</label>
            <input type="file" id="csv-upload" accept=".csv" onChange={handleFileUpload} className="hidden" />
            <CSVLink data={dataForCsv} headers={headersForCsv} filename={`export_${activity?.name.replace(/\s+/g, '_') || 'activity'}.csv`} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">ส่งออก CSV</CSVLink>
          </div>
          <p className="text-xs text-gray-500 text-center md:text-right">
            คอลัมน์ที่จำเป็น: <code>ชื่อ-สกุล</code>, <code>เลขบัตรประชาชน</code><br/>
            คอลัมน์เสริม: <code>รหัสนักศึกษา</code>, <code>สถานะ</code>, <code>เลขที่นั่ง</code>, <code>LINE User ID</code>
          </p>
        </div>

        {message && <p className="text-center mb-4 font-semibold text-blue-700">{message}</p>}

        {registrants.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-600">จัดการข้อมูลทั้งหมด ({registrants.length} รายการ)</p>
            <div className="flex gap-2">
              <button onClick={handleSaveAllSeats} disabled={isBulkLoading} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">{isBulkLoading ? '...' : 'บันทึกที่นั่งทั้งหมด'}</button>
              <button onClick={handleDeleteAll} disabled={isBulkLoading} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-800 disabled:bg-gray-400">{isBulkLoading ? '...' : 'ลบทั้งหมด'}</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 sticky top-0">
                <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">ชื่อ-สกุล</th>
                    <th className="p-2">รหัส นศ.</th>
                    <th className="p-2">เลขบัตร ปชช.</th>
                    <th className="p-2">สถานะ</th>
                    <th className="p-2">เลขที่นั่ง</th>
                    <th className="p-2">จัดการ</th>
                </tr>
            </thead>
            <tbody>
                {registrants.map((reg, index) => (
                    <tr key={reg.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2 font-medium">
                            {editingRegistrant === reg.id ? (
                                <input
                                    type="text"
                                    value={editForm.fullName}
                                    onChange={(e) => handleEditFormChange('fullName', e.target.value)}
                                    className="p-1 border border-gray-300 rounded w-full"
                                    placeholder="ชื่อ-สกุล"
                                />
                            ) : (
                                reg.fullName
                            )}
                        </td>
                        <td className="p-2">
                            {editingRegistrant === reg.id ? (
                                <input
                                    type="text"
                                    value={editForm.studentId}
                                    onChange={(e) => handleEditFormChange('studentId', e.target.value)}
                                    className="p-1 border border-gray-300 rounded w-full"
                                    placeholder="รหัสนักศึกษา"
                                />
                            ) : (
                                reg.studentId
                            )}
                        </td>
                        <td className="p-2">
                            {editingRegistrant === reg.id ? (
                                <input
                                    type="text"
                                    value={editForm.nationalId}
                                    onChange={(e) => handleEditFormChange('nationalId', e.target.value)}
                                    className="p-1 border border-gray-300 rounded w-full"
                                    placeholder="เลขบัตรประชาชน"
                                />
                            ) : (
                                reg.nationalId
                            )}
                        </td>
                        <td className="p-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${reg.status === 'checked-in' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {translateStatus(reg.status)}
                            </span>
                        </td>
                        <td className="p-2">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="ที่นั่ง"
                                    value={seatInputs[reg.id] || ''}
                                    onChange={(e) => handleSeatInputChange(reg.id, e.target.value)}
                                    className="p-2 border border-gray-300 rounded-md w-24"
                                />
                                <button
                                    onClick={() => handleAssignSeat(reg.id)}
                                    disabled={savingStates[reg.id]}
                                    className="px-3 py-2 bg-gray-600 text-white text-xs font-semibold rounded-md hover:bg-gray-700 disabled:bg-gray-400"
                                >
                                    {savingStates[reg.id] ? '...' : 'บันทึก'}
                                </button>
                            </div>
                        </td>
                        <td className="p-2">
                            <div className="flex items-center gap-2">
                                {editingRegistrant === reg.id ? (
                                    <>
                                        <button
                                            onClick={() => handleSaveEdit(reg.id)}
                                            disabled={savingStates[reg.id]}
                                            className="text-green-600 hover:text-green-800 text-sm font-semibold"
                                        >
                                            {savingStates[reg.id] ? '...' : 'บันทึก'}
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            className="text-gray-500 hover:text-gray-700 text-sm font-semibold"
                                        >
                                            ยกเลิก
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleEditClick(reg)}
                                            className="text-blue-500 hover:text-blue-700 text-sm font-semibold"
                                        >
                                            แก้ไข
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRegistrant(reg.id, reg.fullName)}
                                            className="text-red-500 hover:text-red-700 text-sm font-semibold"
                                        >
                                            ลบ
                                        </button>
                                    </>
                                )}
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
          </table>
          {registrants.length === 0 && (
              <p className="p-6 text-center text-gray-500">ยังไม่มีนักเรียนลงทะเบียนในกิจกรรมนี้</p>
          )}
        </div>
      </main>
    </div>
  );
}