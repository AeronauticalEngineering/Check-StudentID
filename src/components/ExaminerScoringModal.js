'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, orderBy, getDocs, serverTimestamp } from 'firebase/firestore';
import { compressImageToBase64, uploadDocumentImage } from '../lib/storageService';

function SafePhotoThumbnail({ src, alt, onClick }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError || !src) {
    return (
      <div
        onClick={onClick}
        className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 cursor-pointer text-sm hover:bg-slate-200 transition-colors"
        title="คลิกเพื่อลองดูรูปภาพ"
      >
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        </svg>
        <span className="text-sm mt-0.5 font-normal">กดดูรูป</span>
      </div>
    );
  }
  return (
    <div className="w-full h-full relative group/img cursor-pointer" onClick={onClick}>
      <img
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
        title="คลิกเพื่อดูรูปขยาย"
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-normal gap-1 pointer-events-none">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
        </svg>
        <span>ดูรูป</span>
      </div>
    </div>
  );
}

export default function ExaminerScoringModal({
  isOpen,
  onClose,
  registrant: registrantProp,
  candidate,
  activity,
  onScoreSaved,
  onSaveSuccess,
  onSaveAndComplete,
  defaultExaminerName,
  examinerName: examinerNameProp,
  channel,
  channelId,
  channelName,
  examiners: examinersProp,
  allChannels: allChannelsProp,
  writtenExamScore: writtenExamScoreProp
}) {
  const registrant = registrantProp || candidate;
  const resolvedWrittenExamScore =
    writtenExamScoreProp !== undefined && writtenExamScoreProp !== null && String(writtenExamScoreProp).trim() !== ''
      ? writtenExamScoreProp
      : registrant?.writtenExamScore !== undefined && registrant?.writtenExamScore !== null && String(registrant.writtenExamScore).trim() !== ''
      ? registrant.writtenExamScore
      : registrant?.examScore !== undefined && registrant?.examScore !== null && String(registrant.examScore).trim() !== ''
      ? registrant.examScore
      : null;

  const [selectedQuota, setSelectedQuota] = useState('');
  const [generalScores, setGeneralScores] = useState({}); // { [criterionId]: score }
  const [quotaScores, setQuotaScores] = useState({}); // { [criterionId]: score }
  const [examiner1, setExaminer1] = useState('');
  const [examiner2, setExaminer2] = useState('');
  const [examinersListMaster, setExaminersListMaster] = useState([]);
  const [channelsListMaster, setChannelsListMaster] = useState([]);
  const [notes, setNotes] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState([]); // Array of photo URLs or base64
  const [uploadStatus, setUploadStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Image Lightbox State
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxError, setLightboxError] = useState(false);

  const scoringConfig = activity?.scoringConfig || {};
  const generalCriteria = scoringConfig.generalCriteria || [];
  const quotaCriteriaList = scoringConfig.quotaCriteriaList || [];

  const lastLoadedCandidateIdRef = useRef(null);
  const wasOpenRef = useRef(false);

  // Load master examiners list and channels if not passed via props
  useEffect(() => {
    if (!isOpen) return;
    if (Array.isArray(examinersProp) && examinersProp.length > 0) {
      setExaminersListMaster(examinersProp);
    } else {
      getDocs(query(collection(db, 'examiners'), orderBy('name')))
        .then(snap => setExaminersListMaster(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
        .catch(err => console.warn('Failed to load examiners in modal:', err));
    }

    const actId = activity?.id || registrant?.activityId;
    if (Array.isArray(allChannelsProp) && allChannelsProp.length > 0) {
      setChannelsListMaster(allChannelsProp);
    } else if (actId) {
      getDocs(query(collection(db, 'queueChannels'), where('activityId', '==', actId)))
        .then(snap => setChannelsListMaster(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
        .catch(err => console.warn('Failed to load channels in modal:', err));
    }
  }, [isOpen, examinersProp, allChannelsProp, activity?.id, registrant?.activityId]);

  const parseExaminerPair = (rawInput, chObj) => {
    const isPlaceholder = (s) => !s || s === 'กรรมการประจำช่องบริการ' || s === 'Examiner' || s === '-';
    if (Array.isArray(rawInput)) {
      const cleaned = rawInput.map(s => String(s || '').trim()).filter(s => !isPlaceholder(s));
      if (cleaned.length >= 2) return [cleaned[0], cleaned[1]];
      if (cleaned.length === 1) return [cleaned[0], chObj?.examiner2 && chObj.examiner2 !== cleaned[0] ? chObj.examiner2 : ''];
    }
    if (typeof rawInput === 'string' && !isPlaceholder(rawInput.trim())) {
      const parts = rawInput.split(',').map(s => s.trim()).filter(s => !isPlaceholder(s));
      if (parts.length >= 2) return [parts[0], parts[1]];
      if (parts.length === 1) return [parts[0], chObj?.examiner2 && chObj.examiner2 !== parts[0] ? chObj.examiner2 : ''];
    }
    if (chObj?.examiner1 || chObj?.examiner2) {
      return [chObj.examiner1 || '', chObj.examiner2 || ''];
    }
    return ['', ''];
  };

  // Initialize or reset form only when modal is newly opened or candidate ID changes
  useEffect(() => {
    if (!isOpen || !registrant) {
      if (!isOpen) {
        lastLoadedCandidateIdRef.current = null;
        wasOpenRef.current = false;
      }
      return;
    }

    const candidateId = registrant.id;
    const isNewOpen = !wasOpenRef.current && isOpen;
    const isDifferentCandidate = lastLoadedCandidateIdRef.current !== candidateId;

    if (isNewOpen || isDifferentCandidate) {
      wasOpenRef.current = true;
      lastLoadedCandidateIdRef.current = candidateId;

      const savedExaminer = typeof window !== 'undefined'
        ? (localStorage.getItem('aero_station_examiner_name') || localStorage.getItem('aero_examiner_name') || '')
        : '';
      const resolvedChId = channel?.id || channelId || registrant?.evaluationScore?.channelId || registrant?.interviewedChannelId || registrant?.currentChannelId;
      const matchedCh = channel || channelsListMaster.find(c => String(c.id) === String(resolvedChId));
      const fallbackActiveExaminer =
        [matchedCh?.examiner1, matchedCh?.examiner2].filter(Boolean).join(', ') ||
        examinerNameProp ||
        defaultExaminerName ||
        savedExaminer;

      // Load existing evaluation score if available
      const existing = registrant.evaluationScore;
      if (existing) {
        setGeneralScores(existing.generalScores || {});
        setQuotaScores(existing.quotaScores || {});
        const resolvedQuota = registrant.quota || existing?.quota || (quotaCriteriaList.length === 1 ? quotaCriteriaList[0]?.quotaName : '') || '';
        setSelectedQuota(resolvedQuota);

        const [initEx1, initEx2] = parseExaminerPair(
          existing.examiners?.length ? existing.examiners : (existing.examinerName || fallbackActiveExaminer),
          matchedCh
        );
        setExaminer1(initEx1);
        setExaminer2(initEx2);
        setNotes(existing.notes || '');
      } else {
        setGeneralScores({});
        setQuotaScores({});
        const resolvedQuota = registrant.quota || (quotaCriteriaList.length === 1 ? quotaCriteriaList[0]?.quotaName : '') || '';
        setSelectedQuota(resolvedQuota);
        const [initEx1, initEx2] = parseExaminerPair(fallbackActiveExaminer, matchedCh);
        setExaminer1(initEx1);
        setExaminer2(initEx2);
        setNotes('');
      }

      // Load existing attached evidence photos comprehensively from all potential locations
      const candidateSources = [
        registrant.attachedDocuments,
        registrant.documents,
        registrant.evidence,
        registrant.evidencePhotos,
        registrant.evaluationScore?.attachedDocuments,
        registrant.evaluationScore?.evidence,
        registrant.evaluationScore?.evidencePhotos
      ];

      const initialPhotos = [];
      candidateSources.forEach(source => {
        if (!source) return;
        if (Array.isArray(source)) {
          source.forEach(item => {
            if (typeof item === 'string' && item.trim()) initialPhotos.push(item.trim());
          });
        } else if (typeof source === 'object') {
          Object.values(source).forEach(val => {
            if (Array.isArray(val)) {
              val.forEach(item => {
                if (typeof item === 'string' && item.trim()) initialPhotos.push(item.trim());
              });
            } else if (typeof val === 'string' && val.trim()) {
              initialPhotos.push(val.trim());
            }
          });
        } else if (typeof source === 'string' && source.trim()) {
          initialPhotos.push(source.trim());
        }
      });

      setEvidencePhotos(Array.from(new Set(initialPhotos)));
      setMessage('');
      setUploadStatus('');
    }
  }, [registrant?.id, isOpen]);

  // Manual Form Reset Action
  const handleManualReset = () => {
    if (!window.confirm('คุณต้องการรีเซ็ตค่าคะแนนและข้อเสนอแนะที่กำลังกรอกในฟอร์มนี้ใช่หรือไม่?')) {
      return;
    }
    const existing = registrant?.evaluationScore;
    if (existing) {
      setGeneralScores(existing.generalScores || {});
      setQuotaScores(existing.quotaScores || {});
      setNotes(existing.notes || '');
      setMessage('↺ รีเซ็ตคะแนนกลับเป็นค่าเดิมที่เคยบันทึกไว้เรียบร้อยแล้ว');
    } else {
      setGeneralScores({});
      setQuotaScores({});
      setNotes('');
      setMessage('↺ รีเซ็ตและล้างคะแนนในฟอร์มเรียบร้อยแล้ว');
    }
    setTimeout(() => setMessage(''), 3500);
  };

  // Current selected quota criteria list
  const activeQuotaCriteria = useMemo(() => {
    if (!selectedQuota) return [];
    const group = quotaCriteriaList.find(q => q.quotaName === selectedQuota);
    return group?.criteria || [];
  }, [selectedQuota, quotaCriteriaList]);

  // Calculate General Subtotal & Max Total (Direct Sum without Weighting)
  const { generalTotal, generalMaxTotal } = useMemo(() => {
    let scoreTotal = 0;
    let maxTotal = 0;
    generalCriteria.forEach(crit => {
      const score = Number(generalScores[crit.id]) || 0;
      const maxScore = Number(crit.maxScore !== undefined ? crit.maxScore : crit.weight) || 100;
      scoreTotal += score;
      maxTotal += maxScore;
    });
    return {
      generalTotal: Math.round(scoreTotal * 100) / 100,
      generalMaxTotal: Math.round(maxTotal * 100) / 100
    };
  }, [generalScores, generalCriteria]);

  // Calculate Quota Subtotal & Max Total (Direct Sum without Weighting)
  const { quotaTotal, quotaMaxTotal } = useMemo(() => {
    let scoreTotal = 0;
    let maxTotal = 0;
    activeQuotaCriteria.forEach(crit => {
      const score = Number(quotaScores[crit.id]) || 0;
      const maxScore = Number(crit.maxScore !== undefined ? crit.maxScore : crit.weight) || 100;
      scoreTotal += score;
      maxTotal += maxScore;
    });
    return {
      quotaTotal: Math.round(scoreTotal * 100) / 100,
      quotaMaxTotal: Math.round(maxTotal * 100) / 100
    };
  }, [quotaScores, activeQuotaCriteria]);

  // Final Total Score calculation (direct sum without weights)
  const { finalTotalScore, finalMaxTotal } = useMemo(() => {
    const hasQuota = activeQuotaCriteria.length > 0;
    const total = generalTotal + (hasQuota ? quotaTotal : 0);
    const max = generalMaxTotal + (hasQuota ? quotaMaxTotal : 0);
    return {
      finalTotalScore: Math.round(total * 100) / 100,
      finalMaxTotal: Math.round(max * 100) / 100
    };
  }, [generalTotal, generalMaxTotal, quotaTotal, quotaMaxTotal, activeQuotaCriteria]);

  const handleScoreChange = (type, critId, val, critMax) => {
    if (val === '') {
      if (type === 'general') {
        setGeneralScores(prev => ({ ...prev, [critId]: '' }));
      } else {
        setQuotaScores(prev => ({ ...prev, [critId]: '' }));
      }
      return;
    }

    const maxLimit = Number(critMax !== undefined ? critMax : 100);
    const num = Number(val);
    const clamped = Math.max(0, Math.min(maxLimit, isNaN(num) ? 0 : num));
    if (type === 'general') {
      setGeneralScores(prev => ({ ...prev, [critId]: clamped }));
    } else {
      setQuotaScores(prev => ({ ...prev, [critId]: clamped }));
    }
  };

  const handleFileSelect = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadStatus('กำลังประมวลผลรูปภาพ...');
    try {
      const newImages = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const compressed = await compressImageToBase64(file);
        newImages.push(compressed);
      }

      setEvidencePhotos(prev => [...prev, ...newImages]);
      setUploadStatus('');
      event.target.value = '';
    } catch (err) {
      console.error('Error compressing image:', err);
      setUploadStatus('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    }
  };

  const handleRemovePhoto = (indexToRemove) => {
    setEvidencePhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const getModalExaminerOptions = (slotIndex) => {
    const currentValue = slotIndex === 1 ? examiner1 : examiner2;
    const otherSlotValue = slotIndex === 1 ? examiner2 : examiner1;
    const resolvedChId = channel?.id || channelId || registrant?.evaluationScore?.channelId || registrant?.interviewedChannelId || registrant?.currentChannelId || null;

    const assignedOtherChannelsMap = new Map();
    channelsListMaster.forEach(ch => {
      if (resolvedChId && String(ch.id) === String(resolvedChId)) return;
      const chLabel = `ช่อง ${ch.channelNumber}${ch.channelName ? ` (${ch.channelName})` : ''}`;
      if (ch.examiner1) assignedOtherChannelsMap.set(ch.examiner1, chLabel);
      if (ch.examiner2) assignedOtherChannelsMap.set(ch.examiner2, chLabel);
      if (Array.isArray(ch.examiners)) {
        ch.examiners.forEach(exName => {
          if (exName) assignedOtherChannelsMap.set(exName, chLabel);
        });
      }
    });

    const masterNames = new Set(examinersListMaster.map(ex => ex.name));
    const hasCustomCurrent = currentValue && !masterNames.has(currentValue);

    return (
      <>
        <option value="">-- เลือกกรรมการคนที่ {slotIndex} --</option>
        {hasCustomCurrent && (
          <option value={currentValue}>{currentValue}</option>
        )}
        {examinersListMaster.map(ex => {
          const isSameDeskOtherSlot = ex.name === otherSlotValue;
          const otherChannelLabel = assignedOtherChannelsMap.get(ex.name);
          const isDisabled = isSameDeskOtherSlot || Boolean(otherChannelLabel);

          let suffix = '';
          if (isSameDeskOtherSlot) {
            suffix = ' (เลือกในอีกช่องของโต๊ะนี้แล้ว)';
          } else if (otherChannelLabel) {
            suffix = ` (ประจำอยู่ที่ ${otherChannelLabel})`;
          }

          return (
            <option key={ex.id} value={ex.name} disabled={isDisabled}>
              {ex.name}{ex.department ? ` (${ex.department})` : ''}{suffix}
            </option>
          );
        })}
      </>
    );
  };

  const handleSave = async (shouldCompleteAfterSave = false) => {
    const regId = registrant?.id || registrant?.docId;
    if (!regId) return;
    setMessage('');

    const ex1 = examiner1.trim();
    const ex2 = examiner2.trim();
    if (!ex1 || !ex2) {
      setMessage('⚠️ กรุณาเลือกชื่อกรรมการสอบจากรายการ (Dropdown) ให้ครบทั้ง 2 ท่านก่อนบันทึกคะแนน');
      return;
    }
    if (ex1 === ex2) {
      setMessage('⚠️ ชื่อกรรมการคนที่ 1 และคนที่ 2 ต้องไม่ซ้ำกัน');
      return;
    }

    setIsSaving(true);

    try {
      setUploadStatus('กำลังบันทึกรูปภาพหลักฐาน...');

      // Upload any new base64 images to Storage / preserve existing URLs (including /uploads/...)
      const uploadedUrls = [];
      for (let i = 0; i < evidencePhotos.length; i++) {
        const item = evidencePhotos[i];
        if (typeof item === 'string' && item.startsWith('data:image')) {
          // New base64 photo: upload
          const uploadedUrl = await uploadDocumentImage(
            item,
            `documents/${regId}/evidence_${Date.now()}_${i}.jpg`
          );
          if (uploadedUrl) {
            uploadedUrls.push(uploadedUrl);
          }
        } else if (typeof item === 'string' && item.trim()) {
          // Existing image URL (/uploads/..., http://, https://, etc.) - PRESERVE!
          uploadedUrls.push(item.trim());
        }
      }

      const finalAttachedDocs = uploadedUrls.length > 0 ? { evidence: uploadedUrls } : {};

      setUploadStatus('กำลังบันทึกข้อมูล...');
      const examinersList = [ex1, ex2];
      const trimmedExaminer = examinersList.join(', ');

      // Remember examiner name in localStorage for subsequent students
      if (typeof window !== 'undefined') {
        localStorage.setItem('aero_examiner_name', trimmedExaminer);
        localStorage.setItem('aero_station_examiner_name', trimmedExaminer);
      }

      // Sanitize scores so any empty/blank field defaults cleanly to 0
      const sanitizedGeneralScores = {};
      generalCriteria.forEach(crit => {
        sanitizedGeneralScores[crit.id] = Number(generalScores[crit.id]) || 0;
      });

      const sanitizedQuotaScores = {};
      activeQuotaCriteria.forEach(crit => {
        sanitizedQuotaScores[crit.id] = Number(quotaScores[crit.id]) || 0;
      });

      const finalQuota = selectedQuota || registrant.quota || null;
      const resolvedChannelId = channel?.id || channelId || registrant?.evaluationScore?.channelId || registrant?.interviewedChannelId || registrant?.currentChannelId || null;
      const resolvedChannelName = channel?.channelName || channelName || registrant?.evaluationScore?.channelName || registrant?.currentChannelName || null;

      const evaluationPayload = {
        isScored: true,
        scoredAt: new Date().toISOString(),
        examinerName: trimmedExaminer,
        examiners: examinersList,
        channelId: resolvedChannelId,
        channelName: resolvedChannelName,
        quota: finalQuota,
        generalScores: sanitizedGeneralScores,
        quotaScores: sanitizedQuotaScores,
        calculatedGeneralTotal: generalTotal,
        calculatedQuotaTotal: quotaTotal,
        generalTotal,
        generalMaxTotal,
        quotaTotal,
        quotaMaxTotal,
        finalTotalScore,
        finalMaxTotal,
        evidence: uploadedUrls,
        notes: notes.trim()
      };

      const regUpdateFields = {
        evaluationScore: evaluationPayload,
        interviewedBy: trimmedExaminer,
        examiners: examinersList,
        quota: finalQuota,
        attachedDocuments: finalAttachedDocs,
        attachedBy: 'examiner',
        attachedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (resolvedChannelId) {
        regUpdateFields.interviewedChannelId = resolvedChannelId;
      }
      if (resolvedChannelName) {
        regUpdateFields.interviewedChannelName = resolvedChannelName;
      }

      const regRef = doc(db, 'registrations', regId);
      await updateDoc(regRef, regUpdateFields);

      // Sync the 2 selected examiners back to the desk channel if not already set
      if (resolvedChannelId && (!channel?.examiner1 || !channel?.examiner2)) {
        try {
          await updateDoc(doc(db, 'queueChannels', resolvedChannelId), {
            examiner1: ex1,
            examiner2: ex2,
            examiners: examinersList,
            updatedAt: serverTimestamp()
          });
        } catch (chErr) {
          console.warn('Could not sync examiners to channel doc:', chErr);
        }
      }

      setMessage('✅ บันทึกคะแนนและรูปถ่ายหลักฐานเรียบร้อยแล้ว');
      const updatedPayload = {
        ...registrant,
        id: regId,
        evaluationScore: evaluationPayload,
        quota: finalQuota,
        attachedDocuments: finalAttachedDocs,
        attachedBy: 'examiner',
        ...(resolvedChannelId ? { interviewedChannelId: resolvedChannelId } : {}),
        ...(resolvedChannelName ? { interviewedChannelName: resolvedChannelName } : {})
      };
      if (onScoreSaved) {
        onScoreSaved(updatedPayload);
      }
      if (onSaveSuccess) {
        onSaveSuccess(updatedPayload);
      }
      if (shouldCompleteAfterSave && onSaveAndComplete) {
        await onSaveAndComplete(updatedPayload);
        onClose();
      } else {
        setTimeout(() => {
          onClose();
        }, 700);
      }
    } catch (error) {
      console.error(error);
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSaving(false);
      setUploadStatus('');
    }
  };

  if (!isOpen || !registrant) return null;

  return (
    <>
      {/* Main Modal Backdrop & Container */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 font-sans">
        {/* Main Scoring Modal Card */}
        <div
          className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onClick={e => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-5 py-3.5 bg-[#000946] text-white flex items-center justify-between border-b border-[#000946]">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <div>
                <h2 className="text-sm sm:text-base font-bold tracking-wide text-white">
                  บันทึกคะแนนและแนบรูปถ่ายหลักฐาน: {registrant.fullName}
                </h2>
                <p className="text-sm font-normal text-slate-300">
                  คิว: {registrant.displayQueueNumber || '-'} • บัตร ปชช: {registrant.nationalId || '-'} • รหัส: {registrant.studentId || '-'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-normal transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 text-sm text-slate-800">
            {/* Top Info Strip */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="border-b sm:border-b-0 sm:border-r border-slate-200 pb-2 sm:pb-0 pr-2">
                <span className="text-sm font-normal text-slate-500 block">หมายเลขคิว</span>
                <span className="text-xl font-bold text-[#000946]">
                  {registrant.displayQueueNumber || '-'}
                </span>
              </div>
              <div className="border-b sm:border-b-0 sm:border-r border-slate-200 pb-2 sm:pb-0 pr-2">
                <span className="text-sm font-normal text-slate-500 block">หลักสูตร / รอบ</span>
                <span className="font-normal text-slate-800 truncate block text-sm">
                  {registrant.course || '-'} {registrant.timeSlot ? `(${registrant.timeSlot})` : ''}
                </span>
              </div>
              <div className="sm:border-r border-slate-200 pr-2">
                <span className="text-sm font-normal text-slate-500 block">ประเภท</span>
                {quotaCriteriaList.length > 0 ? (
                  <select
                    value={selectedQuota}
                    onChange={e => setSelectedQuota(e.target.value)}
                    className="mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-[#000946] outline-none focus:border-[#000946] max-w-full"
                  >
                    <option value="">-- เลือกประเภท --</option>
                    {quotaCriteriaList.map((q, idx) => (
                      <option key={idx} value={q.quotaName}>{q.quotaName}</option>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold text-slate-800 truncate block text-sm mt-0.5">
                    {registrant.quota || selectedQuota || 'ทั่วไป'}
                  </span>
                )}
              </div>
              <div className="bg-indigo-50/70 rounded-lg p-1.5 border border-indigo-200/70 flex flex-col justify-center">
                <span className="text-xs font-medium text-indigo-700 block">📝 คะแนนสอบข้อเขียน</span>
                <span className="text-base font-bold text-indigo-950 mt-0.5">
                  {resolvedWrittenExamScore !== null ? `${resolvedWrittenExamScore} คะแนน` : 'ไม่มีข้อมูล'}
                </span>
              </div>
            </div>

            {/* 1. Evidence Photos Attachment Section */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div>
                  <span className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-[#000946]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                    <span>แนบรูปถ่ายหลักฐานหน้างาน</span>
                  </span>
                  <span className="text-sm font-normal text-slate-500 block mt-0.5">
                    ถ่ายภาพหรือแนบรูปถ่ายหลักฐานประกอบการสัมภาษณ์โดยกรรมการ ({evidencePhotos.length} รูป)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {uploadStatus && (
                    <span className="text-sm font-normal text-[#000946] bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse">
                      <span>{uploadStatus}</span>
                    </span>
                  )}
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#000946] hover:bg-[#000946]/90 text-white rounded-xl text-sm font-normal shadow-xs transition-all active:scale-95">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                    <span>ถ่ายภาพ / แนบรูปหลักฐาน</span>
                  </label>
                </div>
              </div>

              {/* Photos Grid */}
              {evidencePhotos.length === 0 ? (
                <div className="py-6 text-center text-sm font-normal text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
                  ยังไม่มีรูปถ่ายหลักฐาน (กดปุ่ม &quot;ถ่ายภาพ / แนบรูปหลักฐาน&quot; ด้านบนเพื่อถ่ายหรือเลือกรูป)
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {evidencePhotos.map((url, idx) => {
                    const isNewUpload = typeof url === 'string' && url.startsWith('data:image');
                    return (
                      <div
                        key={idx}
                        className="relative w-22 h-22 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 group shadow-xs"
                      >
                        <SafePhotoThumbnail
                          src={url}
                          alt={`evidence-${idx}`}
                          onClick={() => {
                            setLightboxError(false);
                            setLightboxImage(url);
                          }}
                        />
                        {isNewUpload && (
                          <span className="absolute bottom-0 inset-x-0 bg-amber-500/90 text-white text-xs font-normal text-center py-0.5 pointer-events-none">
                            รอเซฟ
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePhoto(idx);
                          }}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-xs transition-all cursor-pointer z-10"
                          title="ลบรูปนี้"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. General Scoring Criteria Form */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="font-bold text-slate-900 text-sm">
                  1. เกณฑ์คะแนนทั่วไป (General Criteria)
                </span>
                <span className="font-bold text-[#000946] bg-blue-50 px-3 py-1 rounded-xl border border-blue-200 text-sm">
                  รวมคะแนน: {generalTotal} / {generalMaxTotal} คะแนน
                </span>
              </div>

              {generalCriteria.length === 0 ? (
                <p className="text-slate-400 text-center py-3 text-sm font-normal">ไม่ได้กำหนดเกณฑ์คะแนนทั่วไป</p>
              ) : (
                <div className="space-y-2.5">
                  {generalCriteria.map((crit, idx) => {
                    const rawScore = generalScores[crit.id] !== undefined ? generalScores[crit.id] : '';
                    const critMax = Number(crit.maxScore !== undefined ? crit.maxScore : crit.weight) || 100;

                    return (
                      <div
                        key={crit.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-normal w-5 text-sm">{idx + 1}.</span>
                          <div>
                            <span className="font-normal text-slate-800 text-sm">{crit.name}</span>
                            <span className="text-sm text-slate-500 ml-1.5 font-normal">
                              (เต็ม {critMax} คะแนน)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-normal text-slate-500">คะแนนที่ได้:</span>
                            <input
                              type="number"
                              min="0"
                              max={critMax}
                              value={rawScore}
                              onChange={e => handleScoreChange('general', crit.id, e.target.value, critMax)}
                              placeholder="0"
                              className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-center font-bold text-slate-900 outline-none focus:border-[#000946] focus:ring-2 focus:ring-[#000946]/10 text-sm"
                            />
                            <span className="text-sm text-slate-500 font-normal">/ {critMax}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Quota-Specific Scoring Criteria Form */}
            {activeQuotaCriteria.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="font-bold text-slate-900 text-sm">
                    2. เกณฑ์คะแนนเฉพาะประเภท: <span className="text-[#000946]">{selectedQuota}</span>
                  </span>
                  <span className="font-bold text-[#000946] bg-blue-50 px-3 py-1 rounded-xl border border-blue-200 text-sm">
                    รวมคะแนน: {quotaTotal} / {quotaMaxTotal} คะแนน
                  </span>
                </div>

                <div className="space-y-2.5">
                  {activeQuotaCriteria.map((crit, idx) => {
                    const rawScore = quotaScores[crit.id] !== undefined ? quotaScores[crit.id] : '';
                    const critMax = Number(crit.maxScore !== undefined ? crit.maxScore : crit.weight) || 100;

                    return (
                      <div
                        key={crit.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-normal w-5 text-sm">{idx + 1}.</span>
                          <div>
                            <span className="font-normal text-slate-800 text-sm">{crit.name}</span>
                            <span className="text-sm text-slate-500 ml-1.5 font-normal">
                              (เต็ม {critMax} คะแนน)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-normal text-slate-500">คะแนนที่ได้:</span>
                            <input
                              type="number"
                              min="0"
                              max={critMax}
                              value={rawScore}
                              onChange={e => handleScoreChange('quota', crit.id, e.target.value, critMax)}
                              placeholder="0"
                              className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-center font-bold text-slate-900 outline-none focus:border-[#000946] focus:ring-2 focus:ring-[#000946]/10 text-sm"
                            />
                            <span className="text-sm text-slate-500 font-normal">/ {critMax}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Examiner Remarks & Name (2 Dropdowns Required) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-slate-800">
                    กรรมการสอบ คนที่ 1 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={examiner1}
                    onChange={e => setExaminer1(e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-white border rounded-xl outline-none focus:border-[#000946] focus:ring-2 focus:ring-[#000946]/10 text-sm font-semibold text-slate-900 ${
                      !examiner1 ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                    }`}
                  >
                    {getModalExaminerOptions(1)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-slate-800">
                    กรรมการสอบ คนที่ 2 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={examiner2}
                    onChange={e => setExaminer2(e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-white border rounded-xl outline-none focus:border-[#000946] focus:ring-2 focus:ring-[#000946]/10 text-sm font-semibold text-slate-900 ${
                      !examiner2 ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                    }`}
                  >
                    {getModalExaminerOptions(2)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-normal text-slate-700">ข้อเสนอแนะ / ความเห็นเพิ่มเติม</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="เช่น มีความพร้อมสูง ผ่านเกณฑ์สอบสัมภาษณ์"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#000946] focus:ring-2 focus:ring-[#000946]/10 text-sm font-normal text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {message && (
            <div className={`mx-4 mb-2 p-3 rounded-xl text-sm font-normal border ${message.includes('✅') || message.includes('เรียบร้อย') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {message}
            </div>
          )}

          {/* Modal Footer */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            {/* Left side: Manual Reset Button */}
            <button
              type="button"
              onClick={handleManualReset}
              className="px-3.5 py-2.5 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 text-sm rounded-xl border border-slate-300 hover:border-red-300 font-normal transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="รีเซ็ตคะแนนที่กำลังกรอกให้กลับเป็นค่าเริ่มต้น"
            >
              <svg className="w-4 h-4 text-slate-500 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>รีเซ็ตคะแนน</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-sm rounded-xl border border-slate-300 font-normal transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="px-5 py-2.5 bg-[#000946] hover:bg-[#000946]/90 text-white text-sm font-normal rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกผลคะแนน'}
              </button>
              {onSaveAndComplete && (
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✅ บันทึกคะแนน & เสร็จสิ้นคิวนี้ (เคลียร์โต๊ะว่าง)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for zooming attached images - Rendered at Root Level with z-[9999] */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            setLightboxImage(null);
            setLightboxError(false);
          }}
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
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-sm font-normal transition-colors flex items-center gap-1.5"
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

          {/* Image Container */}
          <div
            className="relative max-w-4xl max-h-[80vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
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
                alt="Zoomed Document"
                onError={() => setLightboxError(true)}
                className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-slate-700 select-none"
              />
            )}
          </div>

          <span className="text-white/60 text-sm font-normal mt-3 bg-black/60 px-3 py-1 rounded-full pointer-events-none">
            คลิกพื้นที่ว่างด้านนอก หรือกดปุ่ม &quot;✕ ปิด&quot; ด้านบนเพื่อปิด
          </span>
        </div>
      )}
    </>
  );
}
