'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, addDoc, query, where, serverTimestamp, doc, getDoc, getDocs } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import useLiff from '../../../hooks/useLiff';
import Link from 'next/link';
import { createRegistrationSuccessFlex } from '../../../lib/flexMessageTemplates';

function RegistrationComponent() {
  const { liffProfile, studentDbProfile, isLoading, error } = useLiff();
  const searchParams = useSearchParams();
  const activityIdFromUrl = searchParams.get('activityId');

  const [activity, setActivity] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [registration, setRegistration] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!liffProfile || !activityIdFromUrl) return;

    const fetchActivityAndCategory = async () => {
      const activityDoc = await getDoc(doc(db, 'activities', activityIdFromUrl));
      if (activityDoc.exists()) {
        const actData = activityDoc.data();
        setActivity({ id: activityDoc.id, ...actData });

        if (actData.categoryId) {
          const categoryDoc = await getDoc(doc(db, 'categories', actData.categoryId));
          if (categoryDoc.exists()) {
            setCategoryName(categoryDoc.data().name);
          }
        }
      }
    };

    const checkExistingRegistration = async () => {
      const q = query(
        collection(db, 'registrations'),
        where('lineUserId', '==', liffProfile.userId),
        where('activityId', '==', activityIdFromUrl)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setRegistration({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    };

    fetchActivityAndCategory();
    checkExistingRegistration();
  }, [liffProfile, activityIdFromUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentDbProfile) {
      setMessage('เกิดข้อผิดพลาด: ไม่พบข้อมูลโปรไฟล์นักเรียน');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    const registrationData = {
      fullName: studentDbProfile.fullName,
      studentId: studentDbProfile.studentId,
      nationalId: studentDbProfile.nationalId,
      activityId: activityIdFromUrl,
      categoryId: activity?.categoryId,
      lineUserId: liffProfile.userId,
      status: 'registered',
      seatNumber: null,
      registeredAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, 'registrations'), registrationData);

      const flexMessage = createRegistrationSuccessFlex({
        categoryName: categoryName,
        activityName: activity?.name,
        fullName: studentDbProfile.fullName,
        studentId: studentDbProfile.studentId
      });

      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: liffProfile.userId, flexMessage: flexMessage })
      });

      setRegistration({ id: docRef.id, ...registrationData });
    } catch (error) {
      console.error("Error during registration:", error);
      setMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="text-center p-10">กำลังโหลด...</div>;
  if (error) return <div className="p-4 text-center text-red-600 bg-red-100">{error}</div>;

  if (registration) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-2">คุณได้ลงทะเบียนกิจกรรมนี้แล้ว</h2>
          <p className="text-gray-600 mb-6">สามารถแสดง QR Code นี้เพื่อเช็คอินได้เลย</p>
          <div className="p-4 bg-white border inline-block rounded-lg shadow">
            <QRCodeSVG value={registration.id} size={240} />
          </div>
        </div>
      </div>
    );
  }

  if (!studentDbProfile) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">กรุณาตั้งค่าโปรไฟล์ก่อน</h2>
          <p className="text-gray-600 mb-6">เราต้องการข้อมูลเพิ่มเติมจากคุณก่อนทำการลงทะเบียนกิจกรรม</p>
          <Link href="/student/my-registrations" className="px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover">
            ไปที่หน้าตั้งค่าโปรไฟล์
          </Link>
        </div>
      </div>
    );
  }

  if (activity && activity.isRegistrationOpen === false) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">ปิดรับลงทะเบียนแล้ว</h2>
          <p className="text-gray-600 mb-6">กิจกรรมนี้ได้ปิดรับการลงทะเบียนแล้ว ขออภัยในความไม่สะดวก</p>
          <Link href="/student/activities" className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">
            กลับหน้ารายการกิจกรรม
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">ยืนยันการลงทะเบียน</h2>
        <div className="bg-gray-50 p-4 rounded-lg border space-y-2">
          <p><strong>กิจกรรม:</strong> {activity?.name || 'กำลังโหลด...'}</p>
          <hr />
          <p><strong>ชื่อ-สกุล:</strong> {studentDbProfile.fullName}</p>
          <p><strong>รหัสผู้สมัคร:</strong> {studentDbProfile.studentId}</p>
        </div>
        <p className="text-xs text-gray-500 mt-4">กรุณาตรวจสอบข้อมูลด้านบนให้ถูกต้อง หากต้องการแก้ไขโปรดไปที่หน้า &quot;การลงทะเบียนของฉัน&quot;</p>

        {message && <p className="text-red-500 text-sm text-center my-4">{message}</p>}

        <button type="submit" disabled={isSubmitting || !activity} className="w-full mt-6 py-3 bg-primary text-white font-semibold rounded-md hover:bg-bg-primary/60 disabled:bg-gray-400">
          {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันการลงทะเบียน'}
        </button>
      </form>
    </div>
  );
}

export default function LiffStudentRegistrationPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">กำลังโหลด...</div>}>
      <RegistrationComponent />
    </Suspense>
  );
}