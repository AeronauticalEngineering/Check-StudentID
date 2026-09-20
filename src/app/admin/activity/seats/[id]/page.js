'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { db } from '../../../../../lib/firebase';
import {
  doc, getDoc, updateDoc, collection, query,
  where, getDocs, writeBatch, serverTimestamp, deleteDoc, onSnapshot, limit, orderBy
} from 'firebase/firestore';
import Papa from 'papaparse';
import { CSVLink } from 'react-csv';
import ExaminerScoringModal from '../../../../../components/ExaminerScoringModal';

function formatSeatLabel(zoneName, runningNumber, labelFormat) {
  const numStr = runningNumber.toString().padStart(3, '0');
  if (labelFormat === 'numberOnly') {
    return numStr;
  }
  if (labelFormat === 'withZone') {
    if (/^[A-Za-z]+$/.test(zoneName)) {
      return `${zoneName}${numStr}`;
    }
    return `${zoneName}-${numStr}`;
  }
  if (/^[A-Za-z]+$/.test(zoneName)) {
    return `${zoneName}${numStr}`;
  }
  return numStr;
}
import { useModal } from '../../../../../context/ModalContext';

// Helper function to translate status to Thai
const translateStatus = (status) => {
  switch (status) {
    case 'checked-in': return 'เช็คอินแล้ว';
    case 'registered': return 'ลงทะเบียนแล้ว';
    case 'calling': return 'กำลังเรียก';
    case 'called': return 'เรียกคิวแล้ว';
    case 'interviewing':
    case 'serving': return 'สอบสัมภาษณ์';
    case 'completed': return 'สำเร็จแล้ว';
    case 'waitlisted': return 'รอคิว';
    case 'cancelled': return 'ยกเลิกแล้ว';
    case 'absent': return 'ไม่มารายงานตัว';
    case 'skipped': return 'ข้ามคิว';
    default: {
      if (!status) return 'ลงทะเบียนแล้ว';
      const lower = String(status).toLowerCase();
      if (lower.includes('call')) return 'กำลังเรียก';
      if (lower.includes('interview')) return 'สอบสัมภาษณ์';
      if (lower.includes('check')) return 'เช็คอินแล้ว';
      if (lower.includes('complete')) return 'สำเร็จแล้ว';
      if (lower.includes('cancel')) return 'ยกเลิกแล้ว';
      if (lower.includes('wait')) return 'รอคิว';
      return status;
    }
  }
};

