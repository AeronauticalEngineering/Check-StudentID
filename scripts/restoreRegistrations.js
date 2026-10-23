const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, setDoc, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyBiMWxLVjzoZSLTAmoLYRsjdQRirUJ3hIY',
  authDomain: 'aeroscan-ad2c1.firebaseapp.com',
  projectId: 'aeroscan-ad2c1',
  storageBucket: 'aeroscan-ad2c1.firebasestorage.app',
  messagingSenderId: '265653848726',
  appId: '1:265653848726:web:d34636ea295d4f87f050b7',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ACTIVITY_ID = 'rhHpcO7iuwV2118jXYZL';

async function restore() {
  console.log('--- Starting Recovery for activity: ' + ACTIVITY_ID + ' ---');
  
  const evSnap = await getDocs(query(collection(db, 'evaluations'), where('activityId', '==', ACTIVITY_ID)));
  console.log('Found evaluations: ' + evSnap.size);
  
  const studentMap = new Map();
  evSnap.docs.forEach(d => {
    const data = d.data();
    const key = data.nationalId || data.lineUserId || d.id;
    if (!studentMap.has(key)) {
      studentMap.set(key, data);
    }
  });

  console.log('Unique students to restore: ' + studentMap.size);

  let restoredCount = 0;
  let orderIndex = 0;

  for (const [key, evData] of studentMap.entries()) {
    orderIndex++;
    let profileData = {};
    if (evData.nationalId) {
      const pSnap = await getDocs(query(collection(db, 'studentProfiles'), where('nationalId', '==', evData.nationalId)));
      if (!pSnap.empty) {
        profileData = pSnap.docs[0].data();
      }
    }

    const fullName = profileData.fullName || evData.fullName || 'ผู้สมัคร';
    const fullNameEn = profileData.fullNameEn || null;
    const studentId = profileData.studentId || evData.studentId || '';
    const nationalId = profileData.nationalId || evData.nationalId || '';
    const lineUserId = profileData.lineUserId || evData.lineUserId || evData.userId || '';
    const timestamp = evData.submittedAt || serverTimestamp();

    const newRegRef = doc(collection(db, 'registrations'));
    const regPayload = {
      activityId: ACTIVITY_ID,
      fullName: fullName,
      fullNameEn: fullNameEn,
      studentId: studentId,
      nationalId: nationalId,
      lineUserId: lineUserId,
      status: 'completed',
      certificateApproved: true,
      importOrder: orderIndex,
      course: profileData.course || '',
      quota: profileData.quota || '',
      registeredAt: timestamp,
      checkedInAt: timestamp,
      completedAt: timestamp,
      restoredAt: serverTimestamp(),
      restoredFrom: 'evaluations_recovery'
    };

    await setDoc(newRegRef, regPayload);
    restoredCount++;
    console.log('[' + restoredCount + '/' + studentMap.size + '] Restored: ' + fullName + ' (' + nationalId + ')');
  }

  console.log('--- Successfully Restored: ' + restoredCount + ' registrations! ---');
}

restore().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
