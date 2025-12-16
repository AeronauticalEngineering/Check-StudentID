'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../../../../lib/firebase';
import {
  doc, collection, query, where, getDocs, runTransaction
} from 'firebase/firestore';
import { useParams } from 'next/navigation';

export default function QueueScannerPage() {
    const params = useParams();
    const { id: activityId } = params;
    const [mode, setMode] = useState('scan'); // 'scan' or 'manual'
    const [scannerState, setScannerState] = useState('idle');
    const [message, setMessage] = useState('');
    const [nationalIdInput, setNationalIdInput] = useState('');
    const qrScannerRef = useRef(null);
    const isProcessingRef = useRef(false); // กันการสแกนซ้ำ

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
        isProcessingRef.current = false; // ปลดล็อคเมื่อเริ่มใหม่
    }

    const assignQueue = async (registrationId) => {
        setScannerState('submitting');
        try {
            const result = await runTransaction(db, async (transaction) => {
                // 1. อ่านข้อมูลการลงทะเบียน (Read: 1 doc)
                const regRef = doc(db, 'registrations', registrationId);
                const regDoc = await transaction.get(regRef);

                if (!regDoc.exists() || regDoc.data().activityId !== activityId) {
                    throw new Error('ข้อมูลไม่ถูกต้องสำหรับกิจกรรมนี้');
                }
                
                const registrationData = regDoc.data();
                const courseName = registrationData.course;

                if (registrationData.status === 'checked-in') {
                    throw new Error(`นักเรียนคนนี้ได้รับคิวแล้ว (คิวที่ ${registrationData.queueNumber})`);
                }
                
                if (!courseName) {
                    throw new Error('นักเรียนยังไม่ได้ถูกกำหนดหลักสูตร');
                }

                // 2. อ่านข้อมูล Activity เพื่อเอาเลขคิวล่าสุด (Read: 1 doc)
                // เป็นการ Lock Document นี้ ห้ามใครแย่งเขียนจนกว่าเราจะเสร็จ
                const activityRef = doc(db, 'activities', activityId);
                const activityDoc = await transaction.get(activityRef);

                if (!activityDoc.exists()) {
                    throw new Error('ไม่พบข้อมูลกิจกรรม');
                }

                const activityData = activityDoc.data();
                let currentCounters = activityData.queueCounters || {}; // เก็บ Counter แยกตามสาขา
                let nextQueueNumber;

                // 3. เช็คว่ามี Counter ของสาขานี้หรือยัง?
                if (currentCounters[courseName] !== undefined) {
                    // แบบใหม่: ถ้ามีแล้ว ให้เอาค่าเดิม + 1 (เร็ว + ประหยัด Quota)
                    nextQueueNumber = currentCounters[courseName] + 1;
                } else {
                    // แบบเก่า (Fallback): ถ้ายังไม่มี (เพิ่งเริ่มระบบใหม่กลางคัน) ให้นับจาก DB เอา (ช้าหน่อยแต่ทำแค่ครั้งเดียว)
                    const registrationsRef = collection(db, 'registrations');
                    const q = query(registrationsRef, 
                        where("activityId", "==", activityId),
                        where("course", "==", courseName),
                        where("status", "==", "checked-in")
                    );
                    const checkedInSnapshot = await getDocs(q);
                    nextQueueNumber = checkedInSnapshot.size + 1;
                }

                // 4. อัพเดทเลขคิวล่าสุดกลับไปที่ Activity (Write: 1 doc)
                const newCounters = {
                    ...currentCounters,
                    [courseName]: nextQueueNumber
                };
                transaction.update(activityRef, { queueCounters: newCounters });

                // 5. อัพเดทสถานะนักเรียน (Write: 1 doc)
                transaction.update(regRef, { 
                    status: 'checked-in', 
                    queueNumber: nextQueueNumber 
                });
                
                return {
                    name: registrationData.fullName,
                    queue: nextQueueNumber,
                    course: courseName,
                };
            });

            setMessage(`✅ สำเร็จ! ${result.name} ได้รับคิวที่ ${result.queue} (${result.course})`);

        } catch (err) {
            setMessage(`❌ ${err.message}`);
        } finally {
            // รอ 3 วินาทีเพื่อให้คนอ่านทัน แล้วค่อยรีเซ็ตหน้า
            setTimeout(() => {
                resetPage();
            }, 3000);
        }
    };

    const handleStartScanner = async () => {
        resetPage();
        setScannerState('scanning');
        
        try {
            await qrScannerRef.current.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    // ล็อกการทำงาน: ถ้ากำลังประมวลผลอยู่ ห้ามทำซ้ำ
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
        isProcessingRef.current = true; // ล็อกทันทีที่กด

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
            }, 3000);
        }
    };

    return (
        <div className="max-w-xl mx-auto p-4 md:p-8 font-sans">
            <div className="bg-white p-6 rounded-lg shadow-2xl min-h-[400px] flex flex-col items-center">
                 <div className="flex justify-center border border-gray-300 rounded-lg p-1 bg-gray-100 mb-6 w-full">
                    <button onClick={() => { setMode('scan'); resetPage(); }} className={`w-1/2 py-2 rounded-md transition-colors ${mode === 'scan' ? 'bg-primary text-white shadow' : 'text-gray-600'}`}>
                    สแกน QR Code
                    </button>
                    <button onClick={() => { setMode('manual'); resetPage(); }} className={`w-1/2 py-2 rounded-md transition-colors ${mode === 'manual' ? 'bg-primary text-white shadow' : 'text-gray-600'}`}>
                    ค้นหาด้วยตนเอง
                    </button>
                </div>

                {message && <p className={`mt-4 text-center font-bold text-lg ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}

                {mode === 'scan' && scannerState === 'idle' && !message && (
                    <button onClick={handleStartScanner} className="text-xl font-semibold text-primary">
                        เริ่มสแกนเพื่อรับคิว
                    </button>
                )}
                <div id="reader" className={`${scannerState === 'scanning' ? 'block' : 'hidden'} w-full max-w-sm border-2 rounded-lg`}></div>

                {mode === 'manual' && scannerState === 'idle' && !message && (
                     <form onSubmit={handleManualSearch} className="w-full space-y-4 animate-fade-in">
                        <div>
                            <label htmlFor="nationalId" className="block text-sm font-medium text-gray-700">กรอกเลขบัตรประชาชน</label>
                            <input 
                                type="tel" 
                                id="nationalId" 
                                value={nationalIdInput} 
                                onChange={(e) => setNationalIdInput(e.target.value)} 
                                required 
                                pattern="\d{13}" 
                                placeholder="กรอกเลข 13 หลัก" 
                                className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <button type="submit" className="w-full py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50">
                            ค้นหาและรับคิว
                        </button>
                    </form>
                )}

            </div>
        </div>
    );
}
