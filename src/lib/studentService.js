import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

const COLLECTION_NAME = 'studentProfiles';

/**
 * ค้นหาโปรไฟล์นักเรียนจาก LINE User ID หรือ National ID
 * รองรับทั้ง Document ID ที่เป็น lineUserId หรือฟิลด์ nationalId
 * @param {string} lineUserId 
 * @param {string} nationalId 
 * @returns {Promise<object|null>}
 */
export async function getStudentProfile(lineUserId, nationalId = null) {
  try {
    // 1. ค้นหาจาก Document ID (กรณีใช้ lineUserId เป็น Doc ID)
    if (lineUserId) {
      const docRef = doc(db, COLLECTION_NAME, lineUserId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }

      // ค้นหาจากฟิลด์ lineUserId
      const qLine = query(collection(db, COLLECTION_NAME), where('lineUserId', '==', lineUserId), limit(1));
      const lineSnap = await getDocs(qLine);
      if (!lineSnap.empty) {
        const found = lineSnap.docs[0];
        return { id: found.id, ...found.data() };
      }
    }

    // 2. ค้นหาจากฟิลด์ nationalId
    if (nationalId) {
      const trimmed = nationalId.trim();
      const qNat = query(collection(db, COLLECTION_NAME), where('nationalId', '==', trimmed), limit(1));
      const natSnap = await getDocs(qNat);
      if (!natSnap.empty) {
        const found = natSnap.docs[0];
        return { id: found.id, ...found.data() };
      }
    }

    return null;
  } catch (error) {
    console.error('Error in getStudentProfile:', error);
    throw error;
  }
}

/**
 * ค้นหานักเรียนจากเลขบัตรประชาชน 13 หลัก
 * @param {string} nationalId 
 * @returns {Promise<object|null>}
 */
export async function findStudentByNationalId(nationalId) {
  if (!nationalId) return null;
  const trimmed = nationalId.trim();
  const q = query(collection(db, COLLECTION_NAME), where('nationalId', '==', trimmed), limit(1));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() };
  }
  return null;
}

/**
 * ตรวจสอบว่าเลขประจำตัวประชาชนซ้ำซ้อนกับผู้ใช้อื่นในระบบหรือไม่
 * @param {string} nationalId 
 * @param {string} [excludeDocId] - Document ID หรือ Line User ID ที่อนุญาตให้ยกเว้น (กรณีแก้ไขข้อมูลตัวเอง)
 * @returns {Promise<boolean>} คืนค่า true หากพบว่าซ้ำซ้อนกับผู้อื่น
 */
export async function checkDuplicateNationalId(nationalId, excludeDocId = null) {
  if (!nationalId) return false;
  const trimmed = nationalId.trim();
  const q = query(collection(db, COLLECTION_NAME), where('nationalId', '==', trimmed));
  const snap = await getDocs(q);
  if (snap.empty) return false;
  if (!excludeDocId) return true;
  return snap.docs.some(docSnap => docSnap.id !== excludeDocId && docSnap.data().lineUserId !== excludeDocId);
}

/**
 * ดึงรายการโปรไฟล์นักเรียนทั้งหมดในระบบ (สำหรับ Admin)
 * @returns {Promise<Array<object>>}
 */
export async function getAllStudentProfiles() {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAtDate: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : null,
      updatedAtDate: d.data().updatedAt?.toDate ? d.data().updatedAt.toDate() : null
    }));
  } catch (error) {
    console.error('Error in getAllStudentProfiles:', error);
    throw error;
  }
}

/**
 * บันทึกหรืออัปเดตข้อมูลโปรไฟล์นักเรียน
 * @param {object} studentData
 * @param {string} studentData.nationalId - เลขบัตรประชาชน 13 หลัก (จำเป็น)
 * @param {string} studentData.fullName - ชื่อ-สกุล (จำเป็น)
 * @param {string} [studentData.studentId] - รหัสนักศึกษา / รหัสผู้สมัคร
 * @param {string} [studentData.lineUserId] - LINE User ID
 * @param {string} [studentData.lineDisplayName] - ชื่อแสดงใน LINE
 * @param {string} [studentData.linePictureUrl] - รูปโปรไฟล์ LINE
 * @param {string} [studentData.source] - แหล่งที่มา (เช่น 'liff_setup', 'admin_import')
 * @returns {Promise<object>}
 */
