'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { db } from '../../../../lib/firebase';
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import {
  createCheckInSuccessFlex,
  createQueueCheckInSuccessFlex
} from '../../../../lib/flexMessageTemplates';

// Synthesize pleasant success audio beep using Web Audio API
const playBeep = (type = 'success') => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // AudioContext blocked or unsupported
  }
};

export default function StationScannerPage({ params }) {
  const { activityId } = use(params);

  const [activity, setActivity] = useState(null);
  const [staffName, setStaffName] = useState('');
  const [isSettingStaff, setIsSettingStaff] = useState(false);
  const [tempStaffName, setTempStaffName] = useState('');

  const [scanMode, setScanMode] = useState('check-in'); // 'check-in' | 'check-out'
  const [scannerState, setScannerState] = useState('idle'); // idle, scanning, processing, success, error
  const [scanResult, setScanResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [stats, setStats] = useState({ total: 0, checkedIn: 0, checkedOut: 0 });
  const [courseOptions, setCourseOptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeTab, setActiveTab] = useState('camera'); // camera, manual

  const html5QrCodeRef = useRef(null);
  const isScanningRef = useRef(false);

  // Load Staff Name from localStorage
  useEffect(() => {
    const savedStaff = localStorage.getItem('aero_station_staff_name') || '';
    setStaffName(savedStaff);
    if (!savedStaff) {
      setIsSettingStaff(true);
    }
  }, []);

  // Fetch Activity and listen to Registrations stats
  useEffect(() => {
    if (!activityId) return;

    const fetchActivity = async () => {
      try {
        const actDoc = await getDoc(doc(db, 'activities', activityId));
        if (actDoc.exists()) {
          const actData = actDoc.data();
          setActivity({
            id: actDoc.id,
            ...actData,
            isQueueType: actData.type === 'queue' || actData.isQueueType
          });
        } else {
          setErrorMessage('ไม่พบข้อมูลกิจกรรมนี้ในระบบ');
        }
      } catch (err) {
        console.error('Error fetching activity:', err);
        setErrorMessage('ไม่สามารถโหลดข้อมูลกิจกรรมได้');
      }
    };
    fetchActivity();

    // Fetch Course Options for prefix resolution
    const fetchCourses = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'courseOptions')));
        setCourseOptions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Error fetching course options:', e);
      }
    };
    fetchCourses();

    // Listen to registrations statistics
    const qRegs = query(collection(db, 'registrations'), where('activityId', '==', activityId));
    const unsub = onSnapshot(qRegs, (snap) => {
      let total = snap.size;
      let checkedIn = 0;
      let checkedOut = 0;
      snap.forEach((d) => {
        const data = d.data();
        if (data.status === 'checked-in' || data.status === 'completed' || data.status === 'evaluated') {
          checkedIn++;
        }
        if (data.checkedOut || data.checkedOutAt) {
          checkedOut++;
        }
      });
      setStats({ total, checkedIn, checkedOut });
    });

    return () => unsub();
  }, [activityId]);

  const saveStaffName = () => {
    if (tempStaffName.trim()) {
      localStorage.setItem('aero_station_staff_name', tempStaffName.trim());
      setStaffName(tempStaffName.trim());
      setIsSettingStaff(false);
    }
  };

  // Start Camera QR Scanner
  const startScanner = async () => {
    try {
      if (isScanningRef.current) return;
      const html5QrCode = new Html5Qrcode('station-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        onScanSuccess,
        () => {} // ignore scan failures
      );
      isScanningRef.current = true;
      setScannerState('scanning');
    } catch (err) {
      console.error('Error starting camera:', err);
      setErrorMessage('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้องบนอุปกรณ์นี้');
      setScannerState('error');
    }
  };

  // Stop Scanner
  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && isScanningRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        isScanningRef.current = false;
      }
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
  };

  // Handle Tab Switch
  useEffect(() => {
    if (activeTab === 'camera' && !isSettingStaff && activity) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [activeTab, isSettingStaff, activity]);

  // Helper to execute Checkout
  const executeDirectCheckOut = async (regDocOrData) => {
    setScannerState('processing');
    setErrorMessage('');
    try {
      const regId = regDocOrData.id;
      const regRef = doc(db, 'registrations', regId);
      const regSnap = await getDoc(regRef);
      if (!regSnap.exists()) throw new Error('ไม่พบข้อมูลผู้ลงทะเบียน');
      const regData = regSnap.data();

      if (regData.checkedOut || regData.checkedOutAt) {
        playBeep('error');
        setScanResult({
          ...regData,
          id: regId,
          alreadyCheckedOut: true
        });
        setScannerState('success');
        return;
      }

      // Check evaluation if required
      if (activity?.enableEvaluation !== false) {
        let hasEval = false;
        if (regData.hasEvaluated || regData.evaluated || regData.evaluationScore?.isScored) {
          hasEval = true;
        }
        if (!hasEval && regData.nationalId) {
          const rawNat = String(regData.nationalId).trim();
          const cleanNat = rawNat.replace(/\D/g, '');
          const evalQueryNat = query(
            collection(db, 'evaluations'),
            where("activityId", "==", activityId),
            where("nationalId", "==", rawNat)
          );
          const evalSnapshotNat = await getDocs(evalQueryNat);
          if (!evalSnapshotNat.empty) {
            hasEval = true;
          } else if (cleanNat && cleanNat !== rawNat) {
            const evalQueryClean = query(
              collection(db, 'evaluations'),
              where("activityId", "==", activityId),
              where("nationalId", "==", cleanNat)
            );
            const snapClean = await getDocs(evalQueryClean);
            if (!snapClean.empty) hasEval = true;
          }
        }
        if (!hasEval && (regData.lineUserId || regData.userId)) {
          const targetUser = regData.lineUserId || regData.userId;
          const evalQueryLine = query(
            collection(db, 'evaluations'),
            where("activityId", "==", activityId),
            where("userId", "==", targetUser)
          );
          const evalSnapshotLine = await getDocs(evalQueryLine);
          if (!evalSnapshotLine.empty) {
            hasEval = true;
          } else {
            const evalQueryLine2 = query(
              collection(db, 'evaluations'),
              where("activityId", "==", activityId),
              where("lineUserId", "==", targetUser)
            );
            const evalSnapshotLine2 = await getDocs(evalQueryLine2);
            if (!evalSnapshotLine2.empty) hasEval = true;
          }
        }

        if (!hasEval) {
          playBeep('error');
          const studentDisplay = `${regData.title || ''} ${regData.firstName || ''} ${regData.lastName || ''}`.trim() || regData.fullName || 'ผู้เข้าร่วม';
          setErrorMessage(`❌ ${studentDisplay} ยังไม่ได้ทำแบบประเมิน ไม่สามารถจบกิจกรรมได้ กรุณาให้นักเรียนทำแบบประเมินก่อน`);
          setScannerState('error');
          return;
        }
      }

      // Perform checkout
      const updatePayload = {
        status: 'completed',
        queueStatus: 'completed',
        completedAt: serverTimestamp(),
        checkedOut: true,
        checkedOutAt: serverTimestamp(),
        checkedOutBy: staffName || 'Station Staff'
      };

      await updateDoc(regRef, updatePayload);

      await addDoc(collection(db, 'checkInLogs'), {
        activityId: activityId,
        activityName: activity?.name || '-',
        studentName: `${regData.title || ''} ${regData.firstName || ''} ${regData.lastName || ''}`.trim() || regData.fullName || '-',
        nationalId: regData.nationalId || '-',
        status: 'check-out',
        timestamp: serverTimestamp(),
        adminId: staffName || 'Station Staff'
      });

      playBeep('success');
      setScanResult({
        ...regData,
        ...updatePayload,
        id: regId,
        isCheckOutSuccess: true
      });
      setScannerState('success');
    } catch (err) {
      playBeep('error');
      setErrorMessage(`เกิดข้อผิดพลาด: ${err.message}`);
      setScannerState('error');
    }
  };

  // Execute Check-in Logic
  const processCheckIn = async (qrPayload) => {
    setScannerState('processing');
    setErrorMessage('');

    try {
      let registrationId = null;
      let nationalId = null;
      let explicitAction = null;

      // Parse payload
      try {
        const parsed = JSON.parse(qrPayload);
        registrationId = parsed.registrationId || parsed.id;
        nationalId = parsed.nationalId;
        explicitAction = parsed.action;
      } catch {
        // Plain text QR (e.g. registration doc ID or nationalId)
        if (qrPayload.length === 13 && /^\d+$/.test(qrPayload)) {
          nationalId = qrPayload;
        } else {
          registrationId = qrPayload;
        }
      }

      let regDoc = null;
      let regRef = null;

      if (registrationId) {
        const directDoc = await getDoc(doc(db, 'registrations', registrationId));
        if (directDoc.exists() && directDoc.data().activityId === activityId) {
          regDoc = directDoc;
          regRef = doc(db, 'registrations', registrationId);
        }
      }

      if (!regDoc && nationalId) {
        const qNat = query(
          collection(db, 'registrations'),
          where('activityId', '==', activityId),
          where('nationalId', '==', nationalId)
        );
        const snap = await getDocs(qNat);
        if (!snap.empty) {
          regDoc = snap.docs[0];
          regRef = doc(db, 'registrations', regDoc.id);
        }
      }

      if (!regDoc) {
        playBeep('error');
        setErrorMessage('ไม่พบข้อมูลการลงทะเบียนในกิจกรรมนี้');
        setScannerState('error');
        return;
      }

      const regData = regDoc.data();

      // AUTO-DETECT CHECK-OUT:
      // If QR code is an Exit QR (explicitAction === 'check-out') OR scanner mode is 'check-out'
      if (explicitAction === 'check-out' || scanMode === 'check-out') {
        await executeDirectCheckOut({ id: regDoc.id, ...regData });
        return;
      }

      // MODE 2: Check-in
      if (regData.checkedOut || regData.checkedOutAt) {
        playBeep('error');
        setScanResult({
          ...regData,
          id: regDoc.id,
          alreadyCheckedOut: true
        });
        setScannerState('success');
        return;
      }

      // Check if already checked in or already completed interview
      if (regData.status === 'checked-in' || regData.status === 'completed' || regData.status === 'evaluated' || regData.queueStatus === 'completed') {
        playBeep('error');
        const isFinishedInterview = regData.status === 'completed' || regData.queueStatus === 'completed' || regData.interviewedAt;
        setScanResult({
          ...regData,
          id: regDoc.id,
          alreadyCheckedIn: true,
          canCheckOutNow: isFinishedInterview && !regData.checkedOut && !regData.checkedOutAt
        });
        setScannerState('success');
        return;
      }

      // Check-in update
      const updatePayload = {
        status: 'checked-in',
        checkedInAt: serverTimestamp(),
        checkedInBy: staffName || 'Station Staff'
      };

      // If activity has queue system and registration does not have queue number yet, assign next queue
      const isQueueActivity = activity?.type === 'queue' || activity?.isQueueType;
      let assignedQueue = regData.queueNumber;
      let finalDisplayQueue = regData.displayQueueNumber;

      if (isQueueActivity && (!assignedQueue || !finalDisplayQueue)) {
        // Find highest queue number for this course in this activity
        const qMax = query(
          collection(db, 'registrations'),
          where('activityId', '==', activityId),
          where('course', '==', regData.course || '')
        );
        const courseRegsSnap = await getDocs(qMax);
        let maxQ = 0;
        courseRegsSnap.forEach((d) => {
          const dData = d.data();
          if (dData.displayQueueNumber) {
            const extracted = parseInt(dData.displayQueueNumber.replace(/\D/g, ''), 10) || 0;
            if (extracted > maxQ) maxQ = extracted;
          }
          const num = Number(dData.queueNumber || 0);
          if (num > maxQ) maxQ = num;
        });

        if (!assignedQueue) {
          assignedQueue = maxQ + 1;
        }

        if (!finalDisplayQueue) {
          const courseInfo = courseOptions.find(c => c.name === regData.course);
          const prefix = regData.courseCode || courseInfo?.shortName || (regData.course ? regData.course.slice(0, 3).toUpperCase() : 'Q');
          finalDisplayQueue = `${prefix}-${String(assignedQueue).padStart(3, '0')}`;
        }

        updatePayload.queueNumber = assignedQueue;
        updatePayload.displayQueueNumber = finalDisplayQueue;
        updatePayload.queueStatus = 'waiting';
      }

      await updateDoc(regRef, updatePayload);
      playBeep('success');

      const finalResult = {
        ...regData,
        ...updatePayload,
        id: regDoc.id,
        alreadyCheckedIn: false
      };
      setScanResult(finalResult);
      setScannerState('success');

      // Send LINE Flex message notification if student has LINE User ID
      if (regData.lineUserId) {
        try {
          const flexMsg = isQueueActivity
            ? createQueueCheckInSuccessFlex({
                activityName: activity?.name || '-',
                fullName: `${regData.title || ''} ${regData.firstName || ''} ${regData.lastName || ''}`.trim(),
                course: regData.course || '-',
                timeSlot: regData.timeSlot || '-',
                queueNumber: finalDisplayQueue || (assignedQueue ? `Q-${String(assignedQueue).padStart(3, '0')}` : '-')
              })
            : createCheckInSuccessFlex({
                courseName: regData.course || '-',
                activityName: activity?.name || '-',
                fullName: `${regData.title || ''} ${regData.firstName || ''} ${regData.lastName || ''}`.trim(),
                studentId: regData.nationalId || '-',
                seatNumber: regData.seatNumber || '-'
              });

          fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: regData.lineUserId,
              flexMessage: flexMsg
            })
          }).catch((e) => console.error('Notification error:', e));
        } catch (notifErr) {
          console.error('Failed to prepare LINE Flex:', notifErr);
        }
      }
    } catch (err) {
      console.error('Check-in error:', err);
      playBeep('error');
      setErrorMessage(`เกิดข้อผิดพลาด: ${err.message}`);
      setScannerState('error');
    }
  };

  const onScanSuccess = (decodedText) => {
    if (scannerState === 'processing') return;
    processCheckIn(decodedText);
  };

  // Manual Search Handler
  const handleManualSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setErrorMessage('');
    try {
      const q = query(
        collection(db, 'registrations'),
        where('activityId', '==', activityId)
      );
      const snap = await getDocs(q);
      const val = searchQuery.trim().toLowerCase();
      const results = [];

      snap.forEach((d) => {
        const data = d.data();
        const fullName = `${data.title || ''} ${data.firstName || ''} ${data.lastName || ''}`.toLowerCase();
        const nationalId = String(data.nationalId || '');
        const seat = String(data.seatNumber || '').toLowerCase();

        if (
          fullName.includes(val) ||
          nationalId.includes(val) ||
          seat.includes(val)
        ) {
          results.push({ id: d.id, ...data });
        }
      });

      setSearchResults(results);
      if (results.length === 0) {
        setErrorMessage('ไม่พบข้อมูลผู้ลงทะเบียนที่ตรงกับคำค้นหา');
      }
    } catch (err) {
      console.error('Search error:', err);
      setErrorMessage('เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setIsSearching(false);
    }
  };

  const resetForNextScan = () => {
    setScanResult(null);
    setErrorMessage('');
    setScannerState('scanning');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col select-none">
      {/* Top Station Header */}
      <header className="h-16 px-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#000946] flex items-center justify-center text-white font-bold text-sm shadow-xs">
            ST
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-[#000946] leading-tight truncate max-w-[200px] sm:max-w-md">
              {activity ? activity.name : 'กำลังโหลดข้อมูลกิจกรรม...'}
            </h1>
            <div className="flex items-center gap-2 text-sm font-normal text-slate-500">
              <span>จุดสแกนเนอร์หน้างาน</span>
              <span>•</span>
              <button
                onClick={() => {
                  setTempStaffName(staffName);
                  setIsSettingStaff(true);
                }}
                className="text-[#000946] hover:text-[#FF741F] font-normal underline flex items-center gap-1 cursor-pointer"
              >
                <span>{staffName ? `สตาฟ: ${staffName}` : 'ระบุชื่อเจ้าหน้าที่'}</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-2">
          <div className="text-right px-3.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-sm font-normal text-slate-500">เช็คอิน / ออก</div>
            <div className="text-sm text-slate-800">
              <span className="font-bold text-[#000946]">{stats.checkedIn}</span>
              <span className="font-normal text-slate-400"> / {stats.total}</span>
              <span className="font-normal text-emerald-600 ml-1.5">({stats.checkedOut} ออก)</span>
            </div>
          </div>
        </div>
      </header>

      {/* Mode Selector: Check-in vs Check-out */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-center">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 w-full max-w-md">
          <button
            type="button"
            onClick={() => {
              setScanMode('check-in');
              setErrorMessage('');
              setScanResult(null);
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-normal transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              scanMode === 'check-in'
                ? 'bg-[#000946] text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>เช็คอินเข้างาน</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setScanMode('check-out');
              setErrorMessage('');
              setScanResult(null);
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-normal transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              scanMode === 'check-out'
                ? 'bg-rose-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            <span>สแกนออก (จบกิจกรรม)</span>
          </button>
        </div>
      </div>

      {/* Staff Name Modal */}
      {isSettingStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#000946] flex items-center justify-center mx-auto mb-2 border border-blue-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">ระบุชื่อเจ้าหน้าที่ประจำจุดสแกน</h3>
              <p className="text-sm font-normal text-slate-500">
                เพื่อบันทึกในประวัติการเช็คอินของกิจกรรม (จำในเครื่องนี้อัตโนมัติ)
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-normal text-slate-700">
                ชื่อ-สกุล หรือ จุดบริการ (เช่น ประตู 1 - พี่มิ้นท์)
              </label>
              <input
                type="text"
                value={tempStaffName}
                onChange={(e) => setTempStaffName(e.target.value)}
                placeholder="ระบุชื่อเจ้าหน้าที่..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-normal text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#000946] focus:ring-2 focus:ring-[#000946]/10"
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSettingStaff(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-normal rounded-xl transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveStaffName}
                disabled={!tempStaffName.trim()}
                className="flex-1 py-2.5 bg-[#000946] hover:bg-[#000946]/90 text-white text-sm font-normal rounded-xl disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                บันทึกชื่อเจ้าหน้าที่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tab Bar */}
      <div className="flex border-b border-slate-200 bg-slate-100 px-4 pt-3 gap-2">
        <button
          onClick={() => setActiveTab('camera')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm transition-colors cursor-pointer ${
            activeTab === 'camera'
              ? 'bg-white text-[#000946] border-t-2 border-[#000946] border-x border-slate-200 shadow-xs font-bold'
              : 'text-slate-500 hover:text-slate-800 font-normal'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
          <span>กล้องสแกน QR Code</span>
        </button>

        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm transition-colors cursor-pointer ${
            activeTab === 'manual'
              ? 'bg-white text-[#000946] border-t-2 border-[#000946] border-x border-slate-200 shadow-xs font-bold'
              : 'text-slate-500 hover:text-slate-800 font-normal'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>ค้นหาด้วยเลขบัตร / ชื่อ</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 max-w-xl mx-auto w-full flex flex-col justify-center">
        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-normal flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Success Modal / Banner */}
        {scanResult && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in zoom-in-95 duration-150">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-xs ${
                scanResult.isCheckOutSuccess
                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}>
                {scanResult.isCheckOutSuccess ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              <div className="space-y-1">
                <span className={`text-sm font-normal px-3 py-1 rounded-full uppercase inline-block ${
                  scanResult.isCheckOutSuccess
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : scanResult.alreadyCheckedOut
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : scanResult.alreadyCheckedIn
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {scanResult.isCheckOutSuccess
                    ? 'สแกนจบกิจกรรมสำเร็จ'
                    : scanResult.alreadyCheckedOut
                    ? 'ได้สแกนจบกิจกรรมไปแล้ว'
                    : scanResult.alreadyCheckedIn
                    ? 'เคยเช็คอินแล้ว'
                    : 'เช็คอินสำเร็จ'}
                </span>
                <h2 className="text-lg font-bold text-slate-900 pt-2">
                  {scanResult.title || ''} {scanResult.firstName || ''} {scanResult.lastName || ''}
                </h2>
                <p className="text-sm font-normal text-slate-500">เลขประจำตัว: {scanResult.nationalId || '-'}</p>
                <p className="text-sm font-normal text-[#000946]">{scanResult.course || '-'}</p>
              </div>

              {scanResult.isCheckOutSuccess ? (
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-1 text-center">
                  <div className="text-sm font-bold text-rose-900">บันทึกการจบกิจกรรมเรียบร้อยแล้ว</div>
                  <div className="text-sm font-normal text-rose-700">ผู้เข้าร่วมทำแบบประเมินและสแกนเช็คเอาท์ออกจากพื้นที่กิจกรรมแล้ว</div>
                </div>
              ) : (
                /* Queue / Seat Highlight Box */
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  {activity?.isQueueType ? (
                    <div>
                      <div className="text-sm font-normal text-slate-500">หมายเลขคิวของคุณ</div>
                      <div className="text-3xl font-bold text-[#000946] tracking-wider">
                        {scanResult.displayQueueNumber
                          || (scanResult.queueNumber
                            ? `${scanResult.courseCode || 'Q'}-${String(scanResult.queueNumber).padStart(3, '0')}`
                            : 'รอเรียกคิว')}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-normal text-slate-500">เลขที่นั่งของคุณ</div>
                      <div className="text-3xl font-bold text-[#000946] tracking-wider">
                        {scanResult.seatNumber || '-'}
                      </div>
                    </div>
                  )}

                  {scanResult.timeSlot && (
                    <div className="text-sm font-normal text-slate-500 pt-1 border-t border-slate-200">
                      รอบเวลา: <span className="text-slate-900 font-normal">{scanResult.timeSlot}</span>
                    </div>
                  )}
                </div>
              )}

              {scanResult.canCheckOutNow && (
                <button
                  type="button"
                  onClick={() => executeDirectCheckOut(scanResult)}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white text-sm font-normal rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                  <span>สัมภาษณ์เสร็จแล้ว: กดสแกนออก (จบกิจกรรม) ทันที</span>
                </button>
              )}

              <button
                onClick={resetForNextScan}
                className="w-full py-3 bg-[#000946] hover:bg-[#000946]/90 text-white text-sm font-normal rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
                autoFocus
              >
                สแกนคนถัดไป (Next Student)
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Camera Scanner */}
        {activeTab === 'camera' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="relative w-full max-w-[340px] aspect-square rounded-3xl overflow-hidden border-2 border-[#000946]/30 shadow-xl bg-black flex items-center justify-center">
              <div id="station-reader" className="w-full h-full" />
              {scannerState === 'processing' && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-white font-normal">กำลังประมวลผล...</span>
                </div>
              )}
            </div>

            <p className="text-sm text-slate-500 text-center font-normal">
              นำ QR Code บนหน้าจอ LINE ของนักเรียนมาจ่อในกรอบเพื่อสแกน
            </p>
          </div>
        )}

        {/* Tab 2: Manual Search & Check-in */}
        {activeTab === 'manual' && (
          <div className="space-y-4">
            <form onSubmit={handleManualSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาด้วยเลขบัตร 13 หลัก หรือ ชื่อ-นามสกุล..."
                className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-normal text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#000946] focus:ring-2 focus:ring-[#000946]/10 shadow-xs"
                autoFocus
              />
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-5 py-2.5 bg-[#000946] hover:bg-[#000946]/90 text-white text-sm font-normal rounded-xl disabled:opacity-50 transition-all flex-shrink-0 shadow-xs cursor-pointer"
              >
                {isSearching ? 'กำลังค้นหา...' : 'ค้นหา'}
              </button>
            </form>

            {/* Results List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto custom-scrollbar">
              {searchResults.map((student) => (
                <div
                  key={student.id}
                  className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-300 shadow-xs transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {student.title || ''} {student.firstName || ''} {student.lastName || ''}
                    </div>
                    <div className="text-sm font-normal text-slate-500">
                      เลขบัตร: {student.nationalId || '-'} • ที่นั่ง: {student.seatNumber || '-'}
                    </div>
                    <div className="text-sm font-normal text-[#000946] truncate">{student.course || '-'}</div>
                  </div>

                  <button
                    onClick={() => processCheckIn(student.id)}
                    disabled={scannerState === 'processing'}
                    className={`px-4 py-2 rounded-xl text-sm font-normal transition-all flex-shrink-0 cursor-pointer ${
                      student.status === 'checked-in'
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : 'bg-[#000946] hover:bg-[#000946]/90 text-white shadow-xs active:scale-95'
                    }`}
                  >
                    {student.status === 'checked-in' ? 'เช็คอินแล้ว' : 'กดเช็คอิน'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
