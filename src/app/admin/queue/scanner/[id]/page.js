'use client';

import { useState, useEffect, useRef, use } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../../../../lib/firebase';
import {
  doc, collection, query, where, getDocs, runTransaction, orderBy, limit, getDoc
} from 'firebase/firestore';
import Link from 'next/link';

export default function QueueScannerPage({ params }) {
    const unwrappedParams = use(params);
    const activityId = unwrappedParams.id;

    const [activity, setActivity] = useState(null);
    const [mode, setMode] = useState('scan'); // 'scan' or 'manual'
    const [scannerState, setScannerState] = useState('idle');
    const [message, setMessage] = useState('');
    const [nationalIdInput, setNationalIdInput] = useState('');
    const qrScannerRef = useRef(null);
    const isProcessingRef = useRef(false);

    useEffect(() => {
        const fetchActivity = async () => {
            if (!activityId) return;
            try {
                const actDoc = await getDoc(doc(db, 'activities', activityId));
                if (actDoc.exists()) {
                    setActivity({ id: actDoc.id, ...actDoc.data() });
                }
            } catch (err) {
                console.error("Failed to load activity:", err);
            }
        };
        fetchActivity();
    }, [activityId]);

    useEffect(() => {
        qrScannerRef.current = new Html5Qrcode("reader");
        return () => {
            if (qrScannerRef.current?.isScanning) {
                qrScannerRef.current.stop().catch(err => console.error("Cleanup failed", err));
            }
        };
    }, []);

    const resetPage = () => {
        setMessage('');
        setNationalIdInput('');
        setScannerState('idle');
        isProcessingRef.current = false;
    };

    const assignQueue = async (registrationId) => {
        setScannerState('submitting');
        try {
            const result = await runTransaction(db, async (transaction) => {
                const regRef = doc(db, 'registrations', registrationId);
                const regDoc = await transaction.get(regRef);

                if (!regDoc.exists() || regDoc.data().activityId !== activityId) {
                    throw new Error('ข้อมูลไม่ถูกต้องสำหรับกิจกรรมนี้');
                }
                
                const registrationData = regDoc.data();
                const courseName = registrationData.course;

                if (registrationData.status === 'checked-in' || registrationData.status === 'interviewing') {
                    throw new Error(`นักเรียนคนนี้ได้รับคิวแล้ว (${registrationData.displayQueueNumber || 'คิวที่ ' + registrationData.queueNumber})`);
                }
                
                if (!courseName) {
                    throw new Error('นักเรียนยังไม่ได้ถูกกำหนดหลักสูตร');
                }

                const activityRef = doc(db, 'activities', activityId);
                const activityDoc = await transaction.get(activityRef);

                if (!activityDoc.exists()) {
                    throw new Error('ไม่พบข้อมูลกิจกรรม');
                }

                const activityData = activityDoc.data();
                let currentCounters = activityData.queueCounters || {};
                let nextQueueNumber;

                if (currentCounters[courseName] !== undefined) {
                    nextQueueNumber = currentCounters[courseName] + 1;
                } else {
                    const registrationsRef = collection(db, 'registrations');
                    const q = query(registrationsRef, 
                        where("activityId", "==", activityId),
                        where("course", "==", courseName),
                        where("queueNumber", ">", 0),
                        orderBy("queueNumber", "desc"),
                        limit(1)
                    );
                    
                    const latestSnapshot = await getDocs(q);

                    if (!latestSnapshot.empty) {
                        const maxQueue = latestSnapshot.docs[0].data().queueNumber;
                        nextQueueNumber = maxQueue + 1;
                    } else {
                        nextQueueNumber = 1;
                    }
                }

                const newCounters = {
                    ...currentCounters,
                    [courseName]: nextQueueNumber
                };
                transaction.update(activityRef, { queueCounters: newCounters });

                transaction.update(regRef, { 
                    status: 'checked-in', 
                    queueNumber: nextQueueNumber 
                });
                
                return {
                    name: registrationData.fullName,
                    queue: registrationData.displayQueueNumber || nextQueueNumber,
                    course: courseName,
                };
            });

            setMessage(`✅ สำเร็จ! ${result.name} ได้รับคิว ${result.queue} (${result.course})`);

        } catch (err) {
            console.error(err);
            if (err.message.includes('index')) {
                setMessage(`⚠️ ระบบต้องการการตั้งค่า Index: กรุณาเปิด Console (F12) เพื่อสร้าง Index`);
            } else {
                setMessage(`❌ ${err.message}`);
            }
        } finally {
            setTimeout(() => {
                resetPage();
            }, 3500);
        }
    };

    const handleStartScanner = async () => {
        resetPage();
        setScannerState('scanning');
        
        try {
            await qrScannerRef.current.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 240, height: 240 } },
                (decodedText) => {
                    if (isProcessingRef.current) return;
                    isProcessingRef.current = true;

                    if (qrScannerRef.current?.isScanning) {
                        qrScannerRef.current.stop().catch(console.error);
                    }
                    assignQueue(decodedText);
                },
                () => {}
            );
        } catch (err) {
            setMessage(`ไม่สามารถเปิดกล้องได้: ${err.name}`);
            setScannerState('idle');
            isProcessingRef.current = false;
        }
    };
    
    const handleManualSearch = async (e) => {
        e.preventDefault();
        
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        setScannerState('submitting');
        setMessage('กำลังค้นหา...');

        try {
            const q = query(
                collection(db, 'registrations'),
                where("activityId", "==", activityId),
                where("nationalId", "==", nationalIdInput.trim())
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                throw new Error('ไม่พบข้อมูลนักเรียนในกิจกรรมนี้');
            }
            
            const registrationId = snapshot.docs[0].id;
            await assignQueue(registrationId);

        } catch (err) {
            setMessage(`❌ ${err.message}`);
            setTimeout(() => {
                resetPage();
            }, 3500);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-xl mx-auto font-sans">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/queue/scanner"
                        className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm font-normal border border-slate-200"
                        title="กลับ"
                    >
                        ← กลับ
                    </Link>
                    <div>
                        <h1 className="text-base font-bold text-slate-900">
                            สแกนรับคิว: {activity?.name || 'กำลังโหลด...'}
                        </h1>
                        <p className="text-sm font-normal text-slate-500">สแกน QR Code หรือค้นหาเพื่อแจกหมายเลขคิวเข้ารับบริการ</p>
                    </div>
                </div>
            </div>

            {/* Main Scanner Container */}
            <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
                {/* Mode Switcher Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200 text-sm font-normal">
                    <button
                        type="button"
                        onClick={() => { setMode('scan'); resetPage(); }}
                        className={`flex-1 py-2 rounded-md transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                            mode === 'scan' ? 'bg-[#000946] text-white font-normal shadow-xs' : 'text-slate-600 hover:text-slate-900 font-normal'
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
                        onClick={() => { setMode('manual'); resetPage(); }}
                        className={`flex-1 py-2 rounded-md transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                            mode === 'manual' ? 'bg-[#000946] text-white font-normal shadow-xs' : 'text-slate-600 hover:text-slate-900 font-normal'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span>ค้นหาด้วยเลขบัตร</span>
                    </button>
                </div>

                {/* Feedback Message */}
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

                {/* QR Scanner Mode */}
                {mode === 'scan' && (
                    <div className="flex flex-col items-center justify-center min-h-[290px] bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 relative overflow-hidden p-4">
                        <div id="reader" className={`${scannerState === 'scanning' ? 'block' : 'hidden'} w-full max-w-sm rounded-lg overflow-hidden`}></div>

                        {scannerState === 'idle' && !message && (
                            <button
                                type="button"
                                onClick={handleStartScanner}
                                className="flex flex-col items-center justify-center w-full h-full py-8 text-slate-500 hover:text-[#000946] transition-colors group cursor-pointer"
                            >
                                <div className="w-14 h-14 bg-white rounded-full border border-slate-200 flex items-center justify-center mb-2.5 group-hover:border-[#000946] transition-colors shadow-xs">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#000946]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-800 group-hover:text-[#000946]">แตะเพื่อเปิดกล้องสแกน</span>
                                <span className="text-sm text-slate-400 font-normal mt-0.5">อนุญาตการเข้าถึงกล้องเพื่อสแกน QR Code รับคิว</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Manual Mode */}
                {mode === 'manual' && scannerState === 'idle' && !message && (
                    <form onSubmit={handleManualSearch} className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="nationalId" className="block text-sm font-normal text-slate-700">เลขบัตรประจำตัวประชาชน</label>
                            <input 
                                type="tel" 
                                id="nationalId" 
                                value={nationalIdInput} 
                                onChange={(e) => setNationalIdInput(e.target.value)} 
                                required 
                                pattern="\d{13}" 
                                placeholder="กรอกเลข 13 หลัก..." 
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-900 outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20 transition-all placeholder:text-slate-400"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-2.5 bg-[#000946] hover:bg-[#000c5a] text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                        >
                            ค้นหาและแจกคิว
                        </button>
                    </form>
                )}
            </div>

        </div>
    );
}
