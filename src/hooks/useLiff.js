'use client';

import { useContext } from 'react';
import { StudentContext } from '../context/StudentContext';
import { useState, useEffect } from 'react';
import { getStudentProfile } from '../lib/studentService';

const MOCK_PROFILE = {
  liffProfile: {
    userId: 'U_PC_USER_001',
    displayName: 'คุณทดสอบ (PC Mode)',
    pictureUrl: null
  },
  studentDbProfile: undefined
};

export default function useLiff() {
  const context = useContext(StudentContext);

  // If inside StudentProvider, use the shared real-time synchronized context
  if (context) {
    return context;
  }

  // Fallback standalone hook when used outside StudentProvider
  return useStandaloneLiff();
}

function useStandaloneLiff() {
  const [liffProfile, setLiffProfile] = useState(null);
  const [studentDbProfile, setStudentDbProfile] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [liffObject, setLiffObject] = useState(null);

  const fetchProfileFromDb = async (profileFromLiff) => {
    if (!profileFromLiff?.userId) return null;
    try {
      const studentData = await getStudentProfile(profileFromLiff.userId);
      return studentData || null;
    } catch (err) {
      console.error('Error fetching student profile:', err);
      setError('เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์');
      return null;
    }
  };

  const refreshProfile = async () => {
    setIsLoading(true);
    setError('');
    try {
      let profileFromLiff = null;
      const liff = (await import('@line/liff')).default;
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) throw new Error('LIFF ID is not defined');
      await liff.init({ liffId });
      setLiffObject(liff);

      if (liff.isInClient()) {
        if (liff.isLoggedIn()) {
          profileFromLiff = await liff.getProfile();
          setLiffProfile(profileFromLiff);
        } else {
          liff.login();
          return;
        }
      } else {
        profileFromLiff = MOCK_PROFILE.liffProfile;
        setLiffProfile(profileFromLiff);
      }

      if (profileFromLiff) {
        const studentData = await fetchProfileFromDb(profileFromLiff);
        setStudentDbProfile(studentData);
      }
      setIsLoading(false);
    } catch (err) {
      setError(`LIFF Error: ${err.message}`);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      let profileFromLiff = null;

      try {
        const liff = (await import('@line/liff')).default;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) throw new Error('LIFF ID is not defined');

        await liff.init({ liffId });
        setLiffObject(liff);

        if (liff.isInClient()) {
          if (liff.isLoggedIn()) {
            profileFromLiff = await liff.getProfile();
            setLiffProfile(profileFromLiff);
          } else {
            liff.login();
            return;
          }
        } else {
          console.warn('Running on PC / Web browser. Using MOCK LIFF PROFILE.');
          profileFromLiff = MOCK_PROFILE.liffProfile;
          setLiffProfile(profileFromLiff);
        }

        if (profileFromLiff) {
          const studentData = await fetchProfileFromDb(profileFromLiff);
          setStudentDbProfile(studentData);
        }
        setIsLoading(false);
      } catch (err) {
        setError(`LIFF Error: ${err.message}`);
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  return { liffObject, liffProfile, studentDbProfile, isLoading, error, setStudentDbProfile, refreshProfile };
}