export async function upsertStudentProfile({
  nationalId,
  fullName,
  studentId = null,
  lineUserId = null,
  lineDisplayName = null,
  linePictureUrl = null,
  source = 'user_setup'
}) {
  const trimmedNationalId = nationalId?.trim();
  if (!trimmedNationalId || !fullName) {
    throw new Error('nationalId และ fullName เป็นข้อมูลที่จำเป็น');
  }

  if (trimmedNationalId.length !== 13 || !/^\d{13}$/.test(trimmedNationalId)) {
    throw new Error('เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก');
  }

  // กำหนด Document ID หลัก: ถ้ามี lineUserId ให้ใช้ lineUserId ถ้าไม่มีให้ใช้ nationalId
  const docId = lineUserId || trimmedNationalId;

  // ตรวจสอบความซ้ำซ้อนของเลขบัตรประชาชนกับ Document อื่น
  const isDuplicate = await checkDuplicateNationalId(trimmedNationalId, docId);
  if (isDuplicate) {
    throw new Error(`เลขประจำตัวประชาชน ${trimmedNationalId} ซ้ำซ้อนกับผู้ใช้อื่นในระบบ`);
  }

  const docRef = doc(db, COLLECTION_NAME, docId);

  const payload = {
    nationalId: trimmedNationalId,
    fullName: fullName.trim(),
    studentId: studentId ? studentId.trim() : null,
    updatedAt: serverTimestamp()
  };

  if (lineUserId) payload.lineUserId = lineUserId;
  if (lineDisplayName) payload.lineDisplayName = lineDisplayName;
  if (linePictureUrl) payload.linePictureUrl = linePictureUrl;

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    payload.createdAt = serverTimestamp();
    payload.source = source;
  }

  await setDoc(docRef, payload, { merge: true });
  return { id: docId, ...payload };
}

/**
 * ผูกบัญชี LINE กับโปรไฟล์นักเรียน (แก้ปัญหา Orphan Doc และเชื่อมข้อมูล)
 * @param {string} nationalId - เลขบัตรประชาชน 13 หลัก
 * @param {object} liffProfile - ข้อมูลจาก LINE LIFF { userId, displayName, pictureUrl }
 * @returns {Promise<object>}
 */
export async function linkStudentLineAccount(nationalId, liffProfile) {
  const trimmedNationalId = nationalId.trim();
  const { userId, displayName, pictureUrl } = liffProfile;

  const batch = writeBatch(db);

  // 1. ค้นหาโปรไฟล์เดิมที่มีอยู่
  const existingProfile = await findStudentByNationalId(trimmedNationalId);

  if (existingProfile) {
    // ถ้าโปรไฟล์นี้ผูกกับ LINE คนอื่นอยู่แล้ว
    if (existingProfile.lineUserId && existingProfile.lineUserId !== userId) {
      throw new Error('เลขบัตรประชาชนนี้ถูกผูกไว้กับบัญชี LINE อื่นแล้ว');
    }

    const newProfileData = {
      ...existingProfile,
      lineUserId: userId,
      lineDisplayName: displayName || existingProfile.lineDisplayName || null,
      linePictureUrl: pictureUrl || existingProfile.linePictureUrl || null,
      updatedAt: serverTimestamp()
    };

    // สร้างหรืออัปเดต Document ใน Key ใหม่ (userId)
    const newDocRef = doc(db, COLLECTION_NAME, userId);
    batch.set(newDocRef, newProfileData, { merge: true });

    // ลบเอกสารเก่าออก หาก ID เดิมไม่ใช่ userId
    if (existingProfile.id !== userId) {
      const oldDocRef = doc(db, COLLECTION_NAME, existingProfile.id);
      batch.delete(oldDocRef);
    }

    await batch.commit();
    return newProfileData;
  }

  // 2. ถ้าไม่พบใน studentProfiles ให้ค้นหาจาก registrations
  const qReg = query(collection(db, 'registrations'), where('nationalId', '==', trimmedNationalId), limit(1));
  const regSnapshot = await getDocs(qReg);

  if (regSnapshot.empty) {
    throw new Error('ไม่พบข้อมูลเลขบัตรประชาชนนี้ในระบบ กรุณาติดต่อเจ้าหน้าที่');
  }

  const regData = regSnapshot.docs[0].data();
  const profileData = {
    nationalId: trimmedNationalId,
    fullName: regData.fullName,
    studentId: regData.studentId || null,
    lineUserId: userId,
    lineDisplayName: displayName || null,
    linePictureUrl: pictureUrl || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    source: 'registration_link'
  };

  const newDocRef = doc(db, COLLECTION_NAME, userId);
  await setDoc(newDocRef, profileData);

  return profileData;
}

/**
 * ลงทะเบียนโปรไฟล์นักเรียนใหม่ หรือผูกบัญชี LINE กับโปรไฟล์เดิม
 * รองรับนักเรียนใหม่ที่ยังไม่มีชื่อในระบบ ให้สามารถสร้างโปรไฟล์และลงทะเบียนกิจกรรมได้ด้วยตนเอง
 * @param {object} params
 * @param {string} params.nationalId - เลขบัตรประชาชน 13 หลัก
 * @param {string} params.fullName - ชื่อ-สกุล
 * @param {string} [params.studentId] - รหัสนักศึกษา / รหัสผู้สมัคร (ไม่บังคับ)
 * @param {object} params.liffProfile - ข้อมูลจาก LINE LIFF { userId, displayName, pictureUrl }
 * @returns {Promise<object>}
 */
