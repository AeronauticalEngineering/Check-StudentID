'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNavbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // --- จุดที่แก้ไข: เพิ่ม "ข้อมูลนักเรียน" เข้าไปในเมนู ---
  const navLinks = [
    { name: 'แดชบอร์ดกิจกรรม', href: '/admin/activity' },
    { name: 'สแกนและค้นหา', href: '/admin/scanner' },
    { name: 'เรียกคิว', href: '/admin/queue/call' },
    { name: 'ผลประเมิน', href: '/admin/evaluation' },
    { name: 'ประวัติ', href: '/admin/history' },
    { name: 'ข้อมูล', href: '/admin/registrants' },
    { name: 'ตั้งค่า', href: '/admin/settings' },
  ];

  return (
    <nav className="bg-primary shadow-lg">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link href="/admin/activity" className="text-white font-bold text-xl">
              Admin Panel
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link key={link.name} href={link.href} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${isActive ? 'bg-card text-white' : 'text-gray-300 hover:bg-card hover:text-white'}`}>
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              type="button"
              className="bg-gray-800 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
            >
              <span className="sr-only">Open main menu</span>
              {!isOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link key={link.name} href={link.href} className={`block px-3 py-2 rounded-md text-base font-medium ${isActive ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>

  );
}