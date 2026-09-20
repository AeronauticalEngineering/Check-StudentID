'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useModal } from '../context/ModalContext';

const ROUTE_TITLES = {
  '/admin/activity': { title: 'แดชบอร์ดกิจกรรม', group: 'การจัดการกิจกรรม' },
  '/admin/activity/add': { title: 'เพิ่มกิจกรรมใหม่', group: 'การจัดการกิจกรรม' },
  '/admin/activity/register-student': { title: 'ลงทะเบียนนักเรียน (Admin)', group: 'การจัดการกิจกรรม' },
  '/admin/registrants': { title: 'ฐานข้อมูลผู้ลงทะเบียน & LINE ID', group: 'การจัดการกิจกรรม' },
  '/admin/scanner': { title: 'สแกนเนอร์ QR เช็คอิน / จบกิจกรรม', group: 'จุดบริการหน้างาน' },
  '/admin/queue/call': { title: 'ศูนย์ควบคุมการเรียกคิว', group: 'จุดบริการหน้างาน' },
  '/admin/queue/scanner': { title: 'สแกนเนอร์คิว', group: 'จุดบริการหน้างาน' },
  '/admin/evaluation': { title: 'รายงานผลการประเมินกิจกรรม', group: 'รายงานและการประเมิน' },
  '/admin/history': { title: 'ประวัติและ Audit Logs', group: 'รายงานและการประเมิน' },
  '/admin/settings': { title: 'ตั้งค่าระบบและการแจ้งเตือน', group: 'ระบบและการตั้งค่า' },
  '/admin/test-flex': { title: 'ทดสอบส่ง LINE Flex Message', group: 'ระบบและการตั้งค่า' }
};

export default function AdminHeader({
  onOpenMobile = () => {},
  isCollapsed = false,
  onToggleCollapse = () => {}
}) {
  const pathname = usePathname();
  const { currentUser, logout } = useAdminAuth();
  const { showConfirm } = useModal();
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateTime(
        now.toLocaleDateString('th-TH', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: 'ออกจากระบบ',
      message: 'คุณต้องการออกจากระบบผู้ดูแลหรือไม่?',
      type: 'warning',
      confirmText: 'ออกจากระบบ',
      cancelText: 'ยกเลิก',
    });

    if (confirmed) {
      setIsLoggingOut(true);
      try {
        await logout();
      } catch (err) {
        console.error('Logout error:', err);
      } finally {
        setIsLoggingOut(false);
      }
    }
  };


  let currentInfo = { title: 'ระบบจัดการ AERO Admin', group: 'Admin' };

  if (pathname) {
    if (ROUTE_TITLES[pathname]) {
      currentInfo = ROUTE_TITLES[pathname];
    } else if (pathname.startsWith('/admin/activity/seats')) {
      currentInfo = { title: 'จัดการที่นั่งและผู้สมัคร', group: 'การจัดการกิจกรรม' };
    } else if (pathname.startsWith('/admin/activity/edit')) {
      currentInfo = { title: 'แก้ไขข้อมูลกิจกรรม', group: 'การจัดการกิจกรรม' };
    } else if (pathname.startsWith('/admin/evaluation/')) {
      currentInfo = { title: 'รายงานสรุปแบบประเมิน', group: 'รายงานและการประเมิน' };
    } else if (pathname.startsWith('/admin/registrants/')) {
      currentInfo = { title: 'ประวัติการลงทะเบียนของนักเรียน', group: 'การจัดการกิจกรรม' };
    } else if (pathname.startsWith('/admin/queue/call/')) {
      currentInfo = { title: 'เรียกคิวประจำกิจกรรม', group: 'จุดบริการหน้างาน' };
    }
  }

  const adminEmail = currentUser?.email || 'Admin';

  return (
    <header className="h-12 px-4 md:px-6 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between">
      {/* Left: Mobile Hamburger & Breadcrumb */}
      <div className="flex items-center gap-2.5">
        {/* Mobile Toggle only */}
        <button
          onClick={onOpenMobile}
          className="flex md:hidden p-1 rounded text-slate-600 hover:bg-slate-100"
          aria-label="เปิดเมนู"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb Title */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>{currentInfo.group}</span>
          <span>/</span>
          <span className="text-slate-900 font-medium">{currentInfo.title}</span>
        </div>
      </div>

      {/* Right: Actions & User Info */}
      <div className="flex items-center gap-2">
        {currentDateTime && (
          <span className="hidden lg:inline-block text-xs text-slate-500 px-2 py-0.5 border border-slate-200 rounded bg-slate-50">
            {currentDateTime}
          </span>
        )}

        {/* QR Scanner Shortcut */}
        <Link
          href="/admin/scanner"
          className="p-1.5 rounded-lg text-slate-600 hover:text-[#ff741f] hover:bg-orange-50/50 border border-slate-200 hover:border-[#ff741f]/40 transition-colors"
          title="สแกนเนอร์ QR"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </Link>

        {/* Admin Badge & User Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 text-xs text-slate-700">
          <div className="flex items-center gap-1.5">
            <div className="w-6.5 h-6.5 rounded-lg bg-[#000946] text-white text-[10px] flex items-center justify-center font-bold shadow-xs">
              {adminEmail.substring(0, 2).toUpperCase()}
            </div>
            <span className="hidden xl:inline text-xs font-medium max-w-[140px] truncate" title={adminEmail}>
              {adminEmail}
            </span>
          </div>


          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="ออกจากระบบ (Logout)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

