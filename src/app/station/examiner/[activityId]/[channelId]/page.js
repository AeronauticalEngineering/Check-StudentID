'use client';

import React, { useState, useEffect, useRef, use, useMemo } from 'react';
import { db } from '../../../../../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import ExaminerScoringModal from '../../../../../components/ExaminerScoringModal';
import { queueToThaiSpeech, channelNameToThai } from '../../../../../lib/speechUtils';
import { createQueueCallFlex } from '../../../../../lib/flexMessageTemplates';

// Single Source of Truth for Candidate Queue Display (Synchronized with student's ticket)
export const getCandidateQueueDisplay = (cand, courseOptions = []) => {
  if (!cand) return '-';
  if (cand.displayQueueNumber) return cand.displayQueueNumber;
  if (cand.queueNumber) {
    const courseInfo = courseOptions.find(c => c.name === cand.course);
    const prefix = cand.courseCode || courseInfo?.shortName || (cand.course ? cand.course.slice(0, 3).toUpperCase() : 'Q');
    return `${prefix}-${String(cand.queueNumber).padStart(3, '0')}`;
  }
  return cand.seatNumber || '-';
};

// Helper to extract numeric queue value for accurate sorting
const parseQueueNumber = (cand) => {
  if (cand?.displayQueueNumber) {
    const digits = String(cand.displayQueueNumber).replace(/\D/g, '');
    if (digits) return parseInt(digits, 10);
  }
  if (cand?.queueNumber !== undefined && cand?.queueNumber !== null) {
    const num = Number(cand.queueNumber);
    if (!isNaN(num)) return num;
    const digits = String(cand.queueNumber).replace(/\D/g, '');
    if (digits) return parseInt(digits, 10);
  }
  if (cand?.seatNumber) {
    const digits = String(cand.seatNumber).replace(/\D/g, '');
    if (digits) return parseInt(digits, 10);
  }
  return 999999;
};

// Standard candidate queue status classifier
const getCandidateQueueStatus = (cand) => {
  if (!cand) return 'waiting';

  // 1. If candidate is checked-in and has NOT been called yet, they are ALWAYS waiting!
  if (cand.status === 'checked-in' && !cand.calledAt) {
    return 'waiting';
  }

  // 2. Truly completed or evaluated (actually finished interview)
  const isTrulyCompleted =
    cand.status === 'completed' ||
    cand.status === 'evaluated' ||
    Boolean(cand.completedAt) ||
    Boolean(cand.evaluationScore?.isScored);

  if (isTrulyCompleted) {
    return 'completed';
  }

  // 3. Actively calling or interviewing
  const isActivelyCalling =
    cand.status === 'interviewing' ||
    cand.status === 'calling' ||
    (Boolean(cand.calledAt) && !cand.completedAt && cand.status !== 'completed');

  if (isActivelyCalling) {
    return 'calling';
  }

  // 4. Default: if candidate has a queue number or is checked-in, they are waiting
  if (cand.status === 'checked-in' || cand.queueStatus === 'waiting' || cand.displayQueueNumber) {
    return 'waiting';
  }

  return cand.status === 'registered' ? 'registered' : 'waiting';
};

function SafeEvidenceThumbnail({ src, alt }) {
  const [hasError, setHasError] = useState(false);
  if (hasError || !src) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 text-slate-400">
        <span className="text-xl">📷</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
    />
  );
}

