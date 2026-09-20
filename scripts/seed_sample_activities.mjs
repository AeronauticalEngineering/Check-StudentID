import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log("🚀 Starting seeding sample activities...");

  const now = new Date();
  
  // 1. Queue Activity (สอบสัมภาษณ์ / เรียกคิว / ให้คะแนน)
  const dateQueue = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // พรุ่งนี้
  dateQueue.setHours(9, 0, 0, 0);

  const queueActivityData = {
    name: "[ตัวอย่าง] สัมภาษณ์คัดเลือกหลักสูตรวิศวกรรมการบิน & การจัดการการบิน 2569",
    type: "queue",
    categoryId: "iROW29h4ZAGA5GAkzh9L", // สอบสัมภาษณ์
    capacity: 60,
    location: "อาคารปฏิบัติการการบิน ชั้น 3 ห้องสัมภาษณ์ 301-303",
    activityDate: Timestamp.fromDate(dateQueue),
    createdAt: serverTimestamp(),
    isRegistrationOpen: true,
    enableEvaluation: true,
    evaluationQuestions: [
      { id: "eval_q1", text: "ความชัดเจนของขั้นตอนและกระบวนการสัมภาษณ์", type: "rating", isRequired: true },
      { id: "eval_q2", text: "การให้คำแนะนำและการต้อนรับของเจ้าหน้าที่และอาจารย์", type: "rating", isRequired: true },
      { id: "eval_q3", text: "ข้อเสนอแนะสำหรับการปรับปรุงการจัดกิจกรรมครั้งถัดไป", type: "text", isRequired: false }
    ],
    enableScoring: true,
    scoringConfig: {
      generalCriteria: [
        { id: "g1", name: "บุคลิกภาพและการสื่อสาร (A)", weight: 25, maxScore: 100 },
        { id: "g2", name: "ทัศนคติและความพร้อมในการเรียน (B)", weight: 25, maxScore: 100 },
        { id: "g3", name: "ความรู้พื้นฐานด้านการบินและตรรกะ (C)", weight: 50, maxScore: 100 }
      ],
      quotaCriteriaList: [
        {
          quotaName: "โควตาเรียนดี",
          criteria: [
            { id: "q1", name: "ผลการเรียนเฉลี่ยสะสม (GPAX)", weight: 60, maxScore: 100 },
            { id: "q2", name: "ความถนัดทางภาษาอังกฤษและวิทยาศาสตร์", weight: 40, maxScore: 100 }
          ]
        },
        {
          quotaName: "โควตากิจกรรม & ความสามารถพิเศษ",
          criteria: [
            { id: "q1", name: "ผลงาน เกียรติบัตร และแฟ้มสะสมงาน", weight: 50, maxScore: 100 },
            { id: "q2", name: "การนำเสนอผลงานและความคิดสร้างสรรค์", weight: 30, maxScore: 100 },
            { id: "q3", name: "ความสามารถพิเศษทางด้านการบิน/กีฬา/เทคโนโลยี", weight: 20, maxScore: 100 }
          ]
        }
      ],
      requiredDocuments: [
        { id: "doc1", name: "สำเนา ปพ.1 / ใบแสดงผลการเรียน 5 เทอม", maxFiles: 1, required: true },
        { id: "doc2", name: "แฟ้มสะสมผลงาน (Portfolio) / เกียรติบัตร", maxFiles: 2, required: false }
      ]
    }
  };

  const queueActRef = await addDoc(collection(db, "activities"), queueActivityData);
  console.log("✅ Created Queue Activity ID:", queueActRef.id);

  // Add 3 Queue Channels
  const ch1Ref = await addDoc(collection(db, "queueChannels"), {
    activityId: queueActRef.id,
    channelNumber: 1,
    name: "โต๊ะที่ 1 - สัมภาษณ์หลักสูตรวิศวกรรมการบิน",
    servingCourse: "วิศวกรรมการบิน",
    createdAt: serverTimestamp()
  });

  const ch2Ref = await addDoc(collection(db, "queueChannels"), {
    activityId: queueActRef.id,
    channelNumber: 2,
    name: "โต๊ะที่ 2 - สัมภาษณ์หลักสูตรการจัดการการบิน",
    servingCourse: "การจัดการการบิน",
    createdAt: serverTimestamp()
  });

  const ch3Ref = await addDoc(collection(db, "queueChannels"), {
    activityId: queueActRef.id,
    channelNumber: 3,
    name: "โต๊ะที่ 3 - ตรวจสอบเอกสาร & สุขภาพเบื้องต้น",
    servingCourse: null,
    createdAt: serverTimestamp()
  });

  console.log("✅ Created 3 Queue Channels:", ch1Ref.id, ch2Ref.id, ch3Ref.id);

  // Add sample registrants for Queue Activity
  await addDoc(collection(db, "registrations"), {
    activityId: queueActRef.id,
    nationalId: "1100100200301",
    fullName: "นายธีรภัทร รักการบิน",
    title: "นาย",
    firstName: "ธีรภัทร",
    lastName: "รักการบิน",
    studentId: "AERO-6901",
    course: "วิศวกรรมการบิน",
    courseCode: "AE",
    queueNumber: 1,
    displayQueueNumber: "AE-001",
    seatNumber: "A-01",
    quota: "โควตาเรียนดี",
    status: "calling",
    queueStatus: "calling",
    currentChannelName: "โต๊ะที่ 1 - สัมภาษณ์หลักสูตรวิศวกรรมการบิน",
    calledBy: "อาจารย์ผู้ประเมิน",
    registeredBy: "system_sample",
    registeredAt: serverTimestamp()
  });

  await addDoc(collection(db, "registrations"), {
    activityId: queueActRef.id,
    nationalId: "1100100200302",
    fullName: "นางสาวกานดา ฟ้ากว้าง",
    title: "นางสาว",
    firstName: "กานดา",
    lastName: "ฟ้ากว้าง",
    studentId: "AERO-6902",
    course: "วิศวกรรมการบิน",
    courseCode: "AE",
    queueNumber: 2,
    displayQueueNumber: "AE-002",
    seatNumber: "A-02",
    quota: "โควตากิจกรรม & ความสามารถพิเศษ",
    status: "checked-in",
    queueStatus: "waiting",
    registeredBy: "system_sample",
    registeredAt: serverTimestamp()
  });

  await addDoc(collection(db, "registrations"), {
    activityId: queueActRef.id,
    nationalId: "1100100200303",
    fullName: "นายปกรณ์ สุวรรณภูมิ",
    title: "นาย",
    firstName: "ปกรณ์",
    lastName: "สุวรรณภูมิ",
    studentId: "AERO-6903",
    course: "การจัดการการบิน",
    courseCode: "AM",
    queueNumber: 3,
    displayQueueNumber: "AM-001",
    seatNumber: "A-03",
    quota: "โควตาเรียนดี",
    status: "registered",
    queueStatus: "waiting",
    registeredBy: "system_sample",
    registeredAt: serverTimestamp()
  });

  console.log("✅ Added 3 Registrants for Queue Activity");

  // 2. Event Activity (กิจกรรมทั่วไป / ผังที่นั่ง / สัมมนา)
  const dateEvent = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // อีก 2 วัน
  dateEvent.setHours(10, 0, 0, 0);

  const eventActivityData = {
    name: "[ตัวอย่าง] สัมมนาเปิดบ้านการบิน AERO Open House 2026",
    type: "event",
    categoryId: "mMD1c0ZGpDBypKbBogLn", // กิจกรรม
    capacity: 100,
    location: "หอประชุมใหญ่ AERO Auditorium ชั้น 1",
    activityDate: Timestamp.fromDate(dateEvent),
    createdAt: serverTimestamp(),
    isRegistrationOpen: true,
    enableEvaluation: true,
    evaluationQuestions: [
      { id: "ev1", text: "เนื้อหาการบรรยายมีความน่าสนใจและเป็นประโยชน์", type: "rating", isRequired: true },
      { id: "ev2", text: "ความพร้อมของสถานที่และโสตทัศนูปกรณ์", type: "rating", isRequired: true },
      { id: "ev3", text: "ข้อเสนอแนะในการจัดกิจกรรมครั้งต่อไป", type: "text", isRequired: false }
    ],
    enableScoring: false,
    scoringConfig: null
  };

  const eventActRef = await addDoc(collection(db, "activities"), eventActivityData);
  console.log("✅ Created Event Activity ID:", eventActRef.id);

  // Add 4 sample registrants with assigned seats
  const eventSeats = [
    { seat: "A-01", name: "นายชลธี มีทรัพย์", id: "EV-001", status: "checked-in", nat: "1100200300401" },
    { seat: "A-02", name: "นางสาวศิริพร บุญตา", id: "EV-002", status: "checked-in", nat: "1100200300402" },
    { seat: "B-01", name: "นายธนวัฒน์ พัฒนาการ", id: "EV-003", status: "registered", nat: "1100200300403" },
    { seat: "B-02", name: "นางสาวพิมพ์ใจ ใฝ่รู้", id: "EV-004", status: "registered", nat: "1100200300404" }
  ];

  for (const s of eventSeats) {
    await addDoc(collection(db, "registrations"), {
      activityId: eventActRef.id,
      nationalId: s.nat,
      fullName: s.name,
      studentId: s.id,
      seatNumber: s.seat,
      status: s.status,
      registeredBy: "system_sample",
      registeredAt: serverTimestamp()
    });
  }
  console.log("✅ Added 4 Registrants for Event Activity");

  // 3. Exam Activity (สอบข้อเขียน / ผังที่นั่งสอบ)
  const dateExam = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // อีก 3 วัน
  dateExam.setHours(13, 30, 0, 0);

  const examActivityData = {
    name: "[ตัวอย่าง] สอบข้อเขียนคัดเลือกทุนการศึกษาการบิน ประจำปี 2569",
    type: "exam",
    categoryId: "IGuVnnDUkxt1VA1q2m5z", // สอบข้อเขียน
    capacity: 80,
    location: "ห้องสอบบรรยายรวม 501 อาคารการบิน ชั้น 5",
    activityDate: Timestamp.fromDate(dateExam),
    createdAt: serverTimestamp(),
    isRegistrationOpen: true,
    enableEvaluation: false,
    evaluationQuestions: [],
    enableScoring: false,
    scoringConfig: null
  };

  const examActRef = await addDoc(collection(db, "activities"), examActivityData);
  console.log("✅ Created Exam Activity ID:", examActRef.id);

  const examSeats = [
    { seat: "EX-01", name: "นายวรเมธ วิทยาคม", id: "EX-101", status: "checked-in", nat: "1100300400501" },
    { seat: "EX-02", name: "นางสาวมนัสนันท์ เลิศปัญญา", id: "EX-102", status: "registered", nat: "1100300400502" },
    { seat: "EX-03", name: "นายกฤษฎา พลังคิด", id: "EX-103", status: "registered", nat: "1100300400503" }
  ];

  for (const s of examSeats) {
    await addDoc(collection(db, "registrations"), {
      activityId: examActRef.id,
      nationalId: s.nat,
      fullName: s.name,
      studentId: s.id,
      seatNumber: s.seat,
      status: s.status,
      registeredBy: "system_sample",
      registeredAt: serverTimestamp()
    });
  }
  console.log("✅ Added 3 Registrants for Exam Activity");

  // 4. Graduation Activity (งานรับปริญญา / พิธีมอบประกาศนียบัตร)
  const dateGrad = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // อีก 4 วัน
  dateGrad.setHours(8, 30, 0, 0);

  const gradActivityData = {
    name: "[ตัวอย่าง] พิธีมอบประกาศนียบัตรวิชาชีพการบิน ประจำปีการศึกษา 2568",
    type: "graduation",
    categoryId: "D1j1lRgx1Vo75jA4lBCF", // ซ้อมรับใบประกาศ(เช้า)
    capacity: 150,
    location: "หอประชุมเฉลิมพระเกียรติ มหาวิทยาลัยการบิน",
    activityDate: Timestamp.fromDate(dateGrad),
    createdAt: serverTimestamp(),
    isRegistrationOpen: true,
    enableEvaluation: false,
    evaluationQuestions: [],
    enableScoring: false,
    scoringConfig: null
  };

  const gradActRef = await addDoc(collection(db, "activities"), gradActivityData);
  console.log("✅ Created Graduation Activity ID:", gradActRef.id);

  const gradSeats = [
    { seat: "G-001", name: "นายกิตติศักดิ์ ชัยชนะ", id: "GRAD-01", status: "checked-in", nat: "1100400500601" },
    { seat: "G-002", name: "นางสาวศศิธร ดาวประดับ", id: "GRAD-02", status: "checked-in", nat: "1100400500602" },
    { seat: "G-003", name: "นายพงศกร เจริญยิ่ง", id: "GRAD-03", status: "registered", nat: "1100400500603" }
  ];

  for (const s of gradSeats) {
    await addDoc(collection(db, "registrations"), {
      activityId: gradActRef.id,
      nationalId: s.nat,
      fullName: s.name,
      studentId: s.id,
      seatNumber: s.seat,
      status: s.status,
      registeredBy: "system_sample",
      registeredAt: serverTimestamp()
    });
  }
  console.log("✅ Added 3 Registrants for Graduation Activity");

  console.log("\n==========================================");
  console.log("🎉 SEED COMPLETED SUCCESSFULLY!");
  console.log("1. Queue Activity ID:", queueActRef.id);
  console.log("   Channel 1 ID:", ch1Ref.id);
  console.log("   Channel 2 ID:", ch2Ref.id);
  console.log("   Channel 3 ID:", ch3Ref.id);
  console.log("2. Event Activity ID:", eventActRef.id);
  console.log("3. Exam Activity ID:", examActRef.id);
  console.log("4. Graduation Activity ID:", gradActRef.id);
  console.log("==========================================");

  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed Error:", err);
  process.exit(1);
});
