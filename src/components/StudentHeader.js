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
  const [imageError, setImageError] = useState(false);

  const navLinks = [
    { name: 'ค้นหากิจกรรม', href: '/student/activities' },
    { name: 'การลงทะเบียนของฉัน', href: '/student/my-registrations' },
  ];

  if (isLoading || !liffProfile) {
    return (
      <header className="bg-[#000946] p-4 shadow-md text-white animate-pulse">
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
      <header className="bg-gradient-to-r from-[#00062a] via-[#000946] to-[#00125e] p-4 shadow-lg text-white sticky top-0 z-40 font-sans border-b border-slate-800">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3.5">
              {(!liffProfile?.pictureUrl || imageError) ? (
                <div className="w-14 h-14 rounded-full border-2 border-[#ff741f] bg-[#00125e] text-white flex items-center justify-center shadow select-none shrink-0">
                  <svg className="w-8 h-8 text-white/90" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <img
                  src={liffProfile.pictureUrl}
                  alt={displayName || 'Profile'}
                  onError={() => setImageError(true)}
                  className="w-14 h-14 rounded-full border-2 border-[#ff741f] bg-slate-700 shadow object-cover shrink-0"
                />
              )}
              <div>
                <h1 className="font-bold text-lg text-white drop-shadow-sm">{displayName}</h1>
                <p className="text-sm font-normal text-white/80">{displaySubText}</p>
              </div>
            </div>
            
            {/* Show Edit button only if profile is set up */}
            {studentDbProfile && (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="bg-[#ff741f] hover:bg-[#e55e0b] text-white px-3.5 py-1.5 rounded-lg text-sm font-normal shadow transition-all flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>แก้ไข</span>
              </button>
            )}
          </div>

          <div className="flex justify-center bg-[#00062a]/70 border border-white/10 rounded-xl p-1 shadow-inner">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`w-1/2 text-center px-4 py-2.5 rounded-lg text-sm font-normal transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-[#000946] shadow-md font-bold'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

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