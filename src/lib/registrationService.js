import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

const COLLECTION_NAME = 'registrations';

/**
 * ตรวจสอบว่านักเรียนเคยลงทะเบียนกิจกรรมนี้แล้วหรือไม่
 * @param {string} activityId 
 * @param {string} nationalId 
 * @param {string} [lineUserId] 
 * @returns {Promise<object|null>}
 */
export async function checkExistingRegistration(activityId, nationalId, lineUserId = null) {
  if (!activityId) return null;

  // 1. ตรวจสอบผ่าน nationalId (ถ้ามี)
  if (nationalId) {
    const qNat = query(
      collection(db, COLLECTION_NAME),
      where('activityId', '==', activityId),
      where('nationalId', '==', nationalId.trim()),
      limit(1)
    );
    const snapNat = await getDocs(qNat);
    if (!snapNat.empty) {
      const d = snapNat.docs[0];
      return { id: d.id, ...d.data() };
    }
  }

  // 2. ตรวจสอบผ่าน lineUserId (ถ้ามี)
  if (lineUserId) {
    const qLine = query(
      collection(db, COLLECTION_NAME),
      where('activityId', '==', activityId),
      where('lineUserId', '==', lineUserId),
      limit(1)
    );
    const snapLine = await getDocs(qLine);
    if (!snapLine.empty) {
      const d = snapLine.docs[0];
      return { id: d.id, ...d.data() };
    }
  }

  return null;
}

/**
 * ลงทะเบียนนักเรียนเข้าร่วมกิจกรรม
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function registerStudentForActivity({
  activityId,
  nationalId,
  fullName,
  studentId = null,
  lineUserId = null,
  course = null,
  courseId = null,
  categoryId = null,
  timeSlot = null,
  seatNumber = null,
  displayQueueNumber = null,
  queueNumber = null,
  quota = null,
  attachedDocuments = {},
  evaluationScore = null,
  status = 'registered',
  registeredBy = 'student_self'
}) {
  if (!activityId || !nationalId || !fullName) {
    throw new Error('activityId, nationalId และ fullName เป็นข้อมูลที่จำเป็น');
  }

  const trimmedNationalId = nationalId.trim();

  // ตรวจสอบการลงทะเบียนซ้ำ
  const existing = await checkExistingRegistration(activityId, trimmedNationalId, lineUserId);
  if (existing) {
    throw new Error('นักเรียนท่านนี้ได้ลงทะเบียนกิจกรรมนี้เรียบร้อยแล้ว');
  }

  const registrationData = {
    activityId,
    nationalId: trimmedNationalId,
    fullName: fullName.trim(),
    studentId: studentId ? studentId.trim() : null,
    lineUserId: lineUserId || null,
    course: course || null,
    courseId: courseId || null,
    categoryId: categoryId || null,
    timeSlot: timeSlot || null,
    seatNumber: seatNumber || null,
    queueNumber: queueNumber || null,
    displayQueueNumber: displayQueueNumber || null,
    quota: quota || null,
    attachedDocuments: attachedDocuments || {},
    evaluationScore: evaluationScore || null,
    status,
    registeredBy,
    registeredAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), registrationData);
  return { id: docRef.id, ...registrationData };
}

/**
 * ดึงรายการการลงทะเบียนของนักเรียน (ด้วย nationalId หรือ lineUserId)
 * @param {object} params
 * @param {string} [params.nationalId]
 * @param {string} [params.lineUserId]
 * @returns {Promise<Array<object>>}
 */
export async function getUserRegistrations({ nationalId, lineUserId }) {
  const registrationsRef = collection(db, COLLECTION_NAME);
  const results = new Map();

  if (nationalId) {
    const qNat = query(registrationsRef, where('nationalId', '==', nationalId.trim()));
    const snapNat = await getDocs(qNat);
    snapNat.forEach(d => results.set(d.id, { id: d.id, ...d.data() }));
  }

  if (lineUserId) {
    const qLine = query(registrationsRef, where('lineUserId', '==', lineUserId));
    const snapLine = await getDocs(qLine);
    snapLine.forEach(d => results.set(d.id, { id: d.id, ...d.data() }));
  }

  return Array.from(results.values());
}

/**
 * ซิงค์และอัปเดต LINE ID เข้ากับการลงทะเบียนเดิมที่ตรงกับเลขบัตรประชาชน
 * @param {string} nationalId 
 * @param {string} lineUserId 
 * @returns {Promise<number>} จำนวนรายการที่ซิงค์
 */
export async function syncUnlinkedRegistrations(nationalId, lineUserId) {
  if (!nationalId || !lineUserId) return 0;

  const q = query(collection(db, COLLECTION_NAME), where('nationalId', '==', nationalId.trim()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  let updateCount = 0;

  snapshot.forEach(d => {
    const data = d.data();
    if (data.lineUserId !== lineUserId) {
      batch.update(d.ref, { lineUserId });
      updateCount++;
    }
  });

  if (updateCount > 0) {
    await batch.commit();
  }

  return updateCount;
}

/**
 * อัปเดตสถานะการลงทะเบียน (เช็คอิน / จบกิจกรรม / ระบุที่นั่ง / คิว)
 * @param {string} registrationId 
 * @param {string} status 
 * @param {object} additionalFields 
 */
export async function updateRegistrationStatus(registrationId, status, additionalFields = {}) {
  const regRef = doc(db, COLLECTION_NAME, registrationId);
  const updatePayload = {
    status,
    ...additionalFields,
    updatedAt: serverTimestamp()
  };
  await updateDoc(regRef, updatePayload);
}

/**
 * ลบรายการลงทะเบียน
 * @param {string} registrationId 
 */
export async function deleteRegistration(registrationId) {
  await deleteDoc(doc(db, COLLECTION_NAME, registrationId));
}
