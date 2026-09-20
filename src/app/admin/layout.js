'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminAuthProvider, useAdminAuth } from '../../context/AdminAuthContext';
import AdminSidebar from '../../components/AdminSidebar';
import AdminHeader from '../../components/AdminHeader';

function AdminLayoutContent({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, isLoading } = useAdminAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // If on login page, render full-screen login without admin chrome
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (!isLoading && !currentUser && !isLoginPage) {
      router.replace('/admin/login');
    }
  }, [currentUser, isLoading, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  // Hide layout chrome on kiosk / full-screen queue control screens
  if (pathname?.includes('/admin/queue/control/')) {
    return <div className="min-h-screen bg-gray-100">{children}</div>;
  }

  // Loading Screen while verifying Firebase Auth session
  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-400 text-xs">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <span>กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-400 font-sans text-slate-800">
      {/* Professional Grouped Sidebar */}
      <AdminSidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50/70">
        {/* Top Action Header */}
        <AdminHeader
          onOpenMobile={() => setIsMobileOpen(true)}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminAuthProvider>
  );
}