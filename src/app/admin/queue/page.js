'use client';

import Link from 'next/link';

export default function AdminQueueIndexPage() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto font-sans">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
        <h1 className="text-base font-bold text-slate-900">ศูนย์จัดการระบบคิว (Queue Management Center)</h1>
        <p className="text-sm font-normal text-slate-500">
          เลือกโมดูลที่ต้องการดำเนินการระหว่างระบบเรียกคิวช่องบริการ หรือระบบสแกนแจกบัตรคิวนักเรียน
        </p>
      </div>

      {/* Grid of Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Module 1: Calling Console */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">ระบบเรียกคิว (Queue Calling Console)</h2>
              <p className="text-sm font-normal text-slate-500 mt-1">
                จัดการช่องบริการ เรียกคิวนักเรียนเข้ารับการสัมภาษณ์ แทรกคิว สลับสถานะ และแสดงผลบนจอประชาสัมพันธ์
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
            <Link
              href="/admin/queue/call"
              className="px-5 py-2.5 bg-[#000946] hover:bg-[#000c5a] text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <span>เข้าสู่ระบบเรียกคิว</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* Module 2: Scanner & Queue Dispenser */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">สแกนเนอร์รับคิว (Queue Scanner)</h2>
              <p className="text-sm font-normal text-slate-500 mt-1">
                สแกน QR Code หน้างานหรือค้นหาด้วยเลขบัตรประชาชน เพื่อเช็คอินและออกหมายเลขคิวอัตโนมัติ
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
            <Link
              href="/admin/queue/scanner"
              className="px-5 py-2.5 bg-[#000946] hover:bg-[#000c5a] text-white text-sm font-normal rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <span>เข้าสู่สแกนเนอร์รับคิว</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
