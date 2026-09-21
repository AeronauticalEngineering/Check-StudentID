'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, onSnapshot, limit } from 'firebase/firestore';
import { getStudentProfile } from '../lib/studentService';

const MOCK_PROFILE = {
  liffProfile: {
    userId: 'U_PC_USER_001',
    displayName: 'คุณทดสอบ (PC Mode)',
    pictureUrl: null
  },
  studentDbProfile: undefined
};

// Create the context object
export const StudentContext = createContext(null);

// Create a Provider component that will wrap our student layout
export function StudentProvider({ children }) {
  const [liffProfile, setLiffProfile] = useState(null);
  const [studentDbProfile, setStudentDbProfileState] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [liffObject, setLiffObject] = useState(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // Keep a ref of current nationalId to prevent unnecessary re-subscriptions
  const currentNatIdRef = useRef(null);
  const currentLineIdRef = useRef(null);

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

  const setStudentDbProfile = useCallback((profile) => {
    setStudentDbProfileState(profile);
    if (profile?.nationalId) {
      currentNatIdRef.current = profile.nationalId;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!liffProfile?.userId) return;
    try {
      const studentData = await getStudentProfile(liffProfile.userId, currentNatIdRef.current);
      setStudentDbProfileState(studentData || null);
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  }, [liffProfile]);

  // 1. Initialize LIFF
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
            currentLineIdRef.current = profileFromLiff.userId;
          } else {
            liff.login();
            return;
          }
        } else {
          console.warn('Running on PC / Web browser. Using MOCK LIFF PROFILE.');
          profileFromLiff = MOCK_PROFILE.liffProfile;
          setLiffProfile(profileFromLiff);
          currentLineIdRef.current = profileFromLiff.userId;
        }

        if (profileFromLiff) {
          const studentData = await fetchProfileFromDb(profileFromLiff);
          setStudentDbProfileState(studentData);
          if (studentData?.nationalId) {
            currentNatIdRef.current = studentData.nationalId;
          }
        }
        setIsLoading(false);
      } catch (err) {
        setError(`LIFF Error: ${err.message}`);
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // 2. Real-Time Firestore Listener for Student Profile
  // Whenever student profile is created, linked, or modified in Firestore, update state instantly across all student screens!
  useEffect(() => {
    if (!liffProfile?.userId) return;

    const unsubs = [];
    const lineUserId = liffProfile.userId;

    // A. Listener on Document ID = lineUserId
    const docRef = doc(db, 'studentProfiles', lineUserId);
    const unsubDoc = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setStudentDbProfileState(data);
        if (data.nationalId) currentNatIdRef.current = data.nationalId;
      }
    }, (err) => console.error('Student profile doc snapshot error:', err));
    unsubs.push(unsubDoc);

    // B. Listener on query by lineUserId field
    const qLine = query(collection(db, 'studentProfiles'), where('lineUserId', '==', lineUserId), limit(1));
    const unsubQueryLine = onSnapshot(qLine, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = { id: d.id, ...d.data() };
        setStudentDbProfileState(data);
        if (data.nationalId) currentNatIdRef.current = data.nationalId;
      }
    }, (err) => console.error('Student profile query line snapshot error:', err));
    unsubs.push(unsubQueryLine);

    // C. Listener on query by nationalId field (if known)
    if (studentDbProfile?.nationalId) {
      const qNat = query(collection(db, 'studentProfiles'), where('nationalId', '==', studentDbProfile.nationalId.trim()), limit(1));
      const unsubQueryNat = onSnapshot(qNat, (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0];
          const data = { id: d.id, ...d.data() };
          setStudentDbProfileState(data);
        }
      }, (err) => console.error('Student profile query nationalId snapshot error:', err));
      unsubs.push(unsubQueryNat);
    }

    return () => {
      unsubs.forEach(u => u());
    };
  }, [liffProfile?.userId, studentDbProfile?.nationalId]);

  const value = {
    liffObject,
    liffProfile,
    studentDbProfile,
    isLoading,
    error,
    setStudentDbProfile,
    refreshProfile,
    isLinkModalOpen,
    setIsLinkModalOpen
  };

  return (
    <StudentContext.Provider value={value}>
      {children}
    </StudentContext.Provider>
  );
}

// Custom hook for easy access to the context
export function useStudentContext() {
  return useContext(StudentContext);
}