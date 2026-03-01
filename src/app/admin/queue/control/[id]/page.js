'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../../../lib/firebase';
import {
    doc, getDoc, collection, query, where, onSnapshot, writeBatch, serverTimestamp, getDocs, limit
} from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { createQueueCallFlex } from '../../../../../lib/flexMessageTemplates';

export default function QueueControlPage() {
    const params = useParams();
    const router = useRouter();
    const { id: channelId } = params;

    const [channel, setChannel] = useState(null);
    const [activity, setActivity] = useState(null);
    const [registrants, setRegistrants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);



    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Channel
            const channelRef = doc(db, 'queueChannels', channelId);
            const unsubscribeChannel = onSnapshot(channelRef, async (snap) => {
                if (!snap.exists()) {
                    setError('ไม่พบช่องบริการนี้');
                    setIsLoading(false);
                    return;
                }
                const channelData = { id: snap.id, ...snap.data() };
                setChannel(channelData);

                // 2. Fetch Activity (only once)
                if (!activity) {
                    const activityRef = doc(db, 'activities', channelData.activityId);
                    const activitySnap = await getDoc(activityRef);
                    if (activitySnap.exists()) {
                        setActivity({ id: activitySnap.id, ...activitySnap.data() });
                    }
                }
            });

            // 3. Setup Registrants Listener (needs activityId from channel)
            const channelSnap = await getDoc(channelRef);
            if (channelSnap.exists()) {
                const actId = channelSnap.data().activityId;
                const unsubRegistrants = onSnapshot(
                    query(collection(db, 'registrations'), where('activityId', '==', actId)),
                    (snap) => {
                        const regData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                        setRegistrants(regData);
                    }
                );

                setIsLoading(false);
                return () => {
                    unsubscribeChannel();
                    unsubRegistrants();
                };
            }

            setIsLoading(false);
            return unsubscribeChannel;

        } catch (err) {
            console.error("Error fetching data:", err);
            setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            setIsLoading(false);
        }
    }, [channelId]); // Removed activity dependency to avoid infinite loops

    useEffect(() => {
        let cleanup;
        fetchData().then(fn => { cleanup = fn; });
        return () => { if (cleanup) cleanup(); };
    }, [fetchData]);

    const findLineUserId = async (nationalId) => {
        if (!nationalId) return null;
        const profileQuery = query(collection(db, 'studentProfiles'), where("nationalId", "==", nationalId), limit(1));
        const profileSnapshot = await getDocs(profileQuery);
        if (!profileSnapshot.empty) {
            return profileSnapshot.docs[0].data().lineUserId;
        }
        return null;
    };

    const callSpecificRegistrant = async (registrant) => {
        try {
            const batch = writeBatch(db);
            const channelRef = doc(db, 'queueChannels', channel.id);

            // Generate a unique ping ID for animation
            const timestamp = new Date().getTime();

            batch.update(channelRef, {
                currentQueueNumber: registrant.queueNumber || null,
                currentDisplayQueueNumber: registrant.displayQueueNumber || null,
                currentStudentName: registrant.fullName || null,
                lastCalledAt: serverTimestamp(),
                pingId: timestamp // Add this to trigger animation on display screen
            });

            const regRef = doc(db, 'registrations', registrant.id);
            batch.update(regRef, { calledAt: serverTimestamp(), status: 'interviewing' });
            await batch.commit();

            // Notify LINE
            const lineUserId = registrant.lineUserId || await findLineUserId(registrant.nationalId);
            if (lineUserId) {
                const flexMessage = createQueueCallFlex({
                    activityName: activity?.name || '',
                    channelName: channel.channelName || `ช่องบริการ ${channel.channelNumber}`,
                    queueNumber: registrant.displayQueueNumber,
                    courseName: registrant.course,
                    activityId: registrant.activityId,
                    requireEvaluation: activity?.enableEvaluation !== false
                });

                await fetch('/api/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: lineUserId,
                        flexMessage
                    })
                }).catch(e => console.error("Line notification failed:", e));
            }

        } catch (error) {
            console.error("Error calling queue:", error);
            alert(`เกิดข้อผิดพลาดในการเรียกคิว: ${error.message}`);
        }
    };

    const handleCallNext = async () => {
        if (!channel.servingCourse) {
            alert('ช่องบริการนี้ยังไม่ได้ระบุหลักสูตร กรุณาติดต่อ Admin หลัก');
            return;
        }
        const waitingForCourse = registrants
            .filter(r => r.course === channel.servingCourse && r.status === 'checked-in' && !r.calledAt)
            .sort((a, b) => a.queueNumber - b.queueNumber);

        if (waitingForCourse.length === 0) {
            alert(`ไม่มีคิวรอสำหรับหลักสูตร: ${channel.servingCourse}`);
            return;
        }
        const nextInQueue = waitingForCourse[0];
        await callSpecificRegistrant(nextInQueue);
    };

    const handleRecall = async () => {
        if (!channel.currentDisplayQueueNumber) {
            alert('ยังไม่มีคิวที่ถูกเรียกในช่องนี้');
            return;
        }

        // ค้นหาผู้สมัครที่กำลังจะถูกเรียกซ้ำ (ต้องรวมกรณีที่สถานะเป็น interviewing แล้วด้วย)
        const currentRegistrant = registrants.find(r =>
            r.displayQueueNumber === channel.currentDisplayQueueNumber
        );

        if (!currentRegistrant) {
            alert(`ไม่พบข้อมูลผู้ลงทะเบียนสำหรับคิวที่ ${channel.currentDisplayQueueNumber}`);
            return;
        }
        await callSpecificRegistrant(currentRegistrant);
        alert(`ส่งแจ้งเตือนและเรียกคิว ${currentRegistrant.displayQueueNumber} ซ้ำอีกครั้งสำเร็จ!`);
    };

    if (isLoading) return <div className="text-center p-12 text-gray-500">กำลังโหลดข้อมูล...</div>;
    if (error) return <div className="text-center p-12 text-red-500 font-bold">{error}</div>;
    if (!channel) return <div className="text-center p-12 text-gray-500">ไม่พบช่องบริการ</div>;

    const waitingRegistrants = registrants
        .filter(r => r.course === channel.servingCourse && r.status === 'checked-in' && !r.calledAt)
        .sort((a, b) => {
            const numA = parseInt(a.displayQueueNumber?.replace(/\D/g, '') || '0');
            const numB = parseInt(b.displayQueueNumber?.replace(/\D/g, '') || '0');
            return numA - numB;
        });

    const waitingCount = waitingRegistrants.length;

    return (
        <div className="bg-gray-100 min-h-screen py-8 px-4 font-sans flex flex-col items-center justify-center">
            <div className="max-w-5xl w-full mx-auto bg-white rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-5">

                {/* Left Column: ควบคุมคิว */}
                <div className="p-6 md:p-8 col-span-1 md:col-span-3 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col justify-center">

                    {/* Header เล็กๆ แทนของเดิม */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
                        <div className="text-left font-bold text-gray-600 text-lg">
                            {channel.channelName || `ช่องบริการ ${channel.channelNumber}`}
                        </div>
                        <div className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">
                            หลักสูตร: {channel.servingCourse || 'ยังไม่ระบุ'}
                        </div>
                    </div>

                    <div className="text-center mb-8 bg-gray-50 py-10 rounded-2xl border border-gray-100">
                        <p className="text-gray-500 text-sm font-medium mb-2">คิวปัจจุบัน</p>
                        <p className="text-7xl font-black text-primary tracking-tighter mb-4">
                            {channel.currentDisplayQueueNumber || '-'}
                        </p>
                        <p className="text-xl font-bold text-gray-800 h-8 line-clamp-1 px-4">
                            {channel.currentStudentName || 'ยังไม่มีผู้ถูกเรียก'}
                        </p>
                    </div>

                    <div className="space-y-4 mt-auto">
                        <button
                            onClick={handleCallNext}
                            disabled={!channel.servingCourse || waitingCount === 0}
                            className={`w-full py-4 text-xl font-bold rounded-xl flex items-center justify-center transition-all ${!channel.servingCourse || waitingCount === 0
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/30 active:scale-95'
                                }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                            เรียกคิวถัดไป
                        </button>

                        <button
                            onClick={handleRecall}
                            disabled={!channel.currentDisplayQueueNumber}
                            className={`w-full py-3 text-lg font-semibold rounded-xl flex items-center justify-center transition-all ${!channel.currentDisplayQueueNumber
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/20 active:scale-95'
                                }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                            </svg>
                            เรียกซ้ำ
                        </button>
                    </div>
                </div>

                {/* Right Column: รายชื่อผู้รอคิว */}
                <div className="p-6 md:p-8 col-span-1 md:col-span-2 bg-gray-50 flex flex-col md:max-h-[80vh]">
                    <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
                        <span className="text-gray-700 font-bold text-lg">คิวที่รอ</span>
                        <span className="text-2xl font-black text-primary bg-primary/10 px-4 py-1.5 rounded-xl">
                            {waitingCount}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {waitingCount > 0 ? (
                            waitingRegistrants.map((reg, index) => (
                                <div key={reg.id} className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className="font-extrabold text-primary text-base shrink-0 w-12">{reg.displayQueueNumber}</span>
                                        <span className="text-gray-700 truncate font-semibold">{reg.fullName}</span>
                                    </div>
                                    <span className="text-xs text-gray-400 font-bold shrink-0">#{index + 1}</span>
                                </div>
                            ))
                        ) : (
                            <div className="w-full flex justify-center items-center h-40 text-center text-gray-400 text-sm font-medium">
                                ไม่มีคิวรอเรียกหลักสูตรนี้
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 text-center text-sm">
                <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 underline font-medium transition-colors">
                    กลับหน้าหลัก (ปิดหน้าต่าง)
                </button>
            </div>
        </div >
    );
}
