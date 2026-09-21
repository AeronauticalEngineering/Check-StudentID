'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  defaultExaminerName,
  examinerName: examinerNameProp
}) {
  const registrant = registrantProp || candidate;

  const [selectedQuota, setSelectedQuota] = useState('');
  const [generalScores, setGeneralScores] = useState({}); // { [criterionId]: score }
  const [quotaScores, setQuotaScores] = useState({}); // { [criterionId]: score }
  const [examinerName, setExaminerName] = useState('');
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

  // Initialize or reset form when registrant or isOpen changes
  useEffect(() => {
    if (!registrant || !isOpen) return;

    const savedExaminer = typeof window !== 'undefined' ? (localStorage.getItem('aero_examiner_name') || '') : '';
    const currentActiveExaminer = examinerNameProp || defaultExaminerName || savedExaminer;

    // Load existing evaluation score if available
    const existing = registrant.evaluationScore;
    if (existing) {
      setGeneralScores(existing.generalScores || {});
      setQuotaScores(existing.quotaScores || {});
      const resolvedQuota = registrant.quota || existing?.quota || (quotaCriteriaList.length === 1 ? quotaCriteriaList[0]?.quotaName : '') || '';
      setSelectedQuota(resolvedQuota);
      
      if (existing.examinerName) {
        setExaminerName(existing.examinerName);
      } else if (currentActiveExaminer) {
        setExaminerName(currentActiveExaminer);
      } else {
        setExaminerName('');
      }
      setNotes(existing.notes || '');
    } else {
      setGeneralScores({});
      setQuotaScores({});
      const resolvedQuota = registrant.quota || (quotaCriteriaList.length === 1 ? quotaCriteriaList[0]?.quotaName : '') || '';
      setSelectedQuota(resolvedQuota);
      setExaminerName(currentActiveExaminer || '');
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
  }, [registrant, isOpen, quotaCriteriaList, defaultExaminerName, examinerNameProp]);

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

  const handleSave = async () => {
    const regId = registrant?.id || registrant?.docId;
    if (!regId) return;
    setMessage('');
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
      const trimmedExaminer = examinerName.trim() || 'กรรมการประจำช่องบริการ';
      const examinersList = trimmedExaminer.split(',').map(s => s.trim()).filter(Boolean);

      // Remember examiner name in localStorage for subsequent students
      if (typeof window !== 'undefined' && examinerName.trim()) {
        localStorage.setItem('aero_examiner_name', examinerName.trim());
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

      const evaluationPayload = {
        isScored: true,
        scoredAt: new Date().toISOString(),
        examinerName: trimmedExaminer,
        examiners: examinersList,
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

      const regRef = doc(db, 'registrations', regId);
      await updateDoc(regRef, {
        evaluationScore: evaluationPayload,
        quota: finalQuota,
        attachedDocuments: finalAttachedDocs,
        attachedBy: 'examiner',
        attachedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setMessage('✅ บันทึกคะแนนและรูปถ่ายหลักฐานเรียบร้อยแล้ว');
      const updatedPayload = {
        ...registrant,
        id: regId,
        evaluationScore: evaluationPayload,
        quota: finalQuota,
        attachedDocuments: finalAttachedDocs,
        attachedBy: 'examiner'
      };
      if (onScoreSaved) {
        onScoreSaved(updatedPayload);
      }
      if (onSaveSuccess) {
        onSaveSuccess(updatedPayload);
      }
      setTimeout(() => {
        onClose();
      }, 700);
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
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
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
              <div>
                <span className="text-sm font-normal text-slate-500 block">ประเภทโควตา</span>
                <span className="font-normal text-slate-800 truncate block text-sm mt-0.5">
                  {registrant.quota || selectedQuota || 'ทั่วไป'}
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
                    2. เกณฑ์คะแนนเฉพาะโควตา: <span className="text-[#000946]">{selectedQuota}</span>
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

            {/* 4. Examiner Remarks & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1 space-y-1.5">
                <label className="block text-sm font-normal text-slate-700">ชื่อกรรมการผู้ประเมิน (1-2 ท่าน)</label>
                <input
                  type="text"
                  value={examinerName}
                  onChange={e => {
                    setExaminerName(e.target.value);
                    if (typeof window !== 'undefined' && e.target.value.trim()) {
                      localStorage.setItem('aero_examiner_name', e.target.value.trim());
                    }
                  }}
                  placeholder="เช่น อ.สมชาย ใจดี, อ.วิภาดา รักเรียน"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#000946] focus:ring-2 focus:ring-[#000946]/10 text-sm font-normal text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
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
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-sm rounded-xl border border-slate-300 font-normal transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2.5 bg-[#000946] hover:bg-[#000946]/90 text-white text-sm font-normal rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกผลคะแนน'}
              </button>
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
