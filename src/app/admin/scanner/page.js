'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../../lib/firebase';
import { 
  doc, getDoc, updateDoc, addDoc, collection, 
  serverTimestamp, query, where, getDocs 
} from 'firebase/firestore';
import { createCheckInSuccessFlex } from '../../../lib/flexMessageTemplates';

const CameraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

export default function AdminScannerPage() {
  const [mode, setMode] = useState('scan'); 
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [nationalIdInput, setNationalIdInput] = useState('');
  const [scannerState, setScannerState] = useState('idle'); 
  const [registrationData, setRegistrationData] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [courseName, setCourseName] = useState('');
  const [seatNumberInput, setSeatNumberInput] = useState('');
  const [message, setMessage] = useState('');
  const qrScannerRef = useRef(null);

  useEffect(() => {
    qrScannerRef.current = new Html5Qrcode("reader");
    return () => {
      if (qrScannerRef.current?.isScanning) {
        qrScannerRef.current.stop().catch(err => console.error("Cleanup stop failed", err));
      }
    };
  }, []);
  
  useEffect(() => {
    const fetchActivities = async () => {
      const activitiesSnapshot = await getDocs(collection(db, 'activities'));
      const activitiesList = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivities(activitiesList);
    };
    fetchActivities();
  }, []);

  const handleStartScanner = async () => {
    if (!qrScannerRef.current) return;
    resetState();
    setScannerState('scanning');
    try {
      await qrScannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScanSuccess,
        () => {}
      );
    } catch (err) {
      console.error("Failed to start scanner", err);
      if (err.name === "NotAllowedError") {
        setMessage("คุณปฏิเสธการเข้าถึงกล้อง กรุณาอนุญาตในตั้งค่าเบราว์เซอร์");
      } else {
        setMessage(`ไม่สามารถเปิดกล้องได้: ${err.name}`);
      }
      setScannerState('idle');
    }
  };

  const handleScanSuccess = async (decodedText) => {
    if (scannerState === 'found' || scannerState === 'submitting') return;
    
    if (qrScannerRef.current?.isScanning) {
      await qrScannerRef.current.stop();
    }
    
    setScannerState('submitting');
    setMessage(`กำลังตรวจสอบ ID: ${decodedText}`);

    try {
      const regRef = doc(db, 'registrations', decodedText);
      const regSnap = await getDoc(regRef);
      if (regSnap.exists()) {
        await processFoundRegistration({ id: regSnap.id, ...regSnap.data() });
      } else {
        throw new Error('ไม่พบข้อมูลการลงทะเบียน');
      }
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      setTimeout(() => { resetState(); setScannerState('idle'); }, 3000);
    }
  };

  const handleSearchById = async (e) => {
    e.preventDefault();
    if (!selectedActivity || !nationalIdInput) {
      setMessage("กรุณาเลือกกิจกรรมและกรอกเลขบัตรประชาชน");
      return;
    }
    setScannerState('submitting');
    resetState();
    setMessage('กำลังค้นหา...');
    try {
      const q = query(
        collection(db, 'registrations'),
        where("activityId", "==", selectedActivity),
        where("nationalId", "==", nationalIdInput.trim())
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error('ไม่พบข้อมูลนักเรียนในกิจกรรมนี้');
      
      await processFoundRegistration({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      setScannerState('idle');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const processFoundRegistration = async (regData) => {
    setRegistrationData(regData);

    if (regData.seatNumber) {
        setSeatNumberInput(regData.seatNumber);
    }

    const actRef = doc(db, 'activities', regData.activityId);
    const actSnap = await getDoc(actRef);
    if (actSnap.exists()) {
        const actData = actSnap.data();
        setActivityData(actData);
        
        if (actData.courseId) {
            const courseRef = doc(db, 'courses', actData.courseId);
            const courseSnap = await getDoc(courseRef);
            if(courseSnap.exists()) {
                setCourseName(courseSnap.data().name);
            }
        }
    }
    
    setScannerState('found');
    setMessage('');
  };

  const handleConfirmCheckIn = async (e) => {
    e.preventDefault();
    if (!registrationData || !seatNumberInput.trim()) {
      setMessage("กรุณากำหนดเลขที่นั่ง"); return;
    }
    setScannerState('submitting');
    setMessage('กำลังบันทึกข้อมูล...');
    try {
      const regRef = doc(db, 'registrations', registrationData.id);
      // อัปเดต status และ seatNumber พร้อมกันเสมอ
      await updateDoc(regRef, { 
        status: 'checked-in', 
        seatNumber: seatNumberInput.trim() 
      });
      
      const logData = {
        adminId: 'Admin_01',
        registrationId: registrationData.id,
        studentName: registrationData.fullName,
        activityName: activityData.name,
        assignedSeat: seatNumberInput.trim(),
        timestamp: serverTimestamp()
      };
      await addDoc(collection(db, 'checkInLogs'), logData);
      
      if (registrationData.lineUserId) {
          const flexMessage = createCheckInSuccessFlex({
            courseName: courseName,
            activityName: activityData.name,
            fullName: registrationData.fullName,
            studentId: registrationData.studentId,
            seatNumber: seatNumberInput.trim(),
          });

          await fetch('/api/send-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: registrationData.lineUserId, flexMessage: flexMessage })
          });
      }

      setMessage(`✅ ยืนยันสำเร็จ! ที่นั่ง ${seatNumberInput.trim()}`);
      setTimeout(() => {
        resetState();
        setScannerState('idle');
      }, 2000);
    } catch (err) {
      setMessage(`เกิดข้อผิดพลาด: ${err.message}`);
      setScannerState('found');
    }
  };
  
  const resetState = () => {
    setRegistrationData(null);
    setActivityData(null);
    setCourseName('');
    setSeatNumberInput('');
    setMessage('');
    if (mode === 'manual') setNationalIdInput('');
  };

  const StatusBadge = ({ status }) => {
    const isCheckedIn = status === 'checked-in';
    const bgColor = isCheckedIn ? 'bg-green-500' : 'bg-yellow-500';
    return <span className={`px-3 py-1 text-sm text-white rounded-full ${bgColor}`}>{isCheckedIn ? 'เช็คอินแล้ว' : 'ลงทะเบียน'}</span>;
  };

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8 font-sans">
      <div className="bg-white p-6 rounded-lg shadow-2xl min-h-[500px] flex flex-col items-center">

        <div className="flex justify-center border border-gray-300 rounded-lg p-1 bg-gray-100 mb-6 w-full">
            <button onClick={() => { setMode('scan'); resetState(); setScannerState('idle'); }} className={`w-1/2 py-2 rounded-md transition-colors ${mode === 'scan' ? 'bg-primary text-white shadow' : 'text-gray-600'}`}>
              สแกน QR Code
            </button>
            <button onClick={() => { setMode('manual'); resetState(); setScannerState('idle'); }} className={`w-1/2 py-2 rounded-md transition-colors ${mode === 'manual' ? 'bg-primary text-white shadow' : 'text-gray-600'}`}>
              ค้นหาด้วยตนเอง
            </button>
        </div>

        {mode === 'scan' && (
          <div className="w-full flex flex-col items-center">
            {scannerState === 'idle' && (
              <button onClick={handleStartScanner} className="flex flex-col items-center text-primary hover:text-blue-800 transition-colors">
                <CameraIcon />
                <span className="text-xl font-semibold">เริ่มสแกน</span>
              </button>
            )}
            <div id="reader" className={`${scannerState === 'scanning' ? 'block' : 'hidden'} w-full max-w-sm border-2 border-gray-300 rounded-lg overflow-hidden`}></div>
            {scannerState === 'scanning' && <p className="mt-4 text-gray-500">กรุณาหันกล้องไปที่ QR Code</p>}
          </div>
        )}
        
        {mode === 'manual' && scannerState === 'idle' && (
            <form onSubmit={handleSearchById} className="w-full space-y-4 animate-fade-in">
              <div>
                <label htmlFor="activity-select" className="block text-sm font-medium text-gray-700">1. เลือกกิจกรรม</label>
                <select id="activity-select" value={selectedActivity} onChange={(e) => setSelectedActivity(e.target.value)} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                  <option value="">-- กรุณาเลือกกิจกรรม --</option>
                  {activities.map(act => <option key={act.id} value={act.id}>{act.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="nationalId" className="block text-sm font-medium text-gray-700">2. กรอกเลขบัตรประชาชน</label>
                <input type="tel" id="nationalId" value={nationalIdInput} onChange={(e) => setNationalIdInput(e.target.value)} required pattern="\d{13}" placeholder="กรอกเลข 13 หลัก" className="mt-1 block w-full p-2 border border-gray-300 rounded-md"/>
              </div>
              <button type="submit" disabled={scannerState === 'submitting'} className="w-full py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700">
                {scannerState === 'submitting' ? 'กำลังค้นหา...' : 'ค้นหา'}
              </button>
            </form>
        )}

        {/* 👇 **การเปลี่ยนแปลง**: ลบเงื่อนไข && registrationData.status !== 'checked-in' ออก */}
        {(scannerState === 'found' || scannerState === 'submitting') && registrationData && (
          <div className="w-full animate-fade-in">
            <h2 className="text-2xl font-bold mb-4">ข้อมูลผู้ลงทะเบียน</h2>
            <div className="space-y-2 text-gray-700 bg-gray-50 p-4 rounded-lg border">
              <p><strong>ชื่อ-สกุล:</strong> {registrationData.fullName}</p>
              <p><strong>กิจกรรม:</strong> {activityData?.name}</p>
              <p className="flex items-center gap-2"><strong>สถานะ:</strong> <StatusBadge status={registrationData.status} /></p>
            </div>
            <hr className="my-4"/>
            <form onSubmit={handleConfirmCheckIn} className="space-y-3">
              <label htmlFor="seatNumber" className="block text-sm font-medium text-gray-700">
                กำหนด/แก้ไขเลขที่นั่ง
              </label>
              <input 
                type="text" 
                id="seatNumber" 
                value={seatNumberInput} 
                onChange={(e) => setSeatNumberInput(e.target.value)} 
                required 
                placeholder="เช่น A1, B12" 
                className="w-full p-2 border border-gray-300 rounded-md" 
              />
              <button 
                type="submit" 
                disabled={scannerState === 'submitting'} 
                className="w-full py-3 bg-primary text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {scannerState === 'submitting' ? 'กำลังดำเนินการ...' : 'ยืนยัน / อัปเดตข้อมูล'}
              </button>
            </form>
          </div>
        )}

        {message && <p className="mt-4 text-center font-bold text-lg text-red-600">{message}</p>}
      </div>
    </div>
  );
}