'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import useLiff from '../../../hooks/useLiff';
import Link from 'next/link';
import { checkExistingRegistration, registerStudentForActivity } from '../../../lib/registrationService';
import { useModal } from '../../../context/ModalContext';
import { createRegistrationSuccessFlex } from '../../../lib/flexMessageTemplates';
import ProfileSetupForm from '../../../components/student/ProfileSetupForm';

function RegistrationComponent() {
  const { showAlert } = useModal();
  const { liffProfile, studentDbProfile, isLoading, error, setStudentDbProfile } = useLiff();
  const searchParams = useSearchParams();
  const activityIdFromUrl = searchParams.get('activityId');
  const courseFromUrl = searchParams.get('course');
  const courseIdFromUrl = searchParams.get('courseId');

  const [activity, setActivity] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [courseOptions, setCourseOptions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);

  const [registration, setRegistration] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Quota Selection State
  const [selectedQuota, setSelectedQuota] = useState('');
  const [isQuotaDropdownOpen, setIsQuotaDropdownOpen] = useState(false);

  useEffect(() => {
    if (!liffProfile || !activityIdFromUrl) return;

    const fetchActivityAndCourses = async () => {
      try {
        const [activityDoc, coursesSnap] = await Promise.all([
          getDoc(doc(db, 'activities', activityIdFromUrl)),
          getDocs(query(collection(db, 'courseOptions'), orderBy('name')))
        ]);

        const fetchedCourses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCourseOptions(fetchedCourses);

        // Pre-select course from URL or first available
        if (courseFromUrl || courseIdFromUrl) {
          const match = fetchedCourses.find(c => c.name === courseFromUrl || c.id === courseIdFromUrl || c.shortName === courseFromUrl);
          if (match) {
            setSelectedCourse(match);
          } else if (courseFromUrl) {
            setSelectedCourse({ id: courseIdFromUrl || 'custom', name: courseFromUrl });
          }
        } else if (fetchedCourses.length > 0) {
          setSelectedCourse(fetchedCourses[0]);
        }

        if (activityDoc.exists()) {
          const actData = activityDoc.data();
          setActivity({ id: activityDoc.id, ...actData });

          if (actData.categoryId) {
            const categoryDoc = await getDoc(doc(db, 'categories', actData.categoryId));
            if (categoryDoc.exists()) {
              setCategoryName(categoryDoc.data().name);
            }
          }

          // Auto-select first quota if available
          if (actData.enableScoring && actData.scoringConfig?.quotaCriteriaList?.length > 0) {
            setSelectedQuota(actData.scoringConfig.quotaCriteriaList[0].quotaName);
          }
        }

        // Check if student already registered for this specific activity
        const existing = await checkExistingRegistration(activityIdFromUrl, studentDbProfile?.nationalId);
        if (existing) {
          setRegistration(existing);
        }
      } catch (err) {
        console.error('Error fetching activity/courses:', err);
      }
    };

    fetchActivityAndCourses();
  }, [liffProfile, studentDbProfile, activityIdFromUrl, courseFromUrl, courseIdFromUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentDbProfile) {
      setMessage('เกิดข้อผิดพลาด: ไม่พบข้อมูลโปรไฟล์นักเรียน');
      return;
    }

    if (courseOptions.length > 0 && !selectedCourse) {
      setMessage('กรุณาเลือกหลักสูตรที่ต้องการสมัคร');
      showAlert({
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาเลือกหลักสูตรที่ต้องการสมัครก่อนดำเนินการต่อ',
        type: 'warning'
      });
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      // ลงทะเบียนผ่าน Service Layer
      const newReg = await registerStudentForActivity({
        activityId: activityIdFromUrl,
        nationalId: studentDbProfile.nationalId,
        fullName: studentDbProfile.fullName,
        studentId: studentDbProfile.studentId,
        lineUserId: liffProfile.userId,
        course: selectedCourse?.name || null,
        courseId: selectedCourse?.id || null,
        categoryId: activity?.categoryId || null,
        quota: selectedQuota || null,
        attachedDocuments: {},
        registeredBy: 'student_self'
      });

      // ส่ง LINE Notification
      const flexMessage = createRegistrationSuccessFlex({
        categoryName: selectedCourse?.name || categoryName || 'กิจกรรม',
        activityName: activity?.name,
        fullName: studentDbProfile.fullName,
        studentId: studentDbProfile.studentId
      });

      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: liffProfile.userId, flexMessage: flexMessage })
      }).catch(err => console.error('Notification error:', err));

      setRegistration(newReg);
    } catch (error) {
      console.error('Error during registration:', error);
      setMessage(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 font-sans space-y-3">
        <svg className="w-8 h-8 text-[#000946] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <span className="text-sm font-normal text-slate-500">กำลังโหลดข้อมูลการลงทะเบียน...</span>
      </div>
    );
  }

  if (error) return <div className="p-4 text-center text-red-600 bg-red-100 font-sans">{error}</div>;

  if (registration) {
    return (
      <div className="max-w-xl mx-auto p-4 md:p-8 font-sans">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">คุณได้ลงทะเบียนกิจกรรมนี้แล้ว</h2>
            <p className="text-slate-500 text-sm font-normal mt-1">แสดง QR Code นี้กับเจ้าหน้าที่เพื่อเช็คอินเข้างาน</p>
          </div>

          <div className="p-4 bg-white border border-slate-200 inline-block rounded-2xl shadow-xs">
            <QRCodeSVG value={registration.id} size={220} />
          </div>

          <div className="pt-2">
            <Link
              href="/student/my-registrations"
              className="inline-block px-6 py-2.5 bg-[#000946] hover:bg-[#00125e] text-white font-normal rounded-xl transition-colors text-sm shadow-xs"
            >
              ดูการลงทะเบียนของฉัน
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!studentDbProfile) {
    return (
      <div className="max-w-md mx-auto p-4 font-sans space-y-4">
        <ProfileSetupForm liffProfile={liffProfile} onProfileCreated={setStudentDbProfile} />
      </div>
    );
  }

  if (activity && activity.isRegistrationOpen === false) {
    return (
      <div className="max-w-xl mx-auto p-4 md:p-8 font-sans">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-slate-200 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-600">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">เฉพาะผู้มีสิทธิ์เท่านั้น</h2>
          <p className="text-slate-600 text-sm font-normal leading-relaxed">
            กิจกรรมนี้เปิดให้เข้าร่วมเฉพาะผู้มีรายชื่อที่เจ้าหน้าที่ลงทะเบียนให้ล่วงหน้า หากท่านได้รับการคัดเลือกแล้ว กรุณาตรวจสอบบัตรคิวที่หน้า &quot;การลงทะเบียนของฉัน&quot;
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/student/activities"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-normal rounded-xl transition-colors text-sm"
            >
              กลับหน้ารายการกิจกรรม
            </Link>
            <Link
              href="/student/my-registrations"
              className="px-5 py-2.5 bg-[#000946] hover:bg-[#00125e] text-white font-normal rounded-xl transition-colors text-sm shadow-xs"
            >
              ไปที่การลงทะเบียนของฉัน
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasQuotaConfig = activity?.enableScoring && activity?.scoringConfig?.quotaCriteriaList?.length > 0;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 font-sans space-y-5">
      <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-xl font-bold text-[#000946]">ยืนยันการลงทะเบียนกิจกรรม</h2>
          <p className="text-sm font-normal text-slate-500 mt-0.5">
            โปรดตรวจสอบข้อมูลและเลือกหลักสูตรที่ท่านประสงค์จะสมัคร
          </p>
        </div>

        {/* Student & Activity Info Box */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-sm font-normal">
          <div className="flex justify-between items-start gap-2">
            <span className="text-slate-500 font-normal">กิจกรรม:</span>
            <span className="font-bold text-[#000946] text-right">{activity?.name || 'กำลังโหลด...'}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between">
            <span className="text-slate-500 font-normal">ชื่อ-นามสกุล:</span>
            <span className="font-normal text-slate-800">{studentDbProfile.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-normal">รหัสผู้สมัคร:</span>
            <span className="font-normal text-slate-800">{studentDbProfile.studentId || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-normal">เลขบัตรประชาชน:</span>
            <span className="font-normal text-slate-800">{studentDbProfile.nationalId}</span>
          </div>
        </div>

        {/* Course Selection Section */}
        {courseOptions.length > 0 && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
            <label className="block text-sm font-bold text-slate-800">
              เลือกหลักสูตรที่สมัคร <span className="text-red-500">*</span>
            </label>

            {/* Custom Dropdown for Course */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 hover:border-[#000946] rounded-xl text-sm font-normal text-slate-900 flex items-center justify-between shadow-xs outline-none transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: selectedCourse?.color || '#000946' }}
                  ></span>
                  <span className="font-semibold text-slate-900">
                    {selectedCourse ? selectedCourse.name : 'เลือกหลักสูตร'}
                  </span>
                  {selectedCourse?.shortName && selectedCourse.shortName !== selectedCourse.name && (
                    <span className="text-xs text-slate-500 font-normal">
                      ({selectedCourse.shortName})
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isCourseDropdownOpen ? 'rotate-180 text-[#000946]' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Course Options List */}
              {isCourseDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden py-1 divide-y divide-slate-100 animate-fadeIn max-h-60 overflow-y-auto">
                  {courseOptions.map(c => {
                    const isSelected = selectedCourse?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCourse(c);
                          setIsCourseDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-[#000946] font-bold'
                            : 'text-slate-700 hover:bg-slate-50 font-normal'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: c.color || '#000946' }}
                          ></span>
                          <span>{c.name}</span>
                          {c.shortName && c.shortName !== c.name && (
                            <span className="text-xs text-slate-400 font-normal">
                              ({c.shortName})
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <svg className="w-4 h-4 text-[#000946]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quota Selection Section */}
        {hasQuotaConfig && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
            <label className="block text-sm font-bold text-slate-800">
              ประเภทโควตาที่ต้องการสมัคร
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsQuotaDropdownOpen(!isQuotaDropdownOpen)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 hover:border-[#000946] rounded-xl text-sm font-normal text-slate-900 flex items-center justify-between shadow-xs outline-none transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#000946]"></span>
                  <span className="font-semibold text-slate-800">{selectedQuota || 'เลือกประเภทโควตา'}</span>
                </div>
                <svg
                  className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isQuotaDropdownOpen ? 'rotate-180 text-[#000946]' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isQuotaDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden py-1 divide-y divide-slate-100 animate-fadeIn">
                  {activity.scoringConfig.quotaCriteriaList.map(q => {
                    const isSelected = selectedQuota === q.quotaName;
                    return (
                      <button
                        key={q.quotaName}
                        type="button"
                        onClick={() => {
                          setSelectedQuota(q.quotaName);
                          setIsQuotaDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-[#000946] font-bold'
                            : 'text-slate-700 hover:bg-slate-50 font-normal'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#000946]' : 'bg-slate-300'}`}></span>
                          <span>{q.quotaName}</span>
                        </span>
                        {isSelected && (
                          <svg className="w-4 h-4 text-[#000946]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-sm font-normal text-slate-500">
          กรุณาตรวจสอบข้อมูลด้านบนให้ถูกต้อง หากต้องการแก้ไขโปรไฟล์โปรดไปที่หน้า &quot;การลงทะเบียนของฉัน&quot;
        </p>

        {message && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-normal text-red-700 text-center">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !activity}
          className="w-full py-3 bg-[#000946] hover:bg-[#00125e] text-white font-normal rounded-xl shadow-sm active:scale-98 disabled:opacity-50 transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
              <span>กำลังบันทึกการลงทะเบียน...</span>
            </>
          ) : (
            <span>ยืนยันการลงทะเบียน</span>
          )}
        </button>
      </form>
    </div>
  );
}

export default function LiffStudentRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh] font-sans text-sm font-normal text-slate-500">
        กำลังโหลด...
      </div>
    }>
      <RegistrationComponent />
    </Suspense>
  );
}