export default function StationExaminerPage({ params }) {
  const { activityId, channelId } = use(params);

  const [activity, setActivity] = useState(null);
  const [channel, setChannel] = useState(null);
  const [allChannels, setAllChannels] = useState([]);
  const [examiners, setExaminers] = useState([]);
  const [examinerName, setExaminerName] = useState('');
  const [isSettingExaminer, setIsSettingExaminer] = useState(false);
  const [tempExaminer1, setTempExaminer1] = useState('');
  const [tempExaminer2, setTempExaminer2] = useState('');

  const [registrations, setRegistrations] = useState([]);
  const [courseOptions, setCourseOptions] = useState([]);
  const [currentCandidate, setCurrentCandidate] = useState(null);
  const [isScoringOpen, setIsScoringOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('waiting'); // waiting, calling, completed, all

  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxError, setLightboxError] = useState(false);
  const [message, setMessage] = useState('');

  // Load Examiner Name from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('aero_station_examiner_name') || '';
    if (savedName) {
      setExaminerName(savedName);
    }
  }, []);

  // Fetch Activity and Channel Details & Real-time Listeners
  useEffect(() => {
    if (!activityId) return;

    // Real-time listener for this specific channel
    let unsubscribeChannel = () => {};
    const channelRef = doc(db, 'queueChannels', channelId);
    unsubscribeChannel = onSnapshot(channelRef, (snap) => {
      if (snap.exists()) {
        const cData = { id: snap.id, ...snap.data() };
        setChannel(cData);
        const combined = [cData.examiner1, cData.examiner2].filter(Boolean).join(', ');
        if (combined) {
          setExaminerName(combined);
          if (typeof window !== 'undefined') {
            localStorage.setItem('aero_station_examiner_name', combined);
          }
        }
      }
    });

    // Real-time listener for all channels in activity (for duplicate checking)
    const qAllChannels = query(collection(db, 'queueChannels'), where('activityId', '==', activityId));
    const unsubscribeAllChannels = onSnapshot(qAllChannels, (snap) => {
      setAllChannels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Real-time listener for examiners master list
    const qExaminers = query(collection(db, 'examiners'), orderBy('name'));
    const unsubscribeExaminers = onSnapshot(qExaminers, (snap) => {
      setExaminers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Activity Details
    const fetchDetails = async () => {
      try {
        const actDoc = await getDoc(doc(db, 'activities', activityId));
        if (actDoc.exists()) {
          setActivity({ id: actDoc.id, ...actDoc.data() });
        }
      } catch (err) {
        console.error('Error fetching station activity details:', err);
      }
    };

    fetchDetails();

    // Fetch course options for quota criteria
    const fetchCourses = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'courseOptions'), orderBy('name')));
        setCourseOptions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Error fetching course options:', e);
      }
    };
    fetchCourses();

    return () => {
      unsubscribeChannel();
      unsubscribeAllChannels();
      unsubscribeExaminers();
    };
  }, [activityId, channelId]);

  // Real-time listener for registrations
  useEffect(() => {
    if (!activityId) return;

    const q = query(
      collection(db, 'registrations'),
      where('activityId', '==', activityId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() });
      });

      // Sort by queue number ascending, then by check-in / registration timestamp
      items.sort((a, b) => {
        const numA = parseQueueNumber(a);
        const numB = parseQueueNumber(b);
        if (numA !== numB) return numA - numB;
        const timeA = a.checkedInAt?.toMillis?.() || a.checkedInAt?.seconds || a.registeredAt?.toMillis?.() || 0;
        const timeB = b.checkedInAt?.toMillis?.() || b.checkedInAt?.seconds || b.registeredAt?.toMillis?.() || 0;
        return timeA - timeB;
      });
      setRegistrations(items);

      // Auto update currentCandidate if still in list
      if (currentCandidate) {
        const updated = items.find(i => i.id === currentCandidate.id);
        if (updated) setCurrentCandidate(updated);
      }
    });

    return () => unsub();
  }, [activityId, currentCandidate?.id]);

  // Assigned examiners map across all channels in activity
  const assignedExaminersMap = useMemo(() => {
    const map = {};
    allChannels.forEach(ch => {
      const chName = ch.name || ch.channelName || `โต๊ะที่ ${ch.channelNumber || ''}`;
      if (ch.examiner1) {
        map[ch.examiner1] = { channelId: ch.id, channelName: chName, slot: 1 };
      }
      if (ch.examiner2) {
        map[ch.examiner2] = { channelId: ch.id, channelName: chName, slot: 2 };
      }
    });
    return map;
  }, [allChannels]);

  // Build station dropdown options with duplicate prevention
  const getStationExaminerOptions = (slotIndex) => {
    const currentVal = slotIndex === 1 ? tempExaminer1 : tempExaminer2;
    const otherSlotVal = slotIndex === 1 ? tempExaminer2 : tempExaminer1;

    const masterNames = examiners.map(e => e.name);
    const optionsList = [...examiners];
    if (currentVal && !masterNames.includes(currentVal)) {
      optionsList.unshift({ id: `legacy-${currentVal}`, name: currentVal, role: 'ระบุไว้ก่อนหน้า' });
    }

    return optionsList.map(ex => {
      const isCurrentValue = ex.name === currentVal;
      const isOtherSlotOnSameTable = ex.name === otherSlotVal;
      const assignedInfo = assignedExaminersMap[ex.name];
      const isAssignedToOtherTable = assignedInfo && assignedInfo.channelId !== (channel?.id || channelId);

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

  const saveExaminersToChannel = async () => {
    const ex1 = (tempExaminer1 || '').trim();
    const ex2 = (tempExaminer2 || '').trim();

    if (ex1 && ex2 && ex1 === ex2) {
      alert('กรรมการคนที่ 1 และคนที่ 2 ต้องไม่ใช่บุคคลเดียวกัน');
      return;
    }

    const combined = [ex1, ex2].filter(Boolean).join(', ');
    setExaminerName(combined);
    if (typeof window !== 'undefined' && combined) {
      localStorage.setItem('aero_station_examiner_name', combined);
    }

    try {
      if (channel?.id) {
        await updateDoc(doc(db, 'queueChannels', channel.id), {
          examiner1: ex1 || null,
          examiner2: ex2 || null,
          examiners: [ex1, ex2].filter(Boolean),
          updatedAt: serverTimestamp()
        });
      }
      setIsSettingExaminer(false);
      setMessage('บันทึกรายชื่อกรรมการประจำโต๊ะเรียบร้อยแล้ว');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error saving channel examiners:', err);
      setIsSettingExaminer(false);
    }
  };

  // Speak Thai Text
  const speakThai = (text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('TTS error:', err);
    }
  };

  // Call Queue Action
  const handleCallQueue = async (candidate) => {
    if (!candidate) return;

    try {
      setCurrentCandidate(candidate);

      const chName = channel?.name || channel?.channelName || `โต๊ะสัมภาษณ์ ${channel?.channelNumber || 1}`;
      const qText = getCandidateQueueDisplay(candidate, courseOptions);
      const studentName = candidate.fullName
        || `${candidate.title || ''} ${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
        || 'ผู้สมัคร';

      // Update candidate status to calling and interviewing
      const updateRegistrationPayload = {
        queueStatus: 'calling',
        status: 'interviewing',
        currentChannelName: chName,
        calledAt: serverTimestamp(),
        calledBy: examinerName || 'Examiner'
      };
      if (!candidate.displayQueueNumber && qText && qText !== '-') {
        updateRegistrationPayload.displayQueueNumber = qText;
      }
      await updateDoc(doc(db, 'registrations', candidate.id), updateRegistrationPayload);

      // Announce with Thai TTS locally
      const thaiQueueSpeech = queueToThaiSpeech(qText);
      const thaiChannelSpeech = channelNameToThai(chName);
      speakThai(`ขอเชิญหมายเลข ${thaiQueueSpeech} ที่ ${thaiChannelSpeech} ค่ะ`);

      // Update Channel's active current queue in Firestore
      if (channel?.id) {
        try {
          const timestamp = Date.now();
          const channelNumber = channel.channelNumber || (isNaN(Number(channelId)) ? 1 : Number(channelId));
          await setDoc(doc(db, 'queueChannels', channel.id), {
            activityId: activityId,
            channelNumber: channelNumber,
            channelName: chName,
            name: chName,
            currentQueue: qText,
            currentDisplayQueueNumber: qText,
            currentQueueNumber: candidate.queueNumber || null,
            currentStudentName: studentName,
            status: 'calling',
            pingId: timestamp,
            lastCalledAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (chErr) {
          console.error('Channel doc update error:', chErr);
        }
      }

      // Send LINE notification flex message if student has lineUserId
      if (candidate.lineUserId) {
        try {
          const flexMsg = createQueueCallFlex({
            activityName: activity?.name || 'การสอบสัมภาษณ์',
            channelName: chName,
            queueNumber: qText,
            courseName: candidate.course || '-',
            activityId: activityId
          });
          fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: candidate.lineUserId,
              flexMessage: flexMsg
            })
          }).catch(e => console.error('Notification error:', e));
        } catch (notifErr) {
          console.error('Failed to prepare call flex:', notifErr);
        }
      }
    } catch (err) {
      console.error('Call queue error:', err);
      setMessage(`เกิดข้อผิดพลาดในการเรียกคิว: ${err.message}`);
    }
  };

  // Recall current candidate
  const handleRecall = async () => {
    if (!currentCandidate) return;
    const chName = channel?.name || channel?.channelName || `โต๊ะสัมภาษณ์ ${channel?.channelNumber || 1}`;
    const qText = getCandidateQueueDisplay(currentCandidate, courseOptions);
    const studentName = currentCandidate.fullName
      || `${currentCandidate.title || ''} ${currentCandidate.firstName || ''} ${currentCandidate.lastName || ''}`.trim()
      || 'ผู้สมัคร';

    const thaiQueueSpeech = queueToThaiSpeech(qText);
    const thaiChannelSpeech = channelNameToThai(chName);
    speakThai(`ขอเชิญหมายเลข ${thaiQueueSpeech} ที่ ${thaiChannelSpeech} ค่ะ`);

    if (channel?.id) {
      try {
        const timestamp = Date.now();
        const channelNumber = channel.channelNumber || (isNaN(Number(channelId)) ? 1 : Number(channelId));
        await setDoc(doc(db, 'queueChannels', channel.id), {
          activityId: activityId,
          channelNumber: channelNumber,
          channelName: chName,
          name: chName,
          currentQueue: qText,
          currentDisplayQueueNumber: qText,
          currentStudentName: studentName,
          status: 'calling',
          pingId: timestamp,
          lastCalledAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error('Recall channel update error:', err);
      }
    }

    // Send LINE Flex call reminder if lineUserId
    if (currentCandidate.lineUserId) {
      try {
        const flexMsg = createQueueCallFlex({
          activityName: activity?.name || 'การสอบสัมภาษณ์',
          channelName: chName,
          queueNumber: qText,
          courseName: currentCandidate.course || '-',
          activityId: activityId
        });
        fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentCandidate.lineUserId,
            flexMessage: flexMsg
          })
        }).catch(e => console.error('Notification error:', e));
      } catch (e) {
        console.error('Notification error:', e);
      }
    }
  };

  // Complete Interview without scoring or after scoring
  const handleCompleteInterview = async () => {
    if (!currentCandidate) return;

    try {
      await updateDoc(doc(db, 'registrations', currentCandidate.id), {
        queueStatus: 'completed',
        status: 'completed',
        interviewedAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        interviewedBy: examinerName || 'Examiner'
      });

      // Clear channel active queue
      if (channel?.id) {
        try {
          await setDoc(doc(db, 'queueChannels', channel.id), {
            currentQueue: null,
            currentDisplayQueueNumber: null,
            currentQueueNumber: null,
            currentStudentName: null,
            status: 'available',
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (chErr) {
          console.error('Complete interview channel reset error:', chErr);
        }
      }

      setCurrentCandidate(null);
      setMessage('สัมภาษณ์และบันทึกข้อมูลเสร็จสิ้น');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Complete interview error:', err);
      setMessage(`เกิดข้อผิดพลาด: ${err.message}`);
    }
  };

  // Filtered List
  const filteredRegistrations = useMemo(() => {
    const targetCourse = channel?.servingCourse || channel?.course || null;
    return registrations.filter((item) => {
      // If channel is assigned to specific course, filter by course
      if (targetCourse && item.course && item.course !== targetCourse) {
        return false;
      }

      const qStatus = getCandidateQueueStatus(item);

      if (activeFilter === 'waiting') {
        return qStatus === 'waiting' || qStatus === 'registered';
      }
      if (activeFilter === 'calling') {
        return qStatus === 'calling';
      }
      if (activeFilter === 'completed') {
        return qStatus === 'completed';
      }
      return true;
    });
  }, [registrations, channel?.servingCourse, channel?.course, activeFilter]);

  // Find next in line
  const nextWaitingCandidate = useMemo(() => {
    const targetCourse = channel?.servingCourse || channel?.course || null;
    return registrations.find((item) => {
      if (targetCourse && item.course && item.course !== targetCourse) return false;
      const qStatus = getCandidateQueueStatus(item);
      return qStatus === 'waiting' || (qStatus === 'registered' && item.displayQueueNumber);
    });
  }, [registrations, channel?.servingCourse, channel?.course]);

  // Counts for each queue category tab
  const queueCounts = useMemo(() => {
    const targetCourse = channel?.servingCourse || channel?.course || null;
    let waiting = 0;
    let calling = 0;
    let completed = 0;

    registrations.forEach((item) => {
      if (targetCourse && item.course && item.course !== targetCourse) return;
      const status = getCandidateQueueStatus(item);
      if (status === 'waiting' || status === 'registered') waiting++;
      else if (status === 'calling') calling++;
      else if (status === 'completed') completed++;
    });

    return { waiting, calling, completed };
  }, [registrations, channel?.servingCourse, channel?.course]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col select-none">
      {/* Top Station Header */}
      <header className="h-16 px-4 md:px-6 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#000946] flex items-center justify-center text-white font-bold text-sm shadow-xs">
            EX
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#000946] leading-tight">
                {channel?.name || `โต๊ะสัมภาษณ์ ${channelId}`}
              </h1>
              {channel?.course && (
                <span className="text-sm bg-blue-50 text-[#000946] border border-blue-200 px-2.5 py-0.5 rounded-full font-normal">
                  {channel.course}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm font-normal text-slate-500">
              <span className="truncate max-w-[150px] sm:max-w-xs">{activity?.name || 'กำลังโหลด...'}</span>
              <span>•</span>
              <button
                onClick={() => {
                  setTempExaminer1(channel?.examiner1 || '');
                  setTempExaminer2(channel?.examiner2 || '');
                  setIsSettingExaminer(true);
                }}
                className="text-[#000946] hover:text-[#FF741F] font-normal underline flex items-center gap-1 cursor-pointer"
              >
                <span>
                  {channel?.examiner1 || channel?.examiner2
                    ? `กรรมการ: ${[channel.examiner1, channel.examiner2].filter(Boolean).join(', ')}`
                    : examinerName ? `กรรมการ: ${examinerName}` : 'ระบุชื่อกรรมการ (2 ท่าน)'}
                </span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Next Candidate Call Button */}
        <div className="flex items-center gap-2">
          {nextWaitingCandidate && (
            <button
              onClick={() => handleCallQueue(nextWaitingCandidate)}
              className="px-4 py-2.5 bg-[#000946] hover:bg-[#000946]/90 text-white text-sm font-normal rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <span>เรียกคิวถัดไป ({getCandidateQueueDisplay(nextWaitingCandidate, courseOptions)})</span>
            </button>
          )}
        </div>
      </header>

      {/* Examiner Selection Modal (2 Dropdowns) */}
      {isSettingExaminer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#000946] flex items-center justify-center mx-auto mb-2 border border-blue-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">ระบุชื่อกรรมการประจำโต๊ะ (2 ท่าน)</h3>
              <p className="text-sm font-normal text-slate-500">
                เลือกกรรมการประจำช่องบริการนี้เพื่อบันทึกลงในผลการประเมิน
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {/* Examiner 1 */}
              <div className="space-y-1.5">
                <label className="text-sm font-normal text-slate-700 flex items-center justify-between">
                  <span>กรรมการคนที่ 1</span>
                  {tempExaminer1 && (
                    <button
                      type="button"
                      onClick={() => setTempExaminer1('')}
                      className="text-sm text-slate-400 hover:text-red-500 font-normal cursor-pointer"
                    >
                      ปลดออก
                    </button>
                  )}
                </label>
                <select
                  value={tempExaminer1}
                  onChange={(e) => setTempExaminer1(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-normal text-slate-900 outline-none focus:border-[#000946] focus:ring-2 focus:ring-[#000946]/10 cursor-pointer"
                >
                  <option value="">-- เลือกกรรมการคนที่ 1 --</option>
                  {getStationExaminerOptions(1)}
                </select>
              </div>

              {/* Examiner 2 */}
              <div className="space-y-1.5">
                <label className="text-sm font-normal text-slate-700 flex items-center justify-between">
                  <span>กรรมการคนที่ 2</span>
                  {tempExaminer2 && (
                    <button
                      type="button"
                      onClick={() => setTempExaminer2('')}
                      className="text-sm text-slate-400 hover:text-red-500 font-normal cursor-pointer"
                    >
                      ปลดออก
                    </button>
                  )}
                </label>
                <select
                  value={tempExaminer2}
                  onChange={(e) => setTempExaminer2(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-normal text-slate-900 outline-none focus:border-[#000946] focus:ring-2 focus:ring-[#000946]/10 cursor-pointer"
                >
                  <option value="">-- เลือกกรรมการคนที่ 2 --</option>
                  {getStationExaminerOptions(2)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSettingExaminer(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-normal rounded-xl transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={saveExaminersToChannel}
                className="flex-1 py-2.5 bg-[#000946] hover:bg-[#000946]/90 text-white text-sm font-normal rounded-xl transition-all shadow-xs cursor-pointer"
              >
                บันทึกกรรมการประจำโต๊ะ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Split Grid */}
      <div className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        {/* Left Column (Active Candidate Console): 7 cols on Desktop */}
        <div className="lg:col-span-7 space-y-4">
          {message && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 text-[#000946] rounded-xl text-sm font-normal flex items-center justify-between animate-in fade-in">
              <span>{message}</span>
              <button onClick={() => setMessage('')} className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>
          )}

          {currentCandidate ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-xs">
              {/* Candidate Banner */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="px-5 py-2.5 min-w-[120px] h-18 rounded-2xl bg-blue-50 border-2 border-blue-200 flex flex-col items-center justify-center text-[#000946] flex-shrink-0 shadow-xs">
                    <span className="text-sm font-normal text-slate-600 uppercase tracking-wider">หมายเลขคิว</span>
                    <span className="text-2xl font-bold tracking-tight whitespace-nowrap leading-tight mt-0.5">
                      {getCandidateQueueDisplay(currentCandidate, courseOptions)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-normal px-2.5 py-0.5 rounded-full border ${
                        getCandidateQueueStatus(currentCandidate) === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-blue-50 text-[#000946] border border-blue-200'
                      }`}>
                        {getCandidateQueueStatus(currentCandidate) === 'completed' ? 'เสร็จสิ้นแล้ว' : 'กำลังสัมภาษณ์'}
                      </span>
                      <span className="text-sm font-normal text-slate-500">{currentCandidate.nationalId}</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">
                      {currentCandidate.fullName || `${currentCandidate.title || ''} ${currentCandidate.firstName || ''} ${currentCandidate.lastName || ''}`.trim() || currentCandidate.name || 'ผู้สมัคร'}
                    </h2>
                    <p className="text-sm font-normal text-[#000946]">{currentCandidate.course || '-'}</p>
                  </div>
                </div>

                {/* Recall Button (Show only when not completed) */}
                {getCandidateQueueStatus(currentCandidate) !== 'completed' && (
                  <button
                    onClick={handleRecall}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm font-normal rounded-xl text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="กดเพื่อส่งเสียงประกาศเรียกซ้ำ"
                  >
                    <svg className="w-4 h-4 text-[#000946]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    <span>เรียกซ้ำ</span>
                  </button>
                )}
              </div>

              {/* Evidence Photos Section */}
              <div className="space-y-2">
                {(() => {
                  const attached = currentCandidate.attachedDocuments || currentCandidate.documents || {};
                  const photoList = [];
                  if (Array.isArray(attached)) {
                    photoList.push(...attached.filter(Boolean));
                  } else if (typeof attached === 'object') {
                    Object.values(attached).forEach((val) => {
                      if (Array.isArray(val)) photoList.push(...val.filter(Boolean));
                      else if (typeof val === 'string' && val) photoList.push(val);
                    });
                  }

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-[#000946]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          </svg>
                          <span>รูปถ่ายหลักฐานหน้างาน</span>
                        </h3>
                        {photoList.length > 0 && (
                          <span className="text-sm font-normal text-[#000946] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                            {photoList.length} รูป
                          </span>
                        )}
                      </div>

                      {photoList.length === 0 ? (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-normal text-slate-500 flex items-center justify-between">
                          <span>ยังไม่มีรูปถ่ายหลักฐานที่แนบ</span>
                          <span className="text-sm text-[#000946] font-normal bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                            ถ่ายภาพเมื่อกดกรอกคะแนน
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {photoList.map((url, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setLightboxError(false);
                                setLightboxImage(url);
                              }}
                              className="group relative aspect-video rounded-xl bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer hover:border-[#000946] transition-all"
                            >
                              <SafeEvidenceThumbnail
                                src={url}
                                alt={`evidence-${idx}`}
                              />
                              <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-slate-900/20 transition-colors flex items-end p-1.5 pointer-events-none">
                                <span className="text-sm font-normal text-white truncate drop-shadow">
                                  รูปหลักฐาน {idx + 1}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Action Buttons: Scoring & Finish */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2.5">
                <button
                  onClick={() => setIsScoringOpen(true)}
                  className="flex-1 py-3 px-4 bg-[#000946] hover:bg-[#000946]/90 text-white text-sm font-normal rounded-xl shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>
                    {getCandidateQueueStatus(currentCandidate) === 'completed'
                      ? 'แก้ไขคะแนนและผลประเมินสัมภาษณ์'
                      : 'กรอกคะแนนและผลประเมินสัมภาษณ์'}
                  </span>
                </button>

                {getCandidateQueueStatus(currentCandidate) === 'completed' ? (
                  <button
                    onClick={() => setCurrentCandidate(null)}
                    className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-sm font-normal rounded-xl transition-colors cursor-pointer"
                  >
                    ปิดหน้านี้
                  </button>
                ) : (
                  <button
                    onClick={handleCompleteInterview}
                    className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-sm font-normal rounded-xl transition-colors cursor-pointer"
                  >
                    สัมภาษณ์เสร็จสิ้น (คนถัดไป)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">ยังไม่มีผู้สมัครที่โต๊ะสัมภาษณ์ขณะนี้</h3>
                <p className="text-sm font-normal text-slate-500 mt-1">
                  กรุณากดปุ่ม <strong>&quot;เรียกคิวถัดไป&quot;</strong> ด้านบน หรือเลือกรายชื่อจากรายการคิวด้านขวา
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Queue List & Filters): 5 cols on Desktop */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col h-[600px] shadow-xs">
          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-1 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>คิวผู้สมัคร</span>
              <span className="text-sm px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold">
                {filteredRegistrations.length}
              </span>
            </h3>

            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-sm">
              <button
                onClick={() => setActiveFilter('waiting')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === 'waiting' ? 'bg-white text-[#000946] shadow-xs border border-slate-200 font-bold' : 'text-slate-500 hover:text-slate-800 font-normal'
                }`}
              >
                <span>รอเรียก</span>
                <span className={`px-2 py-0.5 rounded-full text-sm font-bold ${
                  activeFilter === 'waiting' ? 'bg-blue-50 text-[#000946]' : 'bg-slate-200 text-slate-600'
                }`}>
                  {queueCounts.waiting}
                </span>
              </button>
              <button
                onClick={() => setActiveFilter('calling')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === 'calling' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200 font-bold' : 'text-slate-500 hover:text-slate-800 font-normal'
                }`}
              >
                <span>กำลังเรียก</span>
                <span className={`px-2 py-0.5 rounded-full text-sm font-bold ${
                  activeFilter === 'calling' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {queueCounts.calling}
                </span>
              </button>
              <button
                onClick={() => setActiveFilter('completed')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === 'completed' ? 'bg-white text-emerald-700 shadow-xs border border-slate-200 font-bold' : 'text-slate-500 hover:text-slate-800 font-normal'
                }`}
              >
                <span>เสร็จแล้ว</span>
                <span className={`px-2 py-0.5 rounded-full text-sm font-bold ${
                  activeFilter === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {queueCounts.completed}
                </span>
              </button>
            </div>
          </div>

          {/* Queue Items List */}
          <div className="flex-1 overflow-y-auto py-2 space-y-2 custom-scrollbar">
            {filteredRegistrations.length === 0 ? (
              <div className="p-8 text-center text-sm font-normal text-slate-400">
                ไม่มีรายการคิวในสถานะนี้
              </div>
            ) : (
              filteredRegistrations.map((cand) => {
                const isCurrent = currentCandidate?.id === cand.id;
                const qNum = getCandidateQueueDisplay(cand, courseOptions);
                const qStatus = getCandidateQueueStatus(cand);
                const isCompleted = qStatus === 'completed';

                return (
                  <div
                    key={cand.id}
                    onClick={() => {
                      if (isCompleted) {
                        setCurrentCandidate(cand);
                      }
                    }}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                      isCurrent
                        ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                        : isCompleted
                        ? 'bg-emerald-50/20 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 cursor-pointer'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`px-3 py-1.5 min-w-[72px] h-10 rounded-xl font-bold text-sm flex items-center justify-center flex-shrink-0 whitespace-nowrap shadow-xs ${
                        isCurrent
                          ? 'bg-[#000946] text-white'
                          : isCompleted
                          ? 'bg-white border border-emerald-300 text-emerald-800'
                          : 'bg-white border border-slate-200 text-slate-800'
                      }`}>
                        {qNum}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {cand.fullName || `${cand.title || ''} ${cand.firstName || ''} ${cand.lastName || ''}`.trim() || cand.name || 'ผู้สมัคร'}
                        </div>
                        <div className="text-sm font-normal text-slate-500 truncate">
                          {cand.course || '-'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCompleted) {
                          setCurrentCandidate(cand);
                          setIsScoringOpen(true);
                        } else {
                          handleCallQueue(cand);
                        }
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-sm font-normal transition-all flex-shrink-0 cursor-pointer ${
                        isCompleted
                          ? 'bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 border border-amber-300 hover:border-amber-600 shadow-xs'
                          : isCurrent
                          ? 'bg-[#000946] text-white'
                          : 'bg-white hover:bg-[#000946] hover:text-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      {isCompleted ? 'แก้ไขข้อมูล' : isCurrent ? 'กำลังตรวจ' : 'เรียกคิว'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Document Zoom */}
      {lightboxImage && (
        <div
          onClick={() => {
            setLightboxImage(null);
            setLightboxError(false);
          }}
          className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          {/* Header Controls */}
          <div
            className="w-full max-w-4xl flex items-center justify-between pb-3 text-white px-2"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <span className="text-sm font-normal text-slate-200">
                รูปถ่ายหลักฐานหน้างาน
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={lightboxImage}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-sm font-normal transition-colors flex items-center gap-1.5 cursor-pointer"
                title="เปิดในแท็บใหม่"
              >
                <span>เปิดแท็บใหม่</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <button
                type="button"
                onClick={() => {
                  setLightboxImage(null);
                  setLightboxError(false);
                }}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-normal transition-colors cursor-pointer"
              >
                ✕ ปิด
              </button>
            </div>
          </div>

          <div className="max-w-4xl max-h-[85vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {lightboxError ? (
              <div className="bg-slate-900 text-slate-300 p-8 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-2">
                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-bold">ไม่สามารถโหลดรูปภาพนี้ได้</p>
                <a
                  href={lightboxImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-sm text-blue-400 hover:underline font-normal"
                >
                  ลองเปิดไฟล์ตรง
                </a>
              </div>
            ) : (
              <img
                src={lightboxImage}
                alt="Document Zoom"
                onError={() => setLightboxError(true)}
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-slate-700"
              />
            )}
          </div>

          <span className="text-white/80 text-sm font-normal mt-3 bg-black/60 px-3 py-1 rounded-full">
            คลิกที่ใดก็ได้เพื่อปิดรูปขยาย
          </span>
        </div>
      )}

      {/* Examiner Scoring Modal */}
      {isScoringOpen && currentCandidate && (
        <ExaminerScoringModal
          isOpen={isScoringOpen}
          onClose={() => setIsScoringOpen(false)}
          candidate={currentCandidate}
          registrant={currentCandidate}
          activity={activity}
          activityId={activityId}
          activityName={activity?.name}
          courseOptions={courseOptions}
          examinerName={examinerName}
          onScoreSaved={(updated) => {
            setCurrentCandidate(prev => ({ ...prev, ...updated }));
            setIsScoringOpen(false);
            setMessage('บันทึกผลการประเมินและรูปถ่ายหลักฐานเรียบร้อยแล้ว');
          }}
          onSaveSuccess={(updated) => {
            if (updated) setCurrentCandidate(prev => ({ ...prev, ...updated }));
            setIsScoringOpen(false);
            setMessage('บันทึกผลการประเมินและรูปถ่ายหลักฐานเรียบร้อยแล้ว');
          }}
        />
      )}
    </div>
  );
}
