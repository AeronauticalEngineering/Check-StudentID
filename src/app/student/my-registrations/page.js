'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import useLiff from '../../../hooks/useLiff';
import { QRCodeSVG } from 'qrcode.react';
import ProfileSetupForm from '../../../components/student/ProfileSetupForm';
import Link from 'next/link';

const QRModal = ({ qrData, onClose }) => {
  if (!qrData) return null;
  const payload = typeof qrData === 'string' ? { registrationId: qrData, isCheckOut: false } : qrData;
  const { registrationId, title, isCheckOut, hasEvaluated, activityId, enableEvaluation } = payload;
  const needsEval = !hasEvaluated && enableEvaluation !== false;
  const qrValue = isCheckOut
    ? JSON.stringify({ registrationId, action: 'check-out', activityId })
    : registrationId;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white p-6 rounded-2xl shadow-2xl text-center border border-slate-100 max-w-sm w-full space-y-4 font-sans" onClick={e => e.stopPropagation()}>
        <div className="space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-[#000946] mb-1">
            {isCheckOut ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            )}
          </div>
          <h3 className="font-bold text-slate-900 text-base">
            {title || (isCheckOut ? 'QR Code สแกนจบกิจกรรม (ทางออก)' : 'QR Code เช็คอินเข้างาน')}
          </h3>
          <p className="text-sm font-normal text-slate-500 leading-relaxed">
            {isCheckOut
              ? 'แสดง QR Code นี้กับเจ้าหน้าที่จุดทางออกเพื่อสแกนจบกิจกรรม'
              : 'แสดง QR Code นี้กับเจ้าหน้าที่จุดลงทะเบียนเพื่อเช็คอิน'}
          </p>
        </div>

        <div className="inline-block p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <QRCodeSVG value={qrValue} size={220} />
        </div>

        {/* Notice about evaluation if check-out */}
        {isCheckOut && needsEval && (
          <div className="bg-orange-50/80 border border-[#ff741f]/30 rounded-xl p-3.5 text-left space-y-2.5">
            <div className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-slate-800">
                <span className="font-semibold block text-slate-900">ต้องทำแบบประเมินก่อนจบกิจกรรม</span>
                <span className="text-slate-600 font-normal text-sm leading-relaxed block mt-0.5">
                  เจ้าหน้าที่จะตรวจสอบผลการประเมินที่จุดทางออก หากยังไม่ได้ประเมินจะไม่สามารถจบกิจกรรมได้
                </span>
              </div>
            </div>
            {activityId && (
              <Link
                href={`/student/evaluation/${activityId}`}
                onClick={onClose}
                className="w-full py-2.5 bg-[#ff741f] hover:bg-[#e55e0b] text-white text-sm font-normal rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-98"
              >
                <span>ทำแบบประเมินเดี๋ยวนี้</span>
              </Link>
            )}
          </div>
        )}

        {isCheckOut && !needsEval && enableEvaluation !== false && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center text-sm font-normal text-emerald-800 flex items-center justify-center gap-1.5">
            <span className="font-bold">✓</span>
            <span>ทำแบบประเมินเรียบร้อยแล้ว ยื่นให้เจ้าหน้าที่สแกนออกได้เลย</span>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-normal rounded-xl text-sm transition-colors cursor-pointer"
        >
          ปิด
        </button>
      </div>
    </div>
  );
};
const CheckmarkIcon = ({ className }) => (
  <svg className={`w-5 h-5 ${className}`} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
);
const TicketIcon = () => (
  <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
      d="M5 10V8a2 2 0 012-2h10a2 2 0 012 2v2M5 10h14M5 10v8a1 1 0 001 1h1m0 0v2m0-2h10m0 0v2m0-2h1a1 1 0 001-1v-8" />
  </svg>
);

