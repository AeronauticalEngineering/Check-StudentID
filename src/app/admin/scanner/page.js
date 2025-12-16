'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../../lib/firebase';
import {
  doc, getDoc, updateDoc, collection,
  serverTimestamp, query, where, getDocs, runTransaction, Timestamp, limit, addDoc, orderBy
} from 'firebase/firestore';
import { createCheckInSuccessFlex, createEvaluationRequestFlex, createQueueCheckInSuccessFlex } from '../../../lib/flexMessageTemplates';

// --- Helper Functions ---
const translateStatus = (status) => {
  switch (status) {
    case 'checked-in': return 'เช็คอินแล้ว';
    case 'registered': return 'ลงทะเบียนแล้ว';
    case 'completed': return 'จบกิจกรรมแล้ว';
    case 'cancelled': return 'ยกเลิกแล้ว';
    case 'waitlisted': return 'รอคิว';
    default: return status || 'N/A';
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

const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

export default function UniversalScannerPage() {
  const [scanMode, setScanMode] = useState('check-in');
  const [searchMode, setSearchMode] = useState('scan');
  const [activities, setActivities] = useState([]);
  const [courses, setCourses] = useState({});
  const [courseOptions, setCourseOptions] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [nationalIdInput, setNationalIdInput] = useState('');
  const [scannerState, setScannerState] = useState('idle');
  const [foundData, setFoundData] = useState(null);
  const [seatNumberInput, setSeatNumberInput] = useState('');
  const [message, setMessage] = useState('');
  const qrScannerRef = useRef(null);
  const isProcessingRef = useRef(false); // [แก้ไข 1] เพิ่ม Ref

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activitiesQuery = query(collection(db, 'activities'), where("activityDate", ">=", Timestamp.fromDate(today)));
      const categoriesQuery = collection(db, 'categories');
      const coursesQuery = collection(db, 'courseOptions');

      const [activitiesSnapshot, categoriesSnapshot, coursesSnapshot] = await Promise.all([
        getDocs(activitiesQuery),
        getDocs(categoriesQuery),
        getDocs(coursesQuery)
      ]);

      const activitiesData = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      activitiesData.sort((a, b) => b.activityDate.seconds - a.activityDate.seconds);
      setActivities(activitiesData);

      const categoriesMap = {};
      categoriesSnapshot.forEach(doc => { categoriesMap[doc.id] = doc.data().name; });
      setCourses(categoriesMap);

      setCourseOptions(coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  const findLineUserId = async (nationalId) => {
    if (!nationalId) return null;
    const profileQuery = query(collection(db, 'studentProfiles'), where("nationalId", "==", nationalId), limit(1));
    const profileSnapshot = await getDocs(profileQuery);
    if (!profileSnapshot.empty) {
      return profileSnapshot.docs[0].data().lineUserId;
    }
    return null;
  };

  const stopScanner = async () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      try {
        await qrScannerRef.current.stop();
      } catch (err) {
        console.warn("Scanner stop failed.", err);
      }
    }
  };

  const resetState = () => {
    stopScanner();
    setFoundData(null);
    setSeatNumberInput('');
    setMessage('');
    setNationalIdInput('');
    setScannerState('idle');
    isProcessingRef.current = false; // [แก้ไข 4] Reset lock
  };

  const handleActivityChange = (e) => {
    const activity = activities.find(a => a.id === e.target.value);
    setSelectedActivity(activity);
    resetState();
  };

  const handleModeChange = (newMode, modeType) => {
    stopScanner().then(() => {
      if (modeType === 'scan') setScanMode(newMode);
      if (modeType === 'search') setSearchMode(newMode);
      resetState();
    });
  };

  const processId = async (registrationId) => {
    setScannerState('submitting');
    try {
      const regRef = doc(db, 'registrations', registrationId);
      const regDoc = await getDoc(regRef);

      if (!regDoc.exists() || regDoc.data().activityId !== selectedActivity.id) {
        throw new Error('QR Code หรือข้อมูลไม่ถูกต้องสำหรับกิจกรรมนี้');
      }

      const registrationData = { id: regDoc.id, ...regDoc.data() };

      if (scanMode === 'check-in' && registrationData.status === 'checked-in') {
        const queueInfo = registrationData.displayQueueNumber ? ` (${registrationData.displayQueueNumber})` : '';
        setMessage(`✅ ${registrationData.fullName} ได้เช็คอินแล้ว${queueInfo}`);
        setScannerState('idle');
        setTimeout(() => resetState(), 3000);
        return;
      }
      if (registrationData.status === 'completed') {
        setMessage(`✅ ${registrationData.fullName} ได้จบกิจกรรมไปแล้ว`);
        setScannerState('idle');
        setTimeout(() => resetState(), 3000);
        return;
      }

      setFoundData({ registration: registrationData, activity: selectedActivity });
      if (registrationData.seatNumber) setSeatNumberInput(registrationData.seatNumber);
      setMessage('');
      setScannerState('found');

    } catch (err) {
      setMessage(`❌ ${err.message}`);
      setScannerState('idle');
      // [แก้ไข 5] ถ้า error ให้ปลดล็อค (กรณีไม่ได้ไปต่อ)
      setTimeout(() => { isProcessingRef.current = false; }, 1000);
    }
  };

  const handleStartScanner = () => {
    if (!selectedActivity) {
      setMessage('กรุณาเลือกกิจกรรมก่อน');
      return;
    }

    // [แก้ไข 2] Reset Lock ก่อนเริ่ม
    isProcessingRef.current = false;

    stopScanner().then(() => {
      resetState();
      setTimeout(() => {
        setScannerState('scanning');
        qrScannerRef.current = new Html5Qrcode("reader");
        qrScannerRef.current.start(
          { facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // [แก้ไข 3] Check Lock
            if (isProcessingRef.current) return;
            isProcessingRef.current = true; // Lock ทันที

            stopScanner();
            processId(decodedText);
          }, () => { }
        ).catch(err => {
          setMessage(`ไม่สามารถเปิดกล้องได้: ${err.name}`);
          setScannerState('idle');
          isProcessingRef.current = false;
        });
      }, 100);
    });
  };

  const handleManualSearch = async (e) => {
    e.preventDefault();
    await handleModeChange(searchMode, 'search');
    setScannerState('submitting');
    try {
      const q = query(collection(db, 'registrations'), where("activityId", "==", selectedActivity.id), where("nationalId", "==", nationalIdInput.trim()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error('ไม่พบข้อมูลนักเรียนในกิจกรรมนี้');
      processId(snapshot.docs[0].id);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      setScannerState('idle');
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setScannerState('submitting');

    try {
      const settingsRef = doc(db, 'systemSettings', 'notifications');
      const settingsSnap = await getDoc(settingsRef);
      const settings = settingsSnap.exists() ? settingsSnap.data() : { onCheckIn: true, onCheckOut: true };

      const { registration, activity } = foundData;
      const lineUserId = registration.lineUserId || await findLineUserId(registration.nationalId);

      if (scanMode === 'check-in') {
        let successMessage = `✅ เช็คอิน ${registration.fullName} สำเร็จ!`;
        let flexMessage = null;
        let finalQueueData;

        if (activity.type === 'queue') {
          if (registration.displayQueueNumber) {
            // กรณีมี displayQueueNumber อยู่แล้ว (Pre-assigned เช่น ANE-085) 
            // ตรวจสอบว่าคิวนี้ถูกใช้งานโดยคนอื่นที่เช็คอินแล้วหรือยัง
            const result = await runTransaction(db, async (transaction) => {
              const regRef = doc(db, 'registrations', registration.id);
              const existingDisplayQueue = registration.displayQueueNumber;

              // ตรวจสอบว่ามีคนอื่นใช้คิวนี้และเช็คอินไปแล้วหรือยัง
              const registrationsRef = collection(db, 'registrations');
              const duplicateQuery = query(registrationsRef,
                where("activityId", "==", activity.id),
                where("displayQueueNumber", "==", existingDisplayQueue),
                where("status", "in", ["checked-in", "completed"])
              );
              const duplicateSnapshot = await getDocs(duplicateQuery);

              let finalDisplayQueue = existingDisplayQueue;
              let finalQueueNumber;

              if (!duplicateSnapshot.empty) {
                // มีคนอื่นใช้คิวนี้ไปแล้ว - ต้องสร้างคิวใหม่
                const courseName = registration.course;

                // หาเลขคิวสูงสุดจาก displayQueueNumber
                const allRegsQuery = query(registrationsRef,
                  where("activityId", "==", activity.id),
                  where("course", "==", courseName)
                );
                const allRegsSnapshot = await getDocs(allRegsQuery);

                let maxQueueNumber = 0;
                allRegsSnapshot.forEach((docSnap) => {
                  const data = docSnap.data();
                  if (data.displayQueueNumber) {
                    const extractedNum = parseInt(data.displayQueueNumber.replace(/\D/g, ''), 10) || 0;
                    if (extractedNum > maxQueueNumber) {
                      maxQueueNumber = extractedNum;
                    }
                  }
                  if (data.queueNumber && data.queueNumber > maxQueueNumber) {
                    maxQueueNumber = data.queueNumber;
                  }
                });

                finalQueueNumber = maxQueueNumber + 1;

                // สร้าง displayQueueNumber ใหม่
                const courseInfo = courseOptions.find(c => c.name === courseName);
                const prefix = courseInfo?.shortName || '';
                const paddedNumber = String(finalQueueNumber).padStart(3, '0');
                finalDisplayQueue = `${prefix}-${paddedNumber}`;

                transaction.update(regRef, {
                  status: 'checked-in',
                  queueNumber: finalQueueNumber,
                  displayQueueNumber: finalDisplayQueue
                });
              } else {
                // ยังไม่มีใครใช้คิวนี้ - ใช้คิวเดิมได้
                finalQueueNumber = parseInt(existingDisplayQueue.replace(/\D/g, ''), 10) || 0;

                transaction.update(regRef, {
                  status: 'checked-in',
                  queueNumber: finalQueueNumber
                });
              }

              // อัพเดท Counter ใน Activity
              const activityRef = doc(db, 'activities', activity.id);
              const activityDoc = await transaction.get(activityRef);
              if (activityDoc.exists()) {
                const activityData = activityDoc.data();
                const courseName = registration.course;
                let currentCounters = activityData.queueCounters || {};

                if (finalQueueNumber > (currentCounters[courseName] || 0)) {
                  const newCounters = { ...currentCounters, [courseName]: finalQueueNumber };
                  transaction.update(activityRef, { queueCounters: newCounters });
                }
              }

              return { ...registration, queueNumber: finalQueueNumber, displayQueueNumber: finalDisplayQueue };
            });
            finalQueueData = result;
            successMessage = `✅ สำเร็จ! ${finalQueueData.fullName} ได้รับคิว ${finalQueueData.displayQueueNumber} (${finalQueueData.course})`;
          } else {
            // กรณีไม่มี displayQueueNumber - ต้องสร้างใหม่ โดยใช้ queueCounters จาก Activity
            const result = await runTransaction(db, async (transaction) => {
              const regRef = doc(db, 'registrations', registration.id);
              const regDoc = await transaction.get(regRef);
              if (!regDoc.exists()) throw new Error("ไม่พบข้อมูล");
              const regData = regDoc.data();
              if (!regData.course) throw new Error('นักเรียนยังไม่ได้ถูกกำหนดหลักสูตร');

              const courseName = regData.course;

              // อ่านข้อมูล Activity เพื่อดูตัวนับ (Counter)
              const activityRef = doc(db, 'activities', selectedActivity.id);
              const activityDoc = await transaction.get(activityRef);

              if (!activityDoc.exists()) throw new Error('ไม่พบข้อมูลกิจกรรม');

              const activityData = activityDoc.data();
              let currentCounters = activityData.queueCounters || {};
              let nextQueueNumber;

              // ใช้ Counter ที่บันทึกไว้ (รองรับค่า 0 คือรีเซ็ตแล้ว) หรือหาเลขคิวสูงสุดที่เคยแจกไป
              if (currentCounters[courseName] !== undefined) {
                // Counter มีค่า (รวม 0 ที่ถูกรีเซ็ต) - ใช้ counter + 1
                nextQueueNumber = currentCounters[courseName] + 1;
              } else {
                // Fallback: หาเลขคิวสูงสุดจาก displayQueueNumber (เพราะข้อมูลที่ import อาจไม่มี queueNumber)
                const registrationsRef = collection(db, 'registrations');
                const allRegsQuery = query(registrationsRef,
                  where("activityId", "==", selectedActivity.id),
                  where("course", "==", courseName)
                );
                const allRegsSnapshot = await getDocs(allRegsQuery);

                let maxQueueNumber = 0;
                allRegsSnapshot.forEach((docSnap) => {
                  const data = docSnap.data();
                  // ดึงเลขจาก displayQueueNumber (เช่น "ANE-086" -> 86)
                  if (data.displayQueueNumber) {
                    const extractedNum = parseInt(data.displayQueueNumber.replace(/\D/g, ''), 10) || 0;
                    if (extractedNum > maxQueueNumber) {
                      maxQueueNumber = extractedNum;
                    }
                  }
                  // ดึงจาก queueNumber ด้วย (กรณีมีอยู่แล้ว)
                  if (data.queueNumber && data.queueNumber > maxQueueNumber) {
                    maxQueueNumber = data.queueNumber;
                  }
                });

                nextQueueNumber = maxQueueNumber + 1;
              }

              // สร้าง displayQueueNumber จาก prefix ของ course (รูปแบบ: ANE-001, ANE-002, ...)
              const courseInfo = courseOptions.find(c => c.name === courseName);
              const prefix = courseInfo?.shortName || '';
              const paddedNumber = String(nextQueueNumber).padStart(3, '0');
              const displayQueueNumber = `${prefix}-${paddedNumber}`;

              // บันทึก Counter ใหม่ลง Activity
              const newCounters = { ...currentCounters, [courseName]: nextQueueNumber };
              transaction.update(activityRef, { queueCounters: newCounters });

              transaction.update(regRef, {
                status: 'checked-in',
                queueNumber: nextQueueNumber,
                displayQueueNumber: displayQueueNumber
              });

              return { ...regData, queueNumber: nextQueueNumber, displayQueueNumber };
            });
            finalQueueData = result;
            successMessage = `✅ สำเร็จ! ${finalQueueData.fullName} ได้รับคิว ${finalQueueData.displayQueueNumber} (${finalQueueData.course})`;
          }

          await addDoc(collection(db, 'checkInLogs'), {
            activityId: activity.id,
            activityName: activity.name,
            studentName: finalQueueData.fullName,
            nationalId: finalQueueData.nationalId,
            status: 'checked-in',
            assignedSeat: `คิว ${finalQueueData.displayQueueNumber}`,
            timestamp: serverTimestamp(),
            adminId: 'admin'
          });

          flexMessage = createQueueCheckInSuccessFlex({
            activityName: activity.name,
            fullName: finalQueueData.fullName,
            course: finalQueueData.course,
            timeSlot: finalQueueData.timeSlot,
            queueNumber: finalQueueData.displayQueueNumber
          });

        } else { // Event type check-in
          if (!seatNumberInput.trim()) {
            setMessage("กรุณากำหนดเลขที่นั่ง");
            setScannerState('found');
            return;
          }
          const regRef = doc(db, 'registrations', registration.id);
          await updateDoc(regRef, { status: 'checked-in', seatNumber: seatNumberInput.trim() });

          await addDoc(collection(db, 'checkInLogs'), {
            activityId: activity.id,
            activityName: activity.name,
            studentName: registration.fullName,
            nationalId: registration.nationalId,
            status: 'checked-in',
            assignedSeat: seatNumberInput.trim(),
            timestamp: serverTimestamp(),
            adminId: 'admin'
          });

          flexMessage = createCheckInSuccessFlex({
            courseName: courses[activity.categoryId] || 'ทั่วไป',
            activityName: activity.name,
            fullName: registration.fullName,
            studentId: registration.studentId,
            seatNumber: seatNumberInput.trim()
          });
        }

        if (settings.onCheckIn && lineUserId && flexMessage) {
          await fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: lineUserId, flexMessage }) });
        }
        setMessage(successMessage);

      } else if (scanMode === 'check-out' && activity.enableEvaluation !== false) {
        const regRef = doc(db, 'registrations', registration.id);
        await updateDoc(regRef, { status: 'completed', completedAt: serverTimestamp() });

        await addDoc(collection(db, 'checkInLogs'), {
          activityId: activity.id,
          activityName: activity.name,
          studentName: registration.fullName,
          nationalId: registration.nationalId,
          status: 'completed',
          timestamp: serverTimestamp(),
          adminId: 'admin'
        });

        if (settings.onCheckOut && lineUserId) {
          const flexMessage = createEvaluationRequestFlex({
            activityId: registration.activityId,
            activityName: activity.name,
          });
          await fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: lineUserId, flexMessage }) });
        }
        setMessage(`✅ ${registration.fullName} จบกิจกรรมแล้ว`);
      } else {
        const regRef = doc(db, 'registrations', registration.id);
        await updateDoc(regRef, { status: 'completed', completedAt: serverTimestamp() });
        setMessage(`✅ ${registration.fullName} จบกิจกรรมแล้ว`);
      }

      setTimeout(() => resetState(), 3000);
    } catch (err) {
      setMessage(`เกิดข้อผิดพลาด: ${err.message}`);
      setScannerState('found');
    }
  };


  return (
    <div className="bg-gray-50/50 min-h-screen p-6 md:p-10">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">ระบบสแกน QR Code</h1>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Activity Selector */}
          <div className="p-6 border-b border-gray-100 bg-gray-50/30">
            <label className="block text-sm font-medium text-gray-700 mb-2">เลือกกิจกรรมที่ต้องการดำเนินการ</label>
            <div className="relative">
              <select
                onChange={handleActivityChange}
                defaultValue=""
                required
                className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none text-gray-700"
              >
                <option value="" disabled>-- กรุณาเลือกกิจกรรม --</option>
                {activities.map(act => <option key={act.id} value={act.id}>{act.name}</option>)}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          {selectedActivity && (
            <div className="p-6">
              {/* Mode Toggles */}
              <div className="flex flex-col gap-4 mb-8">
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => handleModeChange('check-in', 'scan')}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${scanMode === 'check-in' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    เช็คอินเข้างาน
                  </button>
                  <button
                    onClick={() => handleModeChange('check-out', 'scan')}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${scanMode === 'check-out' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    จบกิจกรรม
                  </button>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => handleModeChange('scan', 'search')}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${searchMode === 'scan' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    สแกน QR Code
                  </button>
                  <button
                    onClick={() => handleModeChange('manual', 'search')}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${searchMode === 'manual' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    ค้นหาด้วยเลขบัตร
                  </button>
                </div>
              </div>

              {/* Feedback Message */}
              {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.includes('✅') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                  <span className="text-xl">{message.includes('✅') ? '🎉' : '⚠️'}</span>
                  <p className="font-medium">{message.replace('✅ ', '').replace('❌ ', '')}</p>
                </div>
              )}

              {/* Scanner Area */}
              {searchMode === 'scan' && (
                <div className="flex flex-col items-center justify-center min-h-[300px] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 relative overflow-hidden">
                  <div id="reader" style={{ display: scannerState === 'scanning' ? 'block' : 'none' }} className="w-full h-full"></div>

                  {scannerState === 'idle' && (
                    <button
                      onClick={handleStartScanner}
                      className="flex flex-col items-center justify-center w-full h-full py-12 text-gray-400 hover:text-primary hover:bg-gray-100 transition-all group"
                    >
                      <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <CameraIcon />
                      </div>
                      <span className="text-lg font-semibold">แตะเพื่อเปิดกล้อง</span>
                      <span className="text-sm mt-1">อนุญาตให้เข้าถึงกล้องเพื่อสแกน</span>
                    </button>
                  )}
                </div>
              )}

              {/* Manual Search Area */}
              {searchMode === 'manual' && scannerState === 'idle' && (
                <form onSubmit={handleManualSearch} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">เลขบัตรประชาชน</label>
                    <input
                      type="tel"
                      value={nationalIdInput}
                      onChange={e => setNationalIdInput(e.target.value)}
                      required
                      pattern="\d{13}"
                      placeholder="กรอกเลขบัตร 13 หลัก"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-lg tracking-wide"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20 active:scale-95 transition-all"
                  >
                    ค้นหาข้อมูล
                  </button>
                </form>
              )}

              {/* Found Data / Confirmation Area */}
              {scannerState === 'found' && foundData && (
                <div className="mt-6 animate-fade-in">
                  <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100 mb-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      ข้อมูลผู้ลงทะเบียน
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-gray-500 text-sm">ชื่อ-สกุล</span>
                        <span className="font-semibold text-gray-900 text-right">{foundData.registration.fullName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm">สถานะปัจจุบัน</span>
                        <StatusBadge status={foundData.registration.status} />
                      </div>
                      {foundData.registration.studentId && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-sm">รหัสผู้สมัคร</span>
                          <span className="font-mono text-gray-700">{foundData.registration.studentId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleConfirm} className="space-y-4">
                    {scanMode === 'check-in' && selectedActivity.type !== 'queue' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ระบุเลขที่นั่ง (ถ้ามี)</label>
                        <input
                          type="text"
                          value={seatNumberInput}
                          onChange={e => setSeatNumberInput(e.target.value)}
                          required
                          placeholder="เช่น A1, 12, แถวหน้า"
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={resetState}
                        className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        className={`flex-[2] py-3 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all ${scanMode === 'check-in' ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'}`}
                      >
                        {scanMode === 'check-in' ? 'ยืนยันเช็คอิน' : 'ยืนยันจบกิจกรรม'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {!selectedActivity && (
            <div className="p-10 text-center text-gray-400">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <p>กรุณาเลือกกิจกรรมด้านบนเพื่อเริ่มใช้งาน</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
