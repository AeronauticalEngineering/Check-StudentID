'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';


export const ADMIN_NAV_GROUPS = [


  {
    title: 'การจัดการกิจกรรม',
    items: [
      {
        name: 'แดชบอร์ดกิจกรรม',
        href: '/admin/activity',
        exact: true,
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        ),
        badge: null
      },
      {
        name: 'เพิ่มกิจกรรมใหม่',
        href: '/admin/activity/add',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        badge: 'ใหม่'
      },
      {
        name: 'ฐานข้อมูลผู้ลงทะเบียน',
        href: '/admin/registrants',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
        badge: null
      },
      {
        name: 'ลงทะเบียนนักเรียน',
        href: '/admin/activity/register-student',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        ),
        badge: null
      }
    ]
  },
  {
    title: 'จุดบริการหน้างาน',
    items: [
      {
        name: 'สแกนเนอร์ QR เช็คอิน',
        href: '/admin/scanner',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        ),
        badge: 'LIVE'
      },
      {
        name: 'ศูนย์ควบคุมการเรียกคิว',
        href: '/admin/queue/call',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        ),
        badge: null
      }
    ]
  },
  {
    title: 'รายงานและการประเมิน',
    items: [
      {
        name: 'รายงานผลการประเมิน',
        href: '/admin/evaluation',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        ),
        badge: null
      },
      {
        name: 'ประวัติและ Audit Logs',
        href: '/admin/history',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        badge: null
      }
    ]
  },
  {
    title: 'ระบบและการตั้งค่า',
    items: [
      {
        name: 'ตั้งค่าระบบ',
        href: '/admin/settings',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        badge: null
      },
      {
        name: 'ทดสอบ LINE Flex',
        href: '/admin/test-flex',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        ),
        badge: null
      }
    ]
  }
];

export default function AdminSidebar({
  isCollapsed = false,
  isMobileOpen = false,
  onCloseMobile = () => {},
  onToggleCollapse = () => {}
}) {
  const pathname = usePathname();

  const isLinkActive = (href, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    if (href === '/admin/activity') {
      return (
        pathname === '/admin/activity' ||
        pathname.startsWith('/admin/activity/seats') ||
        pathname.startsWith('/admin/activity/edit')
      );
    }
    return pathname.startsWith(href);
  };



  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0B1120] text-slate-200 select-none border-r border-slate-800/90 shadow-2xl">
      {/* Brand Header */}
      <div
        className={`h-16 flex items-center border-b border-slate-800/80 bg-[#070D1A] ${
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}
      >
        {!isCollapsed ? (
          <>
            <Link
              href="/admin/activity"
              className="flex items-center gap-2.5 min-w-0 group"
              onClick={onCloseMobile}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#000946] to-[#00125e] border border-slate-700 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                AE
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-white text-[15px] font-bold tracking-tight truncate leading-snug group-hover:text-orange-300 transition-colors">
                    AERO <span className="text-[#ff741f]">Admin</span>
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff741f]"></span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium leading-tight truncate">
                  Student Management
                </span>
              </div>
            </Link>

            {/* Collapse toggle (Desktop) */}
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
              title="ย่อเมนู"
              aria-label="ย่อเมนู"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </>
        ) : (

          /* When Collapsed: Single cleanly centered expand button */
          <button
            onClick={onToggleCollapse}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-800/70 text-slate-300 hover:text-white hover:bg-[#ff741f]/20 hover:border-[#ff741f]/40 border border-slate-700/60 transition-all active:scale-95 cursor-pointer"
            title="ขยายเมนู"
            aria-label="ขยายเมนู"
          >
            <svg
              className="w-4 h-4 rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="flex md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="ปิดเมนู"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Direct Scrollbar Styles */}
      <style>{`
        .admin-sidebar-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .admin-sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .admin-sidebar-scroll::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 9999px;
        }
        .admin-sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: #ff741f;
        }
        .admin-sidebar-scroll::-webkit-scrollbar-button {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>

      {/* Navigation Group Items */}
      <div
        className={`flex-1 overflow-y-auto py-4 space-y-5 admin-sidebar-scroll ${
          isCollapsed ? 'px-2' : 'px-3'
        }`}
      >
        {ADMIN_NAV_GROUPS.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1.5">
            {!isCollapsed ? (
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400/90 tracking-wider uppercase">
                {group.title}
              </div>
            ) : (
              <div className="h-px bg-slate-800 my-2 mx-1" title={group.title} />
            )}

            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isLinkActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={`group relative flex items-center rounded-xl transition-all duration-150 ease-in-out ${
                      isCollapsed
                        ? `w-12 h-12 mx-auto justify-center ${
                            active
                              ? 'bg-[#ff741f]/20 text-[#ff8e47] border border-[#ff741f]/40 shadow-sm shadow-[#ff741f]/10'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                          }`
                        : `gap-3 px-3.5 py-3 min-h-[42px] text-[13px] ${
                            active
                              ? 'bg-gradient-to-r from-[#ff741f]/20 via-[#ff741f]/10 to-transparent text-orange-200 font-semibold border-l-[3px] border-[#ff741f] shadow-xs'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/60 hover:translate-x-0.5'
                          }`
                    }`}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <span
                      className={`flex-shrink-0 transition-colors ${
                        active
                          ? 'text-[#ff741f]'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      {item.icon}
                    </span>

                    {!isCollapsed && (
                      <span className="truncate flex-1 tracking-normal font-medium">
                        {item.name}
                      </span>
                    )}

                    {!isCollapsed && item.badge && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.badge === 'LIVE'
                            ? 'bg-[#ff741f]/20 text-[#ff8e47] border border-[#ff741f]/40 animate-pulse'
                            : 'bg-[#ff741f]/20 text-[#ff8e47] border border-[#ff741f]/40'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: Student Portal Link */}
      <div className="p-3 border-t border-slate-800/80 bg-[#070D1A]">
        {/* Student Portal Link */}
        <Link
          href="/student/activities"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-medium text-slate-300 bg-slate-800/70 border border-slate-700/60 hover:bg-[#ff741f]/20 hover:border-[#ff741f]/40 hover:text-white transition-all active:scale-[0.98] ${
            isCollapsed ? 'justify-center px-1 h-11' : 'justify-between'
          }`}
          title="เปิดหน้านักเรียน (Student Portal)"
        >
          <div className="flex items-center gap-2 truncate">
            <svg
              className="w-4 h-4 flex-shrink-0 text-teal-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            {!isCollapsed && <span>มุมมองนักเรียน</span>}
          </div>
          {!isCollapsed && (
            <span className="text-[11px] text-slate-400 font-bold">↗</span>
          )}
        </Link>
      </div>



    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block transition-all duration-200 h-screen z-30 flex-shrink-0 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

