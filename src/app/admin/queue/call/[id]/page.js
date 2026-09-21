'use client';

import { useState, useEffect, useCallback, use, useMemo } from 'react';
import { db } from '../../../../../lib/firebase';
import {
    doc, getDoc, collection, query, where, onSnapshot, updateDoc, writeBatch, serverTimestamp, addDoc, deleteDoc, orderBy, limit, getDocs
} from 'firebase/firestore';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { createQueueCallFlex } from '../../../../../lib/flexMessageTemplates';
import ExaminerScoringModal from '../../../../../components/ExaminerScoringModal';
import { queueToThaiSpeech, channelNameToThai } from '../../../../../lib/speechUtils';
import { useModal } from '../../../../../context/ModalContext';


// Modal component for inserting a queue
const InsertQueueModal = ({ onConfirm, onCancel }) => {
    const [queueNumber, setQueueNumber] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (queueNumber) {
            onConfirm(queueNumber.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 font-sans">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xl w-full max-w-sm space-y-4">
                <div className="border-b border-slate-100 pb-2.5">
                    <h2 className="text-sm font-bold text-slate-900">แทรกคิวเข้ารับบริการ</h2>
                    <p className="text-sm font-normal text-slate-500">ระบุหมายเลขคิวที่ต้องการแทรกเข้าช่องบริการนี้</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        value={queueNumber}
                        onChange={(e) => setQueueNumber(e.target.value.toUpperCase())}
                        placeholder="เช่น ANE-001 หรือ AS1"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-center text-slate-900 outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20 transition-all"
                        autoFocus
                    />
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-normal rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-2 bg-[#000946] hover:bg-[#000c5a] text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                        >
                            ยืนยันแทรกคิว
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Modal for managing examiners directly from queue console
const ExaminerManagementModal = ({ isOpen, onClose, examiners, channels, onAddExaminer, onDeleteExaminer }) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim()) {
            onAddExaminer({ name: name.trim(), role: role.trim() });
            setName('');
            setRole('');
        }
    };

    // Helper to see where each examiner is currently assigned
    const getAssignmentStatus = (exName) => {
        for (const ch of channels) {
            const chName = ch.name || ch.channelName || `โต๊ะที่ ${ch.channelNumber || ''}`;
            if (ch.examiner1 === exName) return { assigned: true, text: `ประจำ${chName} (คนที่ 1)` };
            if (ch.examiner2 === exName) return { assigned: true, text: `ประจำ${chName} (คนที่ 2)` };
        }
        return { assigned: false, text: 'ว่าง (พร้อมเลือก)' };
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4 font-sans animate-in fade-in duration-150">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2.5">
                        <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">จัดการรายชื่อกรรมการ (Examiners Master List)</h2>
                            <p className="text-sm font-normal text-slate-500">กำหนดรายชื่อกรรมการสำหรับเลือกประจำแต่ละโต๊ะ (โต๊ะละ 2 ท่าน)</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg text-sm font-normal cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Form to add */}
                <form onSubmit={handleSubmit} className="p-3.5 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-6">
                        <input
                            type="text"
                            placeholder="ชื่อ-นามสกุล (เช่น อ.สมชาย ใจดี) *"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-900 outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20 transition-all placeholder:text-slate-400"
                            required
                        />
                    </div>
                    <div className="sm:col-span-4">
                        <input
                            type="text"
                            placeholder="ตำแหน่ง/สังกัด (ไม่บังคับ)"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-normal text-slate-900 outline-none focus:border-[#000946] focus:ring-1 focus:ring-[#000946]/20 transition-all placeholder:text-slate-400"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <button
                            type="submit"
                            className="w-full py-2 bg-[#000946] hover:bg-[#000c5a] text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                        >
                            + เพิ่ม
                        </button>
                    </div>
                </form>

                {/* List of examiners */}
                <div className="p-4 overflow-y-auto flex-1 space-y-2.5 divide-y divide-slate-100">
                    {examiners.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-sm font-normal text-slate-400">ยังไม่มีรายชื่อกรรมการในระบบ กรุณากรอกเพิ่มด้านบน</p>
                        </div>
                    ) : (
                        examiners.map(ex => {
                            const status = getAssignmentStatus(ex.name);
                            return (
                                <div key={ex.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-normal text-slate-900 truncate">{ex.name}</span>
                                            {ex.role && (
                                                <span className="text-sm text-slate-500 font-normal truncate">
                                                    • {ex.role}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm flex items-center gap-1.5 mt-0.5">
                                            <span className={`inline-block w-2 h-2 rounded-full ${status.assigned ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                            <span className={status.assigned ? 'text-emerald-700 font-normal' : 'text-slate-400 font-normal'}>
                                                {status.text}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onDeleteExaminer(ex.id, ex.name)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg text-sm font-normal transition-colors cursor-pointer"
                                        title="ลบกรรมการท่านนี้"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-sm font-normal text-slate-500">
                    <span>ทั้งหมด <strong className="font-semibold text-slate-800">{examiners.length}</strong> ท่าน</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-normal rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function QueueCallPage({ params }) {
    const unwrappedParams = use(params);
    const activityId = unwrappedParams.id;
    const { showAlert, showConfirm, showToast } = useModal();

    const [activity, setActivity] = useState(null);
    const [channels, setChannels] = useState([]);
    const [registrants, setRegistrants] = useState([]);
    const [courseOptions, setCourseOptions] = useState([]);
    const [examiners, setExaminers] = useState([]);
    const [isExaminerModalOpen, setIsExaminerModalOpen] = useState(false);
    const [activeChannelForScoring, setActiveChannelForScoring] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [publicUrl, setPublicUrl] = useState('');
    const [insertingOnChannel, setInsertingOnChannel] = useState(null);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [scoringRegistrant, setScoringRegistrant] = useState(null);
    const [examinerName, setExaminerName] = useState('');
    const [sharedQrModal, setSharedQrModal] = useState(null); // { title, url, subtitle }

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('aero_examiner_name') || '';
            setExaminerName(saved);
        }
    }, []);

    const handleExaminerNameChange = (val) => {
        setExaminerName(val);
        if (typeof window !== 'undefined') {
            localStorage.setItem('aero_examiner_name', val);
        }
    };

    const speakQueueNumber = (displayQueueNumber, channelName) => {
        if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const fullText = `ขอเชิญคิว ${queueToThaiSpeech(displayQueueNumber)} ที่ ${channelNameToThai(channelName)} ค่ะ`;
        const utterance = new SpeechSynthesisUtterance(fullText);
        utterance.lang = 'th-TH';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    };

    const findLineUserId = async (nationalId) => {
        if (!nationalId) return null;
        try {
            const profileRef = doc(db, 'studentProfiles', nationalId);
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists() && profileSnap.data().lineUserId) {
                return profileSnap.data().lineUserId;
            }
            const studentsRef = collection(db, 'students');
            const q = query(studentsRef, where('nationalId', '==', nationalId), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty && querySnapshot.docs[0].data().lineUserId) {
                return querySnapshot.docs[0].data().lineUserId;
            }
            return null;
        } catch (error) {
            console.error('Error finding lineUserId:', error);
            return null;
        }
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPublicUrl(`${window.location.origin}/queue/${activityId}`);
        }

        const activityRef = doc(db, 'activities', activityId);
        const unsubscribeActivity = onSnapshot(activityRef, (docSnap) => {
            if (docSnap.exists()) {
                const actData = docSnap.data();
                setActivity({ id: docSnap.id, ...actData });
                if (actData.courses && Array.isArray(actData.courses)) {
                    setCourseOptions(actData.courses.map(c => typeof c === 'string' ? c : c.name));
                }
            }
        });

        const channelsRef = collection(db, 'queueChannels');
        const qChannels = query(channelsRef, where('activityId', '==', activityId), orderBy('channelNumber', 'asc'));
        const unsubscribeChannels = onSnapshot(qChannels, (snapshot) => {
            const channelList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setChannels(channelList);
        });

        const regRef = collection(db, 'registrations');
        const qReg = query(regRef, where('activityId', '==', activityId));
        const unsubscribeReg = onSnapshot(qReg, (snapshot) => {
            const regList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRegistrants(regList);
            setIsLoading(false);
        });

        // Realtime subscribe to Examiners Master List
        const examinersRef = collection(db, 'examiners');
        const qExaminers = query(examinersRef, orderBy('name'));
        const unsubscribeExaminers = onSnapshot(qExaminers, (snapshot) => {
            setExaminers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribeActivity();
            unsubscribeChannels();
            unsubscribeReg();
            unsubscribeExaminers();
        };
    }, [activityId]);

    // Aggregate all unique course options from activity, registrations, channels, and courses collection
    useEffect(() => {
        const allCourseSet = new Set();
        if (activity?.courses && Array.isArray(activity.courses)) {
            activity.courses.forEach(c => allCourseSet.add(typeof c === 'string' ? c : c.name));
        }
        channels.forEach(ch => {
            if (ch.servingCourse) allCourseSet.add(ch.servingCourse);
        });
        registrants.forEach(r => {
            if (r.course) allCourseSet.add(r.course);
        });

        getDocs(collection(db, 'courses')).then(snap => {
            snap.docs.forEach(d => {
                if (d.data().name) allCourseSet.add(d.data().name);
            });
            setCourseOptions(Array.from(allCourseSet).filter(Boolean));
        }).catch(() => {
            setCourseOptions(Array.from(allCourseSet).filter(Boolean));
        });
    }, [activity, channels, registrants]);

    // Map of currently assigned examiners: { [name]: { channelId, channelName, slot } }
    const assignedExaminersMap = useMemo(() => {
        const map = {};
        channels.forEach(ch => {
            const chName = ch.name || ch.channelName || `โต๊ะที่ ${ch.channelNumber || ''}`;
            if (ch.examiner1) {
                map[ch.examiner1] = { channelId: ch.id, channelName: chName, slot: 1 };
            }
            if (ch.examiner2) {
                map[ch.examiner2] = { channelId: ch.id, channelName: chName, slot: 2 };
            }
        });
        return map;
    }, [channels]);

    // Build Dropdown Options for Examiner Slot 1 or 2 with Duplicate Prevention
    const getExaminerOptions = (channel, slotIndex) => {
        const currentVal = slotIndex === 1 ? channel.examiner1 : channel.examiner2;
        const otherSlotVal = slotIndex === 1 ? channel.examiner2 : channel.examiner1;

        // Ensure legacy/unlisted examiner names in current channel are visible
        const masterNames = examiners.map(e => e.name);
        const optionsList = [...examiners];
        if (currentVal && !masterNames.includes(currentVal)) {
            optionsList.unshift({ id: `legacy-${currentVal}`, name: currentVal, role: 'ระบุไว้ก่อนหน้า' });
        }

        return optionsList.map(ex => {
            const isCurrentValue = ex.name === currentVal;
            const isOtherSlotOnSameTable = ex.name === otherSlotVal;
            const assignedInfo = assignedExaminersMap[ex.name];
            const isAssignedToOtherTable = assignedInfo && assignedInfo.channelId !== channel.id;

            // Disabled if selected in other slot on this table OR selected on any other table
            const isDisabled = !isCurrentValue && (isOtherSlotOnSameTable || isAssignedToOtherTable);

            let tag = '';
            if (isOtherSlotOnSameTable) {
                tag = ` (เลือกเป็นคนที่ ${slotIndex === 1 ? 2 : 1} แล้ว)`;
            } else if (isAssignedToOtherTable) {
                tag = ` (ประจำ${assignedInfo.channelName}แล้ว)`;
            }

            return (
                <option
                    key={ex.id || ex.name}
                    value={ex.name}
                    disabled={isDisabled}
                    className={isDisabled ? 'text-slate-400 bg-slate-100' : 'text-slate-800'}
                >
                    {ex.name}{tag || (ex.role ? ` (${ex.role})` : '')}
                </option>
            );
        });
    };

    const handleChannelExaminerChange = async (channelId, slotIndex, newName) => {
        try {
            const targetChannel = channels.find(c => c.id === channelId);
            if (!targetChannel) return;

            const trimmed = (newName || '').trim();
            const ex1 = slotIndex === 1 ? trimmed : (targetChannel.examiner1 || '');
            const ex2 = slotIndex === 2 ? trimmed : (targetChannel.examiner2 || '');

            // Duplicate validation on the same table
            if (ex1 && ex2 && ex1 === ex2) {
                showAlert({
                    title: 'ไม่สามารถเลือกซ้ำได้',
                    message: 'กรรมการคนที่ 1 และคนที่ 2 ต้องไม่ใช่บุคคลเดียวกัน',
                    type: 'warning'
                });
                return;
            }

            // Duplicate validation across other tables
            if (trimmed) {
                const conflict = channels.find(c =>
                    c.id !== channelId && (c.examiner1 === trimmed || c.examiner2 === trimmed)
                );
                if (conflict) {
                    const cName = conflict.name || conflict.channelName || `โต๊ะที่ ${conflict.channelNumber}`;
                    showAlert({
                        title: 'กรรมการถูกเลือกแล้ว',
                        message: `คุณ "${trimmed}" ได้รับมอบหมายประจำอยู่ที่ "${cName}" แล้ว`,
                        type: 'warning'
                    });
                    return;
                }
            }

            const channelRef = doc(db, 'queueChannels', channelId);
            const examinersList = [ex1, ex2].filter(Boolean);
            await updateDoc(channelRef, {
                examiner1: ex1 || null,
                examiner2: ex2 || null,
                examiners: examinersList,
                updatedAt: serverTimestamp()
            });

            showToast({
                message: trimmed ? `มอบหมาย ${trimmed} ประจำโต๊ะสำเร็จ` : 'ปลดรายชื่อกรรมการเรียบร้อย',
                type: 'success'
            });
        } catch (err) {
            console.error('Error updating channel examiner:', err);
            showToast({ message: `เกิดข้อผิดพลาด: ${err.message}`, type: 'error' });
        }
    };

    const handleAddExaminerFromModal = async (examinerData) => {
        try {
            await addDoc(collection(db, 'examiners'), {
                name: examinerData.name,
                role: examinerData.role || '',
                createdAt: serverTimestamp()
            });
            showToast({ message: `เพิ่มกรรมการ "${examinerData.name}" สำเร็จ`, type: 'success' });
        } catch (err) {
            showAlert({ title: 'เกิดข้อผิดพลาด', message: err.message, type: 'error' });
        }
    };

    const handleDeleteExaminerFromModal = async (examinerId, examinerName) => {
        // Check if currently assigned
        const isAssigned = channels.some(c => c.examiner1 === examinerName || c.examiner2 === examinerName);
        const warning = isAssigned ? '\n(คำเตือน: กรรมการท่านนี้กำลังได้รับมอบหมายประจำโต๊ะอยู่)' : '';
        const confirmed = await showConfirm({
            title: 'ยืนยันการลบกรรมการ',
            message: `คุณต้องการลบ "${examinerName}" ออกจากรายชื่อกรรมการหรือไม่?${warning}`,
            type: 'danger',
            confirmText: 'ลบ',
            cancelText: 'ยกเลิก'
        });
        if (confirmed) {
            try {
                await deleteDoc(doc(db, 'examiners', examinerId));
                showToast({ message: 'ลบกรรมการเรียบร้อย', type: 'success' });
            } catch (err) {
                showAlert({ title: 'เกิดข้อผิดพลาด', message: err.message, type: 'error' });
            }
        }
    };

    const handleAddChannel = async () => {
        const nextNumber = channels.length > 0 ? Math.max(...channels.map(c => c.channelNumber || 0)) + 1 : 1;
        await addDoc(collection(db, 'queueChannels'), {
            activityId,
            channelNumber: nextNumber,
            name: `โต๊ะที่ ${nextNumber}`,
            channelName: `โต๊ะที่ ${nextNumber}`,
            servingCourse: null,
            examiner1: null,
            examiner2: null,
            examiners: [],
            createdAt: serverTimestamp(),
        });
        showToast({ message: `เพิ่มโต๊ะที่ ${nextNumber} สำเร็จ`, type: 'success' });
    };

    const handleDeleteChannel = async (channelId) => {
        const confirmed = await showConfirm({
            title: 'ยืนยันการลบช่องบริการ',
            message: 'คุณแน่ใจหรือไม่ว่าต้องการลบช่องบริการนี้?',
            type: 'danger',
            confirmText: 'ลบช่องบริการ',
            cancelText: 'ยกเลิก'
        });
        if (confirmed) {
            await deleteDoc(doc(db, 'queueChannels', channelId));
            showToast({ message: 'ลบช่องบริการเรียบร้อย', type: 'success' });
        }
    };

    const handleChannelUpdate = async (channelId, field, value) => {
        try {
            const channelRef = doc(db, 'queueChannels', channelId);
            const updatePayload = {
                [field]: value,
                updatedAt: serverTimestamp()
            };
            if (field === 'channelName' || field === 'name') {
                updatePayload.name = value;
                updatePayload.channelName = value;
            }
            await updateDoc(channelRef, updatePayload);
        } catch (error) {
            console.error('Error updating channel:', error);
            showToast({ message: `เกิดข้อผิดพลาดในการอัปเดต: ${error.message}`, type: 'error' });
        }
    };

    const callSpecificRegistrant = async (channel, registrant) => {
        try {
            const settingsRef = doc(db, 'systemSettings', 'notifications');
            const settingsSnap = await getDoc(settingsRef);
            const settings = settingsSnap.exists() ? settingsSnap.data() : { onQueueCall: true };

            const batch = writeBatch(db);
            const channelRef = doc(db, 'queueChannels', channel.id);
            const timestamp = new Date().getTime();
            batch.update(channelRef, {
                currentQueueNumber: registrant.queueNumber || null,
                currentDisplayQueueNumber: registrant.displayQueueNumber || null,
                currentQueue: registrant.displayQueueNumber || null,
                currentStudentName: registrant.fullName || null,
                status: 'calling',
                lastCalledAt: serverTimestamp(),
                pingId: timestamp
            });

            // Automatically complete previous candidate on this channel if they were being interviewed
            const channelExaminersCombined = [channel.examiner1, channel.examiner2].filter(Boolean).join(', ') || examinerName || 'Examiner';
            const channelExaminersArray = [channel.examiner1, channel.examiner2].filter(Boolean);

            if (channel.currentDisplayQueueNumber && channel.currentDisplayQueueNumber !== registrant.displayQueueNumber) {
                const prevReg = registrants.find(r => r.displayQueueNumber === channel.currentDisplayQueueNumber && r.id !== registrant.id);
                if (prevReg && prevReg.status !== 'completed' && prevReg.status !== 'evaluated') {
                    const prevRegRef = doc(db, 'registrations', prevReg.id);
                    batch.update(prevRegRef, {
                        status: 'completed',
                        queueStatus: 'completed',
                        interviewedAt: serverTimestamp(),
                        completedAt: serverTimestamp(),
                        interviewedBy: channelExaminersCombined,
                        examiners: channelExaminersArray
                    });
                }
            }

            const regRef = doc(db, 'registrations', registrant.id);
            batch.update(regRef, {
                calledAt: serverTimestamp(),
                status: 'interviewing',
                queueStatus: 'calling',
                currentChannelName: channel.name || channel.channelName || `โต๊ะที่ ${channel.channelNumber}`,
                interviewedBy: channelExaminersCombined,
                examiners: channelExaminersArray
            });
            await batch.commit();

            const chDisplayName = channel.name || channel.channelName || `ช่องบริการ ${channel.channelNumber}`;
            speakQueueNumber(registrant.displayQueueNumber, chDisplayName);

            const lineUserId = registrant.lineUserId || await findLineUserId(registrant.nationalId);
            const isRealLineUser = typeof lineUserId === 'string' && /^[UCR][0-9a-fA-F]{32}$/.test(lineUserId.trim());

            if (settings.onQueueCall && isRealLineUser) {
                try {
                    const flexMessage = createQueueCallFlex({
                        activityName: activity.name,
                        channelName: chDisplayName,
                        queueNumber: registrant.displayQueueNumber,
                        courseName: registrant.course,
                        activityId: registrant.activityId,
                        requireEvaluation: activity.enableEvaluation !== false
                    });

                    fetch('/api/send-notification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: lineUserId.trim(), flexMessage })
                    }).catch(err => console.warn('LINE notification warning (non-fatal):', err));
                } catch (notiPrepErr) {
                    console.warn('Failed to build LINE notification:', notiPrepErr);
                }
            } else if (settings.onQueueCall && !isRealLineUser) {
                console.info('Skipped LINE notification: user has no valid LINE ID or is in PC test mode');
            }
        } catch (error) {
            console.error("Error calling queue:", error);
            showAlert({
                title: 'เกิดข้อผิดพลาด',
                message: `ไม่สามารถเรียกคิวได้: ${error.message}`,
                type: 'error'
            });
        }
    };

    const handleCallNext = async (channel) => {
        let waitingList = registrants.filter(r =>
            (!channel.servingCourse || r.course === channel.servingCourse) &&
            r.status === 'checked-in' &&
            !r.calledAt
        );

        waitingList.sort((a, b) => {
            const numA = parseInt(a.displayQueueNumber?.replace(/\D/g, '') || a.queueNumber || '0');
            const numB = parseInt(b.displayQueueNumber?.replace(/\D/g, '') || b.queueNumber || '0');
            if (numA !== numB) return numA - numB;
            const timeA = a.checkedInAt?.toMillis?.() || a.checkedInAt?.seconds || 0;
            const timeB = b.checkedInAt?.toMillis?.() || b.checkedInAt?.seconds || 0;
            return timeA - timeB;
        });

        if (waitingList.length === 0) {
            showAlert({
                title: 'ไม่มีคิวรอ',
                message: channel.servingCourse
                    ? `ไม่มีคิวรอสำหรับหลักสูตร: ${channel.servingCourse}`
                    : 'ไม่มีคิวรอในขณะนี้',
                type: 'info'
            });
            return;
        }
        const nextInQueue = waitingList[0];
        await callSpecificRegistrant(channel, nextInQueue);
    };

    const handleCompleteCurrent = async (channel) => {
        if (!channel.currentDisplayQueueNumber) return;
        try {
            const batch = writeBatch(db);
            const currentReg = registrants.find(r => r.displayQueueNumber === channel.currentDisplayQueueNumber);
            const channelExaminersCombined = [channel.examiner1, channel.examiner2].filter(Boolean).join(', ') || examinerName || 'Examiner';
            const channelExaminersArray = [channel.examiner1, channel.examiner2].filter(Boolean);

            if (currentReg) {
                const regRef = doc(db, 'registrations', currentReg.id);
                batch.update(regRef, {
                    status: 'completed',
                    queueStatus: 'completed',
                    interviewedAt: serverTimestamp(),
                    completedAt: serverTimestamp(),
                    interviewedBy: channelExaminersCombined,
                    examiners: channelExaminersArray
                });
            }
            const channelRef = doc(db, 'queueChannels', channel.id);
            batch.update(channelRef, {
                currentQueueNumber: null,
                currentDisplayQueueNumber: null,
                currentQueue: null,
                currentStudentName: null,
                status: 'available',
                updatedAt: serverTimestamp()
            });
            await batch.commit();
            showToast({ message: `เสร็จสิ้นการสัมภาษณ์คิว ${channel.currentDisplayQueueNumber} เรียบร้อยแล้ว`, type: 'success' });
        } catch (error) {
            console.error('Error completing interview:', error);
            showAlert({ title: 'เกิดข้อผิดพลาด', message: `ไม่สามารถเสร็จสิ้นคิวได้: ${error.message}`, type: 'error' });
        }
    };

    const handleRecall = async (channel) => {
        if (!channel.currentDisplayQueueNumber) {
            showAlert({
                title: 'แจ้งเตือน',
                message: 'ยังไม่มีคิวที่ถูกเรียกในช่องนี้',
                type: 'info'
            });
            return;
        }

        const currentRegistrant = registrants.find(r =>
            r.displayQueueNumber === channel.currentDisplayQueueNumber
        );

        if (!currentRegistrant) {
            showAlert({
                title: 'ไม่พบข้อมูล',
                message: `ไม่พบข้อมูลผู้ลงทะเบียนสำหรับคิวที่ ${channel.currentDisplayQueueNumber}`,
                type: 'error'
            });
            return;
        }
        await callSpecificRegistrant(channel, currentRegistrant);
        showToast({ message: `ส่งแจ้งเตือนเรียกคิว ${currentRegistrant.displayQueueNumber} ซ้ำอีกครั้งสำเร็จ!`, type: 'success' });
    };

    const handleInsertQueue = async (channel, displayQueueNumber) => {
        const registrantToCall = registrants.find(r => r.displayQueueNumber === displayQueueNumber && (r.status === 'checked-in' || r.status === 'interviewing'));
        if (!registrantToCall) {
            showAlert({
                title: 'ไม่พบคิว',
                message: `ไม่พบคิว ${displayQueueNumber} ที่ได้ทำการเช็คอินไว้`,
                type: 'error'
            });
            setInsertingOnChannel(null);
            return;
        }
        await callSpecificRegistrant(channel, registrantToCall);
        showToast({ message: `แทรกคิว ${displayQueueNumber} สำเร็จ`, type: 'success' });
        setInsertingOnChannel(null);
    };

    const handleResetCalledAt = async () => {
        const calledRegistrants = registrants.filter(r => r.status === 'checked-in' && r.calledAt);
        if (calledRegistrants.length === 0) {
            showAlert({
                title: 'แจ้งเตือน',
                message: 'ไม่มีคิวที่ถูกเรียกไปแล้ว',
                type: 'info'
            });
            return;
        }

        const confirmed = await showConfirm({
            title: 'ยืนยันการรีเซ็ตคิว',
            message: `ต้องการรีเซ็ต ${calledRegistrants.length} คิวให้กลับมา "รอ" ใหม่หรือไม่?\n\nคิวทั้งหมดที่ถูกเรียกไปแล้วจะกลับมาอยู่ในรายการรอเรียก`,
            type: 'warning',
            confirmText: `รีเซ็ต ${calledRegistrants.length} คิว`,
            cancelText: 'ยกเลิก'
        });

        if (!confirmed) return;

        try {
            const batch = writeBatch(db);
            calledRegistrants.forEach(reg => {
                const regRef = doc(db, 'registrations', reg.id);
                batch.update(regRef, {
                    calledAt: null,
                    status: 'checked-in',
                    queueStatus: 'waiting',
                    currentChannelName: null
                });
            });
            await batch.commit();
            showToast({ message: `รีเซ็ต ${calledRegistrants.length} คิวสำเร็จ`, type: 'success' });
        } catch (error) {
            showAlert({
                title: 'เกิดข้อผิดพลาด',
                message: `เกิดข้อผิดพลาด: ${error.message}`,
                type: 'error'
            });
        }
    };


    if (isLoading) {
        return (
            <div className="p-12 text-center text-slate-500 text-xs font-medium font-sans">
                <div className="w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                กำลังโหลดระบบเรียกคิว...
            </div>
        );
    }

    const waitingByCourse = courseOptions.reduce((acc, course) => {
        acc[course] = registrants.filter(r => r.course === course && r.status === 'checked-in' && !r.calledAt).length;
        return acc;
    }, {});

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto font-sans">
            {insertingOnChannel && (
                <InsertQueueModal
                    onConfirm={(queueNumber) => handleInsertQueue(channels.find(c => c.id === insertingOnChannel), queueNumber)}
                    onCancel={() => setInsertingOnChannel(null)}
                />
            )}

            {/* Header Toolbar */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Link
                        href="/admin/queue/call"
                        className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors font-bold text-xs"
                        title="กลับ"
                    >
                        ←
                    </Link>
                    <div>
                        <h1 className="text-sm font-bold text-slate-900">
                            เรียกคิว: {activity?.name}
                        </h1>
                        <p className="text-xs text-slate-500">
                            สถานที่: {activity?.location || 'ไม่ระบุ'} • ทั้งหมด {channels.length} ช่องบริการ
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsExaminerModalOpen(true)}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#166E7C] text-slate-700 hover:text-[#166E7C] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="จัดการรายชื่อกรรมการ (Master List)"
                    >
                        <span>👥</span>
                        <span>จัดการกรรมการ</span>
                        <span className="px-1.5 py-0.2 bg-teal-50 text-[#166E7C] text-[10px] font-bold rounded-full border border-teal-200">
                            {examiners.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setVoiceEnabled(!voiceEnabled)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border flex items-center gap-1.5 ${
                            voiceEnabled
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                        title={voiceEnabled ? 'คลิกเพื่อปิดเสียงอ่านคิว' : 'คลิกเพื่อเปิดเสียงอ่านคิว'}
                    >
                        <span>{voiceEnabled ? '🔊' : '🔇'}</span>
                        <span>{voiceEnabled ? 'เสียงอ่านเปิด' : 'เสียงอ่านปิด'}</span>
                    </button>

                    <button
                        onClick={handleAddChannel}
                        className="px-4 py-2 bg-[#166E7C] hover:bg-[#0F5661] text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                        <span>+</span>
                        <span>เพิ่มช่องบริการ</span>
                    </button>
                </div>
            </div>

            {/* Main Content Grid (Channels Left, Summary Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left 2 Columns: Channels */}
                <div className="lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                            ช่องบริการเรียกคิว (Service Stations)
                        </h2>
                        <span className="text-[11px] text-slate-400">คลิกที่ช่องเพื่อปรับหลักสูตรหรือเรียกคิว</span>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        {channels.map(channel => (
                            <div
                                key={channel.id}
                                className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors"
                            >
                                {/* Channel Setup Inputs */}
                                <div className="grid grid-cols-5 gap-2">
                                    <input
                                        key={`${channel.id}_${channel.name || channel.channelName || ''}`}
                                        type="text"
                                        defaultValue={channel.name || channel.channelName || `โต๊ะที่ ${channel.channelNumber}`}
                                        onBlur={e => handleChannelUpdate(channel.id, 'name', e.target.value)}
                                        className="col-span-3 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-900 outline-none focus:border-slate-400"
                                        placeholder="ชื่อช่องบริการ"
                                    />
                                    <select
                                        value={channel.servingCourse || ''}
                                        onChange={e => handleChannelUpdate(channel.id, 'servingCourse', e.target.value || null)}
                                        className="col-span-2 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800 outline-none focus:border-slate-400 font-medium"
                                    >
                                        <option value="">ทุกหลักสูตร</option>
                                        {courseOptions.map(course => (
                                             <option key={course} value={course}>{course}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Active Queue Callout Box */}
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-1">
                                    <span className="text-[11px] text-slate-500 block">คิวปัจจุบันที่กำลังให้บริการ</span>
                                    <span className="text-3xl font-black text-[#166E7C] font-mono tracking-tight block">
                                        {channel.currentDisplayQueueNumber || '-'}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-800 truncate block">
                                        {channel.currentStudentName || 'ยังไม่มีผู้ถูกเรียก'}
                                    </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-2 pt-1">
                                    {/* Assigned Examiners Dropdowns (2 Persons per Table - Non Duplicate) */}
                                    {activity?.enableScoring && (
                                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-700 text-[11px] font-bold flex items-center gap-1">
                                                    <span>👥</span>
                                                    <span>กรรมการประจำโต๊ะ (2 ท่าน)</span>
                                                </span>
                                                {channel.examiner1 && channel.examiner2 ? (
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                        ✓ ครบ 2 ท่าน
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                        {[channel.examiner1, channel.examiner2].filter(Boolean).length}/2 ท่าน
                                                    </span>
                                                )}
                                            </div>

                                            {/* Examiner 1 */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                                    <span>กรรมการคนที่ 1</span>
                                                    {channel.examiner1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleChannelExaminerChange(channel.id, 1, '')}
                                                            className="text-slate-400 hover:text-red-500 cursor-pointer"
                                                            title="ปลดกรรมการคนที่ 1"
                                                        >
                                                            ปลดออก
                                                        </button>
                                                    )}
                                                </div>
                                                <select
                                                    value={channel.examiner1 || ''}
                                                    onChange={(e) => handleChannelExaminerChange(channel.id, 1, e.target.value)}
                                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800 outline-none focus:border-[#166E7C] cursor-pointer"
                                                >
                                                    <option value="">-- เลือกกรรมการคนที่ 1 --</option>
                                                    {getExaminerOptions(channel, 1)}
                                                </select>
                                            </div>

                                            {/* Examiner 2 */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                                    <span>กรรมการคนที่ 2</span>
                                                    {channel.examiner2 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleChannelExaminerChange(channel.id, 2, '')}
                                                            className="text-slate-400 hover:text-red-500 cursor-pointer"
                                                            title="ปลดกรรมการคนที่ 2"
                                                        >
                                                            ปลดออก
                                                        </button>
                                                    )}
                                                </div>
                                                <select
                                                    value={channel.examiner2 || ''}
                                                    onChange={(e) => handleChannelExaminerChange(channel.id, 2, e.target.value)}
                                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800 outline-none focus:border-[#166E7C] cursor-pointer"
                                                >
                                                    <option value="">-- เลือกกรรมการคนที่ 2 --</option>
                                                    {getExaminerOptions(channel, 2)}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Call Next & Complete Queue Buttons */}
                                    {(() => {
                                        const channelWaiting = registrants.filter(r =>
                                            (!channel.servingCourse || r.course === channel.servingCourse) &&
                                            r.status === 'checked-in' &&
                                            !r.calledAt
                                        );
                                        const hasWaiting = channelWaiting.length > 0;
                                        return (
                                            <>
                                                <button
                                                    onClick={() => handleCallNext(channel)}
                                                    disabled={!hasWaiting}
                                                    className="w-full py-2.5 bg-[#166E7C] hover:bg-[#0F5661] text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    <span>📢</span>
                                                    <span>เรียกคิวถัดไป {hasWaiting ? `(${channelWaiting.length})` : '(ไม่มีคิวรอ)'}</span>
                                                </button>

                                                {channel.currentDisplayQueueNumber && (
                                                    <button
                                                        onClick={() => handleCompleteCurrent(channel)}
                                                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                                    >
                                                        <span>✅</span>
                                                        <span>เสร็จสิ้นคิวนี้ ({channel.currentDisplayQueueNumber})</span>
                                                    </button>
                                                )}
                                            </>
                                        );
                                    })()}


                                    {/* Examiner Scoring Button */}
                                    {activity?.enableScoring && (
                                        <button
                                            onClick={() => {
                                                const currentReg = registrants.find(r => r.displayQueueNumber === channel.currentDisplayQueueNumber);
                                                if (currentReg) {
                                                    setActiveChannelForScoring(channel);
                                                    setScoringRegistrant(currentReg);
                                                } else {
                                                    showAlert({ title: 'แจ้งเตือน', message: 'กรุณาเรียกคิวก่อนบันทึกคะแนน', type: 'warning' });
                                                }
                                            }}
                                            disabled={!channel.currentDisplayQueueNumber}
                                            className={`w-full py-1.5 text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5 border ${
                                                registrants.find(r => r.displayQueueNumber === channel.currentDisplayQueueNumber)?.evaluationScore?.isScored
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                                        >
                                            <span>📝</span>
                                            <span>
                                                {registrants.find(r => r.displayQueueNumber === channel.currentDisplayQueueNumber)?.evaluationScore?.isScored
                                                    ? `บันทึกคะแนนแล้ว: ${registrants.find(r => r.displayQueueNumber === channel.currentDisplayQueueNumber)?.evaluationScore?.finalTotalScore} (แก้ไข)`
                                                    : 'บันทึกคะแนน / รูปถ่ายหลักฐาน'}
                                            </span>
                                        </button>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleRecall(channel)}
                                            disabled={!channel.currentDisplayQueueNumber}
                                            className="py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                        >
                                            <span>🔁</span>
                                            <span>เรียกซ้ำ</span>
                                        </button>
                                        <button
                                            onClick={() => setInsertingOnChannel(channel.id)}
                                            className="py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
                                        >
                                            <span>➕</span>
                                            <span>แทรกคิว</span>
                                        </button>
                                    </div>
                                </div>

                                 {/* Desk Links (Station Examiner No-login & QR) & Delete Channel */}
                                 <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-xs">
                                     <div className="flex items-center gap-2">
                                         <button
                                             onClick={() => {
                                                 const stationUrl = `${window.location.origin}/station/examiner/${activityId}/${channel.id}`;
                                                 navigator.clipboard.writeText(stationUrl);
                                                 showToast({ message: `คัดลอกลิงก์โต๊ะกรรมการ (${channel.name}) สำเร็จ 📋`, type: 'success' });
                                             }}
                                             className="text-[#166E7C] hover:underline font-semibold flex items-center gap-1 text-[11px]"
                                             title="คัดลอกลิงก์ให้อาจารย์ผู้สัมภาษณ์ใช้งาน (ไม่ต้อง Login)"
                                         >
                                             <span>🔗</span>
                                             <span>คัดลอกลิงก์โต๊ะกรรมการ</span>
                                         </button>
                                         <button
                                             onClick={() => {
                                                 const stationUrl = `${window.location.origin}/station/examiner/${activityId}/${channel.id}`;
                                                 setSharedQrModal({
                                                     title: `โต๊ะสัมภาษณ์: ${channel.name}`,
                                                     url: stationUrl,
                                                     subtitle: 'อาจารย์/กรรมการสัมภาษณ์สามารถใช้มือถือหรือ iPad สแกนเพื่อเข้าใช้งานโต๊ะนี้ได้ทันที (ไม่ต้อง Login)'
                                                 });
                                             }}
                                             className="text-slate-600 hover:text-slate-900 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1"
                                             title="แสดง QR Code สำหรับให้อาจารย์สแกน"
                                         >
                                             <span>📱 QR</span>
                                         </button>
                                     </div>
                                     <button
                                         onClick={() => handleDeleteChannel(channel.id)}
                                         className="text-red-500 hover:text-red-700 text-[11px]"
                                     >
                                         ✕ ลบช่อง
                                     </button>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* Right 1 Column: Summary & Waiting List */}
                 <div className="space-y-3">
                     <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                         ข้อมูลสรุปและจุดบริการ (Station Links)
                     </h2>

                     {/* Gate Scanner Station Link Card */}
                     <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2.5 shadow-xs">
                         <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                             <span className="text-xs font-bold text-slate-900">🎫 จุดสแกนเนอร์หน้างาน</span>
                             <button
                                 onClick={() => {
                                     const scannerUrl = `${window.location.origin}/station/scanner/${activityId}`;
                                     setSharedQrModal({
                                         title: 'จุดสแกนเนอร์เช็คอินหน้างาน',
                                         url: scannerUrl,
                                         subtitle: 'สตาฟหน้าประตูสามารถใช้มือถือหรือ iPad สแกน QR นี้เพื่อเริ่มสแกนเช็คอินนักเรียนได้ทันที (ไม่ต้อง Login)'
                                     });
                                 }}
                                 className="text-[11px] text-[#166E7C] font-semibold hover:underline"
                             >
                                 แสดง QR สตาฟ 📱
                             </button>
                         </div>
                         <div className="flex items-center justify-between gap-2">
                             <div className="text-[11px] text-slate-500">
                                 ส่งลิงก์ให้สตาฟหน้าประตูสแกนรับนักเรียน
                             </div>
                             <button
                                 onClick={() => {
                                     const scannerUrl = `${window.location.origin}/station/scanner/${activityId}`;
                                     navigator.clipboard.writeText(scannerUrl);
                                     showToast({ message: 'คัดลอกลิงก์จุดสแกนเนอร์หน้างานสำเร็จ 📋', type: 'success' });
                                 }}
                                 className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-xs font-semibold transition-colors flex-shrink-0"
                             >
                                 คัดลอกลิงก์ 📋
                             </button>
                         </div>
                     </div>


                     {/* Public Screen QR & Link */}
                     <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                         <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                             <span className="text-xs font-bold text-slate-900">📺 จอแสดงผลคิวสาธารณะ</span>
                             <a
                                 href={publicUrl}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="text-[11px] text-[#166E7C] hover:underline font-semibold"
                             >
                                 เปิดจอแยก ↗
                             </a>
                         </div>
                         <div className="flex items-center gap-3">
                             <div className="p-1 bg-white border border-slate-200 rounded">
                                 <QRCodeSVG value={publicUrl || 'https://aero.ac.th'} size={64} />
                             </div>
                             <div className="min-w-0 space-y-0.5">
                                 <span className="text-[11px] text-slate-500 block">สแกนเพื่อเปิดจอประชาสัมพันธ์:</span>
                                 <a
                                     href={publicUrl}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="text-xs text-[#166E7C] font-mono break-all line-clamp-2 block hover:underline"
                                 >
                                     {publicUrl}
                                 </a>
                             </div>
                         </div>
                     </div>


                    {/* Waiting Counts Summary */}
                    <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                            <span className="text-xs font-bold text-slate-900">คิวที่รอเรียกแต่ละหลักสูตร</span>
                            <button
                                onClick={handleResetCalledAt}
                                className="text-[11px] px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors cursor-pointer"
                                title="รีเซ็ตคิวที่ถูกเรียกแล้วให้กลับมารอใหม่"
                            >
                                🔄 รีเซ็ตคิว
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {courseOptions.length > 0 ? (
                                courseOptions.map(course => (
                                    <div
                                        key={course}
                                        className="flex justify-between items-center p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs"
                                    >
                                        <span className="font-medium text-slate-700">{course}</span>
                                        <span className="font-bold text-[#166E7C] font-mono">
                                            {waitingByCourse[course] || 0} คิว
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-slate-400 text-center py-2">ยังไม่มีข้อมูลหลักสูตร</p>
                            )}
                        </div>
                    </div>

                    {/* Detailed Waiting List */}
                    <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-xs font-bold text-slate-900">รายชื่อผู้รอคิว (Live Waiting List)</span>
                            <span className="text-[11px] text-slate-400">
                                {registrants.filter(r => r.status === 'checked-in' && !r.calledAt).length} คน
                            </span>
                        </div>

                        <div className="max-h-80 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                            {courseOptions.map(course => {
                                const waitingList = registrants
                                    .filter(r => r.course === course && r.status === 'checked-in' && !r.calledAt)
                                    .sort((a, b) => {
                                        const numA = parseInt(a.displayQueueNumber?.replace(/\D/g, '') || '0');
                                        const numB = parseInt(b.displayQueueNumber?.replace(/\D/g, '') || '0');
                                        return numA - numB;
                                    });

                                if (waitingList.length === 0) return null;

                                return (
                                    <div key={course} className="pt-2 first:pt-0 space-y-1">
                                        <span className="text-[11px] font-bold text-slate-800 block">
                                            {course} ({waitingList.length})
                                        </span>
                                        <div className="space-y-1">
                                            {waitingList.map((reg, index) => (
                                                <div
                                                    key={reg.id}
                                                    className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100 text-xs hover:bg-slate-100 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="font-bold text-[#166E7C] font-mono text-xs">
                                                            {reg.displayQueueNumber}
                                                        </span>
                                                        <span className="text-slate-800 truncate font-medium">
                                                            {reg.fullName}
                                                        </span>
                                                    </div>

                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        #{index + 1}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {registrants.filter(r => r.status === 'checked-in' && !r.calledAt).length === 0 && (
                                <p className="text-xs text-slate-400 text-center py-4">ไม่มีผู้รอคิวในขณะนี้</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Examiner Scoring Modal */}
            <ExaminerScoringModal
                isOpen={Boolean(scoringRegistrant)}
                onClose={() => {
                    setScoringRegistrant(null);
                    setActiveChannelForScoring(null);
                }}
                registrant={scoringRegistrant}
                activity={activity}
                channel={activeChannelForScoring}
                defaultExaminerName={
                    [activeChannelForScoring?.examiner1, activeChannelForScoring?.examiner2].filter(Boolean).join(', ') || examinerName
                }
                onScoreSaved={(updated) => {
                    setRegistrants(prev => prev.map(r => r.id === updated.id ? updated : r));
                }}
            />

            {/* Quick Examiner Management Modal */}
            <ExaminerManagementModal
                isOpen={isExaminerModalOpen}
                onClose={() => setIsExaminerModalOpen(false)}
                examiners={examiners}
                channels={channels}
                onAddExaminer={handleAddExaminerFromModal}
                onDeleteExaminer={handleDeleteExaminerFromModal}
            />

            {/* Station Link & QR Code Popup Modal */}
            {sharedQrModal && (
                <div
                    onClick={() => setSharedQrModal(null)}
                    className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 shadow-2xl text-center"
                    >
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-slate-900">{sharedQrModal.title}</h3>
                            <p className="text-xs text-slate-500">{sharedQrModal.subtitle}</p>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl inline-block mx-auto shadow-inner">
                            <QRCodeSVG value={sharedQrModal.url} size={180} />
                        </div>

                        <div className="space-y-2">
                            <div className="p-2 bg-slate-100 rounded-xl text-[11px] font-mono text-slate-600 break-all select-all">
                                {sharedQrModal.url}
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(sharedQrModal.url);
                                    showToast({ message: 'คัดลอกลิงก์สำเร็จ 📋', type: 'success' });
                                }}
                                className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-[#166E7C] hover:from-teal-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                            >
                                คัดลอกลิงก์ (Copy Link) 📋
                            </button>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

