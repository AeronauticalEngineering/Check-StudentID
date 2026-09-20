'use client';

import { useState } from 'react';

const CameraIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const SafeEvidenceImage = ({ src, alt, className = '' }) => {
  const [hasError, setHasError] = useState(false);
  if (hasError || !src) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-2 text-center select-none ${className}`}>
        <CameraIcon className="w-8 h-8 text-slate-300 mb-1" />
        <span className="text-sm text-slate-500 font-normal">รูปภาพไม่พร้อมแสดงผล</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
    />
  );
};

export default function StudentDocumentUploadModal({
  isOpen,
  onClose,
  registration,
  activity
}) {
  const [lightboxImg, setLightboxImg] = useState(null);
  const [lightboxError, setLightboxError] = useState(false);

  if (!isOpen || !registration) return null;

  const attachedDocs = registration?.attachedDocuments || {};
  const examinerName = registration?.evaluationScore?.examinerName || 'กรรมการประจำช่องบริการ';

  // Extract all evidence photo URLs
  const allPhotos = [];
  if (Array.isArray(attachedDocs)) {
    allPhotos.push(...attachedDocs.filter(Boolean));
  } else if (typeof attachedDocs === 'object') {
    Object.values(attachedDocs).forEach(val => {
      if (Array.isArray(val)) allPhotos.push(...val.filter(Boolean));
      else if (typeof val === 'string' && val) allPhotos.push(val);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 font-sans backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 bg-[#000946] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white">
              <CameraIcon className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-wide">
                รูปถ่ายหลักฐานหน้างาน
              </h2>
              <p className="text-sm text-white/80 font-normal truncate max-w-xs">
                {activity?.name || 'กิจกรรม'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer text-sm font-normal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-slate-800">
          {/* Examiner Info Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm flex items-center justify-between gap-2">
            <div className="space-y-1">
              <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                <CameraIcon className="w-4 h-4 text-slate-600" />
                <span>แนบหลักฐานประกอบการสัมภาษณ์</span>
              </span>
              <span className="text-sm text-slate-600 font-normal block">
                ถ่ายภาพ/แนบโดย: <span className="font-semibold text-slate-800">{examinerName}</span>
              </span>
            </div>
            {registration.quota && (
              <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-normal text-sm shrink-0 shadow-xs">
                โควตา: {registration.quota}
              </span>
            )}
          </div>

          {/* Evidence photos list */}
          <div className="space-y-3">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                รูปถ่ายหลักฐาน ({allPhotos.length} รูป)
              </h3>
              <span className="text-sm text-slate-500 font-normal">คลิกที่รูปภาพเพื่อดูภาพขยาย</span>
            </div>

            {allPhotos.length === 0 ? (
              <p className="text-slate-500 text-sm font-normal text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                ยังไม่มีการแนบรูปถ่ายหลักฐานในระบบ
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {allPhotos.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setLightboxError(false);
                      setLightboxImg(url);
                    }}
                    className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-xs cursor-pointer hover:border-[#000946] transition-all"
                    title="คลิกเพื่อดูรูปขยาย"
                  >
                    <SafeEvidenceImage
                      src={url}
                      alt={`evidence-${idx}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-sm font-normal transition-opacity gap-1.5">
                      <SearchIcon className="w-4 h-4" />
                      <span>ดูรูปขยาย</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#000946] hover:bg-[#00125e] text-white text-sm font-normal rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[9999] p-4 cursor-zoom-out"
          onClick={() => {
            setLightboxImg(null);
            setLightboxError(false);
          }}
        >
          <div className="relative max-w-3xl max-h-[90vh] w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            {lightboxError ? (
              <div className="bg-slate-900 text-slate-300 p-8 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-2">
                <CameraIcon className="w-10 h-10 text-slate-500" />
                <p className="text-sm font-semibold">ไม่สามารถโหลดรูปภาพนี้ได้</p>
              </div>
            ) : (
              <img
                src={lightboxImg}
                alt="fullscreen"
                onError={() => setLightboxError(true)}
                className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-700"
              />
            )}
            <button
              type="button"
              onClick={() => {
                setLightboxImg(null);
                setLightboxError(false);
              }}
              className="mt-3 px-5 py-2 bg-white text-slate-900 text-sm font-normal rounded-full shadow-md hover:bg-slate-100 cursor-pointer"
            >
              ✕ ปิดรูปภาพ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
