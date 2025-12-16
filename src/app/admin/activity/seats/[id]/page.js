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

const StatusBadge = ({ status }) => {
  let colorClass = 'bg-gray-100 text-gray-800';
  switch (status) {
    case 'checked-in': colorClass = 'bg-green-100 text-green-800 border-green-200'; break;
    case 'registered': colorClass = 'bg-blue-100 text-blue-800 border-blue-200'; break;
    case 'cancelled': colorClass = 'bg-red-100 text-red-800 border-red-200'; break;
    case 'waitlisted': colorClass = 'bg-amber-100 text-amber-800 border-amber-200'; break;
    case 'completed': colorClass = 'bg-purple-100 text-purple-800 border-purple-200'; break;
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {translateStatus(status)}
    </span>
  );
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

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: 'importOrder', direction: 'asc' });
  const [showSummary, setShowSummary] = useState(false);
  const [editingCounter, setEditingCounter] = useState(null); // { courseName, value }
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'danger' // danger, warning, info
  });

  useEffect(() => {
    // Sort by priority first, then by name
    const unsubCourses = onSnapshot(query(collection(db, 'courseOptions'), orderBy('priority'), orderBy('name')), (snapshot) => {
      setCourseOptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

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
    setIsLoading(true);
    try {
      const activityDoc = await getDoc(doc(db, 'activities', activityId));
      if (activityDoc.exists()) {
        setActivity({ id: activityDoc.id, ...activityDoc.data() });
      }

      const q = query(collection(db, 'registrations'), where('activityId', '==', activityId));
      const snapshot = await getDocs(q);
      const registrantsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Initial sort by importOrder or name
      registrantsData.sort((a, b) => {
        if (a.importOrder !== undefined && b.importOrder !== undefined) {
          return a.importOrder - b.importOrder;
        }
        return (a.fullName || '').localeCompare(b.fullName || '');
      });
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

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRegistrants = [...registrants].sort((a, b) => {
    if (sortConfig.key === 'importOrder') {
      const valA = a.importOrder !== undefined ? a.importOrder : 999999;
      const valB = b.importOrder !== undefined ? b.importOrder : 999999;
      return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    }

    const valA = (a[sortConfig.key] || '').toString().toLowerCase();
    const valB = (b[sortConfig.key] || '').toString().toLowerCase();

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleInputChange = (registrantId, field, value) => {
    let finalValue = value;
    if (field === 'seatNumber') {
      finalValue = value.toUpperCase();
    }
    setEditStates(prev => ({
      ...prev,
      [registrantId]: { ...prev[registrantId], [field]: finalValue }
    }));
  };

  const handleUpdateAll = async () => {
    setIsLoading(true);
    setMessage('กำลังบันทึกข้อมูลทั้งหมด...');
    try {
      const batch = writeBatch(db);

      const updatePromises = registrants.map(async (reg) => {
        const updatedData = editStates[reg.id];
        const originalData = {
          fullName: reg.fullName,
          studentId: reg.studentId,
          nationalId: reg.nationalId
        };

        const hasIdentityChange =
          updatedData.fullName !== originalData.fullName ||
          updatedData.studentId !== originalData.studentId ||
          updatedData.nationalId !== originalData.nationalId;

        if (hasIdentityChange && updatedData.nationalId) {
          const q = query(collection(db, 'studentProfiles'), where('nationalId', '==', updatedData.nationalId), limit(1));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const profileDoc = snapshot.docs[0];
            batch.update(doc(db, 'studentProfiles', profileDoc.id), {
              fullName: updatedData.fullName,
              studentId: updatedData.studentId,
              nationalId: updatedData.nationalId,
              updatedAt: serverTimestamp()
            });
          } else {
            const newProfileRef = doc(collection(db, 'studentProfiles'));
            batch.set(newProfileRef, {
              fullName: updatedData.fullName,
              studentId: updatedData.studentId || '',
              nationalId: updatedData.nationalId,
              lineUserId: '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              importedFrom: 'admin_edit_sync'
            });
          }
        }

        const registrantDocRef = doc(db, 'registrations', reg.id);
        batch.update(registrantDocRef, updatedData);
      });

      await Promise.all(updatePromises);
      await batch.commit();

      setMessage('✅ บันทึกข้อมูลทั้งหมดสำเร็จ!');
      setIsEditMode(false);
      fetchData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Update error:", error);
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAll = () => {
    setEditStates(originalEditStates);
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
      // Check for duplicate nationalId in this activity
      const qDuplicate = query(
        collection(db, 'registrations'),
        where('activityId', '==', activityId),
        where('nationalId', '==', nationalId)
      );
      const duplicateSnapshot = await getDocs(qDuplicate);

      if (!duplicateSnapshot.empty) {
        setMessage('❌ ไม่สามารถลงทะเบียนได้: เลขบัตรประชาชนนี้ได้ลงทะเบียนในกิจกรรมนี้ไปแล้ว');
        return;
      }

      const batch = writeBatch(db);
      let lineUserIdToUse = null;

      const q = query(collection(db, 'studentProfiles'), where('nationalId', '==', nationalId), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const profileDoc = snapshot.docs[0];
        lineUserIdToUse = profileDoc.data().lineUserId;
        batch.update(doc(db, 'studentProfiles', profileDoc.id), {
          fullName,
          studentId: studentId || profileDoc.data().studentId,
          updatedAt: serverTimestamp()
        });
      } else {
        const newProfileRef = doc(collection(db, 'studentProfiles'));
        batch.set(newProfileRef, {
          fullName,
          studentId: studentId || '',
          nationalId,
          lineUserId: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          importedFrom: 'admin_manual_add'
        });
      }

      const newRegRef = doc(collection(db, 'registrations'));
      batch.set(newRegRef, {
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
        lineUserId: lineUserIdToUse,
        displayQueueNumber: displayQueueNumber || null,
      });

      await batch.commit();

      setMessage('เพิ่มรายชื่อสำเร็จ!');
      setForm({ fullName: '', studentId: '', nationalId: '', course: '', timeSlot: '', displayQueueNumber: '', status: 'registered' });
      fetchData();
    } catch (error) {
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const handleDeleteRegistrant = (registrantId) => {
    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการลบข้อมูล',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'registrations', registrantId));
          setMessage('ลบข้อมูลสำเร็จ');
          fetchData();
        } catch (error) {
          setMessage(`เกิดข้อผิดพลาดในการลบ: ${error.message}`);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteAll = () => {
    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการลบข้อมูลทั้งหมด',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมดสำหรับกิจกรรมนี้? การกระทำนี้ไม่สามารถกู้คืนได้.',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
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
          const chunkSize = 400;
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
      }
    });
  };

  const handleAutoAssign = () => {
    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการจัดที่นั่งอัตโนมัติ',
      message: 'คุณต้องการจัดที่นั่งอัตโนมัติใช่หรือไม่? ข้อมูลเลขที่นั่งเดิมจะถูกเขียนทับ',
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        setMessage('กำลังจัดที่นั่ง...');

        try {
          // Use the current sortConfig to determine the order for assignment
          const sortedRegistrants = [...registrants].sort((a, b) => {
            if (sortConfig.key === 'importOrder') {
              const valA = a.importOrder !== undefined ? a.importOrder : 999999;
              const valB = b.importOrder !== undefined ? b.importOrder : 999999;
              return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }

            const valA = (a[sortConfig.key] || '').toString().toLowerCase();
            const valB = (b[sortConfig.key] || '').toString().toLowerCase();

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
          });

          const batch = writeBatch(db);
          const updates = [];
          let currentSeatIndex = 0;

          if (activity.type === 'exam') {
            // EXAM Logic: A001-F600
            const zones = ['A', 'B', 'C', 'D', 'E', 'F'];
            const seatsPerZone = 100;

            for (const reg of sortedRegistrants) {
              if (currentSeatIndex >= zones.length * seatsPerZone) break;

              const zoneIndex = Math.floor(currentSeatIndex / seatsPerZone);
              const seatInZone = (currentSeatIndex % seatsPerZone) + 1;
              const zoneChar = zones[zoneIndex];

              const runningNumber = (zoneIndex * 100) + seatInZone;
              const seatLabel = `${zoneChar}${runningNumber.toString().padStart(3, '0')}`;

              const regRef = doc(db, 'registrations', reg.id);
              batch.update(regRef, { seatNumber: seatLabel });

              updates.push({ id: reg.id, seatNumber: seatLabel });
              currentSeatIndex++;
            }
          } else if (activity.type === 'graduation') {
            // GRADUATION Logic: Theater Style with AJ Locks
            const ajSeats = new Set([
              'A1-1', 'B1-10',    // A1
              'A4-1', 'B4-10',    // A4 (เว้น 2 แถว)
              'A7-1', 'B7-10',    // A7 (เว้น 2 แถว)
              'A10-1', 'B10-10',  // A10 (เว้น 2 แถว)
              'A13-1', 'B13-10',  // A13 (เว้น 2 แถว)
              'A16-1', 'B16-10'   // A16 (เว้น 2 แถว)
            ]);

            const availableSeats = [];
            // Rows 6 to 23 (A1 to A18)
            for (let row = 6; row <= 23; row++) {
              const logicalRow = row - 5;
              // Zone A (1-10)
              for (let col = 1; col <= 10; col++) {
                const seatLabel = `A${logicalRow}-${col}`;
                if (!ajSeats.has(seatLabel)) availableSeats.push(seatLabel);
              }
              // Zone B (1-10)
              for (let col = 1; col <= 10; col++) {
                const seatLabel = `B${logicalRow}-${col}`;
                if (!ajSeats.has(seatLabel)) availableSeats.push(seatLabel);
              }
            }

            for (const reg of sortedRegistrants) {
              if (currentSeatIndex >= availableSeats.length) break;
              const seatLabel = availableSeats[currentSeatIndex];

              const regRef = doc(db, 'registrations', reg.id);
              batch.update(regRef, { seatNumber: seatLabel });

              updates.push({ id: reg.id, seatNumber: seatLabel });
              currentSeatIndex++;
            }
          }

          await batch.commit();

          setMessage(`✅ จัดที่นั่งสำเร็จสำหรับ ${updates.length} คน`);
          fetchData();

        } catch (error) {
          console.error("Auto assign error:", error);
          setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const thaiToEnglishHeaderMap = {
          'ชื่อ-สกุล': 'fullName',
          'รหัสผู้สมัคร': 'studentId',
          'เลขบัตรประชาชน': 'nationalId',
          'หลักสูตร': 'course',
          'เลขที่นั่ง': 'seatNumber',
          'ช่วงเวลา': 'timeSlot',
          'คิว': 'displayQueueNumber',
          'สถานะ': 'status'
        };

        const mappedData = results.data.map(row => {
          const newRow = {};
          Object.keys(row).forEach(key => {
            const engKey = thaiToEnglishHeaderMap[key] || key;
            newRow[engKey] = row[key];
          });
          return newRow;
        });
        setMessage(`กำลังนำเข้าข้อมูล ${mappedData.length} รายการ...`);

        try {
          const batch = writeBatch(db);

          // Create a Set of existing national IDs for fast lookup
          const existingNationalIds = new Set(registrants.map(r => r.nationalId));
          let skippedCount = 0;

          for (let i = 0; i < mappedData.length; i++) {
            const reg = mappedData[i];
            if (reg.fullName && reg.nationalId) {
              if (existingNationalIds.has(reg.nationalId)) {
                console.log(`Skipping duplicate nationalId: ${reg.nationalId}`);
                skippedCount++;
                continue;
              }
              // Add to set to prevent duplicates within the CSV itself
              existingNationalIds.add(reg.nationalId);

              let lineUserIdToUse = null;

              const q = query(collection(db, 'studentProfiles'), where('nationalId', '==', reg.nationalId), limit(1));
              const snapshot = await getDocs(q);

              if (!snapshot.empty) {
                const profileDoc = snapshot.docs[0];
                lineUserIdToUse = profileDoc.data().lineUserId;
                batch.update(doc(db, 'studentProfiles', profileDoc.id), {
                  fullName: reg.fullName,
                  studentId: reg.studentId || profileDoc.data().studentId,
                  updatedAt: serverTimestamp()
                });
              } else {
                const newProfileRef = doc(collection(db, 'studentProfiles'));
                batch.set(newProfileRef, {
                  fullName: reg.fullName,
                  studentId: reg.studentId || '',
                  nationalId: reg.nationalId,
                  lineUserId: '',
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  importedFrom: 'admin_csv_import'
                });
              }

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
                lineUserId: lineUserIdToUse,
                displayQueueNumber: reg.displayQueueNumber || null,
                importOrder: i,
              });
            }
          }
          await batch.commit();
          setMessage(`✅ นำเข้าข้อมูล ${mappedData.length - skippedCount} รายการสำเร็จ! (ข้ามที่ซ้ำ ${skippedCount} รายการ)`);
          await fetchData();
        } catch (error) {
          setMessage(`❌ เกิดข้อผิดพลาดในการนำเข้า: ${error.message}`);
        }
      },
      error: (error) => {
        setMessage(`❌ เกิดข้อผิดพลาดในการอ่านไฟล์ CSV: ${error.message}`);
      }
    });
  };

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

  const stats = {
    total: registrants.length,
    byStatus: registrants.reduce((acc, curr) => {
      const status = curr.status || 'registered';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}),
    byCourse: registrants.reduce((acc, curr) => {
      const course = curr.course || 'ไม่ระบุ';
      acc[course] = (acc[course] || 0) + 1;
      return acc;
    }, {}),
    byTimeSlot: registrants.reduce((acc, curr) => {
      if (activity?.type === 'queue') {
        const slot = curr.timeSlot || 'ไม่ระบุ';
        acc[slot] = (acc[slot] || 0) + 1;
      }
      return acc;
    }, {}),
    byZone: registrants.reduce((acc, curr) => {
      if (activity?.type !== 'queue' && curr.seatNumber) {
        const match = curr.seatNumber.match(/^([A-Za-z]+)/);
        const zone = match ? match[1] : 'Other';
        acc[zone] = (acc[zone] || 0) + 1;
      }
      return acc;
    }, {})
  };

  // ฟังก์ชันอัพเดท Counter คิว
  const handleUpdateCounter = async () => {
    if (!editingCounter || !activity) return;
    try {
      const activityRef = doc(db, 'activities', activityId);
      const currentCounters = activity.queueCounters || {};
      const newCounters = {
        ...currentCounters,
        [editingCounter.courseName]: parseInt(editingCounter.value, 10) || 0
      };
      await updateDoc(activityRef, { queueCounters: newCounters });
      setActivity(prev => ({ ...prev, queueCounters: newCounters }));
      setMessage('✅ บันทึก Counter คิวแล้ว');
      setEditingCounter(null);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  // ฟังก์ชันรีเซ็ต Counter - คำนวณใหม่จากข้อมูลจริงเพื่อหาเลขที่หายไป
  const handleResetAllCounters = async () => {
    // หาหลักสูตรทั้งหมดที่มีในกิจกรรมนี้
    const coursesInActivity = [...new Set(registrants.map(r => r.course).filter(Boolean))];
    if (coursesInActivity.length === 0) {
      setMessage('❌ ไม่มีหลักสูตรที่จะรีเซ็ต');
      return;
    }

    // สร้างสรุปว่าแต่ละหลักสูตรจะได้เลขอะไรถัดไป
    const summaryLines = [];
    const resetCounters = {};

    coursesInActivity.forEach(courseName => {
      // ดึงเลขคิวทั้งหมดของหลักสูตรนี้
      const queueNumbers = registrants
        .filter(r => r.course === courseName && r.displayQueueNumber)
        .map(r => parseInt(r.displayQueueNumber.replace(/\D/g, ''), 10) || 0)
        .filter(n => n > 0)
        .sort((a, b) => a - b);

      // หาเลขแรกที่หายไป (gap)
      let nextNumber = 1;
      for (const num of queueNumbers) {
        if (num > nextNumber) {
          // พบ gap - เลข nextNumber หายไป
          break;
        }
        nextNumber = num + 1;
      }

      // Counter ต้องเป็น nextNumber - 1 เพราะระบบจะ +1 ตอนแจกคิว
      resetCounters[courseName] = nextNumber - 1;

      const courseInfo = courseOptions.find(c => c.name === courseName);
      const prefix = courseInfo?.shortName || '';
      summaryLines.push(`${courseName}: ${prefix}-${String(nextNumber).padStart(3, '0')}`);
    });

    if (!window.confirm(`รีเซ็ต Counter เพื่อหาเลขที่หายไป:\n\nคิวถัดไป:\n${summaryLines.join('\n')}\n\nดำเนินการต่อ?`)) return;

    try {
      const activityRef = doc(db, 'activities', activityId);
      await updateDoc(activityRef, { queueCounters: resetCounters });
      setActivity(prev => ({ ...prev, queueCounters: resetCounters }));
      setMessage('✅ รีเซ็ต Counter แล้ว - คิวถัดไปจะเป็นเลขที่หายไป');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  if (isLoading) return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="mt-4 text-gray-500 font-medium">กำลังโหลดข้อมูล...</p>
    </div>
  );

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    return sortConfig.direction === 'asc'
      ? <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      : <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
  };

  return (
    <div className="bg-gray-50/50 min-h-screen p-6 md:p-10 font-sans">
      <main className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/activity" className="text-gray-400 hover:text-primary transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">จัดการข้อมูลนักเรียน</h1>
            </div>
            <p className="text-gray-500 ml-7">{activity?.name}</p>
          </div>

          {(activity?.type === 'exam' || activity?.type === 'graduation' || activity?.type === 'event') && (
            <Link
              href={`/admin/activity/seats/${activityId}/chart`}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              ดูผังที่นั่ง
            </Link>
          )}
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl border ${message.includes('❌') || message.includes('ข้อผิดพลาด') ? 'bg-red-50 border-red-100 text-red-700' : 'bg-blue-50 border-blue-100 text-blue-700'} flex items-center shadow-sm`}>
            <span className="mr-2 text-xl">{message.includes('❌') || message.includes('ข้อผิดพลาด') ? '⚠️' : 'ℹ️'}</span>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Import/Export Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </div>
              <h2 className="text-lg font-bold text-gray-800">นำเข้าและส่งออกข้อมูล</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  นำเข้าไฟล์ CSV
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Header ที่รองรับ: fullName, studentId, nationalId, course, seatNumber, timeSlot, displayQueueNumber, status
                </p>
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors cursor-pointer border border-gray-200 rounded-xl bg-gray-50"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <CSVLink
                  data={csvExportData}
                  headers={csvExportHeaders}
                  filename={`registrants_${activityId}.csv`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export ข้อมูลทั้งหมดเป็น CSV
                </CSVLink>
              </div>

              {(activity?.type === 'exam' || activity?.type === 'graduation') && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex flex-col gap-2 mb-3">
                    <button
                      onClick={() => setSortConfig({ key: 'fullName', direction: 'asc' })}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                      เรียงรายชื่อ ก-ฮ (Sort A-Z)
                    </button>
                  </div>
                  <button
                    onClick={handleAutoAssign}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20 active:scale-95 disabled:bg-purple-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    จัดที่นั่งอัตโนมัติ (Auto Assign)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Queue Counter Management Card - Only for queue type */}
          {activity?.type === 'queue' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">จัดการ Counter คิว</h2>
                </div>
                <button
                  onClick={handleResetAllCounters}
                  className="text-xs text-red-500 hover:text-red-700 hover:underline"
                >
                  รีเซ็ตทั้งหมด
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4">ตั้งค่าเลขคิวถัดไปที่จะแจก เมื่อต้องการใช้เลขเดิมซ้ำ สามารถแก้ไข Counter ได้</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto">
                {/* แสดงเฉพาะหลักสูตรที่มีนักเรียนลงทะเบียนในกิจกรรมนี้ */}
                {courseOptions.filter(course => registrants.some(r => r.course === course.name)).map(course => {
                  const currentCounter = activity?.queueCounters?.[course.name] || 0;
                  const nextQueue = currentCounter + 1;
                  const isEditing = editingCounter?.courseName === course.name;
                  const registrantCount = registrants.filter(r => r.course === course.name).length;

                  return (
                    <div key={course.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: course.color || '#3B82F6' }}></div>
                        <span className="font-medium text-gray-700 text-sm truncate">{course.name}</span>
                        <span className="text-xs text-gray-400 font-mono">({course.shortName})</span>
                        <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{registrantCount} คน</span>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editingCounter.value}
                            onChange={(e) => setEditingCounter({ ...editingCounter, value: e.target.value })}
                            className="w-20 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                            min="0"
                          />
                          <button onClick={handleUpdateCounter} className="text-green-600 hover:text-green-700 p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button onClick={() => setEditingCounter(null)} className="text-gray-400 hover:text-gray-600 p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-gray-500">Counter</div>
                            <div className="font-bold text-gray-800">{currentCounter}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">คิวถัดไป</div>
                            <div className="font-bold text-purple-600">{course.shortName}-{String(nextQueue).padStart(3, '0')}</div>
                          </div>
                          <button
                            onClick={() => setEditingCounter({ courseName: course.name, value: currentCounter })}
                            className="text-gray-400 hover:text-purple-600 p-1"
                            title="แก้ไข Counter"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Participant Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>
              <h2 className="text-lg font-bold text-gray-800">เพิ่มนักเรียนรายบุคคล</h2>
            </div>

            <form onSubmit={handleAddParticipant} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <input type="text" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="ชื่อ-สกุล*" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" required />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <input type="text" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} placeholder="รหัสผู้สมัคร" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
              </div>
              <div className="col-span-2">
                <input type="text" value={form.nationalId} onChange={e => setForm({ ...form, nationalId: e.target.value })} placeholder="เลขบัตรประชาชน*" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" required />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <select value={form.course} onChange={e => setForm({ ...form, course: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-600">
                  <option value="">เลือกหลักสูตร</option>
                  {courseOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {activity?.type === 'queue' && (
                <>
                  <div className="col-span-2 sm:col-span-1">
                    <select value={form.timeSlot} onChange={e => setForm({ ...form, timeSlot: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-600" required>
                      <option value="">เลือกช่วงเวลา*</option>
                      {timeSlotOptions.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <input type="text" value={form.displayQueueNumber} onChange={e => setForm({ ...form, displayQueueNumber: e.target.value })} placeholder="กำหนดคิว (ถ้ามี)" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                  </div>
                </>
              )}

              <div className="col-span-2 mt-2">
                <button type="submit" className="w-full px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                  เพิ่มรายชื่อ
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Data Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/30">
            <h3 className="font-bold text-gray-800 text-lg">รายการผู้ลงทะเบียน ({registrants.length})</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowSummary(true)}
                className="px-4 py-2 bg-white border border-purple-200 text-purple-700 text-sm font-medium rounded-xl hover:bg-purple-50 transition-colors shadow-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                รายงานสรุป
              </button>
              {isEditMode ? (
                <>
                  <button onClick={handleUpdateAll} disabled={isLoading} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:bg-green-300 transition-colors shadow-sm">
                    {isLoading ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
                  </button>
                  <button onClick={handleCancelAll} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                    ยกเลิก
                  </button>
                </>
              ) : (
                <button onClick={() => setIsEditMode(true)} className="px-4 py-2 bg-white border border-blue-200 text-blue-700 text-sm font-medium rounded-xl hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  แก้ไขข้อมูล
                </button>
              )}
              <button onClick={handleDeleteAll} disabled={isLoading} className="px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 disabled:bg-red-50 transition-colors shadow-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                ลบทั้งหมด
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 w-16">#</th>
                  <th className="px-6 py-4 min-w-[200px] cursor-pointer hover:text-blue-600" onClick={() => handleSort('fullName')}>
                    <div className="flex items-center gap-1">ชื่อ-สกุล <SortIcon columnKey="fullName" /></div>
                  </th>
                  <th className="px-6 py-4 min-w-[120px] cursor-pointer hover:text-blue-600" onClick={() => handleSort('studentId')}>
                    <div className="flex items-center gap-1">รหัสผู้สมัคร <SortIcon columnKey="studentId" /></div>
                  </th>
                  <th className="px-6 py-4 min-w-[150px] cursor-pointer hover:text-blue-600" onClick={() => handleSort('nationalId')}>
                    <div className="flex items-center gap-1">เลขบัตร ปชช. <SortIcon columnKey="nationalId" /></div>
                  </th>
                  <th className="px-6 py-4 min-w-[140px] cursor-pointer hover:text-blue-600" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">สถานะ <SortIcon columnKey="status" /></div>
                  </th>
                  <th className="px-6 py-4 min-w-[150px] cursor-pointer hover:text-blue-600" onClick={() => handleSort('course')}>
                    <div className="flex items-center gap-1">หลักสูตร <SortIcon columnKey="course" /></div>
                  </th>
                  {activity?.type === 'queue' ? (
                    <>
                      <th className="px-6 py-4 min-w-[120px] cursor-pointer hover:text-blue-600" onClick={() => handleSort('timeSlot')}>
                        <div className="flex items-center gap-1">ช่วงเวลา <SortIcon columnKey="timeSlot" /></div>
                      </th>
                      <th className="px-6 py-4 min-w-[80px] cursor-pointer hover:text-blue-600" onClick={() => handleSort('displayQueueNumber')}>
                        <div className="flex items-center gap-1">คิว <SortIcon columnKey="displayQueueNumber" /></div>
                      </th>
                    </>
                  ) : (
                    <th className="px-6 py-4 min-w-[100px] cursor-pointer hover:text-blue-600" onClick={() => handleSort('seatNumber')}>
                      <div className="flex items-center gap-1">เลขที่นั่ง <SortIcon columnKey="seatNumber" /></div>
                    </th>
                  )}
                  <th className="px-6 py-4 w-20 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRegistrants.map((reg, index) => {
                  const isEditing = isEditMode;
                  return (
                    <tr key={reg.id} className={`transition-colors ${isEditing ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}>
                      <td className="px-6 py-4 text-gray-500">{index + 1}</td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input type="text" value={editStates[reg.id]?.fullName || ''} onChange={(e) => handleInputChange(reg.id, 'fullName', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm" />
                        ) : (
                          <span className="font-medium text-gray-900">{reg.fullName}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {isEditing ? (
                          <input type="text" value={editStates[reg.id]?.studentId || ''} onChange={(e) => handleInputChange(reg.id, 'studentId', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm" />
                        ) : (
                          <span>{reg.studentId}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                        {isEditing ? (
                          <input type="text" value={editStates[reg.id]?.nationalId || ''} onChange={(e) => handleInputChange(reg.id, 'nationalId', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm" />
                        ) : (
                          <span>{reg.nationalId}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <select value={editStates[reg.id]?.status || 'registered'} onChange={(e) => handleInputChange(reg.id, 'status', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm">
                            <option value="registered">ลงทะเบียนแล้ว</option>
                            <option value="checked-in">เช็คอินแล้ว</option>
                            <option value="completed">สำเร็จแล้ว</option>
                            <option value="cancelled">ยกเลิกแล้ว</option>
                          </select>
                        ) : (
                          <StatusBadge status={reg.status} />
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {isEditing ? (
                          <select value={editStates[reg.id]?.course || ''} onChange={(e) => handleInputChange(reg.id, 'course', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm">
                            <option value="">เลือกหลักสูตร</option>
                            {courseOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        ) : (
                          <span>{reg.course}</span>
                        )}
                      </td>

                      {activity?.type === 'queue' ? (
                        <>
                          <td className="px-6 py-4 text-gray-600">
                            {isEditing ? (
                              <select value={editStates[reg.id]?.timeSlot || ''} onChange={(e) => handleInputChange(reg.id, 'timeSlot', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm">
                                <option value="">เลือกช่วงเวลา</option>
                                {timeSlotOptions.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                              </select>
                            ) : (
                              <span>{reg.timeSlot}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-600 font-mono">
                            {isEditing ? (
                              <input type="text" value={editStates[reg.id]?.displayQueueNumber || ''} onChange={(e) => handleInputChange(reg.id, 'displayQueueNumber', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm" />
                            ) : (
                              <span>{reg.displayQueueNumber}</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="px-6 py-4 text-gray-600 font-mono font-medium">
                          {isEditing ? (
                            <input type="text" value={editStates[reg.id]?.seatNumber || ''} onChange={(e) => handleInputChange(reg.id, 'seatNumber', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm" />
                          ) : (
                            <span className="text-blue-600">{reg.seatNumber || '-'}</span>
                          )}
                        </td>
                      )}

                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDeleteRegistrant(reg.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="ลบข้อมูล"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {sortedRegistrants.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-400 bg-gray-50/30">
                      <div className="flex flex-col items-center gap-3">
                        <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        <p>ยังไม่มีผู้ลงทะเบียน</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-800">สรุปข้อมูลการลงทะเบียน</h3>
                <p className="text-sm text-gray-500">{activity?.name}</p>
              </div>
              <button onClick={() => setShowSummary(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <p className="text-sm text-blue-600 font-medium mb-1">ทั้งหมด</p>
                  <p className="text-3xl font-bold text-blue-800">{stats.total}</p>
                  <p className="text-xs text-blue-500 mt-1">คน</p>
                </div>
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                  <p className="text-sm text-green-600 font-medium mb-1">เช็คอินแล้ว</p>
                  <p className="text-3xl font-bold text-green-800">{stats.byStatus['checked-in'] || 0}</p>
                  <p className="text-xs text-green-500 mt-1">คน</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <p className="text-sm text-amber-600 font-medium mb-1">รอคิว</p>
                  <p className="text-3xl font-bold text-amber-800">{stats.byStatus['waitlisted'] || 0}</p>
                  <p className="text-xs text-amber-500 mt-1">คน</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                  <p className="text-sm text-purple-600 font-medium mb-1">สำเร็จ</p>
                  <p className="text-3xl font-bold text-purple-800">{stats.byStatus['completed'] || 0}</p>
                  <p className="text-xs text-purple-500 mt-1">คน</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Status Breakdown */}
                <div className="bg-gray-50 rounded-2xl p-5">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    สถานะการลงทะเบียน
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(stats.byStatus).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <StatusBadge status={status} />
                        <span className="font-mono font-bold text-gray-700">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Course Breakdown */}
                <div className="bg-gray-50 rounded-2xl p-5">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    แยกตามหลักสูตร
                  </h4>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {Object.entries(stats.byCourse).sort((a, b) => b[1] - a[1]).map(([course, count]) => (
                      <div key={course} className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <span className="text-sm text-gray-700 font-medium truncate max-w-[70%]">{course}</span>
                        <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">{count}</span>
                      </div>
                    ))}
                    {Object.keys(stats.byCourse).length === 0 && (
                      <p className="text-center text-gray-400 py-4">ไม่พบข้อมูลหลักสูตร</p>
                    )}
                  </div>
                </div>

                {/* Time Slot Breakdown (Queue only) */}
                {activity?.type === 'queue' && (
                  <div className="bg-gray-50 rounded-2xl p-5">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      แยกตามช่วงเวลา
                    </h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {Object.entries(stats.byTimeSlot).sort((a, b) => b[1] - a[1]).map(([slot, count]) => (
                        <div key={slot} className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                          <span className="text-sm text-gray-700 font-medium truncate max-w-[70%]">{slot}</span>
                          <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">{count}</span>
                        </div>
                      ))}
                      {Object.keys(stats.byTimeSlot).length === 0 && (
                        <p className="text-center text-gray-400 py-4">ไม่พบข้อมูลช่วงเวลา</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Zone Breakdown (Non-Queue) */}
                {activity?.type !== 'queue' && Object.keys(stats.byZone).length > 0 && (
                  <div className="bg-gray-50 rounded-2xl p-5">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      แยกตามโซนที่นั่ง
                    </h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {Object.entries(stats.byZone).sort().map(([zone, count]) => (
                        <div key={zone} className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                          <span className="text-sm text-gray-700 font-medium">โซน {zone}</span>
                          <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button onClick={() => setShowSummary(false)} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">ปิดหน้าต่าง</button>
              <CSVLink
                data={csvExportData}
                headers={csvExportHeaders}
                filename={`summary_registrants_${activityId}.csv`}
                className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 shadow-lg shadow-green-600/20 flex items-center gap-2 transition-all active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export ข้อมูลทั้งหมด
              </CSVLink>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden transform transition-all scale-100 opacity-100">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' :
                  confirmModal.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                  {confirmModal.type === 'danger' && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  )}
                  {confirmModal.type === 'warning' && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  )}
                  {confirmModal.type === 'info' && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{confirmModal.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{confirmModal.message}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={`px-4 py-2 text-white font-medium rounded-xl shadow-lg transition-all active:scale-95 ${confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' :
                    confirmModal.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' :
                      'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                    }`}
                >
                  ยืนยัน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
