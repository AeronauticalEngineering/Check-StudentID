'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { db } from '../../../../../lib/firebase';
import {
  doc, getDoc, updateDoc, collection, query,
  where, getDocs, writeBatch, serverTimestamp, deleteDoc, addDoc, onSnapshot, limit, orderBy
} from 'firebase/firestore';
import Papa from "papaparse";
import { CSVLink } from "react-csv";

// Helper function to translate status to Thai
const translateStatus = (status) => {
  switch (status) {
    case 'checked-in': return 'เช็คอินแล้ว';
    case 'registered': return 'ลงทะเบียนแล้ว';
    case 'cancelled': return 'ยกเลิกแล้ว';
    case 'waitlisted': return 'รอคิว';
    case 'completed': return 'สำเร็จแล้ว';
    default: return status || '';
  }
};

export default function SeatAssignmentPage({ params }) {
  const { id: activityId } = use(params);
  const [activity, setActivity] = useState(null);
  const [registrants, setRegistrants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  const [form, setForm] = useState({
  fullName: '', studentId: '', nationalId: '', course: '', timeSlot: '', displayQueueNumber: '', status: 'registered'
  });

  const [editStates, setEditStates] = useState({});
  const [originalEditStates, setOriginalEditStates] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [courseOptions, setCourseOptions] = useState([]);
  const [timeSlotOptions, setTimeSlotOptions] = useState([]);

  const findLineUserId = async (nationalId) => {
    if (!nationalId) return null;
    const profileQuery = query(collection(db, 'studentProfiles'), where("nationalId", "==", nationalId), limit(1));
    const profileSnapshot = await getDocs(profileQuery);
    if (!profileSnapshot.empty) {
        return profileSnapshot.docs[0].data().lineUserId;
    }
    return null;
  };

  useEffect(() => {
    const unsubCourses = onSnapshot(query(collection(db, 'courseOptions'), orderBy('name')), (snapshot) => {
        setCourseOptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    // --- จุดที่แก้ไข ---
    // เพิ่ม query และ orderBy('name') เพื่อเรียงเวลาจากน้อยไปมาก
    const timeSlotsQuery = query(collection(db, 'timeSlotOptions'), orderBy('name'));
    const unsubTimeSlots = onSnapshot(timeSlotsQuery, (snapshot) => {
        setTimeSlotOptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
        unsubCourses();
        unsubTimeSlots();
    };
  }, []);

  const fetchData = useCallback(async () => {
    // ... (โค้ดส่วนนี้เหมือนเดิม)
    setIsLoading(true);
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

      const initialEdits = {};
      registrantsData.forEach(r => {
        initialEdits[r.id] = { 
          fullName: r.fullName || '',
          studentId: r.studentId || '',
          nationalId: r.nationalId || '',
          seatNumber: r.seatNumber || '', 
          course: r.course || '', 
          timeSlot: r.timeSlot || '',
          status: r.status || 'registered',
          displayQueueNumber: r.displayQueueNumber || ''
        };
      });
      setEditStates(initialEdits);
      setOriginalEditStates(JSON.parse(JSON.stringify(initialEdits)));

    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ... (ฟังก์ชัน handle ต่างๆ เช่น handleInputChange, handleUpdateAll ฯลฯ เหมือนเดิมทั้งหมด)
  const handleInputChange = (registrantId, field, value) => {
    setEditStates(prev => ({
      ...prev,
      [registrantId]: { ...prev[registrantId], [field]: value }
    }));
  };

  const handleUpdateAll = async () => {
    setIsLoading(true);
    setMessage('กำลังบันทึกข้อมูลทั้งหมด...');
    try {
      const batch = writeBatch(db);
      registrants.forEach(reg => {
        const registrantDocRef = doc(db, 'registrations', reg.id);
        const updatedData = editStates[reg.id];
        batch.update(registrantDocRef, updatedData);
      });
      await batch.commit();
      
      setMessage('✅ บันทึกข้อมูลทั้งหมดสำเร็จ!');
      setIsEditMode(false);
      fetchData(); // Refresh data
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
       setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleCancelAll = () => {
    setEditStates(originalEditStates); // Revert to original data
    setIsEditMode(false);
  };
  
  const handleAddParticipant = async (e) => {
      e.preventDefault();
      const { fullName, nationalId, course, timeSlot, studentId, displayQueueNumber } = form;
      if (!fullName || !nationalId || (activity?.type === 'queue' && (!course || !timeSlot))) {
          setMessage('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
          return;
      }

    try {
      const lineUserId = await findLineUserId(nationalId);
      await addDoc(collection(db, 'registrations'), {
        activityId,
        courseId: activity?.courseId || null,
        fullName,
        studentId: studentId || null,
        nationalId,
        course: course || null,
        timeSlot: timeSlot || null,
        status: form.status || 'registered',
        registeredBy: 'admin_manual_add',
        registeredAt: serverTimestamp(),
        lineUserId: lineUserId,
        displayQueueNumber: displayQueueNumber || null,
      });
          setMessage('เพิ่มรายชื่อสำเร็จ!');
      setForm({ fullName: '', studentId: '', nationalId: '', course: '', timeSlot: '', displayQueueNumber: '', status: 'registered' });
          fetchData();
      } catch (error) {
          setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
      }
  };

  const handleDeleteRegistrant = async (registrantId) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?')) {
      try {
        await deleteDoc(doc(db, 'registrations', registrantId));
        setMessage('ลบข้อมูลสำเร็จ');
        fetchData();
      } catch (error) {
        setMessage(`เกิดข้อผิดพลาดในการลบ: ${error.message}`);
      }
    }
  };

  // Delete all registrants for this activity (with confirmation and chunked batches)
  const handleDeleteAll = async () => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมดสำหรับกิจกรรมนี้? การกระทำนี้ไม่สามารถกู้คืนได้.')) return;
    setIsLoading(true);
    setMessage('กำลังลบข้อมูลทั้งหมด...');
    try {
      const q = query(collection(db, 'registrations'), where('activityId', '==', activityId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setMessage('ไม่มีข้อมูลให้ลบ');
        setIsLoading(false);
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      const docs = snapshot.docs;
      const chunkSize = 400; // keep under Firestore limits
      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + chunkSize);
        chunk.forEach(d => batch.delete(doc(db, 'registrations', d.id)));
        await batch.commit();
      }

      setMessage('✅ ลบข้อมูลทั้งหมดสำเร็จ');
      fetchData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาดในการลบทั้งหมด: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const newRegistrants = results.data;
            setMessage(`กำลังนำเข้าข้อมูล ${newRegistrants.length} รายการ...`);
            
            try {
                const batch = writeBatch(db);
                for (const reg of newRegistrants) {
                    if (reg.fullName && reg.nationalId) {
                        const lineUserId = await findLineUserId(reg.nationalId);
                        const newRegRef = doc(collection(db, 'registrations'));
            batch.set(newRegRef, {
              activityId,
              courseId: activity?.courseId || null,
              fullName: reg.fullName,
              studentId: reg.studentId || null,
              nationalId: reg.nationalId,
              course: reg.course || null,
              seatNumber: reg.seatNumber || null,
              timeSlot: reg.timeSlot || null,
              status: reg.status || 'registered',
              registeredBy: 'admin_csv_import',
              registeredAt: serverTimestamp(),
              lineUserId: lineUserId,
              displayQueueNumber: reg.displayQueueNumber || null,
            });
                    }
                }
                await batch.commit();
                setMessage(`✅ นำเข้าข้อมูล ${newRegistrants.length} รายการสำเร็จ!`);
                fetchData();
            } catch (error) {
                setMessage(`❌ เกิดข้อผิดพลาดในการนำเข้า: ${error.message}`);
            }
        },
        error: (error) => {
            setMessage(`❌ เกิดข้อผิดพลาดในการอ่านไฟล์ CSV: ${error.message}`);
        }
    });
  };

  // ปรับ header ให้รองรับเลขที่นั่ง (seatNumber) สำหรับกิจกรรมปกติ/ปกติไม่ประเมิน
  const csvExportHeaders = [
    { label: "ชื่อ-สกุล", key: "fullName" },
    { label: "รหัสผู้สมัคร", key: "studentId" },
    { label: "เลขบัตรประชาชน", key: "nationalId" },
    { label: "สถานะ", key: "status" },
    { label: "หลักสูตร", key: "course" },
    { label: "เลขที่นั่ง", key: "seatNumber" },
    { label: "ช่วงเวลา", key: "timeSlot" },
    { label: "คิว", key: "displayQueueNumber" },
  ];

  const csvExportData = registrants.map(reg => ({
    fullName: reg.fullName || '',
    studentId: reg.studentId || '',
    nationalId: reg.nationalId || '',
    status: reg.status || 'registered',
    course: reg.course || '',
    seatNumber: reg.seatNumber || '',
    timeSlot: reg.timeSlot || '',
    displayQueueNumber: reg.displayQueueNumber || '',
  }));

  if (isLoading) return <div className="text-center p-10 font-sans">กำลังโหลด...</div>;

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-8 font-sans">
      <main className="max-w-7xl mx-auto">
        {/* ... JSX for header and forms ... */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">จัดการข้อมูลนักเรียน</h1>
            <p className="text-gray-600">{activity?.name}</p>
          </div>
          <Link href="/admin/activity" className="text-sm text-blue-600 hover:underline">&larr; กลับไปหน้าแดชบอร์ด</Link>
        </div>
        
        {message && <p className="text-center mb-4 font-semibold text-blue-700">{message}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">นำเข้าและส่งออกข้อมูล</h2>
                <div className="space-y-4">
                    <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  นำเข้าไฟล์ CSV (Header: fullName, studentId, nationalId, course, seatNumber, timeSlot, displayQueueNumber)
                  <br/>
                  <span className="text-xs text-gray-500">*กิจกรรมปกติ/ปกติ(ไม่ประเมิน) ใช้เฉพาะ fullName, studentId, nationalId, course, seatNumber, status</span>
                </label>
                        <input 
                            type="file" 
                            accept=".csv" 
                            onChange={handleFileUpload}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                    <div>
                        <CSVLink
                            data={csvExportData}
                            headers={csvExportHeaders}
                            filename={`registrants_${activityId}.csv`}
                            className="w-full text-center block px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                        >
                            Export ข้อมูลทั้งหมดเป็น CSV
                        </CSVLink>
                    </div>
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">เพิ่มนักเรียนรายบุคคล</h2>
                <form onSubmit={handleAddParticipant} className="space-y-3">
                    <input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} placeholder="ชื่อ-สกุล*" className="p-2 border rounded w-full" required />
                    <input type="text" value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})} placeholder="รหัสผู้สมัคร" className="p-2 border rounded w-full" />
                    <input type="text" value={form.nationalId} onChange={e => setForm({...form, nationalId: e.target.value})} placeholder="เลขบัตรประชาชน*" className="p-2 border rounded w-full" required pattern="\d{13}" />
          <div>
            <label className="block text-sm text-gray-600 mb-1">สถานะ</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="p-2 border rounded w-full">
              <option value="registered">ลงทะเบียนแล้ว</option>
              <option value="checked-in">เช็คอินแล้ว</option>
              <option value="waitlisted">รอคิว</option>
              <option value="cancelled">ยกเลิกแล้ว</option>
              <option value="completed">สำเร็จแล้ว</option>
            </select>
          </div>
          {/* เพิ่มตัวเลือกหลักสูตรสำหรับทุกกิจกรรม */}
          <select
            value={form.course}
            onChange={e => setForm({ ...form, course: e.target.value })}
            className="p-2 border rounded w-full"
            required={activity?.type === 'queue' || activity?.type === 'normal' || activity?.type === 'normal-no-eval'}
          >
            <option value="">เลือกหลักสูตร*</option>
            {courseOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          {/* เฉพาะกิจกรรม queue ให้เลือกช่วงเวลาและคิว */}
          {activity?.type === 'queue' && (
            <>
              <select value={form.timeSlot} onChange={e => setForm({...form, timeSlot: e.target.value})} className="p-2 border rounded w-full" required>
                <option value="">เลือกช่วงเวลา*</option>
                {timeSlotOptions.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
              <input type="text" value={form.displayQueueNumber} onChange={e => setForm({...form, displayQueueNumber: e.target.value})} placeholder="กำหนดคิว (ถ้ามี)" className="p-2 border rounded w-full" />
            </>
          )}
                    <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">เพิ่ม</button>
                </form>
            </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <div className="p-4 flex justify-end items-center gap-3">
            {isEditMode ? (
              <>
                <button onClick={handleUpdateAll} disabled={isLoading} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-green-300">
                  {isLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลทั้งหมด'}
                </button>
                 <button onClick={handleCancelAll} className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-md hover:bg-gray-600">
                  ยกเลิก
                </button>
              </>
            ) : (
                 <button onClick={() => setIsEditMode(true)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">
                  แก้ไขข้อมูลทั้งหมด
                </button>
            )}
            <button onClick={handleDeleteAll} disabled={isLoading} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-red-300">
              {isLoading ? 'กำลังลบ...' : 'ลบข้อมูลทั้งหมด'}
            </button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100">
                <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">ชื่อ-สกุล</th>
                    <th className="p-2">รหัสผู้สมัคร</th>
                    <th className="p-2">เลขบัตร ปชช.</th>
                    <th className="p-2">สถานะ</th>
          {/* เพิ่มหลักสูตรในทุกกิจกรรม */}
          <th className="p-2">หลักสูตร</th>
          {activity?.type === 'queue' ? (
            <>
              <th className="p-2">ช่วงเวลา</th>
              <th className="p-2">คิว</th>
            </>
          ) : (
            <th className="p-2">เลขที่นั่ง</th>
          )}
                    <th className="p-2">จัดการ</th>
                </tr>
            </thead>
            <tbody>
                {registrants.map((reg, index) => {
                    const isEditing = isEditMode;
                    return (
                    <tr key={reg.id} className={`border-b ${isEditing ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2">
                           {isEditing ? (
                                <input type="text" value={editStates[reg.id]?.fullName || ''} onChange={(e) => handleInputChange(reg.id, 'fullName', e.target.value)} className="p-1 border rounded w-full min-w-[150px]"/>
                           ) : (
                                <span>{reg.fullName}</span>
                           )}
                        </td>
                        <td className="p-2">
                           {isEditing ? (
                                <input type="text" value={editStates[reg.id]?.studentId || ''} onChange={(e) => handleInputChange(reg.id, 'studentId', e.target.value)} className="p-1 border rounded w-full min-w-[100px]"/>
                           ) : (
                                <span>{reg.studentId}</span>
                           )}
                        </td>
                         <td className="p-2">
                           {isEditing ? (
                                <input type="text" value={editStates[reg.id]?.nationalId || ''} onChange={(e) => handleInputChange(reg.id, 'nationalId', e.target.value)} className="p-1 border rounded w-full min-w-[120px]"/>
                           ) : (
                                <span>{reg.nationalId}</span>
                           )}
                        </td>
                        <td className="p-2">
                          {isEditing ? (
                            <select value={editStates[reg.id]?.status || 'registered'} onChange={(e) => handleInputChange(reg.id, 'status', e.target.value)} className="p-1 border rounded min-w-[140px]">
                                <option value="registered">ลงทะเบียนแล้ว</option>
                                <option value="checked-in">เช็คอินแล้ว</option>
                                <option value="waitlisted">รอคิว</option>
                                <option value="cancelled">ยกเลิกแล้ว</option>
                                <option value="completed">สำเร็จแล้ว</option>
                            </select>
                          ) : (
                            <span>{translateStatus(reg.status)}</span>
                          )}
                        </td>
            {/* หลักสูตร ทุกกิจกรรม */}
            <td className="p-2">
              {isEditing ? (
                <select value={editStates[reg.id]?.course || ''} onChange={(e) => handleInputChange(reg.id, 'course', e.target.value)} className="p-1 border rounded w-full min-w-[120px]">
                  <option value="">เลือกหลักสูตร</option>
                  {courseOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              ) : (
                <span>{reg.course}</span>
              )}
            </td>
            {activity?.type === 'queue' ? (
              <>
                <td className="p-2">
                  {isEditing ? (
                    <select value={editStates[reg.id]?.timeSlot || ''} onChange={(e) => handleInputChange(reg.id, 'timeSlot', e.target.value)} className="p-1 border rounded  min-w-[100px]">
                      <option value="">เลือกเวลา</option>
                      {timeSlotOptions.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  ) : (
                    <span>{reg.timeSlot}</span>
                  )}
                </td>
                <td className="p-2">
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editStates[reg.id]?.displayQueueNumber || ''} 
                      onChange={(e) => handleInputChange(reg.id, 'displayQueueNumber', e.target.value)} 
                      className="p-1 border rounded w-24"
                      placeholder="เช่น A1"
                    />
                  ) : (
                    <span>{reg.displayQueueNumber}</span>
                  )}
                </td>
              </>
            ) : (
              <td className="p-2">
                {isEditing ? (
                  <input type="text" value={editStates[reg.id]?.seatNumber || ''} onChange={(e) => handleInputChange(reg.id, 'seatNumber', e.target.value)} className="p-1 border rounded w-24"/>
                ) : (
                  <span>{reg.seatNumber}</span>
                )}
              </td>
            )}
                        <td className="p-2">
                            <button onClick={() => handleDeleteRegistrant(reg.id)} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">ลบ</button>
                        </td>
                    </tr>
                )})}
            </tbody>
          </table>
          {registrants.length === 0 && <p className="p-6 text-center text-gray-500">ยังไม่มีนักเรียนลงทะเบียน</p>}
        </div>
      </main>
    </div>
  );
}