const RegistrationCard = ({ reg, activities, courses, onShowQr, hasEvaluated }) => {
  const activity = activities[reg.activityId];
  const course = activity ? courses[activity.categoryId] : null;
  if (!activity) return null;
  const activityDate = activity.activityDate?.toDate ? activity.activityDate.toDate() : (activity.activityDate ? new Date(activity.activityDate) : null);

  const isQueueType = activity.type === 'queue' || activity.type === 'interview';
  const isSeatType = activity.type === 'exam' || activity.type === 'graduation';
  const isGeneralEvent = !isQueueType && !isSeatType;

  const isExaminerDone = reg.queueStatus === 'completed' || reg.interviewedAt || (reg.status === 'completed' && !reg.checkedOut && !reg.checkedOutAt);
  const isCheckedOut = reg.checkedOut || reg.checkedOutAt;

  const getStatusDisplay = () => {
    if (isCheckedOut) {
      return <><CheckmarkIcon className="text-emerald-600 shrink-0" /> <span className="text-emerald-600 font-normal text-sm">จบกิจกรรมแล้ว</span></>;
    }
    if (isExaminerDone) {
      return <><CheckmarkIcon className="text-blue-600 shrink-0" /> <span className="text-blue-600 font-normal text-sm">สัมภาษณ์เสร็จสิ้น (รอสแกนออก)</span></>;
    }
    switch (reg.status) {
      case 'checked-in': return <><CheckmarkIcon className="text-emerald-600 shrink-0" /> <span className="text-emerald-600 font-normal text-sm">เช็คอินแล้ว</span></>;
      case 'interviewing': return <><CheckmarkIcon className="text-indigo-600 shrink-0" /> <span className="text-indigo-600 font-normal text-sm">{isQueueType ? 'เข้าสอบสัมภาษณ์' : 'เข้าร่วมกิจกรรม'}</span></>;
      case 'completed': return <><CheckmarkIcon className="text-blue-600 shrink-0" /> <span className="text-blue-600 font-normal text-sm">จบกิจกรรมแล้ว</span></>;
      default: return <><CheckmarkIcon className="text-amber-600 shrink-0" /> <span className="text-amber-600 font-normal text-sm">ลงทะเบียนแล้ว</span></>;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden border border-slate-200 font-sans">
      {isGeneralEvent ? (
        /* กิจกรรมทั่วไป (General Event): ดีไซน์ประหยัดพื้นที่ แถบแนวนอนกะทัดรัด */
        <div className="w-full bg-gradient-to-r from-[#00062a] via-[#000946] to-[#00125e] text-white px-4 py-3 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-4 h-4 text-white/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-semibold whitespace-nowrap">
              {activityDate ? activityDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
            </span>
            <span className="text-sm font-normal text-orange-200 bg-black/30 px-2.5 py-0.5 rounded-full whitespace-nowrap">
              {reg.timeSlot || (activityDate ? activityDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : 'ตามกำหนดการ')}
            </span>
          </div>

          {activity.location && (
            <div className="flex items-center gap-1.5 text-sm font-normal text-white/90 min-w-0 max-w-[190px] shrink-0 justify-end">
              <svg className="w-3.5 h-3.5 text-white/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{activity.location}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full bg-gradient-to-br from-[#00062a] via-[#000946] to-[#00125e] text-white flex flex-col justify-center items-center py-5 px-6 text-center shadow-inner">
          {isQueueType ? (
            reg.displayQueueNumber ? (
              <>
                <span className="text-sm font-normal text-white/90">คิวของคุณ</span>
                <span className="text-5xl font-black tracking-wider text-white drop-shadow-sm my-1">{reg.displayQueueNumber}</span>
              </>
            ) : (
              <>
                <span className="text-sm font-normal text-white/90">เวลาสอบสัมภาษณ์</span>
                <span className="text-3xl font-bold tracking-wider my-1 text-white">
                  {reg.timeSlot || (activityDate ? activityDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '-')}
                </span>
                <span className="text-sm font-normal text-orange-300">รอรับคิวเมื่อเช็คอิน</span>
              </>
            )
          ) : (
            reg.seatNumber ? (
              <Link href={`/student/activity/${reg.activityId}/chart?seat=${reg.seatNumber}`} className="flex flex-col items-center hover:opacity-90 transition-opacity group">
                <span className="text-sm font-normal text-white/90">เลขที่นั่งของคุณ</span>
                <span className="text-5xl font-black tracking-wider underline decoration-dotted decoration-2 underline-offset-4 group-hover:text-orange-300 text-white my-1">{reg.seatNumber}</span>
                <span className="text-sm mt-2 bg-white/20 px-3.5 py-1 rounded-full flex items-center gap-1.5 text-white font-normal">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  กดเพื่อดูผัง
                </span>
              </Link>
            ) : (
              <><TicketIcon /><span className="text-sm font-normal mt-2">ยังไม่ได้รับที่นั่ง</span></>
            )
          )}
        </div>
      )}
      <div className="flex flex-col flex-grow min-w-0">
        <div className="p-4 sm:p-5 flex-grow relative">
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-1.5 text-sm min-w-0">{getStatusDisplay()}</div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {/* ปุ่ม QR เช็คอิน - แสดงเฉพาะสถานะ registered */}
              {reg.status === 'registered' && (
                <button
                  type="button"
                  onClick={() => onShowQr({
                    registrationId: reg.id,
                    title: 'QR Code เช็คอินเข้างาน',
                    isCheckOut: false
                  })}
                  className="px-3.5 py-1.5 bg-[#000946] text-white text-sm font-normal rounded-full hover:bg-[#00125e] transition-all active:scale-95 whitespace-nowrap shadow-xs cursor-pointer"
                >
                  QR เช็คอิน
                </button>
              )}

              {/* ข้อความ รอเรียกคิว - แสดงเมื่อ checked-in + กิจกรรมคิว และยังไม่ถูกเรียก */}
              {reg.status === 'checked-in' && isQueueType && !isExaminerDone && (
                <span className="px-3.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 text-sm font-normal rounded-full whitespace-nowrap">
                  รอเรียกคิว
                </span>
              )}

              {/* สำหรับผู้ที่พร้อมจบกิจกรรม (สัมภาษณ์เสร็จ / กิจกรรมทั่วไป) */}
              {(isExaminerDone || reg.status === 'interviewing' || (reg.status === 'checked-in' && !isQueueType)) && !isCheckedOut && (
                <>
                  {/* หากยังไม่ได้ประเมิน: แสดงเฉพาะปุ่มประเมินกิจกรรมก่อน */}
                  {!hasEvaluated && (activity.enableEvaluation === true || activity.enableEvaluation === undefined) ? (
                    <Link
                      href={`/student/evaluation/${reg.activityId}`}
                      className="px-3.5 py-1.5 bg-[#ff741f] hover:bg-[#e55e0b] text-white text-sm font-normal rounded-full transition-all active:scale-98 whitespace-nowrap shadow-xs flex items-center gap-1"
                    >
                      <span>ประเมินกิจกรรม</span>
                    </Link>
                  ) : (
                    /* เมื่อประเมินเรียบร้อยแล้ว (หรือกิจกรรมไม่ต้องประเมิน): จึงแสดงปุ่ม QR code ออก */
                    <>
                      <button
                        type="button"
                        onClick={() => onShowQr({
                          registrationId: reg.id,
                          title: 'QR Code สแกนจบกิจกรรม (ทางออก)',
                          isCheckOut: true,
                          hasEvaluated,
                          activityId: reg.activityId,
                          enableEvaluation: activity.enableEvaluation !== false
                        })}
                        className="px-3.5 py-1.5 bg-[#000946] text-white text-sm font-normal rounded-full hover:bg-[#00125e] transition-all active:scale-95 whitespace-nowrap shadow-xs cursor-pointer"
                      >
                        QR code ออก
                      </button>

                      {hasEvaluated && (activity.enableEvaluation === true || activity.enableEvaluation === undefined) && (
                        <span className="text-sm text-emerald-700 font-normal flex items-center gap-1">
                          <span>✓</span>
                          <span>ประเมินแล้ว</span>
                        </span>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-2 line-clamp-2">{activity.name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-sm text-slate-500 font-normal truncate">{course?.name || reg.course || 'ทั่วไป'}</span>
            {reg.quota && (
              <span className="text-sm bg-indigo-50 text-indigo-700 font-normal px-2.5 py-0.5 rounded-lg border border-indigo-100">
                โควตา: {reg.quota}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CompletedRegistrationCard = ({ reg, activities, courses, hasEvaluated, onShowQr }) => {
  const activity = activities[reg.activityId];
  const course = activity ? courses[activity.categoryId] : null;
  if (!activity) return null;
  const activityDate = activity.activityDate?.toDate ? activity.activityDate.toDate() : null;

  const isQueueType = activity.type === 'queue' || activity.type === 'interview';
  const isSeatType = activity.type === 'exam' || activity.type === 'graduation';

  // สำหรับกิจกรรมทั่วไป จะไม่มีคิว และไม่มีเลขที่นั่ง
  const queueOrSeat = isQueueType && reg.displayQueueNumber
    ? `คิว ${reg.displayQueueNumber}`
    : isSeatType && reg.seatNumber
    ? `ที่นั่ง ${reg.seatNumber}`
    : null;

  const needsEvaluation = !hasEvaluated && (activity.enableEvaluation === true || activity.enableEvaluation === undefined);
  const isCheckedOut = reg.checkedOut || reg.checkedOutAt;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-colors font-sans">
      {/* Top Header Bar */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">
            จบกิจกรรมแล้ว
          </span>
          {activityDate && (
            <span className="text-sm text-slate-500 font-normal">
              • {activityDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
          )}
        </div>

        {queueOrSeat && (
          <span className="font-semibold text-sm px-3 py-0.5 rounded-full bg-orange-50 text-[#c24f04] border border-[#ff741f]/30">
            {queueOrSeat}
          </span>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Activity Title & Course */}
        <div>
          <h3 className="text-base font-bold text-slate-900 leading-snug">
            {activity.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-slate-500 font-normal">
            <span>{course?.name || reg.course || 'ทั่วไป'}</span>
            {reg.quota && (
              <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-sm font-normal">
                โควตา: {reg.quota}
              </span>
            )}
          </div>
        </div>

        {/* Complete Details Grid (สถานที่, เวลา, ผังที่นั่ง) */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-500 block text-sm font-normal mb-0.5">สถานที่จัดกิจกรรม</span>
            <span className="font-normal text-slate-800 truncate block">
              {activity.location || 'ไม่ระบุสถานที่'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-sm font-normal mb-0.5">เวลาจัดกิจกรรม</span>
            <span className="font-normal text-slate-800 block">
              {reg.timeSlot || (activityDate ? activityDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '-')}
            </span>
          </div>

          {isSeatType && reg.seatNumber && (
            <div className="col-span-2 sm:col-span-1 pt-1.5 border-t border-slate-200/60 sm:border-t-0 sm:pt-0">
              <span className="text-slate-500 block text-sm font-normal mb-0.5">ผังที่นั่ง</span>
              <Link
                href={`/student/activity/${reg.activityId}/chart?seat=${reg.seatNumber}`}
                className="font-normal text-[#000946] hover:text-[#ff741f] underline inline-flex items-center gap-1"
              >
                <span>ดูตำแหน่งที่นั่ง ({reg.seatNumber})</span>
                <span>→</span>
              </Link>
            </div>
          )}
        </div>

        {/* Actions: Evaluation & QR code ออก */}
        <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
          {needsEvaluation ? (
            <Link
              href={`/student/evaluation/${reg.activityId}`}
              className="flex-1 py-2.5 px-4 bg-[#ff741f] hover:bg-[#e55e0b] text-white text-sm font-normal rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-98"
            >
              <span>ทำแบบประเมินกิจกรรม</span>
            </Link>
          ) : (
            (activity.enableEvaluation === true || activity.enableEvaluation === undefined) && (
              <div className="flex-1 py-2.5 px-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-sm font-normal text-emerald-700 flex items-center justify-center gap-1.5">
                <span className="font-bold">✓</span>
                <span>ทำแบบประเมินเรียบร้อยแล้ว</span>
              </div>
            )
          )}

          {onShowQr && !isCheckedOut && (
            <button
              type="button"
              onClick={() => onShowQr({
                registrationId: reg.id,
                title: 'QR Code สแกนจบกิจกรรม (ทางออก)',
                isCheckOut: true,
                hasEvaluated,
                activityId: reg.activityId,
                enableEvaluation: activity.enableEvaluation !== false
              })}
              className="py-2.5 px-4 bg-[#000946] hover:bg-[#00125e] text-white text-sm font-normal rounded-xl transition-all shadow-xs flex items-center justify-center active:scale-98 cursor-pointer"
            >
              QR code ออก
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function MyRegistrationsPage() {
  const { liffProfile, studentDbProfile, isLoading, error, setStudentDbProfile } = useLiff();

  const [registrations, setRegistrations] = useState([]);
  const [activities, setActivities] = useState({});
  const [courses, setCourses] = useState({});
  const [evaluatedActivities, setEvaluatedActivities] = useState(new Set());
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [visibleQrData, setVisibleQrData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [activitiesSnap, coursesSnap] = await Promise.all([
          getDocs(collection(db, 'activities')),
          getDocs(collection(db, 'courses'))
        ]);

        const actMap = {};
        activitiesSnap.forEach(doc => { actMap[doc.id] = doc.data(); });
        setActivities(actMap);

        const courseMap = {};
        coursesSnap.forEach(doc => { courseMap[doc.id] = doc.data(); });
        setCourses(courseMap);
      } catch (err) {
        console.error("Error fetching base data:", err);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (isLoading || isLoadingData || (!liffProfile?.userId && !studentDbProfile?.nationalId)) return;

    const unsubs = [];
    const evaluatedSet = new Set();

    const updateEvals = () => {
      setEvaluatedActivities(new Set(evaluatedSet));
    };

    if (liffProfile?.userId) {
      const qUser = query(collection(db, 'evaluations'), where('userId', '==', liffProfile.userId));
      unsubs.push(onSnapshot(qUser, (snap) => {
        snap.forEach(d => {
          if (d.data()?.activityId) evaluatedSet.add(d.data().activityId);
        });
        updateEvals();
      }));
    }

    if (studentDbProfile?.nationalId) {
      const qNat = query(collection(db, 'evaluations'), where('nationalId', '==', studentDbProfile.nationalId));
      unsubs.push(onSnapshot(qNat, (snap) => {
        snap.forEach(d => {
          if (d.data()?.activityId) evaluatedSet.add(d.data().activityId);
        });
        updateEvals();
      }));
    }

    return () => unsubs.forEach(u => u());
  }, [liffProfile, studentDbProfile, isLoading, isLoadingData]);

  useEffect(() => {
    if (isLoading || isLoadingData || (!liffProfile && !studentDbProfile)) {
      return;
    }

    // Auto-sync unlinked registrations in the background
    const syncUnlinkedRegistrations = async () => {
      if (studentDbProfile && studentDbProfile.nationalId && liffProfile && liffProfile.userId) {
        try {
          const q = query(
            collection(db, 'registrations'),
            where('nationalId', '==', studentDbProfile.nationalId)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const batch = writeBatch(db);
            let updateCount = 0;
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data.lineUserId !== liffProfile.userId) {
                batch.update(doc.ref, { lineUserId: liffProfile.userId });
                updateCount++;
              }
            });
            if (updateCount > 0) {
              await batch.commit();
              console.log(`Auto-synced ${updateCount} registrations.`);
            }
          }
        } catch (error) {
          console.error("Error syncing registrations:", error);
        }
      }
    };
    syncUnlinkedRegistrations();

    const registrationsRef = collection(db, 'registrations');
    const userRegsMap = new Map();
    const unsubs = [];

    const handleUpdate = () => {
      setRegistrations(Array.from(userRegsMap.values()));
    };

    if (studentDbProfile?.nationalId) {
      const qNat = query(
        registrationsRef,
        where('nationalId', '==', studentDbProfile.nationalId.trim())
      );
      const unsubNat = onSnapshot(qNat, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            userRegsMap.delete(change.doc.id);
          } else {
            userRegsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          }
        });
        handleUpdate();
      });
      unsubs.push(unsubNat);
    }

    if (liffProfile?.userId) {
      const qLine = query(
        registrationsRef,
        where('lineUserId', '==', liffProfile.userId)
      );
      const unsubLine = onSnapshot(qLine, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            userRegsMap.delete(change.doc.id);
          } else {
            userRegsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          }
        });
        handleUpdate();
      });
      unsubs.push(unsubLine);
    }

    return () => {
      unsubs.forEach(u => u());
    };
  }, [studentDbProfile, liffProfile, isLoading, isLoadingData]);
  if (isLoading || isLoadingData) return <div className="text-center p-10 font-sans">กำลังโหลดข้อมูล...</div>;
  if (error) return <div className="p-4 text-center text-red-500 bg-red-100 font-sans">{error}</div>;

  if (studentDbProfile === null) {
    return (
      <ProfileSetupForm liffProfile={liffProfile} onProfileCreated={setStudentDbProfile} />
    );
  }

  const now = new Date();

  const sortedRegistrations = [...registrations].sort((a, b) => {
    const actA = activities[a.activityId];
    const actB = activities[b.activityId];
    const timeA = actA?.activityDate?.seconds || 0;
    const timeB = actB?.activityDate?.seconds || 0;
    return timeB - timeA;
  });

  const isActivityEnded = (reg) => {
    // หากสแกนจบกิจกรรมที่ทางออกเรียบร้อยแล้ว ถือว่าจบกิจกรรมอย่างเป็นทางการ
    if (reg.checkedOut || reg.checkedOutAt) return true;

    // ตรวจสอบวันจัดกิจกรรม หากพ้นกำหนดวันจัดกิจกรรมไปแล้ว (หลังเที่ยงคืน) ถือว่าสิ้นสุดแล้ว
    const activity = activities[reg.activityId];
    if (!activity) return false;
    if (!activity.activityDate?.toDate) return false;
    const dt = activity.activityDate.toDate();
    const endOfDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);
    if (endOfDay < now) return true;

    // สำหรับกิจกรรมวันนี้หรือข้างหน้า แม้กรรมการจะบันทึกผลเสร็จแล้ว นักเรียนยังอยู่ที่หน้างาน
    // ต้องแสดงบัตรที่หน้าแรกเพื่อให้เข้าถึง "QR code ออก" และ "ประเมินกิจกรรม" ได้สะดวก
    return false;
  };

  const upcomingRegistrations = sortedRegistrations.filter(reg => {
    const activity = activities[reg.activityId];
    if (!activity) return false;
    return !isActivityEnded(reg);
  });

  const completedRegistrations = sortedRegistrations.filter(reg => {
    const activity = activities[reg.activityId];
    if (!activity) return false;
    return isActivityEnded(reg);
  });

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
      {visibleQrData && <QRModal qrData={visibleQrData} onClose={() => setVisibleQrData(null)} />}


      {sortedRegistrations.length === 0 ? (
        <div className="text-center py-14 px-5 bg-white rounded-2xl border border-slate-200 font-sans">
          <div className="w-14 h-14 mx-auto mb-3.5 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">ยังไม่มีกิจกรรมที่ลงทะเบียน</h3>
          <p className="text-sm font-normal text-slate-500 mb-5">คุณยังไม่ได้ลงทะเบียนเข้าร่วมกิจกรรมใดๆ ในขณะนี้</p>
          <Link
            href="/student/activities"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#000946] hover:bg-[#00125e] text-white text-sm font-normal rounded-xl transition-all shadow-xs active:scale-95"
          >
            <span>ดูกิจกรรมที่เปิดรับสมัคร</span>
            <span>→</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-6 font-sans">
          {/* Section 1: Active / Upcoming Tickets */}
          {upcomingRegistrations.length > 0 ? (
            <div className="space-y-4">
              {upcomingRegistrations.map(reg => (
                <RegistrationCard
                  key={reg.id}
                  reg={reg}
                  activities={activities}
                  courses={courses}
                  onShowQr={setVisibleQrData}
                  hasEvaluated={evaluatedActivities.has(reg.activityId)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
              <p className="text-sm font-normal text-slate-600">ไม่มีกิจกรรมที่ต้องเข้าร่วมในขณะนี้</p>
              <Link
                href="/student/activities"
                className="text-sm font-normal text-[#000946] hover:text-[#ff741f] hover:underline inline-flex items-center gap-1 mt-1.5"
              >
                <span>ค้นหากิจกรรมเปิดรับสมัครใหม่</span>
                <span>→</span>
              </Link>
            </div>
          )}

          {/* Section 2: Completed Activities */}
          {completedRegistrations.length > 0 && (
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                  กิจกรรมที่สิ้นสุดแล้ว
                </span>
                <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {completedRegistrations.length}
                </span>
              </div>

              <div className="space-y-3.5">
                {completedRegistrations.map(reg => (
                  <CompletedRegistrationCard
                    key={reg.id}
                    reg={reg}
                    activities={activities}
                    courses={courses}
                    hasEvaluated={evaluatedActivities.has(reg.activityId)}
                    onShowQr={setVisibleQrData}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
