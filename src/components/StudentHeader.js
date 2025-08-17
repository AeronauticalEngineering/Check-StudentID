'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import useLiff from '../hooks/useLiff';
import Image from 'next/image';
import EditProfileModal from './student/EditProfileModal';

// --- Main Header Component ---
export default function StudentHeader() {
  const { liffProfile, studentDbProfile, isLoading, refreshProfile } = useLiff();
  const pathname = usePathname();
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const navLinks = [
    { name: 'ค้นหากิจกรรม', href: '/student/activities' },
    { name: 'การลงทะเบียนของฉัน', href: '/student/my-registrations' },
  ];

  if (isLoading || !liffProfile) {
    return (
      <header className="bg-primary p-4 shadow-md text-white animate-pulse">
        <div className="max-w-4xl mx-auto"><div className="h-28"></div></div>
      </header>
    );
  }

  const displayName = studentDbProfile?.fullName || liffProfile?.displayName;
  const displaySubText = studentDbProfile?.studentId ? `ID: ${studentDbProfile.studentId}` : "ยังไม่ตั้งค่าโปรไฟล์";

  const handleProfileUpdated = (updatedProfile) => {
    refreshProfile(); // รีเฟรชข้อมูลจาก useLiff hook
    setIsEditingProfile(false);
  };

  return (
    <>
      <header className="bg-primary p-4 shadow-md text-white sticky top-0 z-40 font-sans">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Image
                  src={liffProfile?.pictureUrl}
                  alt={displayName || 'Profile'}
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-full border-2 border-white/80 bg-gray-400"
              />
              <div>
                <h1 className="font-bold text-lg">{displayName}</h1>
                <p className="text-xs text-white/80">{displaySubText}</p>
              </div>
            </div>
            
            {/* ปุ่มแก้ไขโปรไฟล์ */}
            <button
              onClick={() => setIsEditingProfile(true)}
              className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              แก้ไข
            </button>
          </div>

          <div className="flex justify-center bg-black/40 rounded-lg p-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.name} href={link.href} className={`w-1/2 text-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${isActive ? 'bg-white text-primary shadow' : 'text-white/80 hover:bg-white/10'}`}>
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Modal แก้ไขโปรไฟล์ */}
      {isEditingProfile && (
        <EditProfileModal 
          currentProfile={studentDbProfile}
          liffProfile={liffProfile}
          onProfileUpdated={handleProfileUpdated}
          onCancel={() => setIsEditingProfile(false)}
        />
      )}
    </>
  );
}