const StatusBadge = ({ status }) => {
  let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
  switch (status) {
    case 'checked-in': colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'; break;
    case 'registered': colorClass = 'bg-blue-50 text-blue-700 border-blue-200'; break;
    case 'calling':
    case 'called': colorClass = 'bg-amber-50 text-amber-700 border-amber-300 font-semibold animate-pulse'; break;
    case 'interviewing':
    case 'serving': colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'; break;
    case 'completed': colorClass = 'bg-purple-50 text-purple-700 border-purple-200'; break;
    case 'waitlisted': colorClass = 'bg-orange-50 text-orange-700 border-orange-200'; break;
    case 'cancelled':
    case 'absent':
    case 'skipped': colorClass = 'bg-red-50 text-red-700 border-red-200'; break;
    default: {
      const lower = String(status || '').toLowerCase();
      if (lower.includes('call')) colorClass = 'bg-amber-50 text-amber-700 border-amber-300 font-semibold animate-pulse';
      break;
    }
  }
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded text-xs border font-medium ${colorClass}`}>
      {translateStatus(status)}
    </span>
  );
};

export default function SeatAssignmentPage({ params }) {
  const { id: activityId } = use(params);
  const { showAlert, showConfirm, showToast } = useModal();
  const [activity, setActivity] = useState(null);
  const [registrants, setRegistrants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');


  const [form, setForm] = useState({
    fullName: '', studentId: '', nationalId: '', course: '', quota: '', timeSlot: '', displayQueueNumber: '', status: 'registered'
  });

  const [editStates, setEditStates] = useState({});
  const [originalEditStates, setOriginalEditStates] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [courseOptions, setCourseOptions] = useState([]);
  const [timeSlotOptions, setTimeSlotOptions] = useState([]);

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: 'importOrder', direction: 'asc' });
  const [showSummary, setShowSummary] = useState(false);
  const [editingCounter, setEditingCounter] = useState(null);
  const [scoringRegistrant, setScoringRegistrant] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'danger'
  });

  useEffect(() => {
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
          quota: r.quota || r.evaluationScore?.quota || '',
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

    if (sortConfig.key === 'quota') {
      const valA = (a.quota || a.evaluationScore?.quota || '').toString().toLowerCase();
      const valB = (b.quota || b.evaluationScore?.quota || '').toString().toLowerCase();
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
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
    if (field === 'nationalId') {
      finalValue = value.replace(/\D/g, '').slice(0, 13);
    }
    setEditStates(prev => ({
      ...prev,
      [registrantId]: { ...prev[registrantId], [field]: finalValue }
    }));
  };

  const handleUpdateAll = async () => {
    // Validate nationalId for all registrants before saving
    for (const reg of registrants) {
      const updatedData = editStates[reg.id];
      if (updatedData?.nationalId) {
        const cleanNat = String(updatedData.nationalId).replace(/\D/g, '');
        if (cleanNat.length !== 13) {
          setMessage(`❌ เลขบัตรประชาชนของ "${updatedData.fullName || reg.fullName}" ไม่ครบ 13 หลัก (ปัจจุบันมี ${cleanNat.length} หลัก)`);
          return;
        }
      }
    }

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
    const { fullName, nationalId, course, quota, timeSlot, studentId, displayQueueNumber } = form;
    const cleanNat = String(nationalId || '').replace(/\D/g, '');

    if (!fullName || !cleanNat || (activity?.type === 'queue' && (!course || !timeSlot))) {
      setMessage('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (cleanNat.length !== 13) {
      setMessage('❌ เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลักเท่านั้น');
      return;
    }

    try {
      const qDuplicate = query(
        collection(db, 'registrations'),
        where('activityId', '==', activityId),
        where('nationalId', '==', cleanNat)
      );
      const duplicateSnapshot = await getDocs(qDuplicate);

      if (!duplicateSnapshot.empty) {
        setMessage('❌ ไม่สามารถลงทะเบียนได้: เลขบัตรประชาชนนี้ได้ลงทะเบียนในกิจกรรมนี้ไปแล้ว');
        return;
      }

      const batch = writeBatch(db);
      let lineUserIdToUse = null;

      const q = query(collection(db, 'studentProfiles'), where('nationalId', '==', cleanNat), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const profileDoc = snapshot.docs[0];
        lineUserIdToUse = profileDoc.data().lineUserId;
        batch.update(doc(db, 'studentProfiles', profileDoc.id), {
          fullName,
          studentId: studentId || profileDoc.data().studentId,
          nationalId: cleanNat,
          updatedAt: serverTimestamp()
        });
      } else {
        const newProfileRef = doc(collection(db, 'studentProfiles'));
        batch.set(newProfileRef, {
          fullName,
          studentId: studentId || '',
          nationalId: cleanNat,
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
        nationalId: cleanNat,
        course: course || null,
        quota: quota || null,
        timeSlot: timeSlot || null,
        status: form.status || 'registered',
        registeredBy: 'admin_manual_add',
        registeredAt: serverTimestamp(),
        lineUserId: lineUserIdToUse,
        displayQueueNumber: displayQueueNumber || null,
      });

      await batch.commit();

      setMessage('✅ เพิ่มรายชื่อสำเร็จ!');
      setForm({ fullName: '', studentId: '', nationalId: '', course: '', quota: '', timeSlot: '', displayQueueNumber: '', status: 'registered' });
      fetchData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
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
          setMessage('✅ ลบข้อมูลสำเร็จ');
          fetchData();
          setTimeout(() => setMessage(''), 3000);
        } catch (error) {
          setMessage(`❌ เกิดข้อผิดพลาดในการลบ: ${error.message}`);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteAll = () => {
    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการลบข้อมูลทั้งหมด',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมดสำหรับกิจกรรมนี้? การกระทำนี้ไม่สามารถกู้คืนได้',
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
    let zoneDetailsText = '';
    if (activity?.type === 'exam') {
      const config = activity.examConfig || {};
      const zoneCount = Number(config.zoneCount || 4);
      const rows = Number(config.rows || 10);
      const cols = Number(config.cols || 10);
      const seatsPerZone = rows * cols;
      const labelFormat = config.labelFormat || 'numberOnly';

      let zones = [];
      if (Array.isArray(config.zones) && config.zones.length > 0 && typeof config.zones[0] === 'object') {
        zones = config.zones.map((z, i) => {
          const startNum = z.startNumber !== undefined ? Number(z.startNumber) : (i * seatsPerZone) + 1;
          return {
            name: z.name || String(i + 1),
            startNumber: startNum,
            endNumber: z.endNumber !== undefined ? Number(z.endNumber) : startNum + seatsPerZone - 1
          };
        });
      } else {
        zones = Array.from({ length: zoneCount }, (_, i) => {
          const startNum = (i * seatsPerZone) + 1;
          return {
            name: String(i + 1),
            startNumber: startNum,
            endNumber: startNum + seatsPerZone - 1
          };
        });
      }

      zoneDetailsText = zones.map(z => `  • โซน ${z.name}: ${formatSeatLabel(z.name, z.startNumber, labelFormat)} - ${formatSeatLabel(z.name, z.endNumber, labelFormat)} (${seatsPerZone} ที่นั่ง)`).join('\n');
    }

    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการจัดที่นั่งอัตโนมัติ',
      message: `คุณต้องการจัดที่นั่งอัตโนมัติให้นักเรียนทั้งหมด ${registrants.length} คน ใช่หรือไม่?${zoneDetailsText ? '\n\nช่วงเลขที่นั่งแต่ละโซน:\n' + zoneDetailsText : ''}\n\n* ข้อมูลเลขที่นั่งเดิมจะถูกเขียนทับ`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        setMessage('กำลังจัดที่นั่ง...');

        try {
          const sortedList = [...registrants].sort((a, b) => {
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

          if (activity?.type === 'exam') {
            const config = activity.examConfig || {};
            const zoneCount = Number(config.zoneCount || 4);
            const rows = Number(config.rows || 10);
            const cols = Number(config.cols || 10);
            const seatsPerZone = rows * cols;
            const labelFormat = config.labelFormat || (config.zones?.[0]?.name && /^[A-Za-z]+$/.test(config.zones[0].name) ? 'withZone' : 'numberOnly');

            let zones = [];
            if (Array.isArray(config.zones) && config.zones.length > 0 && typeof config.zones[0] === 'object') {
              zones = config.zones.map((z, i) => {
                const startNum = z.startNumber !== undefined ? Number(z.startNumber) : (i * seatsPerZone) + 1;
                return {
                  name: z.name || String(i + 1),
                  startNumber: startNum,
                  endNumber: z.endNumber !== undefined ? Number(z.endNumber) : startNum + seatsPerZone - 1
                };
              });
            } else {
              const isAlpha = Array.isArray(config.zones) && typeof config.zones[0] === 'string';
              zones = Array.from({ length: zoneCount }, (_, i) => {
                const startNum = (i * seatsPerZone) + 1;
                return {
                  name: isAlpha ? config.zones[i] : String(i + 1),
                  startNumber: startNum,
                  endNumber: startNum + seatsPerZone - 1
                };
              });
            }

            const availableSeats = [];
            zones.forEach(z => {
              for (let s = 0; s < seatsPerZone; s++) {
                const runningNumber = z.startNumber + s;
                const seatLabel = formatSeatLabel(z.name, runningNumber, labelFormat);
                availableSeats.push(seatLabel);
              }
            });

            for (const reg of sortedList) {
              if (currentSeatIndex >= availableSeats.length) break;
              const seatLabel = availableSeats[currentSeatIndex];

              const regRef = doc(db, 'registrations', reg.id);
              batch.update(regRef, { seatNumber: seatLabel });

              updates.push({ id: reg.id, seatNumber: seatLabel });
              currentSeatIndex++;
            }
          } else if (activity?.type === 'graduation') {
            const tConfig = activity.theaterConfig || {};
            const studentRows = tConfig.studentRows !== undefined ? Number(tConfig.studentRows) : 18;
            const seatsPerRow = tConfig.seatsPerRow !== undefined ? Number(tConfig.seatsPerRow) : 10;
            const ajInterval = tConfig.ajInterval !== undefined ? Number(tConfig.ajInterval) : 3;
            const ajRowsCustom = tConfig.ajRowsCustom || '';

            let targetAjRows = [];
            if (ajRowsCustom && ajRowsCustom.trim()) {
              targetAjRows = ajRowsCustom
                .split(',')
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n) && n >= 1 && n <= studentRows);
            } else if (ajInterval > 0) {
              for (let r = 1; r <= studentRows; r += ajInterval) {
                targetAjRows.push(r);
              }
            }

            const ajSeatsSet = new Set();
            targetAjRows.forEach(r => {
              ajSeatsSet.add(`A${r}-1`);
              ajSeatsSet.add(`B${r}-${seatsPerRow}`);
            });

            const availableSeats = [];
            for (let s = 1; s <= studentRows; s++) {
              for (let col = 1; col <= seatsPerRow; col++) {
                const seatLabel = `A${s}-${col}`;
                if (!ajSeatsSet.has(seatLabel)) availableSeats.push(seatLabel);
              }
              for (let col = 1; col <= seatsPerRow; col++) {
                const seatLabel = `B${s}-${col}`;
                if (!ajSeatsSet.has(seatLabel)) availableSeats.push(seatLabel);
              }
            }

            for (const reg of sortedList) {
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
          setTimeout(() => setMessage(''), 3000);

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
          'ประเภทโควตา': 'quota',
          'โควตา': 'quota',
          'quota': 'quota',
          'Quota': 'quota',
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
          const existingNationalIds = new Set(registrants.map(r => r.nationalId));
          let skippedCount = 0;
          let invalidNatIdCount = 0;

          for (let i = 0; i < mappedData.length; i++) {
            const reg = mappedData[i];
            if (reg.fullName && reg.nationalId) {
              const cleanNat = String(reg.nationalId).replace(/\D/g, '');
              if (cleanNat.length !== 13) {
                invalidNatIdCount++;
                continue;
              }
              reg.nationalId = cleanNat;

              if (existingNationalIds.has(reg.nationalId)) {
                skippedCount++;
                continue;
              }
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
                quota: reg.quota || null,
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
          let msg = `✅ นำเข้าข้อมูล ${mappedData.length - skippedCount - invalidNatIdCount} รายการสำเร็จ!`;
          if (skippedCount > 0) msg += ` (ข้ามที่ซ้ำ ${skippedCount} รายการ)`;
          if (invalidNatIdCount > 0) msg += ` (ข้ามเลขบัตรไม่ครบ 13 หลัก ${invalidNatIdCount} รายการ)`;
          setMessage(msg);
          await fetchData();
          setTimeout(() => setMessage(''), 4000);
        } catch (error) {
          setMessage(`❌ เกิดข้อผิดพลาดในการนำเข้า: ${error.message}`);
        }
      },
      error: (error) => {
        setMessage(`❌ เกิดข้อผิดพลาดในการอ่านไฟล์ CSV: ${error.message}`);
      }
    });
  };

  const isQueueType = activity?.type === 'queue' || activity?.type === 'interview';
  const isSeatType = activity?.type === 'exam' || activity?.type === 'graduation';
  const isGeneralEvent = !isQueueType && !isSeatType;
  const quotaOptions = activity?.scoringConfig?.quotaCriteriaList || [];

  const csvExportHeaders = [
    { label: "ลำดับ", key: "index" },
    { label: "ชื่อ-สกุล", key: "fullName" },
    { label: "รหัสผู้สมัคร", key: "studentId" },
    { label: "เลขบัตรประชาชน", key: "nationalId" },
    { label: "ประเภทโควตา", key: "quota" },
    { label: "สถานะ", key: "status" },
    { label: "หลักสูตร", key: "course" },
    ...(isSeatType ? [{ label: "เลขที่นั่ง", key: "seatNumber" }] : []),
    ...(isQueueType ? [
      { label: "ช่วงเวลา", key: "timeSlot" },
      { label: "คิว", key: "displayQueueNumber" }
    ] : []),
    ...(activity?.enableScoring && activity?.scoringConfig ? [
      ...(activity.scoringConfig.generalCriteria || []).map(g => ({
        label: `คะแนน: ${g.name} (${g.weight}%)`,
        key: `score_general_${g.id}`
      })),
      { label: "คะแนนถ่วงน้ำหนักรวม (%)", key: "finalTotalScore" },
      { label: "สถานะการประเมิน", key: "scoringStatus" },
      { label: "กรรมการผู้ประเมิน", key: "examinerName" },
      { label: "ข้อเสนอแนะกรรมการ", key: "examinerNotes" },
      { label: "ลิงก์รูปถ่ายหลักฐาน (1)", key: "evidence_0" },
      { label: "ลิงก์รูปถ่ายหลักฐาน (2)", key: "evidence_1" },
      { label: "ลิงก์รูปถ่ายหลักฐาน (3)", key: "evidence_2" },
      { label: "ลิงก์รูปถ่ายหลักฐาน (4)", key: "evidence_3" },
      { label: "ลิงก์รูปถ่ายหลักฐาน (5)", key: "evidence_4" },
    ] : [])
  ];

  const csvExportData = registrants.map((reg, idx) => {
    const evalScore = reg.evaluationScore || {};
    const attached = reg.attachedDocuments || {};
    const row = {
      index: idx + 1,
      fullName: reg.fullName || '',
      studentId: reg.studentId || '',
      nationalId: reg.nationalId || '',
      quota: reg.quota || evalScore.quota || '-',
      status: translateStatus(reg.status),
      course: reg.course || '',
      seatNumber: reg.seatNumber || '',
      timeSlot: reg.timeSlot || '',
      displayQueueNumber: reg.displayQueueNumber || '',
      finalTotalScore: evalScore.isScored ? `${evalScore.finalTotalScore}` : '-',
      scoringStatus: evalScore.isScored ? 'ประเมินแล้ว' : 'รอประเมิน',
      examinerName: evalScore.examinerName || '-',
      examinerNotes: evalScore.notes || '-'
    };

    if (activity?.enableScoring && activity?.scoringConfig) {
      // General criteria scores
      (activity.scoringConfig.generalCriteria || []).forEach(g => {
        const raw = evalScore.generalScores?.[g.id];
        row[`score_general_${g.id}`] = raw !== undefined ? raw : '-';
      });

      // Evidence Photo URLs
      const photoUrls = [];
      if (Array.isArray(attached.evidence)) {
        photoUrls.push(...attached.evidence);
      } else if (Array.isArray(attached)) {
        photoUrls.push(...attached);
      } else if (typeof attached === 'object') {
        Object.values(attached).forEach(val => {
          if (Array.isArray(val)) photoUrls.push(...val);
          else if (typeof val === 'string' && val) photoUrls.push(val);
        });
      }
      for (let i = 0; i < 5; i++) {
        row[`evidence_${i}`] = photoUrls[i] || '';
      }
    }

    return row;
  });

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
        const cfg = activity?.examConfig;
        if (cfg && Array.isArray(cfg.zones) && cfg.zones.length > 0 && typeof cfg.zones[0] === 'object') {
          const num = parseInt(curr.seatNumber.replace(/^[A-Za-z0-9]+-/, ''), 10);
          let foundZone = null;
          for (const z of cfg.zones) {
            if (curr.seatNumber.startsWith(`${z.name}-`) || curr.seatNumber.startsWith(z.name)) {
              foundZone = `โซน ${z.name}`;
              break;
            }
            if (!isNaN(num) && num >= z.startNumber && num <= (z.endNumber || (z.startNumber + (cfg.rows * cfg.cols) - 1))) {
              foundZone = `โซน ${z.name}`;
              break;
            }
          }
          const zoneKey = foundZone || 'Other';
          acc[zoneKey] = (acc[zoneKey] || 0) + 1;
        } else {
          const match = curr.seatNumber.match(/^([A-Za-z]+)/);
          const zone = match ? `โซน ${match[1]}` : 'Other';
          acc[zone] = (acc[zone] || 0) + 1;
        }
      }
      return acc;
    }, {})
  };

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

  const handleResetAllCounters = async () => {
    const coursesInActivity = [...new Set(registrants.map(r => r.course).filter(Boolean))];
    if (coursesInActivity.length === 0) {
      setMessage('❌ ไม่มีหลักสูตรที่จะรีเซ็ต');
      return;
    }

    const summaryLines = [];
    const resetCounters = {};

    coursesInActivity.forEach(courseName => {
      const queueNumbers = registrants
        .filter(r => r.course === courseName && r.displayQueueNumber)
        .map(r => parseInt(r.displayQueueNumber.replace(/\D/g, ''), 10) || 0)
        .filter(n => n > 0)
        .sort((a, b) => a - b);

      let nextNumber = 1;
      for (const num of queueNumbers) {
        if (num > nextNumber) {
          break;
        }
        nextNumber = num + 1;
      }

      resetCounters[courseName] = nextNumber - 1;
      const courseInfo = courseOptions.find(c => c.name === courseName);
      const prefix = courseInfo?.shortName || '';
      summaryLines.push(`${courseName}: ${prefix}-${String(nextNumber).padStart(3, '0')}`);
    });

    const confirmed = await showConfirm({
      title: 'รีเซ็ต Counter คิว',
      message: `รีเซ็ต Counter เพื่อหาเลขที่หายไป:\n\nคิวถัดไป:\n${summaryLines.join('\n')}\n\nต้องการดำเนินการต่อหรือไม่?`,
      type: 'warning',
      confirmText: 'รีเซ็ต Counter',
      cancelText: 'ยกเลิก'
    });

    if (!confirmed) return;

    try {
      const activityRef = doc(db, 'activities', activityId);
      await updateDoc(activityRef, { queueCounters: resetCounters });
      setActivity(prev => ({ ...prev, queueCounters: resetCounters }));
      showToast({ message: 'รีเซ็ต Counter เรียบร้อยแล้ว', type: 'success' });
    } catch (error) {
      showAlert({
        title: 'เกิดข้อผิดพลาด',
        message: `ไม่สามารถรีเซ็ตได้: ${error.message}`,
        type: 'error'
      });
    }
  };


  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        กำลังโหลดข้อมูลนักเรียนและที่นั่ง...
      </div>
    );
  }

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <span className="text-slate-300 ml-1">⇅</span>;
    return sortConfig.direction === 'asc' ? <span className="text-[#0b0084] ml-1">↑</span> : <span className="text-[#0b0084] ml-1">↓</span>;
  };

  return (
    <div className="p-4 md:p-6 space-y-3">
      {/* Top Header */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/activity"
            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="กลับหน้ารายการกิจกรรม"
          >
            ←
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">
              {activity?.type === 'queue' ? 'จัดการข้อมูลนักเรียน & คิว' : activity?.type === 'event' ? 'จัดการข้อมูลผู้ลงทะเบียน' : 'จัดการข้อมูลนักเรียน & ที่นั่ง'}
            </h1>
            <p className="text-xs text-slate-500">{activity?.name} (ประเภท: {activity?.type})</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(activity?.type === 'exam' || activity?.type === 'graduation') && (
            <Link
              href={`/admin/activity/seats/${activityId}/chart`}
              className="px-4 py-2 bg-[#166E7C] hover:bg-[#0F5661] text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>🗺️ ผังที่นั่ง</span>
            </Link>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-2.5 rounded text-xs border ${message.includes('❌') || message.includes('ข้อผิดพลาด') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {message}
        </div>
      )}

      {/* Control Tools Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Import/Export Card */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-slate-900 uppercase">นำเข้า / ส่งออกข้อมูล</h2>
            <div>
              <label className="block text-[11px] text-slate-600 mb-1">นำเข้าไฟล์ CSV</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-slate-200 file:text-xs file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 cursor-pointer border border-slate-200 rounded p-1 bg-white"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Header: fullName, studentId, nationalId, course, quota{isSeatType ? ', seatNumber' : ''}{isQueueType ? ', timeSlot, displayQueueNumber' : ''}, status
              </span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <CSVLink
              data={csvExportData}
              headers={csvExportHeaders}
              filename={`registrants_${activityId}.csv`}
              className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg text-center block transition-colors"
            >
              Export CSV ทั้งหมด ({registrants.length})
            </CSVLink>

            {(activity?.type === 'exam' || activity?.type === 'graduation') && (
              <div className="flex gap-2">
                <button
                  onClick={() => setSortConfig({ key: 'fullName', direction: 'asc' })}
                  className="flex-1 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  เรียง ก-ฮ
                </button>
                <button
                  onClick={handleAutoAssign}
                  disabled={isLoading}
                  className="flex-1 py-2 bg-[#166E7C] hover:bg-[#0F5661] text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  จัดที่นั่ง Auto
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Add Participant Card */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
          <h2 className="text-xs font-semibold text-slate-900 uppercase">เพิ่มนักเรียนรายบุคคล</h2>
          <form onSubmit={handleAddParticipant} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={e => setForm({ ...form, fullName: e.target.value })}
                  placeholder="ชื่อ-สกุล *"
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800 outline-none focus:border-slate-400"
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  value={form.studentId}
                  onChange={e => setForm({ ...form, studentId: e.target.value })}
                  placeholder="รหัสผู้สมัคร"
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800 outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="tel"
                  value={form.nationalId}
                  onChange={e => setForm({ ...form, nationalId: e.target.value.replace(/\D/g, '').slice(0, 13) })}
                  placeholder="เลขบัตร ปชช. (13 หลัก) *"
                  maxLength={13}
                  pattern="\d{13}"
                  title="กรุณากรอกเลขบัตรประชาชน 13 หลัก"
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800 outline-none focus:border-slate-400 font-mono"
                  required
                />
              </div>
              <div>
                <select
                  value={form.course}
                  onChange={e => setForm({ ...form, course: e.target.value })}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none"
                >
                  <option value="">เลือกหลักสูตร</option>
                  {courseOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {quotaOptions.length > 0 && (
              <div>
                <select
                  value={form.quota}
                  onChange={e => setForm({ ...form, quota: e.target.value })}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none"
                >
                  <option value="">เลือกประเภทโควตา (เว้นว่างได้)</option>
                  {quotaOptions.map((q, idx) => (
                    <option key={idx} value={q.quotaName}>{q.quotaName}</option>
                  ))}
                </select>
              </div>
            )}

            {activity?.type === 'queue' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <select
                    value={form.timeSlot}
                    onChange={e => setForm({ ...form, timeSlot: e.target.value })}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none"
                    required
                  >
                    <option value="">เลือกช่วงเวลา *</option>
                    {timeSlotOptions.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <input
                    type="text"
                    value={form.displayQueueNumber}
                    onChange={e => setForm({ ...form, displayQueueNumber: e.target.value })}
                    placeholder="เลขคิว (เว้นว่างได้)"
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-[#166E7C] hover:bg-[#0F5661] text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              + เพิ่มรายชื่อ
            </button>

          </form>
        </div>

        {/* Queue Counter Card (If Queue Type) */}
        {activity?.type === 'queue' ? (
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-900 uppercase">จัดการ Counter คิว</h2>
              <button
                onClick={handleResetAllCounters}
                className="text-[11px] text-red-600 hover:underline"
              >
                รีเซ็ตทั้งหมด
              </button>
            </div>

            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {courseOptions.filter(course => registrants.some(r => r.course === course.name)).map(course => {
                const currentCounter = activity?.queueCounters?.[course.name] || 0;
                const nextQueue = currentCounter + 1;
                const isEditing = editingCounter?.courseName === course.name;

                return (
                  <div key={course.id} className="p-1.5 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between gap-2">
                    <span className="truncate flex-1 font-medium text-slate-800">{course.name}</span>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editingCounter.value}
                          onChange={(e) => setEditingCounter({ ...editingCounter, value: e.target.value })}
                          className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs bg-white"
                          min="0"
                        />
                        <button onClick={handleUpdateCounter} className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px]">✓</button>
                        <button onClick={() => setEditingCounter(null)} className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px]">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Counter: <strong className="text-slate-800">{currentCounter}</strong></span>
                        <span className="text-blue-600 font-medium">Next: {course.shortName}-{String(nextQueue).padStart(3, '0')}</span>
                        <button
                          onClick={() => setEditingCounter({ courseName: course.name, value: currentCounter })}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          ✎
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : isGeneralEvent ? (
          /* Summary Snapshot Card for General Event (No seats) */
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between space-y-2">
            <h2 className="text-xs font-semibold text-slate-900 uppercase">สรุปภาพรวมผู้สมัคร</h2>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                <span className="text-slate-500 block text-[11px]">ทั้งหมด</span>
                <span className="text-sm font-semibold text-slate-900">{stats.total} คน</span>
              </div>
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded">
                <span className="text-emerald-700 block text-[11px]">เช็คอินแล้ว</span>
                <span className="text-sm font-semibold text-emerald-800">{stats.byStatus['checked-in'] || 0} คน</span>
              </div>
              <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                <span className="text-blue-700 block text-[11px]">ลงทะเบียนแล้ว</span>
                <span className="text-sm font-semibold text-blue-800">{stats.byStatus['registered'] || 0} คน</span>
              </div>
            </div>
          </div>
        ) : (
          /* Summary Snapshot Card for Exam / Grad */
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between space-y-2">
            <h2 className="text-xs font-semibold text-slate-900 uppercase">สรุปภาพรวมผู้สมัคร</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                <span className="text-slate-500 block text-[11px]">ทั้งหมด</span>
                <span className="text-sm font-semibold text-slate-900">{stats.total} คน</span>
              </div>
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded">
                <span className="text-emerald-700 block text-[11px]">เช็คอินแล้ว</span>
                <span className="text-sm font-semibold text-emerald-800">{stats.byStatus['checked-in'] || 0} คน</span>
              </div>
              <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                <span className="text-blue-700 block text-[11px]">ลงทะเบียนแล้ว</span>
                <span className="text-sm font-semibold text-blue-800">{stats.byStatus['registered'] || 0} คน</span>
              </div>
              <div className="p-2 bg-purple-50 border border-purple-200 rounded">
                <span className="text-purple-700 block text-[11px]">จัดที่นั่งแล้ว</span>
                <span className="text-sm font-semibold text-purple-800">{registrants.filter(r => r.seatNumber).length} คน</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Registrants Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 bg-slate-50">
          <span className="text-xs font-semibold text-slate-800">
            รายชื่อผู้ลงทะเบียน ({registrants.length} คน)
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setShowSummary(true)}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded transition-colors"
            >
              📊 สรุปยอด
            </button>

            {isEditMode ? (
              <>
                <button
                  onClick={handleUpdateAll}
                  disabled={isLoading}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
                </button>
                <button
                  onClick={handleCancelAll}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded transition-colors"
                >
                  ยกเลิก
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditMode(true)}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded transition-colors"
              >
                ✎ แก้ไขตาราง
              </button>
            )}

            <button
              onClick={handleDeleteAll}
              disabled={isLoading}
              className="px-2.5 py-1 bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs rounded transition-colors"
            >
              ลบทั้งหมด
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-3 py-2.5 w-10 text-center border-r border-slate-200">#</th>
                <th className="px-3 py-2.5 min-w-[160px] border-r border-slate-200 cursor-pointer hover:text-slate-900" onClick={() => handleSort('fullName')}>
                  <div className="flex items-center justify-between">ชื่อ-สกุล <SortIcon columnKey="fullName" /></div>
                </th>
                <th className="px-3 py-2.5 w-28 border-r border-slate-200 cursor-pointer hover:text-slate-900" onClick={() => handleSort('studentId')}>
                  <div className="flex items-center justify-between">รหัสผู้สมัคร <SortIcon columnKey="studentId" /></div>
                </th>
                <th className="px-3 py-2.5 w-32 border-r border-slate-200 cursor-pointer hover:text-slate-900" onClick={() => handleSort('nationalId')}>
                  <div className="flex items-center justify-between">เลขบัตร ปชช. <SortIcon columnKey="nationalId" /></div>
                </th>
                <th className="px-3 py-2.5 w-28 text-center border-r border-slate-200 cursor-pointer hover:text-slate-900" onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-between">สถานะ <SortIcon columnKey="status" /></div>
                </th>
                <th className="px-3 py-2.5 min-w-[140px] border-r border-slate-200 cursor-pointer hover:text-slate-900" onClick={() => handleSort('course')}>
                  <div className="flex items-center justify-between">หลักสูตร <SortIcon columnKey="course" /></div>
                </th>
                <th className="px-3 py-2.5 min-w-[130px] border-r border-slate-200 cursor-pointer hover:text-slate-900" onClick={() => handleSort('quota')}>
                  <div className="flex items-center justify-between">ประเภทโควตา <SortIcon columnKey="quota" /></div>
                </th>

                {isQueueType && (
                  <>
                    <th className="px-3 py-2.5 w-28 border-r border-slate-200 cursor-pointer hover:text-slate-900" onClick={() => handleSort('timeSlot')}>
                      <div className="flex items-center justify-between">ช่วงเวลา <SortIcon columnKey="timeSlot" /></div>
                    </th>
                    <th className="px-3 py-2.5 w-24 text-center border-r border-slate-200 cursor-pointer hover:text-slate-900" onClick={() => handleSort('displayQueueNumber')}>
                      <div className="flex items-center justify-between">คิว <SortIcon columnKey="displayQueueNumber" /></div>
                    </th>
                  </>
                )}

                {isSeatType && (
                  <th className="px-3 py-2.5 w-24 text-center border-r border-slate-200 cursor-pointer hover:text-slate-900" onClick={() => handleSort('seatNumber')}>
                    <div className="flex items-center justify-between">ที่นั่ง <SortIcon columnKey="seatNumber" /></div>
                  </th>
                )}

                {activity?.enableScoring && (
                  <th className="px-3 py-2.5 w-32 text-center border-r border-slate-200 whitespace-nowrap">
                    คะแนนรวม
                  </th>
                )}

                <th className="px-3 py-2.5 w-16 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedRegistrants.map((reg, index) => {
                const isEditing = isEditMode;
                return (
                  <tr key={reg.id} className={`transition-colors ${isEditing ? 'bg-amber-50/50' : 'hover:bg-slate-50/70'}`}>
                    <td className="px-3 py-2 text-center text-slate-400 border-r border-slate-100 bg-slate-50/40">{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editStates[reg.id]?.fullName || ''}
                          onChange={(e) => handleInputChange(reg.id, 'fullName', e.target.value)}
                          className="w-full px-2 py-0.5 bg-white border border-slate-300 rounded text-xs"
                        />
                      ) : (
                        reg.fullName
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 border-r border-slate-100">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editStates[reg.id]?.studentId || ''}
                          onChange={(e) => handleInputChange(reg.id, 'studentId', e.target.value)}
                          className="w-full px-2 py-0.5 bg-white border border-slate-300 rounded text-xs"
                        />
                      ) : (
                        reg.studentId || '-'
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 border-r border-slate-100">
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editStates[reg.id]?.nationalId || ''}
                          onChange={(e) => handleInputChange(reg.id, 'nationalId', e.target.value)}
                          maxLength={13}
                          className="w-full px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-mono"
                        />
                      ) : (
                        reg.nationalId
                      )}
                    </td>
                    <td className="px-3 py-2 text-center border-r border-slate-100">
                      {isEditing ? (
                        <select
                          value={editStates[reg.id]?.status || 'registered'}
                          onChange={(e) => handleInputChange(reg.id, 'status', e.target.value)}
                          className="w-full px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs"
                        >
                          <option value="registered">ลงทะเบียนแล้ว</option>
                          <option value="checked-in">เช็คอินแล้ว</option>
                          <option value="calling">กำลังเรียก</option>
                          <option value="called">เรียกคิวแล้ว</option>
                          <option value="waitlisted">รอคิว</option>
                          <option value="interviewing">สอบสัมภาษณ์</option>
                          <option value="completed">สำเร็จแล้ว</option>
                          <option value="cancelled">ยกเลิกแล้ว</option>
                        </select>
                      ) : (
                        <StatusBadge status={reg.status} />
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 border-r border-slate-100">
                      {isEditing ? (
                        <select
                          value={editStates[reg.id]?.course || ''}
                          onChange={(e) => handleInputChange(reg.id, 'course', e.target.value)}
                          className="w-full px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs"
                        >
                          <option value="">เลือกหลักสูตร</option>
                          {courseOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      ) : (
                        reg.course || '-'
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 border-r border-slate-100">
                      {isEditing ? (
                        quotaOptions.length > 0 ? (
                          <select
                            value={editStates[reg.id]?.quota || ''}
                            onChange={(e) => handleInputChange(reg.id, 'quota', e.target.value)}
                            className="w-full px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs"
                          >
                            <option value="">- เลือกโควตา -</option>
                            {quotaOptions.map((q, qIdx) => (
                              <option key={qIdx} value={q.quotaName}>{q.quotaName}</option>
                            ))}
                            {editStates[reg.id]?.quota && !quotaOptions.some(q => q.quotaName === editStates[reg.id]?.quota) && (
                              <option value={editStates[reg.id].quota}>{editStates[reg.id].quota}</option>
                            )}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={editStates[reg.id]?.quota || ''}
                            onChange={(e) => handleInputChange(reg.id, 'quota', e.target.value)}
                            placeholder="ระบุโควตา"
                            className="w-full px-2 py-0.5 bg-white border border-slate-300 rounded text-xs"
                          />
                        )
                      ) : (
                        (reg.quota || reg.evaluationScore?.quota) ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium border border-slate-200">
                            {reg.quota || reg.evaluationScore?.quota}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )
                      )}
                    </td>

                    {isQueueType && (
                      <>
                        <td className="px-3 py-2 text-slate-600 border-r border-slate-100">
                          {isEditing ? (
                            <select
                              value={editStates[reg.id]?.timeSlot || ''}
                              onChange={(e) => handleInputChange(reg.id, 'timeSlot', e.target.value)}
                              className="w-full px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs"
                            >
                              <option value="">เลือกช่วงเวลา</option>
                              {timeSlotOptions.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                            </select>
                          ) : (
                            reg.timeSlot || '-'
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-[#0b0084] font-medium border-r border-slate-100">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editStates[reg.id]?.displayQueueNumber || ''}
                              onChange={(e) => handleInputChange(reg.id, 'displayQueueNumber', e.target.value)}
                              className="w-full px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs text-center"
                            />
                          ) : (
                            reg.displayQueueNumber || '-'
                          )}
                        </td>
                      </>
                    )}

                    {isSeatType && (
                      <td className="px-3 py-2 text-center text-[#0b0084] font-medium border-r border-slate-100">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editStates[reg.id]?.seatNumber || ''}
                            onChange={(e) => handleInputChange(reg.id, 'seatNumber', e.target.value)}
                            className="w-full px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs text-center uppercase"
                          />
                        ) : (
                          reg.seatNumber || '-'
                        )}
                      </td>
                    )}

                    {activity?.enableScoring && (
                      <td className="px-3 py-2 text-center border-r border-slate-100 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {reg.evaluationScore?.isScored ? (
                            <button
                              type="button"
                              onClick={() => setScoringRegistrant(reg)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all cursor-pointer"
                              title="คลิกเพื่อแก้ไขคะแนนและรูปถ่ายหลักฐาน"
                            >
                              <span>{reg.evaluationScore.finalTotalScore}</span>
                              <span className="text-[11px]">📝</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setScoringRegistrant(reg)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-500 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer"
                              title="คลิกเพื่อบันทึกคะแนนและรูปถ่ายหลักฐาน"
                            >
                              <span>รอประเมิน</span>
                              <span className="text-[11px]">📝</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}

                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteRegistrant(reg.id)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title="ลบรายชื่อ"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}

              {sortedRegistrants.length === 0 && (
                <tr>
                  <td colSpan={activity?.type === 'queue' ? (activity?.enableScoring ? 10 : 9) : (activity?.enableScoring ? 9 : 8)} className="p-8 text-center text-slate-400 text-xs">
                    ยังไม่มีผู้ลงทะเบียนในกิจกรรมนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-slate-300 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">สรุปข้อมูลการลงทะเบียน</h3>
                <p className="text-xs text-slate-500">{activity?.name}</p>
              </div>
              <button
                onClick={() => setShowSummary(false)}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">ทั้งหมด</span>
                  <span className="text-base font-bold text-slate-900">{stats.total}</span>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded border border-emerald-200">
                  <span className="text-emerald-700 block text-[11px]">เช็คอินแล้ว</span>
                  <span className="text-base font-bold text-emerald-800">{stats.byStatus['checked-in'] || 0}</span>
                </div>
                <div className="bg-amber-50 p-2.5 rounded border border-amber-200">
                  <span className="text-amber-700 block text-[11px]">รอคิว</span>
                  <span className="text-base font-bold text-amber-800">{stats.byStatus['waitlisted'] || 0}</span>
                </div>
                <div className="bg-indigo-50 p-2.5 rounded border border-indigo-200">
                  <span className="text-indigo-700 block text-[11px]">สอบสัมภาษณ์</span>
                  <span className="text-base font-bold text-indigo-800">{stats.byStatus['interviewing'] || 0}</span>
                </div>
                <div className="bg-purple-50 p-2.5 rounded border border-purple-200">
                  <span className="text-purple-700 block text-[11px]">สำเร็จ</span>
                  <span className="text-base font-bold text-purple-800">{stats.byStatus['completed'] || 0}</span>
                </div>
              </div>

              {/* Status Breakdown & Course Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                  <h4 className="font-semibold text-slate-800">แยกตามสถานะ</h4>
                  <div className="space-y-1.5">
                    {Object.entries(stats.byStatus).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center p-1.5 bg-white rounded border border-slate-200">
                        <StatusBadge status={status} />
                        <span className="font-semibold text-slate-700">{count} คน</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                  <h4 className="font-semibold text-slate-800">แยกตามหลักสูตร</h4>
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {Object.entries(stats.byCourse).sort((a, b) => b[1] - a[1]).map(([course, count]) => (
                      <div key={course} className="flex justify-between items-center p-1.5 bg-white rounded border border-slate-200">
                        <span className="truncate max-w-[70%] text-slate-700">{course}</span>
                        <span className="font-semibold text-slate-800">{count} คน</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowSummary(false)}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <CSVLink
                data={csvExportData}
                headers={csvExportHeaders}
                filename={`summary_registrants_${activityId}.csv`}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded"
              >
                Export ข้อมูลทั้งหมด
              </CSVLink>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg border border-slate-300 max-w-md w-full p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">{confirmModal.title}</h3>
            <div className="text-xs text-slate-600 whitespace-pre-line leading-relaxed font-sans">{confirmModal.message}</div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer ${
                  confirmModal.type === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#166E7C] hover:bg-[#0F5661]'
                }`}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Examiner Scoring Modal */}
      <ExaminerScoringModal
        isOpen={Boolean(scoringRegistrant)}
        onClose={() => setScoringRegistrant(null)}
        registrant={scoringRegistrant}
        activity={activity}
        onScoreSaved={(updated) => {
          setRegistrants(prev => prev.map(r => r.id === updated.id ? updated : r));
        }}
      />
    </div>
  );
}
