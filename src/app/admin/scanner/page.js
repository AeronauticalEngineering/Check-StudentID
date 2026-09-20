'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../../lib/firebase';
import {
  doc, getDoc, updateDoc, collection,
  serverTimestamp, query, where, getDocs, runTransaction, Timestamp, limit, addDoc
} from 'firebase/firestore';
import { createCheckInSuccessFlex, createActivityCompleteFlex, createQueueCheckInSuccessFlex } from '../../../lib/flexMessageTemplates';

// Helper Functions
const translateStatus = (status) => {
  switch (status) {
    case 'checked-in': return 'เช็คอินแล้ว';
    case 'interviewing': return 'เข้าสอบสัมภาษณ์';
    case 'registered': return 'ลงทะเบียนแล้ว';
    case 'completed': return 'จบกิจกรรมแล้ว';
    case 'cancelled': return 'ยกเลิกแล้ว';
    case 'waitlisted': return 'รอคิว';
    default: return status || 'N/A';
  }
};

const StatusBadge = ({ status }) => {
  let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
  switch (status) {
    case 'checked-in': colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'; break;
    case 'interviewing': colorClass = 'bg-purple-50 text-purple-700 border-purple-200'; break;
    case 'registered': colorClass = 'bg-blue-50 text-blue-700 border-blue-200'; break;
    case 'cancelled': colorClass = 'bg-red-50 text-red-700 border-red-200'; break;
    case 'waitlisted': colorClass = 'bg-amber-50 text-amber-700 border-amber-200'; break;
    case 'completed': colorClass = 'bg-slate-100 text-slate-700 border-slate-200'; break;
  }
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-md text-sm font-normal border ${colorClass}`}>
      {translateStatus(status)}
    </span>
  );
};

const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#000946]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
  const isProcessingRef = useRef(false);

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
    isProcessingRef.current = false;
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

  const executeAdminCheckOut = async (registration, activity) => {
    setScannerState('submitting');
    try {
      const settingsRef = doc(db, 'systemSettings', 'notifications');
      const settingsSnap = await getDoc(settingsRef);
      const settings = settingsSnap.exists() ? settingsSnap.data() : { onCheckIn: true, onCheckOut: true };
      const lineUserId = registration.lineUserId || await findLineUserId(registration.nationalId);

      // Robust Evaluation Check
      if (activity.enableEvaluation !== false) {
        let hasEval = false;
        if (registration.hasEvaluated || registration.evaluated || registration.evaluationScore?.isScored) {
          hasEval = true;
        }

        if (!hasEval && registration.nationalId) {
          const rawNat = String(registration.nationalId).trim();
          const cleanNat = rawNat.replace(/\D/g, '');
          const evalQueryNat = query(
            collection(db, 'evaluations'),
            where("activityId", "==", activity.id),
            where("nationalId", "==", rawNat)
          );
          const evalSnapshotNat = await getDocs(evalQueryNat);
          if (!evalSnapshotNat.empty) {
            hasEval = true;
          } else if (cleanNat && cleanNat !== rawNat) {
            const evalQueryClean = query(
              collection(db, 'evaluations'),
              where("activityId", "==", activity.id),
              where("nationalId", "==", cleanNat)
            );
            const snapClean = await getDocs(evalQueryClean);
            if (!snapClean.empty) hasEval = true;
          }
        }

        if (!hasEval && (registration.lineUserId || lineUserId)) {
          const targetLineUser = registration.lineUserId || lineUserId;
          const evalQueryLine = query(
            collection(db, 'evaluations'),
            where("activityId", "==", activity.id),
            where("userId", "==", targetLineUser)
          );
          const evalSnapshotLine = await getDocs(evalQueryLine);
          if (!evalSnapshotLine.empty) {
            hasEval = true;
          } else {
            const evalQueryLine2 = query(
              collection(db, 'evaluations'),
              where("activityId", "==", activity.id),
              where("lineUserId", "==", targetLineUser)
            );
            const evalSnapshotLine2 = await getDocs(evalQueryLine2);
            if (!evalSnapshotLine2.empty) hasEval = true;
          }
        }

        if (!hasEval) {
          setMessage(`❌ ${registration.fullName} ยังไม่ได้ทำแบบประเมิน ไม่สามารถจบกิจกรรมได้ กรุณาให้นักเรียนทำแบบประเมินก่อน`);
          setFoundData({ registration, activity });
          setScannerState('found');
          return false;
        }
      }

      const regRef = doc(db, 'registrations', registration.id);
      await updateDoc(regRef, {
        status: 'completed',
        queueStatus: 'completed',
        completedAt: serverTimestamp(),
        checkedOut: true,
        checkedOutAt: serverTimestamp(),
        checkedOutBy: 'admin'
      });

      await addDoc(collection(db, 'checkInLogs'), {
        activityId: activity.id,
        activityName: activity.name,
        studentName: registration.fullName,
        nationalId: registration.nationalId,
        status: 'check-out',
        timestamp: serverTimestamp(),
        adminId: 'admin'
      });

      if (settings.onCheckOut && lineUserId) {
        const flexMessage = createActivityCompleteFlex({
          activityId: registration.activityId,
          activityName: activity.name,
          requireEvaluation: false,
          isQueueType: activity.type === 'queue'
        });
        await fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: lineUserId, flexMessage }) });
      }

      setMessage(`🏁 ${registration.fullName} จบกิจกรรมและสแกนออกเรียบร้อยแล้ว`);
      setFoundData({ registration: { ...registration, checkedOut: true }, activity });
      setScannerState('found');
      setTimeout(() => resetState(), 3500);
      return true;
    } catch (err) {
      setMessage(`เกิดข้อผิดพลาด: ${err.message}`);
      setScannerState('found');
      return false;
    }
  };

  const processId = async (qrPayload) => {
    setScannerState('submitting');
    try {
      let registrationId = qrPayload;
      let explicitAction = null;
      try {
        const parsed = JSON.parse(qrPayload);
        registrationId = parsed.registrationId || parsed.id || qrPayload;
        explicitAction = parsed.action;
      } catch {}

      const regRef = doc(db, 'registrations', registrationId);
      const regDoc = await getDoc(regRef);

      if (!regDoc.exists() || regDoc.data().activityId !== selectedActivity.id) {
        throw new Error('QR Code หรือข้อมูลไม่ถูกต้องสำหรับกิจกรรมนี้');
      }

      const registrationData = { id: regDoc.id, ...regDoc.data() };
      const isCheckOut = explicitAction === 'check-out' || scanMode === 'check-out';

      // Check if already checked out
      if (registrationData.checkedOut || registrationData.checkedOutAt) {
        setMessage(`ℹ️ ${registrationData.fullName} ได้สแกนจบกิจกรรม (เช็คเอาท์) ไปแล้ว`);
        setScannerState('idle');
        setTimeout(() => resetState(), 3000);
        return;
      }

      // Auto-detect Check-Out if QR is from "QR code ออก"
      if (isCheckOut) {
        setScanMode('check-out');
        await executeAdminCheckOut(registrationData, selectedActivity);
        return;
      }

      // If in check-in mode, check if candidate already finished interview
      if (registrationData.status === 'completed' || registrationData.queueStatus === 'completed' || registrationData.interviewedAt) {
        setFoundData({ registration: registrationData, activity: selectedActivity, canCheckOutNow: true });
        setScanMode('check-out');
        setMessage(`ℹ️ ${registrationData.fullName} สัมภาษณ์เสร็จแล้ว คุณสามารถกดยืนยันจบกิจกรรม (สแกนออก) ได้ทันที`);
        setScannerState('found');
        return;
      }

      if (scanMode === 'check-in') {
        if (registrationData.status === 'checked-in' || registrationData.status === 'interviewing') {
          const queueInfo = registrationData.displayQueueNumber ? ` (${registrationData.displayQueueNumber})` : '';
          setMessage(`✅ ${registrationData.fullName} ได้เช็คอินแล้ว${queueInfo}`);
          setScannerState('idle');
          setTimeout(() => resetState(), 3000);
          return;
        }
      }

      setFoundData({ registration: registrationData, activity: selectedActivity });
      if (registrationData.seatNumber) setSeatNumberInput(registrationData.seatNumber);
      setMessage('');
      setScannerState('found');

    } catch (err) {
      setMessage(`❌ ${err.message}`);
      setScannerState('idle');
      setTimeout(() => { isProcessingRef.current = false; }, 1000);
    }
  };

  const handleStartScanner = () => {
    if (!selectedActivity) {
      setMessage('กรุณาเลือกกิจกรรมก่อน');
      return;
    }

    isProcessingRef.current = false;

    stopScanner().then(() => {
      resetState();
      setTimeout(() => {
        setScannerState('scanning');
        qrScannerRef.current = new Html5Qrcode("reader");
        qrScannerRef.current.start(
          { facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (isProcessingRef.current) return;
            isProcessingRef.current = true;

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
            const result = await runTransaction(db, async (transaction) => {
              const regRef = doc(db, 'registrations', registration.id);
              const activityRef = doc(db, 'activities', activity.id);
              const existingDisplayQueue = registration.displayQueueNumber;

              const activityDoc = await transaction.get(activityRef);

              const registrationsRef = collection(db, 'registrations');
              const duplicateQuery = query(registrationsRef,
                where("activityId", "==", activity.id),
                where("displayQueueNumber", "==", existingDisplayQueue),
                where("status", "in", ["checked-in", "completed"])
              );
              const duplicateSnapshot = await getDocs(duplicateQuery);

              let finalDisplayQueue = existingDisplayQueue;
              let finalQueueNumber;
              let needsNewQueue = false;

              if (!duplicateSnapshot.empty) {
                needsNewQueue = true;
                const courseName = registration.course;
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
                const courseInfo = courseOptions.find(c => c.name === courseName);
                const prefix = courseInfo?.shortName || '';
                const paddedNumber = String(finalQueueNumber).padStart(3, '0');
                finalDisplayQueue = `${prefix}-${paddedNumber}`;
              } else {
                finalQueueNumber = parseInt(existingDisplayQueue.replace(/\D/g, ''), 10) || 0;
              }

              transaction.update(regRef, {
                status: 'checked-in',
                queueNumber: finalQueueNumber,
                ...(needsNewQueue && { displayQueueNumber: finalDisplayQueue })
              });

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
            const result = await runTransaction(db, async (transaction) => {
              const regRef = doc(db, 'registrations', registration.id);
              const regDoc = await transaction.get(regRef);
              if (!regDoc.exists()) throw new Error("ไม่พบข้อมูล");
              const regData = regDoc.data();
              if (!regData.course) throw new Error('นักเรียนยังไม่ได้ถูกกำหนดหลักสูตร');

              const courseName = regData.course;
              const activityRef = doc(db, 'activities', selectedActivity.id);
              const activityDoc = await transaction.get(activityRef);

              if (!activityDoc.exists()) throw new Error('ไม่พบข้อมูลกิจกรรม');

              const activityData = activityDoc.data();
              let currentCounters = activityData.queueCounters || {};
              let nextQueueNumber;

              if (currentCounters[courseName] !== undefined) {
                nextQueueNumber = currentCounters[courseName] + 1;
              } else {
                const registrationsRef = collection(db, 'registrations');
                const allRegsQuery = query(registrationsRef,
                  where("activityId", "==", selectedActivity.id),
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

                nextQueueNumber = maxQueueNumber + 1;
              }

              const courseInfo = courseOptions.find(c => c.name === courseName);
              const prefix = courseInfo?.shortName || '';
              const paddedNumber = String(nextQueueNumber).padStart(3, '0');
              const displayQueueNumber = `${prefix}-${paddedNumber}`;

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

        } else if (activity.type === 'exam' || activity.type === 'graduation') {
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
        } else {
          // General Event (No seat required)
          const regRef = doc(db, 'registrations', registration.id);
          await updateDoc(regRef, { status: 'checked-in', checkedInAt: serverTimestamp() });

          await addDoc(collection(db, 'checkInLogs'), {
            activityId: activity.id,
            activityName: activity.name,
            studentName: registration.fullName,
            nationalId: registration.nationalId,
            status: 'checked-in',
            timestamp: serverTimestamp(),
            adminId: 'admin'
          });

          flexMessage = createCheckInSuccessFlex({
            courseName: courses[activity.categoryId] || 'ทั่วไป',
            activityName: activity.name,
            fullName: registration.fullName,
            studentId: registration.studentId
          });
        }

        if (settings.onCheckIn && lineUserId && flexMessage) {
          await fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: lineUserId, flexMessage }) });
        }
        setMessage(successMessage);

      } else if (scanMode === 'check-out') {
        await executeAdminCheckOut(registration, activity);
        return;
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
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto font-sans">
      {/* Top Header Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
        <h1 className="text-base font-bold text-slate-900">ระบบสแกน QR Code & เช็คอิน (QR Code Scanner)</h1>
        <p className="text-sm font-normal text-slate-500">สแกน QR Code ของผู้เข้าร่วมกิจกรรม หรือค้นหาด้วยเลขบัตรประชาชนเพื่อเช็คอินหรือจบกิจกรรม</p>
      </div>

      {/* Main Scanner Container Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
        {/* Activity Selector Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 space-y-1.5">
          <label className="block text-sm font-normal text-slate-700">เลือกกิจกรรมที่ต้องการดำเนินการ</label>
          <div className="relative">
            <select
              onChange={handleActivityChange}
              defaultValue=""
              required
              className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 font-normal outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20 transition-all appearance-none cursor-pointer"
            >
              <option value="" disabled>-- กรุณาเลือกกิจกรรม --</option>
              {activities.map(act => <option key={act.id} value={act.id}>{act.name}</option>)}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 text-sm">
              ▼
            </div>
          </div>
        </div>

        {selectedActivity ? (
          <div className="p-5 space-y-4">
            {/* Mode Selector Segmented Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Operation Mode */}
              <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200 text-sm font-normal">
                <button
                  type="button"
                  onClick={() => handleModeChange('check-in', 'scan')}
                  className={`flex-1 py-2 rounded-md text-center transition-all cursor-pointer ${
                    scanMode === 'check-in'
                      ? 'bg-emerald-600 text-white font-normal shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 font-normal'
                  }`}
                >
                  ✓ เช็คอินเข้างาน
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('check-out', 'scan')}
                  className={`flex-1 py-2 rounded-md text-center transition-all cursor-pointer ${
                    scanMode === 'check-out'
                      ? 'bg-red-600 text-white font-normal shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 font-normal'
                  }`}
                >
                  ✕ จบกิจกรรม
                </button>
              </div>

              {/* Input Method */}
              <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200 text-sm font-normal">
                <button
                  type="button"
                  onClick={() => handleModeChange('scan', 'search')}
                  className={`flex-1 py-2 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    searchMode === 'scan'
                      ? 'bg-[#000946] text-white font-normal shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 font-normal'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>สแกน QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('manual', 'search')}
                  className={`flex-1 py-2 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    searchMode === 'manual'
                      ? 'bg-[#000946] text-white font-normal shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 font-normal'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>ค้นหาด้วยเลขบัตร</span>
                </button>
              </div>
            </div>

            {/* Feedback Alert Message */}
            {message && (
              <div className={`p-3 rounded-lg text-sm font-normal border flex items-center gap-2 ${
                message.includes('✅') || message.includes('สำเร็จ')
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {message.includes('✅') || message.includes('สำเร็จ') ? (
                  <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <span>{message.replace(/^[✅❌⚠️]\s*/, '')}</span>
              </div>
            )}

            {/* Scanner Area */}
            {searchMode === 'scan' && scannerState !== 'found' && (
              <div className="flex flex-col items-center justify-center min-h-[290px] bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 relative overflow-hidden p-4">
                <div id="reader" style={{ display: scannerState === 'scanning' ? 'block' : 'none' }} className="w-full h-full max-w-sm rounded-lg overflow-hidden"></div>

                {scannerState === 'idle' && (
                  <button
                    type="button"
                    onClick={handleStartScanner}
                    className="flex flex-col items-center justify-center w-full h-full py-8 text-slate-500 hover:text-[#000946] transition-colors group cursor-pointer"
                  >
                    <div className="w-14 h-14 bg-white rounded-full border border-slate-200 flex items-center justify-center mb-2.5 group-hover:border-[#000946] transition-colors shadow-xs">
                      <CameraIcon />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 group-hover:text-[#000946]">แตะเพื่อเปิดกล้องสแกน</span>
                    <span className="text-sm text-slate-400 font-normal mt-0.5">อนุญาตการเข้าถึงกล้องเพื่อสแกน QR Code</span>
                  </button>
                )}
              </div>
            )}

            {/* Manual Search Area */}
            {searchMode === 'manual' && scannerState === 'idle' && (
              <form onSubmit={handleManualSearch} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-normal text-slate-700">เลขบัตรประจำตัวประชาชน</label>
                  <input
                    type="tel"
                    value={nationalIdInput}
                    onChange={e => setNationalIdInput(e.target.value)}
                    required
                    pattern="\d{13}"
                    placeholder="กรอกเลขบัตร 13 หลัก..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-900 outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20 transition-all placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#000946] hover:bg-[#000c5a] text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  ค้นหาข้อมูลนักเรียน
                </button>
              </form>
            )}

            {/* Found Data / Confirmation Area */}
            {scannerState === 'found' && foundData && (
              <div className="space-y-4 pt-1">
                <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      ข้อมูลผู้ลงทะเบียน
                    </span>
                    <StatusBadge status={foundData.registration.status} />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-start">
                      <span className="text-slate-500 font-normal">ชื่อ-สกุล:</span>
                      <span className="font-normal text-slate-900 text-right">{foundData.registration.fullName}</span>
                    </div>
                    {foundData.registration.studentId && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-normal">รหัสผู้สมัคร:</span>
                        <span className="font-normal text-slate-700">{foundData.registration.studentId}</span>
                      </div>
                    )}
                    {foundData.registration.course && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-normal">หลักสูตร:</span>
                        <span className="font-normal text-slate-800">{foundData.registration.course}</span>
                      </div>
                    )}
                    {foundData.registration.displayQueueNumber && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-normal">เลขคิวที่ได้รับ:</span>
                        <span className="font-bold text-[#000946]">{foundData.registration.displayQueueNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                <form onSubmit={handleConfirm} className="space-y-4">
                  {scanMode === 'check-in' && (selectedActivity.type === 'exam' || selectedActivity.type === 'graduation') && (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-normal text-slate-700">ระบุเลขที่นั่ง (ถ้ามี)</label>
                      <input
                        type="text"
                        value={seatNumberInput}
                        onChange={e => setSeatNumberInput(e.target.value)}
                        required
                        placeholder="เช่น A1, B12, แถวหน้า"
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-900 outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20 transition-all"
                      />
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={resetState}
                      className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-normal rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className={`flex-1 py-2.5 text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer ${
                        scanMode === 'check-in'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {scanMode === 'check-in' ? 'ยืนยันการเช็คอิน' : 'ยืนยันจบกิจกรรม'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="p-10 text-center text-slate-400 space-y-2 text-sm">
            <svg className="w-10 h-10 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="font-normal text-slate-500">กรุณาเลือกกิจกรรมด้านบนเพื่อเริ่มการสแกน</p>
          </div>
        )}
      </div>
    </div>
  );
}
