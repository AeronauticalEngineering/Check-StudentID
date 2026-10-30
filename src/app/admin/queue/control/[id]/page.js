'use client';

import { useState, useEffect, useCallback, use, useMemo } from 'react';
import { db } from '../../../../../lib/firebase';
import {
    doc, getDoc, collection, query, where, onSnapshot, writeBatch, serverTimestamp, getDocs, limit, updateDoc, orderBy, runTransaction
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { createQueueCallFlex } from '../../../../../lib/flexMessageTemplates';
import ExaminerScoringModal from '../../../../../components/ExaminerScoringModal';
import { useModal } from '../../../../../context/ModalContext';

export default function QueueControlPage({ params }) {
    const unwrappedParams = use(params);
    const channelId = unwrappedParams.id;
    const router = useRouter();
    const { showAlert, showConfirm, showToast } = useModal();


    const [channel, setChannel] = useState(null);
    const [channels, setChannels] = useState([]);
    const [examiners, setExaminers] = useState([]);
    const [activity, setActivity] = useState(null);
    const [registrants, setRegistrants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [scoringRegistrant, setScoringRegistrant] = useState(null);
    const [examinerName, setExaminerName] = useState('');

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

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const channelRef = doc(db, 'queueChannels', channelId);
            const unsubscribeChannel = onSnapshot(channelRef, async (snap) => {
                if (!snap.exists()) {
                    setError('ไม่พบช่องบริการนี้');
                    setIsLoading(false);
                    return;
                }
                const channelData = { id: snap.id, ...snap.data() };
                setChannel(channelData);

                if (!activity) {
                    const activityRef = doc(db, 'activities', channelData.activityId);
                    const activitySnap = await getDoc(activityRef);
                    if (activitySnap.exists()) {
                        setActivity({ id: activitySnap.id, ...activitySnap.data() });
                    }
                }
            });

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

                const unsubAllChannels = onSnapshot(
                    query(collection(db, 'queueChannels'), where('activityId', '==', actId)),
                    (snap) => {
                        setChannels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                    }
                );

                const unsubExaminers = onSnapshot(
                    query(collection(db, 'examiners'), orderBy('name')),
                    (snap) => {
                        setExaminers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                    }
                );

                setIsLoading(false);
                return () => {
                    unsubscribeChannel();
                    unsubRegistrants();
                    unsubAllChannels();
                    unsubExaminers();
                };
            }

            setIsLoading(false);
            return unsubscribeChannel;

        } catch (err) {
            console.error("Error fetching data:", err);
            setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            setIsLoading(false);
        }
    }, [channelId]);

    useEffect(() => {
        let cleanup;
        fetchData().then(fn => { cleanup = fn; });
        return () => { if (cleanup) cleanup(); };
    }, [fetchData]);

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
    const getExaminerOptions = (slotIndex) => {
        if (!channel) return null;
        const currentVal = slotIndex === 1 ? channel.examiner1 : channel.examiner2;
        const otherSlotVal = slotIndex === 1 ? channel.examiner2 : channel.examiner1;

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

    const handleChannelExaminerChange = async (slotIndex, newName) => {
        try {
            if (!channel) return;
            const trimmed = (newName || '').trim();
            const ex1 = slotIndex === 1 ? trimmed : (channel.examiner1 || '');
            const ex2 = slotIndex === 2 ? trimmed : (channel.examiner2 || '');

            if (ex1 && ex2 && ex1 === ex2) {
                showAlert({
                    title: 'ไม่สามารถเลือกซ้ำได้',
                    message: 'กรรมการคนที่ 1 และคนที่ 2 ต้องไม่ใช่บุคคลเดียวกัน',
                    type: 'warning'
                });
                return;
            }

            if (trimmed) {
                const conflict = channels.find(c =>
                    c.id !== channel.id && (c.examiner1 === trimmed || c.examiner2 === trimmed)
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

            const channelRef = doc(db, 'queueChannels', channel.id);
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

    const findLineUserId = async (nationalId) => {
        if (!nationalId) return null;
        const profileQuery = query(collection(db, 'studentProfiles'), where("nationalId", "==", nationalId), limit(1));
        const profileSnapshot = await getDocs(profileQuery);
        if (!profileSnapshot.empty) {
            return profileSnapshot.docs[0].data().lineUserId;
        }
        return null;
    };

    const extractTrailingQueueNum = (reg) => {
        if (reg?.displayQueueNumber) {
            const str = String(reg.displayQueueNumber).trim();
            const afterDash = str.includes('-') ? str.split('-').pop().trim() : str;
            const match = afterDash.match(/(\d+)\s*$/);
            if (match) return parseInt(match[1], 10);
        }
        const fb = Number(reg?.queueNumber);
        return !isNaN(fb) && fb > 0 ? fb : 999999;
    };

    const findChannelActiveRegistrant = () => {
        if (!channel) return null;
        if (channel.currentCandidateId) {
            return registrants.find(r => r.id === channel.currentCandidateId) || null;
        }
        const activeQ = channel.currentDisplayQueueNumber || channel.currentQueue;
        if (!activeQ) return null;
        return registrants.find(r => {
            if (r.currentChannelId && String(r.currentChannelId) !== String(channel.id)) return false;
            if (channel.servingCourse && r.course && r.course !== channel.servingCourse) return false;
            return r.displayQueueNumber === activeQ;
        }) || null;
    };

    const callSpecificRegistrant = async (registrant, options = { silentOnConflict: false }) => {
        try {
            const channelExaminersCombined = [channel.examiner1, channel.examiner2].filter(Boolean).join(', ') || examinerName || 'Examiner';
            const channelExaminersArray = [channel.examiner1, channel.examiner2].filter(Boolean);
            const chName = channel.name || channel.channelName || `โต๊ะที่ ${channel.channelNumber}`;
            const currentActiveOnChannel = findChannelActiveRegistrant();
            const prevReg =
                currentActiveOnChannel && currentActiveOnChannel.id !== registrant.id
                    ? currentActiveOnChannel
                    : null;

            await runTransaction(db, async (transaction) => {
                const regRef = doc(db, 'registrations', registrant.id);
                const regSnap = await transaction.get(regRef);
                if (!regSnap.exists()) {
                    throw new Error('ไม่พบข้อมูลผู้สมัครในระบบ');
                }
                const liveReg = regSnap.data();
                const liveStatus = (liveReg.status || '').trim();
                const liveQueueStatus = (liveReg.queueStatus || '').trim();
                const claimedChannelId = liveReg.currentChannelId || liveReg.interviewedChannelId;
                const claimedChannelName = liveReg.currentChannelName || liveReg.interviewedChannelName;
                const isAlreadyOnThisDesk =
                    (claimedChannelId && String(claimedChannelId) === String(channel.id)) ||
                    (!claimedChannelId && claimedChannelName && claimedChannelName === chName);

                const isActivelyInProgress =
                    liveStatus === 'interviewing' ||
                    liveStatus === 'calling' ||
                    liveQueueStatus === 'calling';

                if (isActivelyInProgress && !isAlreadyOnThisDesk) {
                    throw new Error(`QUEUE_TAKEN:${claimedChannelName || 'โต๊ะอื่น'}`);
                }

                if (options.requireWaiting && (isActivelyInProgress || Boolean(liveReg.calledAt))) {
                    throw new Error(`QUEUE_TAKEN:${claimedChannelName || 'โต๊ะอื่น'}`);
                }

                if (prevReg && prevReg.status !== 'completed' && prevReg.status !== 'evaluated') {
                    const prevRegRef = doc(db, 'registrations', prevReg.id);
                    transaction.update(prevRegRef, {
                        status: 'completed',
                        queueStatus: 'completed',
                        interviewedAt: serverTimestamp(),
                        completedAt: serverTimestamp(),
                        interviewedBy: channelExaminersCombined,
                        examiners: channelExaminersArray
                    });
                }

                const channelRef = doc(db, 'queueChannels', channel.id);
                transaction.update(channelRef, {
                    currentCandidateId: registrant.id,
                    currentQueueNumber: registrant.queueNumber || null,
                    currentDisplayQueueNumber: registrant.displayQueueNumber || null,
                    currentQueue: registrant.displayQueueNumber || null,
                    currentStudentName: registrant.fullName || null,
                    status: 'calling',
                    lastCalledAt: serverTimestamp(),
                    pingId: Date.now()
                });

                transaction.update(regRef, {
                    calledAt: serverTimestamp(),
                    status: 'interviewing',
                    queueStatus: 'calling',
                    currentChannelId: channel.id,
                    currentChannelName: chName,
                    interviewedChannelId: channel.id,
                    interviewedChannelName: chName,
                    interviewedBy: channelExaminersCombined,
                    examiners: channelExaminersArray
                });
            });

            const lineUserId = registrant.lineUserId || await findLineUserId(registrant.nationalId);
            const isRealLineUser = typeof lineUserId === 'string' && /^[UCR][0-9a-fA-F]{32}$/.test(lineUserId.trim());
            if (isRealLineUser) {
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
                        userId: lineUserId.trim(),
                        flexMessage
                    })
                }).catch(e => console.warn("Line notification skipped or failed:", e));
            }
            return { ok: true };
        } catch (error) {
            const msg = error?.message || '';
            if (msg.startsWith('QUEUE_TAKEN:')) {
                const takenBy = msg.replace('QUEUE_TAKEN:', '');
                if (!options.silentOnConflict) {
                    showAlert({
                        title: 'คิวนี้ถูกเรียกไปแล้ว',
                        message: `คิว ${registrant.displayQueueNumber} ถูกเรียกโดย "${takenBy}" ไปเมื่อสักครู่นี้แล้ว`,
                        type: 'warning'
                    });
                }
                return { ok: false, reason: 'conflict' };
            }
            console.error("Error calling queue:", error);
            if (!options.silentOnConflict) {
                showAlert({
                    title: 'เกิดข้อผิดพลาด',
                    message: `ไม่สามารถเรียกคิวได้: ${msg}`,
                    type: 'error'
                });
            }
            return { ok: false, reason: 'error' };
        }
    };

    const handleCallNext = async () => {
        const waitingForCourse = registrants
            .filter(r => (!channel.servingCourse || r.course === channel.servingCourse) && r.status === 'checked-in' && !r.calledAt && (!r.currentChannelId || String(r.currentChannelId) === String(channel.id)))
            .sort((a, b) => {
                const numA = extractTrailingQueueNum(a);
                const numB = extractTrailingQueueNum(b);
                if (numA !== numB) return numA - numB;
                const timeA = a.checkedInAt?.toMillis?.() || a.checkedInAt?.seconds || 0;
                const timeB = b.checkedInAt?.toMillis?.() || b.checkedInAt?.seconds || 0;
                return timeA - timeB;
            });

        if (waitingForCourse.length === 0) {
            showAlert({
                title: 'ไม่มีคิวรอ',
                message: channel.servingCourse
                    ? `ไม่มีคิวรอสำหรับหลักสูตร: ${channel.servingCourse}`
                    : 'ไม่มีคิวรอในขณะนี้',
                type: 'info'
            });
            return;
        }
        for (let i = 0; i < Math.min(waitingForCourse.length, 8); i++) {
            const res = await callSpecificRegistrant(waitingForCourse[i], { silentOnConflict: true, requireWaiting: true });
            if (res?.ok) return;
            if (res?.reason !== 'conflict') return;
        }
    };

    const handleCompleteCurrent = async () => {
        if (!channel.currentDisplayQueueNumber && !channel.currentCandidateId) return;
        try {
            const batch = writeBatch(db);
            const currentReg = findChannelActiveRegistrant();
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
                currentCandidateId: null,
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

    const handleRecall = async () => {
        if (!channel.currentDisplayQueueNumber && !channel.currentCandidateId) {
            showAlert({
                title: 'แจ้งเตือน',
                message: 'ยังไม่มีคิวที่ถูกเรียกในช่องนี้',
                type: 'info'
            });
            return;
        }

        const currentRegistrant = findChannelActiveRegistrant();

        if (!currentRegistrant) {
            showAlert({
                title: 'ไม่พบข้อมูล',
                message: `ไม่พบข้อมูลผู้ลงทะเบียนสำหรับคิวที่ ${channel.currentDisplayQueueNumber}`,
                type: 'error'
            });
            return;
        }
        await callSpecificRegistrant(currentRegistrant);
        showToast({ message: `ส่งแจ้งเตือนและเรียกคิว ${currentRegistrant.displayQueueNumber} ซ้ำสำเร็จ!`, type: 'success' });
    };


    if (isLoading) return <div className="text-center p-12 text-slate-500 text-xs font-medium font-sans">กำลังโหลดข้อมูล...</div>;
    if (error) return <div className="text-center p-12 text-red-500 font-bold text-xs font-sans">{error}</div>;
    if (!channel) return <div className="text-center p-12 text-slate-500 text-xs font-sans">ไม่พบช่องบริการ</div>;

    const waitingRegistrants = registrants
        .filter(r => (!channel.servingCourse || r.course === channel.servingCourse) && r.status === 'checked-in' && !r.calledAt && (!r.currentChannelId || String(r.currentChannelId) === String(channel.id)))
        .sort((a, b) => {
            const numA = extractTrailingQueueNum(a);
            const numB = extractTrailingQueueNum(b);
            if (numA !== numB) return numA - numB;
            const timeA = a.checkedInAt?.toMillis?.() || a.checkedInAt?.seconds || 0;
            const timeB = b.checkedInAt?.toMillis?.() || b.checkedInAt?.seconds || 0;
            return timeA - timeB;
        });

    const waitingCount = waitingRegistrants.length;

    return (
        <div className="bg-slate-100 min-h-screen p-4 md:p-6 font-sans flex flex-col justify-center items-center">
            <div className="max-w-4xl w-full bg-white rounded-lg border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-5">
                {/* Left Column: Queue Controls */}
                <div className="p-6 col-span-1 md:col-span-3 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                            <h1 className="text-sm font-bold text-slate-900">
                                {channel.channelName || `ช่องบริการ ${channel.channelNumber}`}
                            </h1>
                            <p className="text-xs text-slate-500">โต๊ะควบคุมการเรียกคิวประจำช่อง</p>
                        </div>
                        <span className="inline-flex px-2.5 py-1 rounded text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            {channel.servingCourse || 'ยังไม่ระบุหลักสูตร'}
                        </span>
                    </div>

                    {/* Active Queue Display */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg py-8 px-4 text-center space-y-2">
                        <span className="text-xs text-slate-500 font-medium block">คิวปัจจุบันที่กำลังให้บริการ</span>
                        <span className="text-6xl md:text-7xl font-black text-[#166E7C] font-mono tracking-tight block">
                            {channel.currentDisplayQueueNumber || '-'}
                        </span>
                        <span className="text-sm font-bold text-slate-800 truncate block">
                            {channel.currentStudentName || 'ยังไม่มีผู้ถูกเรียก'}
                        </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2.5 pt-2">
                        {/* 2-Examiner Dropdowns with Duplicate Prevention */}
                        {activity?.enableScoring && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                    <span className="flex items-center gap-1.5">
                                        <span>👥</span>
                                        <span>กรรมการประจำโต๊ะ (2 ท่าน)</span>
                                    </span>
                                    {channel.examiner1 && channel.examiner2 ? (
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            ✓ ครบ 2 ท่าน
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                            {[channel.examiner1, channel.examiner2].filter(Boolean).length}/2 ท่าน
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                                        <span>กรรมการคนที่ 1</span>
                                        {channel.examiner1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleChannelExaminerChange(1, '')}
                                                className="text-slate-400 hover:text-red-500 cursor-pointer"
                                                title="ปลดกรรมการคนที่ 1"
                                            >
                                                ปลดออก
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        value={channel.examiner1 || ''}
                                        onChange={(e) => handleChannelExaminerChange(1, e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:border-[#166E7C] cursor-pointer"
                                    >
                                        <option value="">-- เลือกกรรมการคนที่ 1 --</option>
                                        {getExaminerOptions(1)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                                        <span>กรรมการคนที่ 2</span>
                                        {channel.examiner2 && (
                                            <button
                                                type="button"
                                                onClick={() => handleChannelExaminerChange(2, '')}
                                                className="text-slate-400 hover:text-red-500 cursor-pointer"
                                                title="ปลดกรรมการคนที่ 2"
                                            >
                                                ปลดออก
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        value={channel.examiner2 || ''}
                                        onChange={(e) => handleChannelExaminerChange(2, e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:border-[#166E7C] cursor-pointer"
                                    >
                                        <option value="">-- เลือกกรรมการคนที่ 2 --</option>
                                        {getExaminerOptions(2)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleCallNext}
                            disabled={waitingCount === 0}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <span>📢</span>
                            <span>เรียกคิวถัดไป {waitingCount > 0 ? `(${waitingCount})` : '(ไม่มีคิวรอ)'}</span>
                        </button>

                        {channel.currentDisplayQueueNumber && (
                            <button
                                onClick={handleCompleteCurrent}
                                className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>✅</span>
                                <span>เสร็จสิ้นคิวนี้ ({channel.currentDisplayQueueNumber})</span>
                            </button>
                        )}

                        {/* Examiner Scoring Button */}
                        {activity?.enableScoring && (() => {
                            const activeRegForScore = findChannelActiveRegistrant();
                            return (
                                <button
                                    onClick={() => {
                                        if (activeRegForScore) setScoringRegistrant(activeRegForScore);
                                        else showAlert({ title: 'แจ้งเตือน', message: 'กรุณาเรียกคิวก่อนบันทึกคะแนน', type: 'warning' });
                                    }}
                                    disabled={!channel.currentDisplayQueueNumber && !channel.currentCandidateId}
                                    className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 border cursor-pointer ${
                                        activeRegForScore?.evaluationScore?.isScored
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                            : 'bg-teal-50 text-[#166E7C] border-teal-200 hover:bg-teal-100'
                                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                    <span>📝</span>
                                    <span>
                                        {activeRegForScore?.evaluationScore?.isScored
                                            ? `บันทึกคะแนนแล้ว: ${activeRegForScore?.evaluationScore?.finalTotalScore} (แก้ไข)`
                                            : 'บันทึกคะแนน / รูปถ่ายหลักฐาน'}
                                    </span>
                                </button>
                            );
                        })()}

                        <button
                            onClick={handleRecall}
                            disabled={!channel.currentDisplayQueueNumber}
                            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <span>🔁</span>
                            <span>เรียกซ้ำ</span>
                        </button>
                    </div>
                </div>

                {/* Right Column: Waiting List */}
                <div className="p-6 col-span-1 md:col-span-2 bg-slate-50/70 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <span className="text-xs font-bold text-slate-900">คิวที่รอ ({channel.servingCourse || 'ทุกหลักสูตร'})</span>
                        <span className="text-xs font-bold text-[#166E7C] font-mono bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-md">
                            {waitingCount} คน
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[380px] pr-1">
                        {waitingCount > 0 ? (
                            waitingRegistrants.map((reg, index) => (
                                <div
                                    key={reg.id}
                                    className="flex justify-between items-center bg-white p-2.5 rounded border border-slate-200 text-xs hover:border-slate-300 transition-colors"
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className="font-bold text-[#166E7C] font-mono text-xs shrink-0">
                                            {reg.displayQueueNumber}
                                        </span>
                                        <span className="text-slate-800 truncate font-medium">
                                            {reg.fullName}
                                        </span>
                                    </div>

                                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                        #{index + 1}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40 text-center text-slate-400 text-xs">
                                <span>⏳</span>
                                <span>ไม่มีคิวรอเรียกในหลักสูตรนี้</span>
                            </div>
                        )}
                    </div>

                    <div className="pt-3 border-t border-slate-200 text-center">
                        <button
                            onClick={() => router.back()}
                            className="text-xs text-slate-500 hover:text-slate-800 font-medium hover:underline"
                        >
                            ← กลับหน้าหลัก
                        </button>
                    </div>
                </div>
            </div>

            {/* Examiner Scoring Modal */}
            <ExaminerScoringModal
                isOpen={Boolean(scoringRegistrant)}
                onClose={() => setScoringRegistrant(null)}
                registrant={scoringRegistrant}
                activity={activity}
                channel={channel}
                channelId={channel?.id || channelId}
                channelName={channel?.name || channel?.channelName || `โต๊ะที่ ${channel?.channelNumber || ''}`}
                examiners={examiners}
                allChannels={channels}
                defaultExaminerName={
                    [channel?.examiner1, channel?.examiner2].filter(Boolean).join(', ') || examinerName
                }
                onScoreSaved={(updated) => {
                    setRegistrants(prev => prev.map(r => r.id === updated.id ? updated : r));
                }}
            />
        </div>
    );
}
