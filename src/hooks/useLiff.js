'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const MOCK_PROFILE = {
    // โปรไฟล์จำลองจาก LINE
    liffProfile: {
        userId: 'U_PC_USER_001',
        displayName: 'คุณทดสอบ (PC Mode)',
        pictureUrl: 'https://via.placeholder.com/150'
    },
    // โปรไฟล์จำลองจาก DB (เราจะปล่อยเป็น undefined เพื่อให้ระบบไปค้นหาจริง)
    studentDbProfile: undefined 
};

export default function useLiff() {
  const [liffProfile, setLiffProfile] = useState(null);
  const [studentDbProfile, setStudentDbProfile] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [liffObject, setLiffObject] = useState(null);

  useEffect(() => {
    let unsubscribeFromProfile = () => {};

    const initialize = async () => {
      let profileFromLiff = null;

      try {
        const liff = (await import('@line/liff')).default;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) throw new Error("LIFF ID is not defined");
        
        await liff.init({ liffId });
        setLiffObject(liff);

        // --- 👇 ส่วน Logic ที่ปรับปรุงใหม่ ---
        if (liff.isInClient()) {
          // กรณีเปิดในแอป LINE
          if (liff.isLoggedIn()) {
            profileFromLiff = await liff.getProfile();
            setLiffProfile(profileFromLiff);
          } else {
            liff.login();
            return; // รอ redirect
          }
        } else {
          // กรณีเปิดบน PC
          console.warn("Running on PC. Using MOCK LIFF PROFILE.");
          profileFromLiff = MOCK_PROFILE.liffProfile;
          setLiffProfile(profileFromLiff);
        }

        // --- ส่วนการดึงข้อมูลโปรไฟล์จาก DB ที่ตอนนี้จะทำงานเสมอ ---
        if (profileFromLiff) {
          const studentDocRef = doc(db, 'studentProfiles', profileFromLiff.userId);
          
          unsubscribeFromProfile = onSnapshot(studentDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setStudentDbProfile(docSnap.data());
            } else {
              setStudentDbProfile(null);
            }
            setIsLoading(false);
          }, (err) => {
            console.error("Error listening to student profile:", err);
            setError("เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์");
            setIsLoading(false);
          });
        } else {
            // กรณีที่ไม่สามารถหาโปรไฟล์ LIFF ได้เลย
            setIsLoading(false);
        }

      } catch (err) {
        setError(`LIFF Error: ${err.message}`);
        setIsLoading(false);
      }
    };

    initialize();

    // Cleanup function
    return () => {
      unsubscribeFromProfile();
    };
  }, []); // ทำงานแค่ครั้งเดียว

  return { liffObject, liffProfile, studentDbProfile, isLoading, error, setStudentDbProfile };
};