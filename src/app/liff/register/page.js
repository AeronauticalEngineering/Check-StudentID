// src/app/liff/register/page.js

'use client';

import { useState, useEffect } from 'react';
import liff from '@line/liff';
import { db } from '../../../lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react'; 

export default function RegisterLiffPage() {
  const [userProfile, setUserProfile] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

  // ... (ส่วน useEffect และ function อื่นๆ เหมือนเดิม) ...
  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        
        const profile = await liff.getProfile();
        setUserProfile(profile);
        await checkExistingRegistration(profile.userId);

      } catch (error) {
        console.error('LIFF Initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initLiff();
  }, [liffId]);
  
  const checkExistingRegistration = async (userId) => {
    const activityId = 'activity-01'; // TODO: ควรเปลี่ยนเป็น Dynamic
    const q = query(
      collection(db, 'registrations'),
      where('userId', '==', userId),
      where('activityId', '==', activityId)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      setRegistration({ id: doc.id, ...doc.data() });
    }
  };

  const handleRegister = async () => {
    if (!userProfile) return;
    try {
      const activityId = 'activity-01'; // TODO: ควรเปลี่ยนเป็น Dynamic
      const newRegistration = {
        activityId,
        userId: userProfile.userId,
        userName: userProfile.displayName,
        status: 'registered',
        seatNumber: null,
      };
      const docRef = await addDoc(collection(db, 'registrations'), newRegistration);
      setRegistration({ id: docRef.id, ...newRegistration });
      alert('ลงทะเบียนสำเร็จ!');
    } catch (e) {
      console.error("Error adding document:", e);
      alert('เกิดข้อผิดพลาดในการลงทะเบียน');
    }
  };

  if (isLoading) return <div>กำลังโหลดข้อมูล...</div>;
  if (!userProfile) return <div>ไม่สามารถโหลดข้อมูลผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง</div>;
  
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>ระบบลงทะเบียน</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <Image  src={userProfile.pictureUrl}  alt={userProfile.displayName} 
            width={64} // Specify width
            height={64} // Specify height
            className="w-16 h-16 rounded-full border-2 border-white"
          />
          <h2>สวัสดี, {userProfile.displayName}!</h2>
      </div>

      {registration ? (
        <div style={{ textAlign: 'center' }}>
          <h3>คุณลงทะเบียนแล้ว</h3>
          <p><strong>สถานะ:</strong> {registration.status === 'checked-in' ? '✅ เช็คอินแล้ว' : 'ลงทะเบียน'}</p>
          <p><strong>เลขที่นั่ง:</strong> {registration.seatNumber || 'ยังไม่ได้รับ'}</p>
          <hr/>
          <p>แสดง QR Code นี้ให้เจ้าหน้าที่:</p>
          <div style={{ background: 'white', padding: '16px', display: 'inline-block' }}>
            <QRCodeSVG value={registration.id} size={256} />
          </div>
          <p style={{ marginTop: '10px', color: '#666' }}>ID: {registration.id}</p>
        </div>
      ) : (
        <div>
          <p>คุณยังไม่ได้ลงทะเบียนสำหรับกิจกรรมนี้</p>
          <button onClick={handleRegister} style={{ padding: '10px 20px', fontSize: '16px' }}>ลงทะเบียน</button>
        </div>
      )}
    </div>
  );
}