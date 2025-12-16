'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../../../../lib/firebase';
import {
  doc, getDoc, updateDoc, collection, query, where, getDocs, runTransaction
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
    const isProcessingRef = useRef(false); // [แก้ไข 1] เพิ่ม Ref สำหรับล็อคการประมวลผล

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
    }

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

                if (registrationData.status === 'checked-in') {
                    throw new Error(`นักเรียนคนนี้ได้รับคิวแล้ว (คิวที่ ${registrationData.queueNumber})`);
                }
                
                if (!registrationData.course) {
                    throw new Error('นักเรียนยังไม่ได้ถูกกำหนดหลักสูตร');
                }

                const registrationsRef = collection(db, 'registrations');
                const q = query(registrationsRef, 
                    where("activityId", "==", activityId),
                    where("course", "==", registrationData.course),
                    where("status", "==", "checked-in")
                );
                
                const checkedInSnapshot = await getDocs(q);
                const nextQueueNumber = checkedInSnapshot.size + 1;

                transaction.update(regRef, { 
                    status: 'checked-in', 
                    queueNumber: nextQueueNumber 
                });
                
                return {
                    name: registrationData.fullName,
                    queue: nextQueueNumber,
                    course: registrationData.course,
                };
            });

            setMessage(`✅ สำเร็จ! ${result.name} ได้รับคิวที่ ${result.queue} (${result.course})`);

        } catch (err) {
            setMessage(`❌ ${err.message}`);
        } finally {
            setTimeout(() => {
                resetPage();
                // [แก้ไข 4] ปลดล็อคหลังจากทำงานเสร็จ (หรือหลังจาก Reset หน้า)
                isProcessingRef.current = false; 
            }, 5000);
        }
    };

    const handleStartScanner = async () => {
        resetPage();
        isProcessingRef.current = false; // [แก้ไข 2] รีเซ็ตค่าล็อคเมื่อเริ่มสแกนใหม่
        setScannerState('scanning');
        try {
            await qrScannerRef.current.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    // [แก้ไข 3] เช็คว่ากำลังทำงานอยู่หรือเปล่า ถ้าใช่ให้หยุด
                    if (isProcessingRef.current) return;
                    isProcessingRef.current = true; // ล็อคทันที

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
        resetPage();
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
            }, 5000);
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

                {message && <p className="mt-4 text-center font-bold text-lg">{message}</p>}

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
                        <button type="submit" className="w-full py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700">
                            ค้นหาและรับคิว
                        </button>
                    </form>
                )}

            </div>
        </div>
    );
}