export async function registerOrLinkStudentProfile({
  nationalId,
  fullName,
  studentId = null,
  liffProfile
}) {
  if (!nationalId || !fullName || !liffProfile?.userId) {
    throw new Error('กรุณากรอกข้อมูลเลขบัตรประชาชน และชื่อ-นามสกุลให้ครบถ้วน');
  }

  const trimmedNationalId = nationalId.trim();
  const trimmedFullName = fullName.trim();
  const trimmedStudentId = studentId?.trim() || null;
  const { userId, displayName, pictureUrl } = liffProfile;

  if (trimmedNationalId.length !== 13 || !/^\d{13}$/.test(trimmedNationalId)) {
    throw new Error('เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก');
  }

  const batch = writeBatch(db);

  // 1. ค้นหาโปรไฟล์เดิมใน studentProfiles จาก nationalId
  const existingProfile = await findStudentByNationalId(trimmedNationalId);

  if (existingProfile) {
    // ตรวจสอบว่าผูกกับ LINE ของคนอื่นอยู่หรือไม่
    if (existingProfile.lineUserId && existingProfile.lineUserId !== userId) {
      throw new Error('เลขประจำตัวประชาชนนี้ถูกผูกไว้กับบัญชี LINE อื่นแล้ว หากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่');
    }

    const updatedProfile = {
      ...existingProfile,
      fullName: trimmedFullName || existingProfile.fullName,
      studentId: trimmedStudentId || existingProfile.studentId || null,
      lineUserId: userId,
      lineDisplayName: displayName || existingProfile.lineDisplayName || null,
      linePictureUrl: pictureUrl || existingProfile.linePictureUrl || null,
      updatedAt: serverTimestamp()
    };

    const newDocRef = doc(db, COLLECTION_NAME, userId);
    batch.set(newDocRef, updatedProfile, { merge: true });

    if (existingProfile.id !== userId) {
      const oldDocRef = doc(db, COLLECTION_NAME, existingProfile.id);
      batch.delete(oldDocRef);
    }

    await batch.commit();
    return updatedProfile;
  }

  // 2. ค้นหาจาก registrations (กรณีมีประวัติการลงทะเบียนที่นำเข้าไว้ล่วงหน้า)
  const qReg = query(collection(db, 'registrations'), where('nationalId', '==', trimmedNationalId), limit(1));
  const regSnapshot = await getDocs(qReg);

  if (!regSnapshot.empty) {
    const regData = regSnapshot.docs[0].data();
    const profileData = {
      nationalId: trimmedNationalId,
      fullName: trimmedFullName || regData.fullName,
      studentId: trimmedStudentId || regData.studentId || null,
      lineUserId: userId,
      lineDisplayName: displayName || null,
      linePictureUrl: pictureUrl || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: 'registration_link'
    };

    const newDocRef = doc(db, COLLECTION_NAME, userId);
    await setDoc(newDocRef, profileData);
    return profileData;
  }

  // 3. เป็นนักเรียนใหม่ที่ยังไม่มีชื่อในระบบ -> สร้างโปรไฟล์ใหม่ทันที
  const newStudentProfile = {
    nationalId: trimmedNationalId,
    fullName: trimmedFullName,
    studentId: trimmedStudentId,
    lineUserId: userId,
    lineDisplayName: displayName || null,
    linePictureUrl: pictureUrl || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    source: 'student_self_registration'
  };

  const newDocRef = doc(db, COLLECTION_NAME, userId);
  await setDoc(newDocRef, newStudentProfile);

  return newStudentProfile;
}

/**
 * รีเซ็ตการผูกบัญชี LINE สำหรับนักเรียน (ใช้โดย Admin)
 * @param {string} lineUserId 
 * @param {string} registrantId 
 */
export async function resetStudentLineBinding(lineUserId, registrantId) {
  const batch = writeBatch(db);

  if (lineUserId) {
    const profileRef = doc(db, COLLECTION_NAME, lineUserId);
    batch.delete(profileRef);
  }

  if (registrantId) {
    const regRef = doc(db, 'registrations', registrantId);
    batch.update(regRef, { lineUserId: null });
  }

  await batch.commit();
}

/**
 * ลบข้อมูลนักเรียนและประวัติการผูก LINE
 * @param {string} nationalId 
 * @param {string} lineUserId 
 */
export async function deleteStudentProfile(nationalId, lineUserId) {
  const batch = writeBatch(db);

  if (lineUserId) {
    batch.delete(doc(db, COLLECTION_NAME, lineUserId));
  }

  if (nationalId) {
    const q = query(collection(db, COLLECTION_NAME), where('nationalId', '==', nationalId));
    const snap = await getDocs(q);
    snap.forEach(d => batch.delete(d.ref));
  }

  await batch.commit();
}
