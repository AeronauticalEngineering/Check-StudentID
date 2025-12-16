'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../../../lib/firebase';
import {
    doc, getDoc, collection, query, where, onSnapshot, updateDoc, writeBatch, serverTimestamp, addDoc, deleteDoc, orderBy, limit, getDocs
} from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createQueueCallFlex } from '../../../../../lib/flexMessageTemplates';

// Modal component for inserting a queue
const InsertQueueModal = ({ onConfirm, onCancel }) => {
    const [queueNumber, setQueueNumber] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (queueNumber) {
            onConfirm(queueNumber);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4">แทรกคิว</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        value={queueNumber}
                        onChange={(e) => setQueueNumber(e.target.value.toUpperCase())}
                        placeholder="กรอกหมายเลขคิว (เช่น AS1)"
                        className="p-3 border rounded-md w-full text-center text-lg"
                        autoFocus
                    />
                    <div className="flex gap-3">
                        <button type="button" onClick={onCancel} className="w-full px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-300">ยกเลิก</button>
                        <button type="submit" className="w-full px-4 py-2 bg-primary text-white font-semibold rounded-md hover:bg-primary-hover">ยืนยัน</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// SVG Icons for buttons
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>;
const NextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
const RecallIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L10 9.586V8a4 4 0 114 4h-2a2 2 0 10-2 2v2a1 1 0 102 0v-2a6 6 0 00-6-6z" /></svg>;
const InsertIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;


export default function QueueCallPage() {
    const params = useParams();
    const { id: activityId } = params;
    const [activity, setActivity] = useState(null);
    const [channels, setChannels] = useState([]);
    const [registrants, setRegistrants] = useState([]);
    const [courseOptions, setCourseOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [publicUrl, setPublicUrl] = useState('');
    const [insertingOnChannel, setInsertingOnChannel] = useState(null);
    const [voiceEnabled, setVoiceEnabled] = useState(true);

    // ฟังก์ชันแปลงเลขคิวเป็นข้อความภาษาไทย
    const queueToThaiSpeech = (displayQueueNumber) => {
        if (!displayQueueNumber) return '';

        // แยกตัวอักษรและตัวเลข (เช่น ANE-001 -> ["ANE", "001"])
        const match = displayQueueNumber.match(/([A-Za-z]+)[- ]?(\d+)/);
        if (!match) return displayQueueNumber;

        const letters = match[1].toUpperCase();
        const numbers = match[2];

        // แปลงตัวอักษรเป็นภาษาไทย
        const letterMap = {
            'A': 'เอ', 'B': 'บี', 'C': 'ซี', 'D': 'ดี', 'E': 'อี', 'F': 'เอฟ',
            'G': 'จี', 'H': 'เอช', 'I': 'ไอ', 'J': 'เจ', 'K': 'เค', 'L': 'แอล',
            'M': 'เอ็ม', 'N': 'เอ็น', 'O': 'โอ', 'P': 'พี', 'Q': 'คิว', 'R': 'อาร์',
            'S': 'เอส', 'T': 'ที', 'U': 'ยู', 'V': 'วี', 'W': 'ดับเบิ้ลยู',
            'X': 'เอ็กซ์', 'Y': 'วาย', 'Z': 'แซด'
        };

        // แปลงตัวเลขเป็นภาษาไทย (อ่านทีละตัว)
        const digitMap = {
            '0': 'ศูนย์', '1': 'หนึ่ง', '2': 'สอง', '3': 'สาม', '4': 'สี่',
            '5': 'ห้า', '6': 'หก', '7': 'เจ็ด', '8': 'แปด', '9': 'เก้า'
        };

        // สร้างข้อความ (ใช้จุลภาคเพื่อเว้นจังหวะสั้นๆ)
        let speech = '';
        for (const char of letters) {
            speech += (letterMap[char] || char) + ', ';
        }
        for (const digit of numbers) {
            speech += (digitMap[digit] || digit) + ', ';
        }

        return speech.trim();
    };

    // ฟังก์ชันแปลงชื่อช่องเป็นคำอ่านภาษาไทย
    const channelNameToThai = (channelName) => {
        if (!channelName) return '';

        // Map คำศัพท์ที่ต้องการอ่านเป็นภาษาไทย
        const wordMap = {
            'AERO': 'แอโร่',
            'VIP': 'วีไอพี',
            'SERVICE': 'เซอร์วิส',
            'COUNTER': 'เคาน์เตอร์',
            'DESK': 'เดสก์',
            'STATION': 'สเตชั่น',
            'ZONE': 'โซน',
            'ROOM': 'รูม'
        };

        // แปลงตัวเลขเป็นภาษาไทย
        const digitToThai = {
            '0': 'ศูนย์', '1': 'หนึ่ง', '2': 'สอง', '3': 'สาม', '4': 'สี่',
            '5': 'ห้า', '6': 'หก', '7': 'เจ็ด', '8': 'แปด', '9': 'เก้า'
        };

        let result = channelName.toUpperCase();

        // แทนที่คำศัพท์
        for (const [eng, thai] of Object.entries(wordMap)) {
            result = result.replace(new RegExp(eng, 'gi'), thai);
        }

        // แทนที่ตัวเลข (ไม่เว้นวรรค)
        result = result.replace(/\d/g, (digit) => digitToThai[digit]);

        return result.trim().replace(/\s+/g, '');
    };

    // ฟังก์ชันอ่านออกเสียง
    const speakQueueNumber = (displayQueueNumber, channelName) => {
        if (!voiceEnabled || !('speechSynthesis' in window)) return;

        // หยุดเสียงที่กำลังพูดอยู่
        window.speechSynthesis.cancel();

        const thaiText = queueToThaiSpeech(displayQueueNumber);
        const thaiChannelName = channelNameToThai(channelName);
        const fullText = `เชิญ, หมายเลข, ${thaiText} ที่, ${thaiChannelName}`;

        const utterance = new SpeechSynthesisUtterance(fullText);
        utterance.lang = 'th-TH';
        utterance.rate = 0.85; // ความเร็วปกติ (เป็นธรรมชาติกว่า)
        utterance.pitch = 1; // ระดับเสียง (0 - 2)
        utterance.volume = 1; // ความดัง (0 - 1)

        // หาเสียงภาษาไทย
        const voices = window.speechSynthesis.getVoices();
        const thaiVoice = voices.find(v => v.lang.includes('th'));
        if (thaiVoice) {
            utterance.voice = thaiVoice;
        }

        window.speechSynthesis.speak(utterance);
    };

    // ... (All logic functions like fetchData, findLineUserId, handle... remain unchanged)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPublicUrl(`${window.location.origin}/queue/${activityId}`);
        }
    }, [activityId]);

    const fetchData = useCallback(async () => {
        if (!activityId) return;
        setIsLoading(true);

        const activityRef = doc(db, 'activities', activityId);
        const activitySnap = await getDoc(activityRef);
        if (activitySnap.exists()) setActivity({ id: activitySnap.id, ...activitySnap.data() });

        const unsubChannels = onSnapshot(query(collection(db, 'queueChannels'), where('activityId', '==', activityId), orderBy('channelNumber')), (snap) => {
            const channelData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setChannels(channelData);
        });

        const unsubRegistrants = onSnapshot(query(collection(db, 'registrations'), where('activityId', '==', activityId)), (snap) => {
            const regData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setRegistrants(regData);
            const courses = [...new Set(regData.map(r => r.course).filter(Boolean))];
            setCourseOptions(courses);
        });

        setIsLoading(false);
        return () => {
            unsubChannels();
            unsubRegistrants();
        };
    }, [activityId]);

    useEffect(() => {
        const unsubscribe = fetchData();
        return () => unsubscribe.then(u => u && u());
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

    const handleChannelUpdate = async (channelId, field, value) => {
        const channelRef = doc(db, 'queueChannels', channelId);
        await updateDoc(channelRef, { [field]: value });
    };

    const handleAddChannel = async () => {
        const maxChannelNum = channels.reduce((max, ch) => Math.max(max, ch.channelNumber), 0);
        await addDoc(collection(db, 'queueChannels'), {
            activityId,
            channelNumber: maxChannelNum + 1,
            channelName: `ช่องบริการ ${maxChannelNum + 1}`,
            currentQueueNumber: null,
            currentDisplayQueueNumber: null,
            currentStudentName: null,
            servingCourse: null,
            createdAt: serverTimestamp(),
        });
    };

    const handleDeleteChannel = async (channelId) => {
        if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบช่องบริการนี้?')) {
            await deleteDoc(doc(db, 'queueChannels', channelId));
        }
    };

    const callSpecificRegistrant = async (channel, registrant) => {
        try {
            const settingsRef = doc(db, 'systemSettings', 'notifications');
            const settingsSnap = await getDoc(settingsRef);
            const settings = settingsSnap.exists() ? settingsSnap.data() : { onQueueCall: true };

            const batch = writeBatch(db);
            const channelRef = doc(db, 'queueChannels', channel.id);
            batch.update(channelRef, {
                currentQueueNumber: registrant.queueNumber || null,
                currentDisplayQueueNumber: registrant.displayQueueNumber || null,
                currentStudentName: registrant.fullName || null
            });
            const regRef = doc(db, 'registrations', registrant.id);
            batch.update(regRef, { calledAt: serverTimestamp() });
            await batch.commit();

            // อ่านออกเสียงเลขคิว
            const channelName = channel.channelName || `ช่องบริการ ${channel.channelNumber}`;
            speakQueueNumber(registrant.displayQueueNumber, channelName);

            const lineUserId = registrant.lineUserId || await findLineUserId(registrant.nationalId);
            if (settings.onQueueCall && lineUserId) {
                const flexMessage = createQueueCallFlex({
                    activityName: activity.name,
                    channelName: channel.channelName || `ช่องบริการ ${channel.channelNumber}`,
                    queueNumber: registrant.displayQueueNumber,
                    courseName: registrant.course,
                });

                const response = await fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: lineUserId, flexMessage }) });
                if (!response.ok) {
                    const errorResult = await response.json();
                    throw new Error(errorResult.message || 'API Error');
                }
            } else if (settings.onQueueCall && !lineUserId) {
                alert('เรียกคิวสำเร็จ แต่ไม่พบ LINE ID ที่เชื่อมต่อกับผู้ใช้รายนี้');
            }
        } catch (error) {
            console.error("Error calling queue:", error);
            alert(`เกิดข้อผิดพลาดในการเรียกคิว: ${error.message}`);
        }
    };

    const handleCallNext = async (channel) => {
        if (!channel.servingCourse) {
            alert('กรุณาเลือกหลักสูตรสำหรับช่องบริการนี้ก่อน');
            return;
        }
        const waitingForCourse = registrants.filter(r => r.course === channel.servingCourse && r.status === 'checked-in' && !r.calledAt).sort((a, b) => a.queueNumber - b.queueNumber);
        if (waitingForCourse.length === 0) {
            alert(`ไม่มีคิวรอสำหรับหลักสูตร: ${channel.servingCourse}`);
            return;
        }
        const nextInQueue = waitingForCourse[0];
        await callSpecificRegistrant(channel, nextInQueue);
    };

    const handleRecall = async (channel) => {
        if (!channel.currentQueueNumber) {
            alert('ยังไม่มีคิวที่ถูกเรียกในช่องนี้');
            return;
        }
        const currentRegistrant = registrants.find(r => r.queueNumber === channel.currentQueueNumber && r.course === channel.servingCourse);
        if (!currentRegistrant) {
            alert(`ไม่พบข้อมูลผู้ลงทะเบียนสำหรับคิวที่ ${channel.currentQueueNumber}`);
            return;
        }
        await callSpecificRegistrant(channel, currentRegistrant);
        alert(`ส่งแจ้งเตือนเรียกคิว ${currentRegistrant.displayQueueNumber} ซ้ำอีกครั้งสำเร็จ!`);
    };

    const handleInsertQueue = async (channel, displayQueueNumber) => {
        const registrantToCall = registrants.find(r => r.displayQueueNumber === displayQueueNumber && r.status === 'checked-in');
        if (!registrantToCall) {
            alert(`ไม่พบคิว ${displayQueueNumber} ที่ได้ทำการเช็คอินไว้`);
            setInsertingOnChannel(null);
            return;
        }
        await callSpecificRegistrant(channel, registrantToCall);
        alert(`แทรกคิว ${displayQueueNumber} สำเร็จ`);
        setInsertingOnChannel(null);
    };

    // ฟังก์ชันรีเซ็ต calledAt เพื่อให้คิวกลับมารอใหม่
    const handleResetCalledAt = async () => {
        const calledRegistrants = registrants.filter(r => r.status === 'checked-in' && r.calledAt);
        if (calledRegistrants.length === 0) {
            alert('ไม่มีคิวที่ถูกเรียกไปแล้ว');
            return;
        }

        if (!window.confirm(`ต้องการรีเซ็ต ${calledRegistrants.length} คิวให้กลับมา "รอ" ใหม่หรือไม่?\n\nคิวทั้งหมดที่ถูกเรียกไปแล้วจะกลับมาอยู่ในรายการรอเรียก`)) {
            return;
        }

        try {
            const batch = writeBatch(db);
            calledRegistrants.forEach(reg => {
                const regRef = doc(db, 'registrations', reg.id);
                batch.update(regRef, { calledAt: null });
            });
            await batch.commit();
            alert(`รีเซ็ต ${calledRegistrants.length} คิวสำเร็จ`);
        } catch (error) {
            alert(`เกิดข้อผิดพลาด: ${error.message}`);
        }
    };

    if (isLoading) return <p className="text-center p-8 font-sans">กำลังโหลด...</p>;

    const waitingByCourse = courseOptions.reduce((acc, course) => {
        acc[course] = registrants.filter(r => r.course === course && r.status === 'checked-in' && !r.calledAt).length;
        return acc;
    }, {});

    return (
        <div className="bg-gray-100 min-h-screen">
            {insertingOnChannel && (
                <InsertQueueModal
                    onConfirm={(queueNumber) => handleInsertQueue(channels.find(c => c.id === insertingOnChannel), queueNumber)}
                    onCancel={() => setInsertingOnChannel(null)}
                />
            )}
            <main className="container mx-auto p-4 md:p-8">
                <h1 className="text-3xl font-bold mb-6 text-gray-800">เรียกคิวสำหรับ: {activity?.name}</h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-semibold text-gray-700">ช่องเรียกคิว</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                                    className={`flex items-center px-4 py-2 font-semibold rounded-lg shadow-sm transition-colors ${voiceEnabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-600 hover:bg-gray-400'}`}
                                    title={voiceEnabled ? 'ปิดเสียงอ่านคิว' : 'เปิดเสียงอ่านคิว'}
                                >
                                    {voiceEnabled ? (
                                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                    ) : (
                                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                                    )}
                                    {voiceEnabled ? 'เสียงเปิด' : 'เสียงปิด'}
                                </button>
                                <button onClick={handleAddChannel} className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-colors">
                                    <PlusIcon /> เพิ่มช่อง
                                </button>
                            </div>
                        </div>
                        {/* ✅ Main grid for channels, supports up to 3 columns on extra large screens */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {channels.map(channel => (
                                <div key={channel.id} className="bg-white p-4 border rounded-lg shadow-md grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                                    {/* Left Column: Display */}
                                    <div className="bg-gray-50 p-4 rounded-lg text-center h-full flex flex-col justify-center">
                                        <p className="text-sm text-gray-500">คิวปัจจุบัน</p>
                                        <p className="text-3xl font-extrabold text-primary my-1 tracking-tighter">{channel.currentDisplayQueueNumber || '-'}</p>
                                        <p className="text-lg text-gray-700 h-7 truncate font-medium">{channel.currentStudentName || '-'}</p>
                                    </div>
                                    {/* Right Column: Controls */}
                                    <div className="flex flex-col justify-between space-y-3">
                                        <div className="space-y-2">
                                            <input type="text" defaultValue={channel.channelName || `ช่องบริการ ${channel.channelNumber}`} onBlur={e => handleChannelUpdate(channel.id, 'channelName', e.target.value)} className="w-full p-2 border rounded-md text-sm font-semibold" />
                                            <select value={channel.servingCourse || ''} onChange={e => handleChannelUpdate(channel.id, 'servingCourse', e.target.value)} className="w-full p-2 border rounded-md bg-white text-sm">
                                                <option value="">-- เลือกหลักสูตร --</option>
                                                {courseOptions.map(course => <option key={course} value={course}>{course}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <button onClick={() => handleCallNext(channel)} className="w-full py-2 flex items-center justify-center bg-primary text-white font-bold rounded-md hover:bg-primary-hover disabled:bg-gray-400 transition-colors" disabled={!channel.servingCourse}>
                                                <NextIcon /> <span className="ml-2">เรียกคิวถัดไป</span>
                                            </button>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button onClick={() => handleRecall(channel)} className="w-full py-2 flex items-center justify-center bg-card text-white font-semibold rounded-md hover:opacity-90 disabled:bg-gray-400 transition-colors text-sm" disabled={!channel.currentQueueNumber}>
                                                    เรียกซ้ำ
                                                </button>
                                                <button onClick={() => setInsertingOnChannel(channel.id)} className="w-full py-2 flex items-center justify-center bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition-colors text-sm">
                                                    แทรกคิว
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <button onClick={() => handleDeleteChannel(channel.id)} className="text-xs text-red-500 hover:text-red-700 hover:underline inline-flex items-center gap-1">
                                                <TrashIcon /> ลบช่อง
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Summary Column */}
                    <div className="lg:col-span-1 space-y-6">
                        <h2 className="text-2xl font-semibold text-gray-700">ข้อมูลสรุป</h2>
                        <div className="bg-white p-5 border rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold mb-3">ลิงก์สำหรับแสดงผลคิว</h3>
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white border inline-block rounded-lg shadow-sm"><QRCodeSVG value={publicUrl} size={100} /></div>
                                <div>
                                    <p className="text-sm text-gray-500">ใช้สำหรับแสดงผลบนจอสาธารณะ</p>
                                    <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 break-all text-sm">{publicUrl}</a>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 border rounded-lg shadow-md">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-lg font-semibold">คิวที่รอเรียก</h3>
                                <button
                                    onClick={handleResetCalledAt}
                                    className="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-colors"
                                    title="รีเซ็ตคิวที่ถูกเรียกแล้วให้กลับมารอใหม่"
                                >
                                    🔄 รีเซ็ต
                                </button>
                            </div>
                            <div className="space-y-2">
                                {courseOptions.length > 0 ? courseOptions.map(course => (
                                    <div key={course} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <span className="font-medium text-gray-700">{course}:</span>
                                        <span className="font-bold text-primary">{waitingByCourse[course] || 0} คิว</span>
                                    </div>
                                )) : <p className="text-sm text-gray-500 text-center">ยังไม่มีข้อมูลคิว</p>}
                            </div>
                        </div>

                        <div className="bg-white p-5 border rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold mb-3">รายชื่อผู้รอคิว</h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {courseOptions.map(course => {
                                    const waitingList = registrants
                                        .filter(r => r.course === course && r.status === 'checked-in' && !r.calledAt)
                                        .sort((a, b) => {
                                            // Extract numeric part from displayQueueNumber (e.g., "AMT8" -> 8)
                                            const numA = parseInt(a.displayQueueNumber?.replace(/\D/g, '') || '0');
                                            const numB = parseInt(b.displayQueueNumber?.replace(/\D/g, '') || '0');
                                            return numA - numB;
                                        });

                                    if (waitingList.length === 0) return null;

                                    return (
                                        <div key={course} className="border-b pb-3 last:border-b-0">
                                            <h4 className="font-semibold text-gray-700 mb-2 text-sm">{course}</h4>
                                            <div className="space-y-1">
                                                {waitingList.map((reg, index) => (
                                                    <div key={reg.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm hover:bg-gray-100 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-primary min-w-[50px]">{reg.displayQueueNumber}</span>
                                                            <span className="text-gray-700 truncate">{reg.fullName}</span>
                                                        </div>
                                                        <span className="text-xs text-gray-500">ลำดับที่ {index + 1}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                {registrants.filter(r => r.status === 'checked-in' && !r.calledAt).length === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-4">ไม่มีผู้รอคิวในขณะนี้</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
