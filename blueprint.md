# AERO Student - Project Blueprint & Architecture

## Overview
AERO Student is an end-to-end Student Activity Registration, Seating Allocation, Queue Management, and Evaluation System built with Next.js, Firebase Firestore, and LINE Official Account (LIFF + Flex Messages).

---

## 🎨 Admin UI Standard Design Pattern (รูปแบบมาตรฐานงาน Admin & ตารางข้อมูล)

ทุกหน้าในส่วนของ Admin ที่มีตารางข้อมูล การค้นหา หรือการจัดการรายการ ต้องยึดรูปแบบมาตรฐานดังนี้เสมอ:

### 1. Clean & Flat Layout (Zero Shadow)
- **ไม่ใส่เงาใดๆ ทั้งสิ้น** (ห้ามใช้ `shadow-*`, `drop-shadow-*`)
- ใช้เส้นขอบคมชัด สะอาดตา (`border border-slate-200` หรือ `border-slate-300`)
- พื้นหลังเรียบง่าย สบายตา (`bg-white`, `bg-slate-50/70`, `divide-slate-100`)

### 2. Single-Line Compact Control Toolbar
- **ไม่ต้องมี Banner หัวข้อหรือคำอธิบายซ้ำซ้อน** (เพราะมี AdminHeader ด้านบนบอกชื่อหน้าอยู่แล้ว)
- **ไม่ต้องมี Stat Cards ขนาดใหญ่กินพื้นที่** แต่ให้นำตัวเลขนับจำนวนรวมเข้าไปในปุ่ม Filter ทันที เช่น `ทั้งหมด (1,234)`, `เช็คอิน (800)`
- จัดวางแถบควบคุมไว้ในแถวเดียวกัน:
  - ด้านซ้าย: ปุ่ม Filter Tabs
  - ด้านขวา: Dropdown ช่วงเวลา + ช่องค้นหา (Search input) + ปุ่ม Export CSV

### 3. High-Density & Clean Typography
- **ไม่ใส่ Avatar วงกลมหรือกราฟิกตกแต่งที่ไม่จำเป็น** ในแต่ละแถวของตาราง เพื่อประหยัดพื้นที่และอ่านง่าย
- ใช้ขนาดฟอนต์ `text-xs` (12px) ที่อ่านง่าย ชัดเจน ไม่ใช้ฟอนต์ตัวหนาเกินไป (`font-medium` สำหรับชื่อหัวข้อ และ `font-normal` สำหรับเนื้อหา)
- **Status Badges & 100% Thai Translation**: ทุกสถานะในตารางข้อมูลต้องแสดงเป็น **ภาษาไทย 100%** ไม่มีคำภาษาอังกฤษหลงเหลือ (`calling` -> `กำลังเรียก`, `called` -> `เรียกคิวแล้ว`, `interviewing`/`serving` -> `สอบสัมภาษณ์`, `checked-in` -> `เช็คอินแล้ว`, `registered` -> `ลงทะเบียนแล้ว`, `completed` -> `สำเร็จแล้ว`, `waitlisted` -> `รอคิว`, `cancelled` -> `ยกเลิกแล้ว`) พร้อมสีสถานะที่สื่อความหมายชัดเจน
- **Score & Action Column Pattern**: ปุ่มแก้ไขคะแนน (`📝`) ให้อยู่คู่กับ Badge คะแนนในคอลัมน์ **"คะแนนรวม"** (สามารถคลิกที่ Badge เพื่อเปิด Modal บันทึก/แก้ไขคะแนนได้ทันที) ส่วนคอลัมน์ **"จัดการ"** ให้คงไว้เฉพาะปุ่มลบรายการ (`✕`) เพื่อแยกบริบทการแก้ไขคะแนนออกจากการจัดการแถวข้อมูลอย่างชัดเจน
- **หัวตาราง**: `bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-xs`

### 4. Compact Pagination Bar
- แสดงจำนวนรายการ: `แสดง 1-25 จาก 1,234 รายการ`
- ตัวเลือกจำนวนแถวต่อหน้า: `หน้าละ: [15, 25, 50, 100]`
- ปุ่มเปลี่ยนหน้า: สี่เหลี่ยมเรียบง่าย (`«`, `‹`, `1`, `2`, `3`, `›`, `»`) ปุ่มปัจจุบันเป็น `bg-slate-900 text-white`

### 5. Modern & Readable Dark Admin Sidebar
- **Palette**: Deep Slate Dark Theme (`bg-[#0B1120]`, `bg-[#070D1A]`, `border-slate-800/90`) ที่ตัดกับเนื้อหาฝั่งขวาได้อย่างลงตัว สบายตา ไม่มืดทึบเกินไป
- **Typography & Spacing**: ฟอนต์เมนูขนาด `text-[13px] font-medium` ความกว้างขยายเป็น `w-64` (256px) พร้อมระยะ Padding ที่พอดี ทำให้ข้อความภาษาไทยอ่านง่าย ไม่เบียด
- **Active State**: ใช้ Soft Teal Accent (`from-teal-500/20 via-teal-500/10 to-transparent`) พร้อมเส้นขอบนำสายตา `border-l-[3px] border-teal-400`
- **Dynamic Elements**: Badge แสดงสถานะแบบ Modern Pill (`LIVE` ใน pulsing emerald, `ใหม่` ใน amber), Brand Icon แบบ Gradient Box และ Live Status Indicator

### 6. Role & Access Architecture (Admin Auth vs. Zero-Login Station Links)
- **Admin Section (`/admin/*`)**: มีระบบรักษาความปลอดภัยดักจับสิทธิ์ผ่าน `AdminAuthContext` (Firebase Authentication) หากยังไม่เข้าสู่ระบบจะถูก Redirect ไปที่ `/admin/login`
- **Gate Scanner Station (`/station/scanner/[activityId]`)**: จุดสแกนเนอร์หน้างาน ไม่ต้อง Login สตาฟสามารถระบุชื่อจำลงเครื่อง สแกน QR และเช็คอิน/แจกคิว/ส่ง LINE Flex ได้ทันที
- **Examiner Station (`/station/examiner/[activityId]/[channelId]`)**: โต๊ะกรรมการสัมภาษณ์ประจำช่องบริการ ไม่ต้อง Login รองรับการกดเรียกคิว, เสียงประกาศภาษาไทย, ตรวจเอกสารแนบด้วย Lightbox และให้คะแนนประเมิน
- **Quick Sharing Tools**: แอดมินสามารถกดปุ่ม "คัดลอกลิงก์โต๊ะกรรมการ" หรือ "แสดง QR Code" ส่งให้อาจารย์และสตาฟเริ่มงานได้ภายใน 30 วินาที

### 8. Identity & Admin Theme (White, Deep Navy `#000946`, Aero Orange `#FF741F`)
- **Theme Palette**: ยึด 3 โทนสีตามอัตลักษณ์ทางการบินใหม่:
  - **Primary: Deep Navy (`#000946` / `#00125E`)**: สีกรมท่าเข้ม สุขุมสง่างาม เป็นสีหลักของระบบ ปุ่มหลัก, Navbar, ส่วนหัวข้อ, และกรอบโครงสร้าง
  - **Secondary: Aero Orange (`#FF741F` / `#E55E0B`)**: สีส้มสดความปลอดภัยทางการบิน (Aviation Safety Orange) สำหรับจุดเน้น, Call-to-action, Badges, ไอคอนดาว, และปุ่มแอคชันที่ต้องการความโดดเด่น
  - **Base & Card: Pure White (`#FFFFFF` / `#F8FAFC`)**: พื้นหลังคลีนสบายตาและการ์ดโมเดิร์น คมชัด อ่านง่าย ไร้เงาสะท้อน
- **UI & Experience**:
  - การ์ดสไตล์มินิมอล คลีนและคมชัด
  - ฟอร์ม Input คมชัด อ่านง่าย มีปุ่มเปิด-ปิดรหัสผ่าน
  - กล่องข้อความแจ้งเตือนจุดบริการหน้างาน (Zero-Login Station Links) พร้อมลิงก์กลับสู่หน้านักเรียน

### 9. Student UI Typography & Design Standards (มาตรฐาน UI หน้านักเรียนและฟอร์ม)
- **น้ำหนักตัวอักษร (Font Weights)**:
  - ใช้ตัวหนา (`font-bold` / `font-semibold`) **เฉพาะจุดสำคัญเท่านั้น**: หัวข้อหลัก (H1, H2, H3), หัวการ์ด/หัวตาราง, และตัวเลขสถิติ (เช่น เลขคิว, เลขที่นั่ง, ตัวเลขนับจำนวน)
  - เนื้อหาทั่วไปทั้งหมด: คำอธิบาย, วันที่, เวลา, สถานที่, ป้ายสถานะ, ป้ายกำกับฟอร์ม (Form Labels), ช่องกรอกข้อมูล (Inputs), และปุ่มกด ต้องใช้ `font-normal`
- **ไม่ใช้ `font-mono`**:
  - ยกเลิกการใช้ `font-mono` ทุกจุดในหน้านักเรียนและฟอร์มต่างๆ ให้ใช้ฟอนต์ Sans-serif มาตรฐานของระบบ
- **ขนาดตัวอักษรขั้นต่ำ `text-sm`**:
  - กำหนดขนาดตัวอักษรเล็กที่สุดเป็น `text-sm` (14px) เพื่อให้อ่านง่าย ชัดเจนบนอุปกรณ์พกพา ไม่ใช้ `text-xs` หรือตัวอักษรขนาดจิ๋ว
- **ฟอร์มและโมดอล (Forms & Modals)**:
  - อัปเดต `ProfileSetupForm`, `EditProfileModal`, `EditProfileForm`, และ `StudentDocumentUploadModal` ให้ใช้ป้ายกำกับ `text-sm font-normal`, ช่องกรอก `text-sm font-normal`, ปุ่มกด `text-sm font-normal`, และธีมสี Deep Navy `#000946` / Aero Orange `#FF741F`

---



## Database Architecture & Design Principles

### 1. Single Source of Truth for Identity (`students` / `studentProfiles`)
- **Primary Anchor**: 13-digit National ID (`nationalId`).
- **LINE Binding**: Maps `lineUserId` to `nationalId` automatically upon first LIFF session.
- **No Orphan Docs**: Admin pre-registered students are keyed by `nationalId`. When students log in via LINE, their `lineUserId` is attached directly.

### 2. Service Layer Architecture (`src/lib/` & `src/context/`)
- `src/context/ModalContext.js`: Global modal & toast state management.
- `src/components/common/GlobalModal.js`: Unified modal dialog & toast notifications component.
- `src/lib/studentService.js`: All student identity, lookup, and LINE account linking operations.
- `src/lib/registrationService.js`: All activity registration, status updates, and quota verification logic.
- `src/lib/flexMessageTemplates.js`: LINE Flex message builders.
- `src/lib/speechUtils.js`: Thai Web Speech text-to-speech helpers for queue numbers and channel desks.
- `src/lib/firebase.js`: Firebase Firestore client & Auth initialization.

---

## 🧪 System Validation & Sample Test Activities (ชุดกิจกรรมตัวอย่างสำหรับทดสอบระบบ)

กิจกรรมตัวอย่างครอบคลุมครบทั้ง 4 รูปแบบ พร้อมข้อมูลจำลอง โต๊ะบริการ และรายชื่อผู้สมัคร:

### 1. กิจกรรมประเภทคิว / สัมภาษณ์ (`type: "queue"`)
- **ชื่อกิจกรรม**: `[ตัวอย่าง] สัมภาษณ์คัดเลือกหลักสูตรวิศวกรรมการบิน & การจัดการการบิน 2569`
- **Activity ID**: `qQ1mXOl1szXDWKLALylc`
- **ช่องบริการ (Queue Channels)**:
  - โต๊ะที่ 1: `OfM3GgBxs0Xs7ImEZM0b` (สัมภาษณ์หลักสูตรวิศวกรรมการบิน)
  - โต๊ะที่ 2: `mPw0H0ANBaLggP7jcH1F` (สัมภาษณ์หลักสูตรการจัดการการบิน)
  - โต๊ะที่ 3: `RrMIpmcuhuELaJC8nBOi` (ตรวจสอบเอกสาร & สุขภาพเบื้องต้น)
- **จุดทดสอบ**:
  - **หน้าเรียกคิวแอดมิน**: `/admin/queue/call/qQ1mXOl1szXDWKLALylc`
  - **โต๊ะกรรมการ Zero-Login**: `/station/examiner/qQ1mXOl1szXDWKLALylc/OfM3GgBxs0Xs7ImEZM0b`
  - **หน้ากระดานคิวสด**: `/queue/qQ1mXOl1szXDWKLALylc`
  - **จุดสแกนเนอร์หน้างาน**: `/station/scanner/qQ1mXOl1szXDWKLALylc`

### 2. กิจกรรมทั่วไป (`type: "event"`)
- **ชื่อกิจกรรม**: `[ตัวอย่าง] สัมมนาเปิดบ้านการบิน AERO Open House 2026`
- **Activity ID**: `CSMtdbpU2Dx94GoaMOze`
- **จุดทดสอบ**:
  - **ผังที่นั่ง & รายชื่อ**: `/admin/activity/seats/CSMtdbpU2Dx94GoaMOze`
  - **จุดสแกนเนอร์หน้างาน**: `/station/scanner/CSMtdbpU2Dx94GoaMOze`
  - **แบบประเมินผล**: `/student/evaluation/CSMtdbpU2Dx94GoaMOze`

### 3. กิจกรรมสอบข้อเขียน (`type: "exam"`)
- **ชื่อกิจกรรม**: `[ตัวอย่าง] สอบข้อเขียนคัดเลือกทุนการศึกษาการบิน ประจำปี 2569`
- **Activity ID**: `MKygsuTIyXrv6OqPRY3P`
- **จุดทดสอบ**:
  - **ผังที่นั่งสอบ**: `/admin/activity/seats/MKygsuTIyXrv6OqPRY3P`
  - **จุดสแกนเนอร์หน้างาน**: `/station/scanner/MKygsuTIyXrv6OqPRY3P`

### 4. กิจกรรมงานรับปริญญาบัตร (`type: "graduation"`)
- **ชื่อกิจกรรม**: `[ตัวอย่าง] พิธีมอบประกาศนียบัตรวิชาชีพการบิน ประจำปีการศึกษา 2568`
- **Activity ID**: `R8O0fq1ZGNJlPd80oUmg`
- **จุดทดสอบ**:
  - **ผังลำดับแถว & ที่นั่ง**: `/admin/activity/seats/R8O0fq1ZGNJlPd80oUmg`
  - **จุดสแกนเนอร์รายงานตัว**: `/station/scanner/R8O0fq1ZGNJlPd80oUmg`

---

## 📌 Registration Control & Activity Status Rules (กฎการเปิด-ปิดรับลงทะเบียน & ตรวจสอบสิทธิ์)
1. **Dynamic Registration State (`isRegistrationOpen`)**: สวิตช์ "เปิดรับลงทะเบียน" ในหน้า Admin (`/admin/activity`) จะส่งผลต่อหน้านักเรียน (`/student/activities`) แบบ Real-time ทุกประเภทกิจกรรม:
   - **เปิดรับ (`true`)**: แสดงปุ่ม "ลงทะเบียน" (หรือ "จองคิว / ลงทะเบียน" สำหรับกิจกรรมประเภทคิว)
   - **ปิดรับ/เฉพาะผู้มีสิทธิ์ (`false`)**: แสดงปุ่ม "เฉพาะผู้มีสิทธิ์ (เจ้าหน้าที่ลงทะเบียนให้)" สำหรับกิจกรรมที่แอดมินนำเข้ารายชื่อล่วงหน้า
   - **มีรายชื่อ/ลงทะเบียนแล้ว (`isRegistered`)**: แสดงปุ่มสีเขียว "✓ มีสิทธิ์เข้าร่วม (ดูบัตรคิว)" เพื่อให้นักเรียนคลิกเข้าไปดูสถานะคิว/บัตร E-Ticket ได้ทันที
   - **ที่นั่งเต็ม (`isFull`)**: แสดงปุ่ม "เต็มแล้ว" (disabled)

---

## 📷 Examiner Photo Evidence Attachment Architecture (ระบบแนบรูปถ่ายหลักฐานหน้างาน โดยกรรมการ)

ระบบถูกปรับเปลี่ยนจาก "การตรวจเอกสาร (Document Verification)" มาเป็น **"การแนบรูปถ่ายหลักฐานหน้างาน (Pure Photo Evidence Attachment)"** ล้วนๆ เพื่อความคล่องตัวและตรงตามการปฏิบัติงานจริง:

### 1. Student Registration Flow (ฝั่งนักเรียน - รวดเร็ว ปลอดภัย และแสดงรูปหลักฐานเมื่อกรรมการแนบเท่านั้น)
- **Zero Student Attachment Permission**: นักเรียน**ไม่มีสิทธิ์แนบหรืออัปโหลดรูปภาพเอกสารใดๆ ทั้งสิ้น** เพื่อป้องกันความล่าช้าและความผิดพลาด
- **Clean Registration**: หน้าระบบลงทะเบียน (`/student/register`) ไม่มีส่วนของการแนบเอกสารใดๆ
- **Conditional Examiner Evidence Display**: ในหน้ารายการลงทะเบียนของฉัน (`/student/my-registrations`) ส่วนของรูปถ่ายหลักฐานจะ**ซ่อนสนิทหากยังไม่มีการแนบ** และจะ**ปรากฏขึ้นเฉพาะเมื่อกรรมการได้ถ่ายภาพแนบรูปถ่ายหลักฐานเข้าระบบแล้วเท่านั้น (`totalAttachedDocs > 0`)** พร้อมปุ่ม "🔍 ดูรูปถ่ายหลักฐาน" เพื่อความโปร่งใส

### 2. On-Desk Examiner Workflow (ฝั่งกรรมการ - แนบรูปถ่ายหลักฐานหน้างาน ไม่ใช่การตรวจเอกสาร)
- **Pure Evidence Photo Capture**: ไม่มีส่วน "ตรวจเอกสาร", ไม่มี Checklist ปพ.1 หรือ Portfolio ที่ยุ่งยากอีกต่อไป แต่เป็นกล่อง **"แนบรูปถ่ายหลักฐานหน้างาน"** พร้อมปุ่มตรงไปตรงมา `[ 📷 ถ่ายภาพ / แนบรูปหลักฐาน ]`
- **Device Camera & Gallery**: รองรับการเปิดกล้องแท็บเล็ต/สมาร์ทโฟนถ่ายภาพได้ทันที หรือเลือกรูปจากอัลบั้มรูปภาพ
- **Multi-Photo Gallery & Management**: แสดงรูปถ่ายหลักฐานที่แนบทั้งหมดในรูปแบบ Gallery Grid สามารถกดกากบาท (✕) เพื่อลบรูปออก หรือคลิกที่รูปเพื่อขยายดูเต็มจอ (Lightbox)
- **Client-Side Compression**: ภาพถ่ายความละเอียดสูงจะถูกย่อขนาดและบีบอัดอัตโนมัติผ่าน HTML5 Canvas เหลือเพียง ~200-300KB
- **Zero-CORS Dual-Tier Upload Engine**:
  - อัปโหลดผ่าน Next.js API Route (`/api/upload`) จัดเก็บลงในโฟลเดอร์ `/public/uploads` โดยตรง ไม่ติดปัญหา CORS หรือ Bucket Not Found (404) จาก Firebase Storage บน localhost หรือเซิร์ฟเวอร์
  - มีระบบ Fallback ไปยัง Firebase Storage อัตโนมัติเมื่อมีการเปิดใช้งาน Bucket ใน Firebase Console
  - บันทึก URL ขนาดกะทัดรัด (เช่น `/uploads/evidence_*.jpg`) ลงใน Firestore Collection `registrations` ภายใต้ฟิลด์ `attachedDocuments: { evidence: [urls] }` ป้องกันปัญหาขนาด Document เกินขีดจำกัด 1MB ของ Firestore
  - ประทับตรา `attachedBy: 'examiner'` และ `attachedAt: serverTimestamp()`
- **Multi-Criteria Scoring Engine**:
  - เกณฑ์คะแนนทั่วไป (General Criteria)
  - เกณฑ์คะแนนตามประเภทโควตา (Quota Criteria)
  - คำนวณคะแนนถ่วงน้ำหนักรวม 100% แบบ Real-time พร้อมบันทึกข้อเสนอแนะและชื่อกรรมการผู้ประเมิน

### 3. Activity Builder Configuration (ฝั่งแอดมิน - ปรับให้กระชับ)
- ยกเลิกการตั้งค่ารายการเอกสารบังคับ (Required Documents Checklist ปพ.1/Portfolio) ในหน้าสร้าง/แก้ไขกิจกรรม
- แทนที่ด้วยกล่องแจ้งเตือน **"ระบบแนบรูปถ่ายหลักฐานหน้างาน (Photo Evidence)"** ซึ่งเปิดใช้งานอัตโนมัติ กรรมการสามารถถ่ายภาพหลักฐานได้ทันทีโดยไม่ต้องตั้งค่ารายการเอกสารล่วงหน้า
### 9. Station Pages Light Theme & High-Contrast Field Standard (รูปแบบธีมสว่างสำหรับจุดบริการหน้างาน)
- **Zero-Glitch Light Palette**: หน้าโต๊ะกรรมการ (`/station/examiner/*`) และจุดสแกนเนอร์หน้างาน (`/station/scanner/*`) เปลี่ยนจากธีมมืดเป็น **ธีมสว่าง (Light Theme)** ที่สะอาดตา สว่าง คมชัด เข้ากับแสงไฟในห้องสอบ/หน้างานจริง
- **High-Contrast Input Fields (แก้ปัญหาตัวหนังสือมองไม่เห็น)**: ทุกช่อง Input, Search Box, Modal Prompt ต้องกำหนด:
  - พื้นหลัง: `bg-white`
  - สีตัวอักษร: `text-slate-900 font-medium` (สีดำเข้มชัดเจน 100% ไม่จาง ไม่กลืนกับพื้นหลัง)
  - Placeholder: `placeholder:text-slate-400`
  - ขอบและสถานะโฟกัส: `border border-slate-300 focus:border-[#166E7C] focus:ring-2 focus:ring-[#166E7C]/20 outline-none`
- **Station Examiner Console**:
  - การ์ดผู้สมัครปัจจุบัน: พื้นหลัง `bg-white border border-slate-200 shadow-sm`, รหัสคิวเด่นชัดด้วยกรอบสี `bg-teal-50 text-[#166E7C] border border-teal-200`, ตัดฟิลด์ข้อมูลส่วนเกิน (เบอร์โทรศัพท์, โรงเรียนเดิม, เกรดเฉลี่ย GPAX) ออกเพื่อให้หน้าจอเรียบง่าย คลีน โฟกัสเฉพาะคิว ชื่อผู้สมัคร หลักสูตร และรูปถ่ายหลักฐานหน้างาน
  - คอลัมน์รายการคิวด้านขวา: ปรับเป็น Light List พร้อมปุ่ม Filter Tabs (รอเรียก, กำลังเรียก, เสร็จแล้ว) สไตล์มินิมอล
- **Station Scanner Terminal**:
  - แท็บเลือกระหว่างกล้อง QR และการค้นหาด้วยชื่อ/เลขบัตร 13 หลัก ปรับเป็นสไตล์ Flat Tab สว่าง คลีน
  - การ์ดผลการสแกน/เช็คอินสำเร็จ: ปรับเป็นการ์ดสีขาว `bg-white` ตัวเลขอ่านง่ายชัดเจนในทุกมุมมอง

### 10. Real-time Queue Calling & Public Display Board Synchronization Standard (มาตรฐานการซิงค์ข้อมูลเรียกคิวกับหน้าจอกลาง)
- **Two-Way Synchronization**: เมื่อโต๊ะกรรมการ (`/station/examiner/*`), แอดมินศูนย์ควบคุม (`/admin/queue/call/*`), หรือแอดมินคุมช่องบริการ (`/admin/queue/control/*`) กดเรียกคิว/เรียกซ้ำ/เสร็จสิ้นการสัมภาษณ์:
  - บันทึกลงใน Firestore Collection `queueChannels` ครบถ้วนทุกฟิลด์:
    - `currentDisplayQueueNumber` และ `currentQueue`: หมายเลขคิวที่แสดงผล
    - `currentQueueNumber`: ตัวเลขลำดับคิว
    - `currentStudentName`: ชื่อ-นามสกุลผู้สมัคร (มี Fallback ชื่อเต็ม ไม่ปล่อยให้เป็นค่าว่าง)
    - `status`: สถานะช่องบริการ (`calling`, `available`)
    - `pingId`: ประทับเวลา `Date.now()` ทุกครั้งที่มีการเรียกคิวหรือเรียกซ้ำ (Recall)
    - `lastCalledAt`: ประทับเวลา `serverTimestamp()`
  - ใช้ `setDoc(..., { merge: true })` เพื่อป้องกันปัญหาข้อผิดพลาดหากเอกสารช่องบริการยังไม่ถูกสร้างใน Firestore
- **Public Display Board (`/queue/[id]`)**:
  - ตัด `orderBy('channelNumber')` ออกจากการ Query ใน Firestore เพื่อป้องกันปัญหา Index Error หรือเอกสารตกหล่น และใช้การจัดเรียงผ่าน JavaScript Client-Side แทน
  - มี Fallback แสดงผล `{channel.currentDisplayQueueNumber || channel.currentQueue || '-'}`
  - แสดงสถานะ "กำลังเรียกคิว" หากชื่อผู้สมัครว่างเปล่า แต่ช่องบริการอยู่ในสถานะ `calling`
  - ตรวจจับทั้งการเปลี่ยนแปลงของ `pingId` และการเปลี่ยนหมายเลขคิว/เวลาเรียก เพื่อสั่งงานเสียงสังเคราะห์ภาษาไทย (Thai TTS) และเอฟเฟกต์กระพริบสีแดงเตือนสายตา (Pulsing Red Effect) อย่างแม่นยำ 100%

### 11. Dynamic Evaluation Questionnaire Builder (ระบบตั้งค่าหัวข้อแบบประเมิน & ตัวเลือกเดี่ยว/หลายข้อ)
- **Comprehensive Question Types**: รองรับหัวข้อคำถาม 4 รูปแบบ:
  1. `rating`: การประเมินคะแนนความพึงพอใจ 1 - 5 ดาว
  2. `text`: ข้อความความคิดเห็นปลายเปิด
  3. `radio`: ตัวเลือกเดี่ยว (เลือกได้ 1 ข้อ) พร้อมระบบกำหนดรายการตัวเลือก
  4. `checkbox`: ตัวเลือกหลายข้อ (เลือกได้มากกว่า 1 ข้อ) พร้อมระบบกำหนดรายการตัวเลือก
- **Inline Options Configuration Panel**:
  - เมื่อแอดมินเลือกประเภทเป็น "ตัวเลือกเดี่ยว (Radio)" หรือ "ตัวเลือกหลายข้อ (Checkbox)" ในหน้าสร้าง/แก้ไขกิจกรรม (`/admin/activity/add` และ `/admin/activity/edit/[id]`):
  - ระบบจะแสดงกล่องจัดการตัวเลือกแบบอินไลน์ทันที พร้อมระบุสัญลักษณ์ประเภทตัวเลือก (`○` สำหรับ Radio และ `□` สำหรับ Checkbox)
  - แอดมินสามารถพิมพ์ข้อความตัวเลือก, กดปุ่ม `+ เพิ่มตัวเลือก` เพื่อเพิ่มชอยส์ใหม่ได้อย่างไม่จำกัด, และกดลบตัวเลือกที่ไม่ต้องการออกได้ (`✕`)
  - มีระบบ Auto-initialization และ Data Sanitization ป้องกันตัวเลือกว่างเปล่า หรือกรณีที่ไม่มีการกำหนดตัวเลือก
- **Student Form & Reporting Integration**:
  - ฝั่งนักเรียน (`/student/evaluation/[activityId]`): แสดงตัวเลือก Radio/Checkbox ที่กำหนดไว้อย่างถูกต้อง พร้อมระบบ Validation ตรวจสอบความครบถ้วน
  - ฝั่งรายงานผลแอดมิน (`/admin/evaluation/[activityId]`): ประมวลผลสถิติเปอร์เซ็นต์และกราฟแท่ง (Bar Chart) แสดงจำนวนผู้เลือกในแต่ละตัวเลือก พร้อมระบบจัดรูปแบบข้อมูล Array เป็นข้อความคั่นด้วยเครื่องหมายจุลภาคในตารางและไฟล์ CSV อย่างสมบูรณ์

### 12. Student My-Registrations & Clean Single-Stream Flow (รูปแบบการแสดงผลหน้ากิจกรรมของฉันแบบไร้ Tab ซ้อน)
- **Problem & Solution**: การมีแท็บซ้อนกัน 2 ชั้น (`[ ค้นหากิจกรรม ] / [ การลงทะเบียนของฉัน ]` ที่ Navbar ด้านบน และ `[ ต้องเข้าร่วม ] / [ สิ้นสุดแล้ว ]` ที่เนื้อหาด้านล่าง) ทำให้หน้าจอดูรกและซับซ้อนเกินไปสำหรับแอพมือถือ ("มี tab ซ้อนกัน 2 ชั้นมันดูไม่สวยเลย")
- **Single-Stream Seamless Flow (ไร้แท็บซ้อน)**:
  - ยกเลิกแท็บย่อยชั้นที่ 2 ออกทั้งหมด คงไว้เฉพาะแท็บหลักใน `StudentHeader` เพียงชั้นเดียว
  - **กิจกรรมปัจจุบัน (Active / Upcoming Tickets)**: แสดงอยู่ด้านบนสุดทันที ไม่ต้องมีปุ่มหรือแท็บมาขวางกั้น ผู้สมัครเห็นบัตรคิว (`คิวของคุณ AMT-001`) หรือผังที่นั่งพร้อมใช้สแกน QR เช็คอินได้ทันที
  - **กิจกรรมที่สิ้นสุดแล้ว (Completed Activities)**: แสดงต่อเนื่องด้านล่างภายใต้หัวข้อ `🏁 กิจกรรมที่สิ้นสุดแล้ว (${count})` อย่างเป็นระเบียบ
  - **รายละเอียดครบถ้วน 100%**: การ์ดกิจกรรมที่จบแล้วแสดงรายละเอียดครบทุกมิติ (สถานที่, เวลา, ผลคะแนน, ผังที่นั่ง, รูปถ่ายหลักฐานหน้างานพร้อม Lightbox และปุ่มทำแบบประเมิน) คลีน สบายตา เลื่อนดูได้เป็นธรรมชาติ สไตล์โมบายล์แอปชั้นนำ

### 13. Image Error Resilience & Elegant Icon Fallback (ระบบป้องกันรูปภาพเสียและแสดงไอคอนสำรองอัตโนมัติ)
- **Student Profile Avatar (`StudentHeader.js`, `/liff/register`)**:
  - เมื่อ `liffProfile.pictureUrl` ไม่มีข้อมูล หรือเกิดข้อผิดพลาดในการโหลดรูปภาพ (`onError`):
  - ระบบจะสลับไปแสดงไอคอน Silhouette ผู้ใช้สีขาว (`<svg>`) บนพื้นหลัง Deep Teal (`#0F5661`) ขอบสีทอง (`#C59B27`) อย่างสวยงามและเป็นมืออาชีพ ไม่แสดงไอคอนกากบาทหรือรูปแตก (Broken Image)
- **Document & Evidence Thumbnails (`SafeThumbnailImage`, `SafeEvidenceImage`, `SafePhotoThumbnail`, `SafeEvidenceThumbnail`)**:
  - ในหน้ากิจกรรมของฉัน (`/student/my-registrations`), โมดอลตรวจเอกสาร (`StudentDocumentUploadModal`), โต๊ะกรรมการ (`ExaminerScoringModal`), และสถานีคัดกรอง (`StationExaminerPage`):
  - หาก URL รูปถ่ายหลักฐาน/ใบเสร็จหมดอายุ, เสียหาย, หรือโหลดไม่ขึ้น ระบบจะตรวจจับผ่าน `onError` และแสดงผลเป็นการ์ดไอคอนกล้องถ่ายรูป (`📷`) พร้อมข้อความกำกับอย่างเรียบร้อย
- **Lightbox Fullscreen Zoom**:
  - ทุกจุดที่มีการคลิกดูรูปขยายแบบ Fullscreen Lightbox จะมีตัวจับ Error State (`lightboxError`) แสดงกล่องไอคอนและแจ้งว่า "ไม่สามารถโหลดรูปภาพนี้ได้" พร้อมปุ่มปิดรูปภาพ ป้องกันหน้าจอมืดหรือแสดงสัญลักษณ์รูปแตก

### 14. Flexible Zone Allocation & Custom Zone Start Numbers (ระบบจัดสรรโซนและกำหนดเลขเริ่มต้นของแต่ละโซน)
- **Problem & Requirement**: การจัดผังที่นั่งในบางกิจกรรม เช่น จัด 4 โซน ต้องการให้แต่ละโซนมีเลขเริ่มต้นที่กำหนดเองได้ เช่น โซน 1 เริ่มที่ 1 (1-100), โซน 2 เริ่มที่ 101 (101-200), โซน 3 เริ่มที่ 201 (201-300), และ **โซน 4 กำหนดเลขเริ่มต้นเป็น 801 (801-900)** แทนที่จะเป็นเลข 301 ต่อเนื่อง
- **Zone Configuration Panel (`/admin/activity/seats/[id]/chart`)**:
  - ในหน้าต่าง "แก้ไขข้อมูลห้องสอบและผังที่นั่ง" เพิ่มตารางตั้งค่ารายละเอียดแต่ละโซนแบบอินไลน์:
    - **ชื่อโซน (Zone Name)**: กำหนดได้อิสระ (เช่น `1, 2, 3, 4` หรือ `A, B, C, D`) พร้อมปุ่ม Preset สลับรูปแบบชื่อทันที
    - **เลขเริ่มต้น (Start Number)**: กำหนดเลขเริ่มของแต่ละโซนได้อย่างอิสระ
    - **ช่วงที่นั่งคำนวณอัตโนมัติ (Live Seat Range)**: แสดงผลแบบ Real-time `startNumber - (startNumber + seatsPerZone - 1)` เช่น `801 - 900 (100 ที่นั่ง)`
    - **รูปแบบรหัสที่นั่ง (Label Format)**: เลือกระหว่าง "เฉพาะตัวเลข" (`801..900`) หรือ "มีชื่อโซนนำหน้า" (`4-801` หรือ `D801`)
    - **ปุ่มรีเซ็ตเลขรัน (`↺ รีเซ็ตเลขรัน`)**: คำนวณเลขรันต่อเนื่องตามลำดับอัตโนมัติ
- **Smart Auto-Assign Engine (`/admin/activity/seats/[id]`)**:
  - ระบบจัดที่นั่งอัตโนมัติจะนำค่า `examConfig.zones` มาจัดสรรที่นั่งให้นักเรียนตามช่วงเลขที่นั่งที่กำหนดไว้ในแต่ละโซนอย่างแม่นยำ
  - หน้าต่างยืนยันการจัดที่นั่งแสดงสรุปช่วงเลขที่นั่งของแต่ละโซนให้ตรวจสอบความถูกต้องก่อนเริ่มดำเนินการ
  - รองรับกิจกรรมทั้งประเภท `exam` และ `event`
- **Synchronized Chart Visualization**:
  - ผังที่นั่งทั้งฝั่งแอดมิน (`/admin/activity/seats/[id]/chart`) และฝั่งนักเรียน (`/student/activity/[id]/chart`) นำโครงสร้างเลขที่นั่งใหม่มาแสดงผลตรงกัน 100% พร้อมระบบค้นหาและไฮไลต์ที่นั่งของผู้สมัคร

### 15. Examiner Station Queue Synchronization & Student Ticket Alignment (ระบบเรียกคิวโต๊ะกรรมการและซิงค์หมายเลขคิวนักเรียน 100%)
- **Problem & Root Causes**:
  - โต๊ะกรรมการ (`/station/examiner/[activityId]/[channelId]`) เคยฮาร์ดโค้ดแสดงผลเป็น `Q-${queueNumber}` ใน 3 จุดหลัก (ปุ่มเรียกคิวถัดไป, แบนเนอร์ผู้สมัครปัจจุบัน, และตารางรายการคิว) ทำให้ข้ามค่า `displayQueueNumber` (เช่น `AMT-001`, `FT-001`) ที่นักเรียนถืออยู่ในมือ
  - การจัดเรียงลำดับคิวใช้ `Number(queueNumber)` ทำให้คิวที่มีรหัสหลักสูตรหรือค่า null สลับลำดับคิวอย่างไม่ถูกต้อง
  - การจัดหมวดหมู่สถานะคิวเคยเกิดข้อผิดพลาดในการตรวจสอบ `status` ส่งผลให้ผู้ที่สัมภาษณ์เสร็จแล้วถูกมองว่ายังรอคิว
  - การกรองหลักสูตรประจำโต๊ะเคยอ้างอิง `channel?.course` เพียงอย่างเดียว ไม่สอดคล้องกับค่า `channel?.servingCourse` ที่บันทึกจากระบบ Admin
- **Synchronized Queue Architecture**:
  - **Single Source of Truth (`getCandidateQueueDisplay`)**: ทุกจุดในระบบโต๊ะกรรมการจะแสดงหมายเลขคิวตรงกับบัตรคิวนักเรียนเสมอ โดยยึดลำดับ: `candidate.displayQueueNumber` > `prefix-00X` (จาก courseOptions) > `candidate.queueNumber` > `candidate.seatNumber`
  - **Smart Queue Sorting Engine**: ถอดรหัสตัวเลขจาก `displayQueueNumber` และ `queueNumber` พร้อมจัดเรียงตามลำดับเวลาเช็คอิน (`checkedInAt`) อย่างแม่นยำ
  - **Resilient Waiting vs Completed Resolution**:
    - ตรวจสอบ `cand.status === 'checked-in' && !cand.calledAt` ให้มีสถานะเป็น `waiting` (รอเรียกคิว) เสมอ แม้จะมีค่า `queueStatus` ตกค้างจากการทดสอบก่อนหน้า
    - ผู้สมัครจะถือว่า `completed` (เสร็จแล้ว) ก็ต่อเมื่อมีผลการประเมินจริง (`evaluationScore?.isScored`), มีการระบุ `completedAt`, หรือ `status === 'completed'` เท่านั้น
    - เพิ่ม Badge แสดงจำนวนคิวบนแถบปุ่มตัวกรอง: `รอเรียก (${waiting})`, `กำลังเรียก (${calling})`, `เสร็จแล้ว (${completed})` เพื่อให้กรรมการเห็นภาพรวมทันที
    - ซิงค์ระบบรีเซ็ตคิวของแอดมิน (`/admin/queue/call/[id]`) ให้รีเซ็ตทั้ง `calledAt: null`, `status: 'checked-in'`, และ `queueStatus: 'waiting'` ให้ตรงกันทั้งระบบ

### 16. Universal Queue Calling & Post-Evaluation Transition (แก้ปัญหาปุ่มเรียกคิวถัดไปกดไม่ได้ และระบบเสร็จสิ้นคิวอัตโนมัติ)
- **Problem & Root Causes**:
  - ในหน้าควบคุมการเรียกคิว (`/admin/queue/call/[id]` และ `/admin/queue/control/[id]`) ปุ่ม "เรียกคิวถัดไป" เคยถูกกำหนดเงื่อนไขปิดการใช้งานเป็น `disabled={!channel.servingCourse}`
  - เมื่อผู้ดูแลระบบตั้งค่าช่องบริการเป็น **"ทุกหลักสูตร"** (ค่า `channel.servingCourse = null` หรือ `""`) เงื่อนไขดังกล่าวส่งผลให้ปุ่มถูกปิดการทำงานตลอดเวลา (Disabled ถาวร) แม้ว่าจะมีผู้รอรับบริการอยู่ในคิวก็ตาม
  - กรรมการที่บันทึกคะแนนเสร็จแล้ว (`AE-002`) จึงไม่สามารถกดเรียกคิวถัดไปได้ และไม่มีปุ่มกด "เสร็จสิ้นคิวนี้" เพื่อเคลียร์โต๊ะให้ว่าง
- **Universal Queue Solutions**:
  - **Dynamic Waiting Check (`hasWaiting`)**: ปรับเงื่อนไขการปิดปุ่มเรียกคิวเป็น `disabled={!hasWaiting}` โดยคำนวณจากจำนวนคิวที่เช็คอินแล้วและยังไม่ถูกเรียก (`status === 'checked-in' && !calledAt`) ที่ตรงตามหลักสูตรของช่องบริการ หรือทุกหลักสูตรกรณีไม่ได้เจาะจง
  - **Live Counter on Button**: แสดงจำนวนคิวที่รออยู่บนปุ่มทันที เช่น `📢 เรียกคิวถัดไป (2)` หรือ `📢 เรียกคิวถัดไป (ไม่มีคิวรอ)`
  - **Auto-Complete Previous Candidate**: เมื่อกดเรียกคิวถัดไป ระบบจะอัปเดตผู้สมัครคนก่อนหน้าที่กำลังรับบริการอยู่ให้มีสถานะเป็น `status: 'completed'`, `queueStatus: 'completed'`, และ `completedAt: serverTimestamp()` อัตโนมัติใน Firestore Write Batch
  - **Explicit Complete Button (`เสร็จสิ้นคิวนี้`)**: เพิ่มปุ่มสีเขียว `✅ เสร็จสิ้นคิวนี้ (AE-002)` ให้กรรมการหรือแอดมินสามารถกดปิดงานผู้สมัครปัจจุบันและเปลี่ยนสถานะโต๊ะกลับเป็น "ว่าง" ได้ทันทีโดยไม่ต้องรอเรียกคิวถัดไป

### 17. Multi-Examiner Allocation & Non-Duplicate Table Assignment (ระบบกำหนดกรรมการโต๊ะละ 2 ท่าน ไม่ซ้ำกันในแต่ละโต๊ะ และเลือกจาก Master List Dropdown)
- **Problem & Requirement**:
  - เดิมระบบคิวรองรับการระบุชื่อกรรมการเพียงท่านเดียวแบบพิมพ์ข้อความอิสระ (Free-text) และจำไว้ในเครื่องเดียว (`localStorage`) ทำให้แต่ละโต๊ะอาจมีกรรมการไม่ตรงกัน หรือพิมพ์ชื่อสะกดต่างกัน
  - ข้อกำหนดใหม่ต้องการให้:
    1. **กรรมการโต๊ะละ 2 ท่าน**: แต่ละโต๊ะ (Channel) มีกรรมการ 2 ท่าน (กรรมการคนที่ 1 และ กรรมการคนที่ 2)
    2. **ชื่อกรรมการต้องไม่ซ้ำกันในแต่ละโต๊ะ**: ไม่สามารถเลือกกรรมการคนเดียวกันในทั้ง 2 ช่องของโต๊ะเดียวกันได้ และกรรมการที่ถูกเลือกประจำโต๊ะหนึ่งแล้ว จะถูกล็อกไม่ให้เลือกซ้ำในโต๊ะอื่น (Non-overlapping across tables)
    3. **กำหนดรายชื่อล่วงหน้า แล้วเลือกจาก Dropdown**: มีฐานข้อมูลรายชื่อคณะกรรมการกลาง (Examiners Master List) เพื่อให้เลือกจาก Dropdown ได้อย่างรวดเร็วและเป็นมาตรฐานเดียวกัน
- **Architecture & Implementation**:
  - **Examiners Master List (`/admin/settings` & Quick Modal in `/admin/queue/call/[id]`)**:
    - เพิ่มคอลเลกชัน Firestore `examiners` เก็บข้อมูล `{ name, role, createdAt }`
    - หน้าตั้งค่าระบบ (`/admin/settings`) เพิ่มการ์ดจัดการรายชื่อกรรมการ (เพิ่ม, แก้ไข, ลบ, และปุ่มลัดสร้างข้อมูลตัวอย่าง 6 ท่าน)
    - หน้าห้องคิว (`/admin/queue/call/[id]`) เพิ่มปุ่มด่วน **"👥 จัดการกรรมการ"** พร้อม Modal สำหรับเพิ่ม/ตรวจสอบสถานะการประจำโต๊ะของกรรมการแต่ละท่านแบบ Realtime
  - **Channel-Level Multi-Examiner Schema**:
    - เอกสาร `queueChannels/{id}` จัดเก็บ:
      - `examiner1`: ชื่อกรรมการคนที่ 1
      - `examiner2`: ชื่อกรรมการคนที่ 2
      - `examiners`: Array รายชื่อกรรมการทั้งสองท่าน `[examiner1, examiner2].filter(Boolean)`
  - **Cross-Table Duplicate Prevention Engine**:
    - คำนวณ `assignedExaminersMap` จากทุกโต๊ะในกิจกรรมเดียวกันแบบ Realtime
    - ตัวเลือกใน Dropdown:
      - หากชื่อถูกเลือกในช่องอื่นของโต๊ะเดียวกัน -> Disabled พร้อมขึ้นแท็ก `(เลือกเป็นคนที่ ... แล้ว)`
      - หากชื่อถูกเลือกประจำโต๊ะอื่นแล้ว -> Disabled พร้อมขึ้นแท็ก `(ประจำโต๊ะที่ ... แล้ว)`
      - หากปลดชื่อออกเป็น `-- ยังไม่ระบุ --` -> ชื่อนั้นจะกลับมาเปิดให้ทุกโต๊ะเลือกได้ใหม่อัตโนมัติทันที
  - **Evaluation & Scoring Traceability**:
    - เมื่อกดเรียกคิว หรือกดเสร็จสิ้นคิว ระบบจะบันทึก `interviewedBy: "อ.สมชาย ใจดี, ผศ.ดร.สมหญิง รักเรียน"` และ `examiners: ["อ.สมชาย ใจดี", "ผศ.ดร.สมหญิง รักเรียน"]`
    - `ExaminerScoringModal` รับค่ากรรมการทั้ง 2 ท่านเป็นค่าเริ่มต้นอัตโนมัติ และบันทึกลงในผลการประเมิน `evaluationScore` โดยยังคงความเข้ากันได้กับรายงานและการส่งออก CSV เดิม 100%
  - **Examiner Tablet Station Synchronized (`/station/examiner/[activityId]/[channelId]`)**:
    - ซิงค์รายชื่อกรรมการทั้ง 2 ท่านจาก Firestore แบบ Realtime พร้อมปุ่มคลิกแก้ไขกรรมการผ่าน Dropdown 2 ท่านได้จากหน้าจอแท็บเล็ต

### 18. Activity Type Display & Separation: General Event (กิจกรรมทั่วไป) No Queue & No Seating Standard
- **Activity Type Segregation**:
  - `queue` / `interview`: กิจกรรมคิวบริการ/สอบสัมภาษณ์ -> มีหมายเลขคิว, ลำดับคิว, และเวลาสอบสัมภาษณ์
  - `exam` / `graduation`: สอบข้อเขียน/รับปริญญาบัตร -> มีระบบจัดเลขที่นั่ง, ผังที่นั่ง (`seatNumber`), และลิงก์ดูผังที่นั่ง
  - `event` (กิจกรรมทั่วไป เช่น งาน Open House, สัมมนา, นิทรรศการ): **ไม่มีคิว และไม่มีเลขที่นั่ง**
- **Student My Registrations (`/student/my-registrations`)**:
  - **บัตรกิจกรรมทั่วไป (RegistrationCard)**: ส่วนหัวแบนเนอร์แสดงไอคอนปฏิทินงานกิจกรรม พร้อม วัน-เดือน-ปี และ เวลาจัดกิจกรรม (พร้อมสถานที่) แทนที่การแสดงเลขที่นั่งหรือการบอกว่า "ยังไม่ได้รับ"
  - **บัตรกิจกรรมที่สิ้นสุดแล้ว (CompletedRegistrationCard)**: ซ่อนป้าย Badge `ที่นั่ง ...` และซ่อนบล็อกลิงก์ `ผังที่นั่ง` สำหรับกิจกรรมประเภททั่วไป
- **Admin Activity Management (`/admin/activity`)**:
  - ปุ่มบนการ์ดกิจกรรมประเภททั่วไป (`event`) แสดงเป็น **"จัดการผู้ลงทะเบียน"** เพื่อความถูกต้องตามบริบท แทนที่จะแสดง "จัดการที่นั่ง & คิว"
  - ในหน้ารายละเอียด (`/admin/activity/seats/[id]`) ซ่อนปุ่มผังที่นั่งและปุ่มจัดที่นั่งอัตโนมัติสำหรับกิจกรรมทั่วไป

### 19. Activity Checkout & Exit QR Lifecycle (วงจรการจบกิจกรรม: QR code ออก และการประเมินกิจกรรมแม้กรรมการจะเสร็จสิ้นการสัมภาษณ์แล้ว)
- **Problem & Root Causes**:
  - เมื่อกรรมการที่โต๊ะสัมภาษณ์กด "สัมภาษณ์เสร็จสิ้น" หรือ "เสร็จสิ้นคิวนี้" (`handleCompleteInterview` หรือ `handleCompleteCurrent`) ข้อมูลผู้สมัครจะถูกอัปเดต `status: 'completed'` ทันที
  - ส่งผลให้ในหน้า `/student/my-registrations`:
    - ฟังก์ชัน `isActivityEnded(reg)` จัดหมวดหมู่ตั๋วเข้าสู่กลุ่ม "กิจกรรมที่สิ้นสุดแล้ว" (`completedRegistrations`) ทันที ทั้งๆ ที่นักเรียนยังอยู่ที่หน้างานและต้องเดินไปจุดทางออก
    - บัตร `CompletedRegistrationCard` เดิมไม่มีปุ่มแสดง QR Code เลย ทำให้นักเรียนไม่มี **"QR code ออก"** ไปแสดงกับเจ้าหน้าที่จุดทางออก
    - บัตร `RegistrationCard` เดิม ซ่อนปุ่ม "QR จบกิจกรรม" หากนักเรียนยังไม่ได้ทำแบบประเมิน (`!hasEvaluated`) ทำให้นักเรียนสับสนว่าทำไมไม่มี QR ออก
  - ในจุดสแกนเนอร์ `/admin/scanner` และ `/station/scanner/[activityId]`:
    - เดิมในโหมด `check-out` มีเงื่อนไขดักจับ `if (registrationData.status === 'completed')` ส่งผลให้ระบบปฏิเสธการสแกนออกโดยแจ้งว่า "ได้จบกิจกรรมไปแล้ว" ทันที โดยที่ยังไม่ทันได้ตรวจสอบว่านักเรียนทำแบบประเมินแล้วหรือไม่ และไม่สามารถบันทึกการเช็คเอาท์จริงได้
- **Comprehensive Solution & Lifecycle Architecture**:
  1. **Dual-Stage Activity Lifecycle Tracking**:
     - **Stage 1 (Interview/Service Complete)**: เมื่อกรรมการเสร็จสิ้นการสัมภาษณ์ ระบบจะบันทึก `queueStatus: 'completed'`, `interviewedAt: serverTimestamp()`, และ `interviewedBy: ...`
     - **Stage 2 (Gate Exit / Official Check-out)**: นักเรียนต้องทำแบบประเมิน (หากเปิดใช้งาน) และสแกน **"QR code ออก"** กับเจ้าหน้าที่จุดทางออก โดยระบบจะบันทึก `checkedOut: true`, `checkedOutAt: serverTimestamp()`, และ `checkedOutBy: ...`
  2. **Student My Registrations UX (`/student/my-registrations`)**:
     - **Resilient Active Status (`isActivityEnded`)**: กิจกรรมวันนี้ที่นักเรียนยังไม่ได้สแกนออก (`!reg.checkedOut && !reg.checkedOutAt`) จะยังคงอยู่บนแท็บกิจกรรมปัจจุบัน เพื่อให้นักเรียนเข้าถึงปุ่ม **"QR code ออก"** และ **"ประเมินกิจกรรม"** ได้อย่างสะดวกทันที
     - **Status Badge Clarification**: แสดงสถานะชัดเจนเป็น `📝 สัมภาษณ์เสร็จสิ้น (รอสแกนออก)` เพื่อให้นักเรียนทราบว่าเสร็จสิ้นกับกรรมการแล้ว แต่ยังต้องสแกนออกที่ทางออก
     - **Universal Exit QR Access**:
       - บน `RegistrationCard`: ปุ่ม **"🏁 QR code ออก"** จะแสดงให้นักเรียนกดเปิดได้ตลอดเวลาเมื่อเข้าสู่กิจกรรมหรือสัมภาษณ์เสร็จสิ้น
       - บน `CompletedRegistrationCard`: เพิ่มปุ่ม **"🏁 QR code ออก"** เพื่อให้นักเรียนเปิด QR ได้เสมอไม่ว่าจะเปิดจากส่วนใด
     - **Smart Exit QR Modal (`QRModal`)**:
       - ระบุหัวข้อชัดเจนว่า "QR Code สแกนจบกิจกรรม (ทางออก)"
       - หากยังไม่ได้ทำแบบประเมิน: แสดงกล่องเตือนสีเหลืองอำพัน `⚠️ ต้องทำแบบประเมินก่อนจบกิจกรรม` พร้อมปุ่มกด `⭐ ทำแบบประเมินเดี๋ยวนี้` ภายใน Modal ทันที
       - หากทำแบบประเมินแล้ว: แสดงป้ายสีเขียว `✓ ทำแบบประเมินเรียบร้อยแล้ว ยื่นให้เจ้าหน้าที่สแกนออกได้เลย`
     - **Dual Evaluation Matching**: ระบบดึงข้อมูลการประเมินโดยเชื่อมโยงทั้ง `userId` (LINE User ID) และ `nationalId` (เลขบัตรประชาชน) แบบ Realtime
  3. **Check-out Gate Scanner Engine (`/admin/scanner` & `/station/scanner/[activityId]`)**:
     - ปรับปรุงให้ตรวจสอบ `checkedOut || checkedOutAt` แทนการตัดสิทธิ์ด้วย `status === 'completed'`
     - ตรวจสอบความถูกต้องของการประเมินก่อนอนุญาตให้จบกิจกรรม หากยังไม่ได้ประเมินระบบจะส่งเสียงเตือนและแจ้งเตือนสีแดงชัดเจน
     - เพิ่มแท็บสลับโหมด `[ ✓ เช็คอินเข้างาน ]` และ `[ 🏁 สแกนออก (จบกิจกรรม) ]` บนหน้าจอ `/station/scanner/[activityId]` พร้อมระบบสถิตินับจำนวนผู้เช็คอินและผู้ที่สแกนออกแล้วแบบ Realtime
### 20. Examiner Scoring & Evaluation Form Standards (ระบบประเมินคะแนน, การแก้ไข, และรูปถ่ายหลักฐาน)
- **Non-Mandatory Fields (ไม่บังคับกรอกทุกช่อง)**:
  - ช่องคะแนนประเมินแต่ละเกณฑ์ ไม่บังคับกรอก สามารถเว้นว่างหรือกรอกเฉพาะเกณฑ์ที่ต้องการได้
  - หากเว้นว่างไว้ ระบบจะ sanitize คะแนนช่องนั้นให้เป็น `0` โดยอัตโนมัติ ไม่แสดงกรอบแดงหรือบล็อกการบันทึก
  - ช่องชื่อกรรมการผู้ประเมิน ไม่บังคับกรอก หากไม่ระบุจะใช้ค่าเริ่มต้น `"กรรมการประจำช่องบริการ"` ให้อัตโนมัติ
- **Preservation of Existing Photos on Edit (การคงอยู่ของรูปภาพเดิมเมื่อแก้ไข)**:
  - แก้ไขปัญหาเดิมที่รูปถ่ายหลักฐานเดิมสูญหายเมื่อกดแก้ไข: ระบบแยกแยะรูปภาพใหม่อย่างแม่นยำด้วยการตรวจสอบ `data:image` (สำหรับอัปโหลดใหม่) ส่วนรูปภาพเดิมที่เป็น URL ภายใน (`/uploads/...`) หรือภายนอกจะถูกเก็บรักษาไว้อย่างสมบูรณ์
  - การดึงรูปภาพเดิมรองรับโครงสร้างข้อมูลครอบคลุมทุกรูปแบบ (`attachedDocuments`, `documents`, `evidence`, `evidencePhotos`, `evaluationScore.evidence`)
- **Interactive Photo Lightbox & Controls**:
  - Lightbox แสดงรูปภาพขนาดใหญ่ทำงานที่ระดับเลเยอร์ `z-[9999]` ไม่ถูกบดบังด้วยหน้าต่าง modal
  - มีปุ่ม `↗ เปิดแท็บใหม่` สำหรับดูรูปต้นฉบับในแท็บแยก และปุ่ม `✕ ปิด`
  - รูป Thumbnail มีไอคอน `🔍 ดูรูป` พร้อม hover effect และระบบ Fallback ป้องกันรูปเสีย
- **Accurate Examiner & Quota Retention on Edit**:
  - เมื่อเปิดดูหรือแก้ไขคะแนนของผู้สมัครที่มีการประเมินไว้แล้ว ระบบจะโหลดชื่อกรรมการเดิมที่เคยบันทึกไว้ ไม่ถูกค่าใน `localStorage` ของเครื่องอื่นเขียนทับ
  - เมื่อมีการเปลี่ยนโควตาใน Modal ข้อมูลโควตาใหม่จะถูกบันทึกและส่งกลับไปยัง state ของหน้าต้นทางอย่างถูกต้องทันที

### 21. Admin Sidebar Scrollbar Theming & Online Status Removal (ปรับสกอร์บาร์เมนูแอดมิน และนำสถานะออนไลน์ออก)
- **Themed Custom Scrollbar (`.custom-scrollbar` in `globals.css`)**:
  - แก้ไขปัญหาสกอร์บาร์สีขาว/เทาพร้อมปุ่มลูกศรแบบดั้งเดิมของ Windows ในแถบเมนูด้านซ้าย (`AdminSidebar.js`)
  - กำหนดสไตล์สกอร์บาร์ให้กลมกลืนกับธีม Dark Navy/Slate (`#0B1120` / `#070D1A`):
    - ความกว้างเพียง `5px` สลิม เรียบหรู ไม่กินพื้นที่เมนู
    - ซ่อนปุ่มลูกศรขึ้นลง (`::-webkit-scrollbar-button { display: none }`)
    - พื้นหลัง Track โปร่งใส (`background: transparent`) ไร้รอยต่อ
    - ก้านเลื่อน (Thumb) สี Dark Slate โปร่งแสง (`rgba(148, 163, 184, 0.22)`) ขอบโค้งมนแบบมนสุด (`border-radius: 9999px`)
    - เมื่อเลื่อนเมาส์ไปชี้ (Hover) จะเปลี่ยนเป็นสีส้มแอร์โรว์ (`#FF741F`) ให้ความรู้สึกหรูหรา ตอบสนองรวดเร็วเข้ากับสี Accent ของระบบ
    - รองรับ Cross-browser ด้วย `scrollbar-width: thin` และ `scrollbar-color`
- **Sidebar Footer Clean-up (นำแถบแสดงสถานะออนไลน์ออก)**:
  - นำแถว `ระบบออนไลน์` พร้อมไฟกระพริบสีเขียว และเวอร์ชัน `v2.0` ด้านล่างสุดของ `AdminSidebar.js` ออก ตามความต้องการของผู้ใช้ เพื่อให้ส่วนล่างของเมนูสะอาด เรียบง่าย และคงไว้เฉพาะปุ่มเปิดหน้าต่างนักเรียน (Student Portal) อย่างชัดเจน

### 22. Examiner Station Mandatory Scoring Before Calling Next Queue (ระบบบังคับบันทึกคะแนนก่อนเรียกคิวถัดไป)
- **Problem & Requirement**:
  - เมื่อโต๊ะกรรมการเรียกผู้สมัครเข้ามาสัมภาษณ์ หากกรรมการยังไม่ได้ให้คะแนนและบันทึกผลการประเมิน ระบบต้องไม่อนุญาตให้กดเรียกคิวถัดไป เพื่อป้องกันข้อผิดพลาด ข้อมูลคะแนนตกหล่น หรือการข้ามคิวโดยไม่ได้บันทึกผล
- **Implementation in Examiner Station (`/station/examiner/[activityId]/[channelId]`)**:
  - **`isCandidateScored(candidate)` Helper**: ตรวจสอบว่าผู้สมัครคนปัจจุบันได้รับการบันทึกคะแนนแล้วหรือไม่ (`cand.evaluationScore?.isScored || cand.evaluationScore?.scoredAt`)
  - **Header Call Next Button Transition**:
    - หากมีผู้สมัครอยู่ที่โต๊ะและยังไม่ได้ให้คะแนน ปุ่มจะเปลี่ยนเป็นสีส้มอำพัน `⚠️ กรุณาให้คะแนนคนปัจจุบันก่อน (${queueNo})` พร้อมเอฟเฟกต์กะพริบเตือนสายตา
    - เมื่อคลิกปุ่มจะเปิดหน้าต่าง `ExaminerScoringModal` เพื่อให้กรรมการบันทึกคะแนนทันที และแสดงข้อความเตือน
    - เมื่อบันทึกคะแนนเรียบร้อยแล้ว ปุ่มจะสลับกลับมาเป็น `📢 เรียกคิวถัดไป (${nextQueueNo})` ตามปกติ
  - **Call Guard in `handleCallQueue`**: ดักจับทุกจุดที่มีการเรียกคิว หากมีผู้สมัครคนปัจจุบันที่ยังไม่ได้ให้คะแนน จะปฏิเสธการเรียกคิวและเปิดโมดอลบันทึกคะแนนทันที
  - **Complete Interview Guard**: ในปุ่ม `สัมภาษณ์เสร็จสิ้น (คนถัดไป)` หากยังไม่ได้บันทึกคะแนน จะไม่ยอมให้จบการสัมภาษณ์ พร้อมเปิดโมดอลบันทึกคะแนน
  - **Visual Status Badges**:
    - แสดงป้ายกำกับสถานะชัดเจนบนการ์ดผู้สมัคร: `⚠️ ยังไม่ได้ให้คะแนน` (สีส้มกะพริบ) หรือ `✓ ให้คะแนนแล้ว (${score} คะแนน)` (สีเขียว)
    - ปุ่มบันทึกคะแนนไฮไลต์เป็นสีส้มชัดเจน `⭐ กรอกคะแนนและผลประเมินสัมภาษณ์ (จำเป็นก่อนเรียกคิวถัดไป)`

### 23. Post-Activity Action Buttons: Certificate (Individual) & Photo (Project-wide)
- **Problem & Requirement**:
  - เมื่อจบกิจกรรม และผู้เข้าร่วมทำแบบประเมินเรียบร้อยแล้ว (ใต้ป้ายสีเขียว "✓ ทำแบบประเมินเรียบร้อยแล้ว" ในหน้ารายการลงทะเบียนของฉัน `/student/my-registrations`)
  - ต้องการให้มีปุ่มเพิ่มขึ้นมา 2 ปุ่ม:
    1. **Certificate (เกียรติบัตร)**: แนบลิงก์รายบุคคล (`certificateUrl` ในเอกสาร `registrations`)
    2. **Photo (รูปภาพกิจกรรม)**: ใช้ลิงก์เดียวกันทั้งโครงการ/กิจกรรม (`photoUrl` ในเอกสาร `activities`)
    3. **Customizable Button Titles**: ชื่อปุ่มของทั้ง 2 ปุ่มสามารถปรับเปลี่ยนได้ตามความเหมาะสมของแต่ละงาน เช่น เปลี่ยนเป็น "ใบประกาศ", "วุฒิบัตร", "รูปถ่ายกิจกรรม", "บรรยากาศงาน" (`certificateButtonLabel`, `photoButtonLabel`)
- **System Architecture & Data Modeling**:
  - **Activity Document (`activities/{id}`)**:
    - `enableCertificate`: boolean (เปิด/ปิดปุ่ม Certificate)
    - `certificateButtonLabel`: string (ชื่อปุ่ม Certificate เช่น "Certificate", "เกียรติบัตร")
    - `enablePhoto`: boolean (เปิด/ปิดปุ่ม Photo)
    - `photoButtonLabel`: string (ชื่อปุ่ม Photo เช่น "Photo", "รูปภาพกิจกรรม")
    - `photoUrl`: string (URL ลิงก์อัลบั้มภาพกิจกรรม เช่น Google Drive, Google Photos, OneDrive)
  - **Registration Document (`registrations/{id}`)**:
    - `certificateUrl`: string (ลิงก์ไฟล์เกียรติบัตรเฉพาะบุคคล เช่น Google Drive PDF / Cloud link)
- **Student Portal UX (`/student/my-registrations`)**:
  - แสดงปุ่ม 2 ปุ่มใต้ป้ายเขียว "✓ ทำแบบประเมินเรียบร้อยแล้ว" (หรือเมื่อประเมินเสร็จสิ้น):
    - ปุ่ม **Certificate**: คลิกเพื่อเปิดลิงก์เกียรติบัตรรายบุคคลในแท็บใหม่ หากยังไม่มีการแนบลิงก์ จะแสดงข้อความแจ้งเตือนอย่างสุภาพ
    - ปุ่ม **Photo**: คลิกเพื่อเปิดอัลบั้มรูปภาพกิจกรรมทั้งโครงการในแท็บใหม่
- **Admin Management Operations**:
  - **Activity Settings (`/admin/activity/add` & `/admin/activity/edit/[id]`)**: แผงตั้งค่าปุ่มหลังจบกิจกรรม สามารถกำหนดชื่อปุ่ม Certificate, ชื่อปุ่ม Photo, และใส่ลิงก์อัลบั้มรูปกิจกรรมส่วนกลาง
  - **Individual Certificate Assignment (`/admin/activity/seats/[id]`)**:
    - นำเข้า / ส่งออก CSV: รองรับคอลัมน์ `certificateUrl` / `ลิงก์เกียรติบัตร` เพื่ออัปโหลดลิงก์เกียรติบัตรรายบุคคลจำนวนมากพร้อมกันได้ในไฟล์เดียว
    - จัดการในตาราง: มีคอลัมน์เกียรติบัตร พร้อมปุ่มลัด `+ แนบลิงก์` / `✎ แก้ไข` เปิดหน้าต่างด่วนให้แอดมินวางลิงก์ได้ทันทีรายคน และรองรับการแก้ไขผ่านโหมดแก้ตาราง

### 24. Admin Root Redirection Standard (`/admin` -> `/admin/login`)
- **Requirement & Architecture**:
  - เมื่อผู้ใช้งานหรือผู้ดูแลระบบพิมพ์ URL หรือเข้าสู่เส้นทาง `/admin` ระบบจะทำการ Redirect ส่งต่อไปยังหน้าเข้าสู่ระบบ `/admin/login` โดยอัตโนมัติทันที
  - สร้างไฟล์ `src/app/admin/page.js` ใช้คำสั่ง `redirect('/admin/login')` ของ Next.js App Router เพื่อทำการ Redirect ทันทีตั้งแต่ฝั่ง Server (Zero-Flicker)
  - หากผู้ดูแลระบบมีเซสชันการเข้าสู่ระบบอยู่แล้ว (`currentUser`) ระบบในหน้า `/admin/login` จะทำการนำทางต่อไปยังหน้าหลักของแอดมิน (`/admin/activity`) โดยอัตโนมัติ

### 25. NAME SURNAME (ENG) Standardization Across Registration & Profiles
- **Problem & Requirement**:
  - ต้องการเพิ่มฟิลด์ข้อมูล **`NAME SURNAME (ENG)`** (ชื่อ-นามสกุลภาษาอังกฤษ) ในการลงทะเบียนใหม่และแก้ไขข้อมูลทั้งหมดในระบบ:
    1. **Format Enforcement**: ตัวพิมพ์ใหญ่ทั้งหมด (UPPERCASE) ทั้งในการพิมพ์ (`onChange`) และการจัดเก็บในฐานข้อมูล
    2. **No Title Prefix**: ห้ามใส่คำนำหน้าชื่อ (เช่น Mr., Miss, Mrs., นาย, นางสาว) โดยมีข้อความคำแนะนำกำกับชัดเจน "* No title (Mr./Miss) - ไม่ต้องใส่คำนำหน้าชื่อ"
    3. **Thai Name Label Distinction**: ปรับป้ายกำกับชื่อภาษาไทยเป็น **"ชื่อ-นามสกุล (ไทย)"** เพื่อความชัดเจนและไม่สับสน
- **Coverage & Touchpoints**:
  - **Student Self Setup & Edit**:
    - `src/components/student/ProfileSetupForm.js`: ฟอร์มตั้งค่าโปรไฟล์นักเรียนครั้งแรก (LIFF)
    - `src/components/student/EditProfileModal.js`: หน้าต่างแก้ไขโปรไฟล์นักเรียนจากแถบส่วนหัว (`StudentHeader`)
    - `src/components/student/EditProfileForm.js`: ฟอร์มแก้ไขข้อมูลโปรไฟล์นักเรียน
    - `src/components/StudentHeader.js`: แสดงชื่อภาษาอังกฤษกำกับไว้ข้างชื่อภาษาไทย
  - **Service & Database Synchronization**:
    - `src/lib/studentService.js`: รองรับฟิลด์ `fullNameEn` ใน `upsertStudentProfile` และ `registerOrLinkStudentProfile` ทั้งการสร้างและอัปเดตเอกสาร `studentProfiles`
    - `src/lib/registrationService.js`: บันทึก `fullNameEn` ลงในเอกสาร `registrations` เมื่อนักเรียนลงทะเบียนกิจกรรม
  - **Admin Operations**:
    - `src/app/admin/activity/seats/[id]/page.js`:
      - ช่องกรอกเพิ่มรายชื่อนักเรียนรายคน (Add Participant) มีช่อง `NAME SURNAME (ENG)` แปลงตัวพิมพ์ใหญ่
      - โหมดแก้ไขตาราง (Inline Edit) มีคอลัมน์ `NAME SURNAME (ENG)` ซิงค์ลงทั้ง `registrations` และ `studentProfiles`
      - นำเข้าไฟล์ CSV: แปลง header `NAME SURNAME (ENG)`, `NAME SUERNAME (ENG)`, `NAME (ENG)`, `ชื่อภาษาอังกฤษ`, `fullNameEn`, `nameEn` เข้าสู่ `fullNameEn` อัตโนมัติ
      - ส่งออก CSV: เพิ่มคอลัมน์ `NAME SURNAME (ENG)` ในรายงานผล
    - `src/app/admin/registrants/page.js`:
      - ตารางการลงทะเบียนกิจกรรม (Table 1) และ ตารางโปรไฟล์นักเรียนทั้งหมด (Table 2) มีคอลัมน์ `NAME SURNAME (ENG)` พร้อมรองรับการแก้ไขข้อมูลในตาราง
      - ส่งออก CSV: รวมคอลัมน์ `NAME SURNAME (ENG)`
    - `src/app/admin/registrants/[id]/page.js`: หน้ารายละเอียดนักเรียนรายบุคคล แสดงและรองรับการแก้ไข `fullNameEn` พร้อมบันทึกลงทุกกิจกรรมที่เกี่ยวข้อง
    - `src/app/admin/activity/register-student/page.js`: ฟอร์มที่แอดมินลงทะเบียนให้นักเรียนโดยตรง มีช่องกรอก `NAME SURNAME (ENG)`

### 26. Dynamic Certificate Template Generator & Auto-Issuance Engine
- **Problem & Requirement**:
  - ต้องการให้สามารถใช้รูปภาพเทมเพลต (Template Background Image) ในการสร้างใบประกาศนียบัตร/เกียรติบัตรได้โดยตรงจากระบบ
  - เมื่อผู้เข้าร่วมกิจกรรมมีสถานะผ่าน/สำเร็จ (`completed` / จบกิจกรรมแล้ว) และทำแบบประเมินเรียบร้อยแล้ว จะสามารถดาวน์โหลดใบประกาศนียบัตรได้ทันที
  - สามารถกำหนดค่าในส่วนของกิจกรรมได้ 3 ส่วนหลัก:
    1. **`PROJECT NAME`**: ชื่อโครงการ/กิจกรรมบนใบประกาศ (ภาษาอังกฤษ หรือชื่อกิจกรรม)
    2. **`DATE MONTH YEAR`**: วันที่จัดกิจกรรมที่ระบุบนใบประกาศ (เช่น 21 October 2026)
    3. **`แนบ template`**: อัปโหลดรูปภาพพื้นหลังเกียรติบัตร (Template Image เช่น Civil Aviation Training Center)
- **Technical Architecture**:
  - **Generator Utility (`src/lib/certificateGenerator.js`)**:
    - ใช้ HTML5 Canvas Client-side Rendering ผสานกับ `jsPDF` เพื่อสร้างใบประกาศนียบัตรความละเอียดสูงทันทีในเบราว์เซอร์ ไม่ต้องพึ่งพา External API Server
    - วางตำแหน่งข้อความอัตโนมัติตามสัดส่วนแม่นยำ:
      - `NAME SURNAME`: ดึงจาก `fullNameEn` (ตัวพิมพ์ใหญ่) หรือชื่อภาษาไทย ใช้ฟอนต์ serif สไตล์มาตรฐานเกียรติบัตรทางการบิน กึ่งกลาง Y ~ 385px
      - `PROJECT NAME`: ดึงจาก `certificateProjectName` กึ่งกลาง Y ~ 468px
      - `DATE MONTH YEAR`: ดึงจาก `certificateDateText` กึ่งกลาง Y ~ 534px
    - รองรับการดาวน์โหลดทั้งรูปแบบ **ภาพความละเอียดสูง (PNG)** และ **เอกสาร PDF ขนาด A4 แนวนอน**
  - **Activity Document Schema (`activities/{id}`)**:
    - `certificateMode`: `'template'` | `'individual_link'`
    - `certificateProjectName`: string
    - `certificateDateText`: string
    - `certificateTemplateUrl`: string (URL รูปภาพเทมเพลตเริ่มต้นหรือที่อัปโหลดใหม่)
  - **Student Portal Flow (`/student/my-registrations`)**:
    - เมื่อผู้เข้าร่วมมีสถานะเสร็จสิ้น (`completed` / `checkedOut`) และผ่านแบบประเมิน ปุ่ม Certificate จะเปิดหน้าต่าง Preview ใบประกาศพร้อมปุ่มดาวน์โหลด PNG และ PDF ได้ทันที
  - **Admin Workspace Flow (`/admin/activity/seats/[id]`)**:
    - แอดมินสามารถคลิกปุ่ม `📜 ออกใบประกาศ` ในคอลัมน์เกียรติบัตร เพื่อเปิดดูตัวอย่างและดาวน์โหลดใบประกาศของนักเรียนแต่ละคนได้ทันที

### 27. Student Certificate Checklist & Verification Approval Gate
- **Requirement**:
  - ต้อง Checklist นักเรียน (อนุมัติสิทธิ์รายบุคคลโดยแอดมิน) ก่อน จึงจะแสดงปุ่มเปิดรับ Certificate ในฝั่งนักเรียน
- **Implementation**:
  - **Admin Table (`/admin/activity/seats/[id]`)**:
    - เพิ่มคอลัมน์ `เกียรติบัตร (Checklist)` พร้อม **Toggle Switch** (สีเขียว `bg-emerald-500` เมื่ออนุมัติ, สีเทา `bg-slate-300` เมื่อยังไม่อนุมัติ) ให้แอดมินคลิกเปิด-ปิดสิทธิ์ `certificateApproved` ได้ทันทีแบบ 1-click
    - รองรับการแก้ไขผ่าน Edit Mode พร้อมช่อง Checkbox ในตาราง
    - แถบการจัดการหลายรายการ (Batch Action Toolbar): เพิ่มปุ่ม `✓ อนุมัติเกียรติบัตร (N)` และ `ปิดสิทธิ์ (N)` เพื่อ Checklist นักเรียนพร้อมกันจำนวนมากได้อย่างรวดเร็ว
  - **Student Portal (`/student/my-registrations`)**:
    - ตรวจสอบเงื่อนไข `reg.certificateApproved === true` ก่อนแสดงปุ่มเปิดดู/ดาวน์โหลด Certificate
    - หากนักเรียนจบกิจกรรมและทำแบบประเมินแล้ว แต่ยังไม่ได้รับการ Checklist อนุมัติจากแอดมิน จะแสดงปุ่มสถานะ `⏳ รออนุมัติ Certificate` เพื่อแจ้งให้นักเรียนทราบว่าอยู่ระหว่างการตรวจรายชื่อของผู้จัดงาน

### 28. CSV Import & Export Synchronization for Extended Participant Schema
- **Requirement & Verification**:
  - ตรวจสอบและอัปเดตระบบการนำเข้า (CSV Import) และส่งออกข้อมูล (CSV Export) ในหน้า `src/app/admin/activity/seats/[id]/page.js` ให้รองรับข้อมูลที่เพิ่มเข้ามาใหม่ทั้งหมดอย่างสมบูรณ์
- **Implementation & Schema Mapping**:
  - **CSV Export**:
    - เพิ่มคอลัมน์ `สิทธิ์เกียรติบัตร` (`certificateApproved`) แปลงค่าเป็นภาษาไทย `อนุมัติ` / `ยังไม่อนุมัติ`
    - รวมคอลัมน์ `NAME SURNAME (ENG)` (`fullNameEn`) และ `ลิงก์เกียรติบัตร` (`certificateUrl`)
    - รองรับทั้งปุ่ม `Export CSV ทั้งหมด` และปุ่ม `Export ข้อมูลทั้งหมด` ในหน้าสรุปผล
  - **CSV Import**:
    - รองรับหัวตารางภาษาไทยและอังกฤษ: `สิทธิ์เกียรติบัตร`, `อนุมัติเกียรติบัตร`, `สถานะเกียรติบัตร`, `รับเกียรติบัตร`, `certificateApproved`, `isCertified`, `certApproved`
    - ระบบแปลงค่าสถานะความยินยอม/สิทธิ์ (Normalize Boolean): รองรับ `true`, `1`, `อนุมัติ`, `yes`, `ผ่าน`, `เปิด`, `y`
    - บันทึกฟิลด์ `certificateApproved` ลง Firestore ในเอกสาร `registrations` อัตโนมัติ
    - ซิงค์ `fullNameEn` สู่ทั้ง `registrations` และ `studentProfiles`
    - อัปเดตข้อความตัวอย่าง Header ในหน้าเว็บให้แนะนำครบทั้ง `fullName (ไทย)`, `fullNameEn (อังกฤษ)`, `certificateApproved (สิทธิ์เกียรติบัตร)`

### 29. Bi-directional Synchronization of English Names (`fullNameEn`) between Student Profiles and Registrations
- **Context & Requirement**:
  - เมื่อ Admin สร้างหรือนำเข้ารายชื่อผู้มีสิทธิ์เข้าร่วมกิจกรรมล่วงหน้าโดยที่ยังไม่มีชื่อภาษาอังกฤษ (`fullNameEn`)
  - ต่อมานักเรียนเข้าสู่ระบบผ่าน LINE และบันทึก/แก้ไขข้อมูลโปรไฟล์ของตนเอง (ระบุ `NAME SURNAME (ENG)`)
  - Admin ต้องการดึงชื่อภาษาอังกฤษที่นักเรียนบันทึกไว้ในโปรไฟล์มาใส่ในรายการกิจกรรมเพื่อออกใบประกาศนียบัตร
- **Architecture & Implementation**:
  - **Single Source of Truth Key**: ผูกโยงข้อมูลด้วยเลขประจำตัวประชาชน 13 หลัก (`nationalId`)
  - **ฝั่ง Admin (`/admin/activity/seats/[id]`)**:
    - เพิ่มปุ่ม **"🔄 ดึงชื่อ ENG จากโปรไฟล์นักเรียน"** ในการ์ดเครื่องมือ นำเข้า/ส่งออกข้อมูล พร้อม Badge แจ้งเตือนจำนวนคนที่ยังไม่มีชื่อ ENG (`ยังไม่มี N คน`)
    - ฟังก์ชัน `handleSyncEnglishNamesFromProfiles`: ค้นหา `studentProfiles` ผ่าน `nationalId` ของผู้เข้าร่วมในกิจกรรม หากพบว่ามี `fullNameEn` จะอัปเดตลง `registrations` แบบ Chunk Batch (ครั้งละ 400 รายการ) และรีเฟรชตารางทันที
  - **ฝั่งนักเรียน (Auto-Sync & Fallback)**:
    - `ProfileSetupForm.js` และ `EditProfileModal.js`: เมื่อนักเรียนบันทึกหรือแก้ไขโปรไฟล์ จะเรียก `syncUnlinkedRegistrations` เพื่ออัปเดต `fullNameEn` ไปยังทุกการลงทะเบียนเดิมของนักเรียนโดยอัตโนมัติ
    - `/student/my-registrations`: มีการตรวจจับใน `syncUnlinkedRegistrations` และในปุ่มเปิดดูเกียรติบัตร (`onOpenCert`) มี Fallback ดึง `studentDbProfile.fullNameEn` ทันทีแม้ว่าข้อมูลในเอกสารการลงทะเบียนจะยังไม่ได้ซิงค์

### 30. Resilient CSV Import Engine & Smart Header Detection
- **Problem**:
  - เมื่อนำเข้าไฟล์ CSV จาก Excel หรือ Export CSV หัวคอลัมน์ภาษาไทยอาจมีความแตกต่าง (เช่น `ชื่อ-สกุล (ไทย)`, `เลขประจำตัวประชาชน`, `เลขบัตร ปชช.`) หรือมีอักขระพิเศษ UTF-8 BOM (`\ufeff`) หรือการแปลงเลขเป็น Scientific Notation ใน Excel (`1.23457E+12`)
  - โค้ดเดิมคำนวณจำนวนแถวแบบคงที่ ทำให้ขึ้นแจ้งเตือน "นำเข้าสำเร็จ" ทั้งที่ไม่มีข้อมูลเข้าฐานข้อมูลจริง
- **Solution & Implementation**:
  - **Smart Header Detection (`detectFieldFromHeader`)**:
    - ลบ UTF-8 BOM (`\ufeff`) และช่องว่างส่วนเกินอัตโนมัติ
    - แมตช์หัวตารางแบบยืดหยุ่นสูง รองรับทุกรูปแบบ เช่น `ชื่อ-สกุล (ไทย)`, `ชื่อ-นามสกุล`, `ชื่อ`, `fullName`, `เลขประจำตัวประชาชน`, `เลขบัตร ปชช.`, `nationalId`, `citizenId`
  - **Data Normalization & Error Trapping**:
    - ดักจับและแปลงเลขบัตรประชาชนแบบ Scientific Notation จาก Excel ให้กลับเป็นเลข 13 หลักที่ถูกต้อง
    - ตรวจสอบ `addedCount` จากจำนวนที่เพิ่มลงใน `batch.set` จริงเท่านั้น
    - หากไม่มีข้อมูลที่นำเข้าได้ จะแสดง Popup และข้อความเตือนสาเหตุที่ชัดเจน (เช่น แถวที่ไม่มีชื่อ, เลขบัตรประชาชนไม่ครบ 13 หลัก หรือหัวตารางที่อ่านได้) แทนการแจ้งเตือนสำเร็จ

### 31. LINE In-App Browser Download Resolution (Mobile Web Share & Long-Press Support)
- **Problem & Root Cause**:
  - เว็บบราวเซอร์ภายในแอป LINE (LINE In-App WebView ทั้งบน iOS และ Android) มีนโยบายความปลอดภัยที่บล็อกคำสั่งดาวน์โหลดไฟล์อัตโนมัติจากแท็ก `<a download>` สำหรับ `blob:` และ `data:` URL ส่งผลให้ผู้ใช้กดปุ่ม "ดาวน์โหลดภาพ (PNG)" หรือ "ดาวน์โหลด PDF" แล้วไม่มีไฟล์ถูกดาวน์โหลดลงเครื่อง
- **Solution & Implementation**:
  - **Web Share API with File Object**:
    - อัปเดต `downloadCertificatePNG` และ `downloadCertificatePDF` ใน `src/lib/certificateGenerator.js` ให้ตรวจสอบ `navigator.canShare` และสร้าง `File` อ็อบเจกต์เพื่อเรียกใช้ Native Share Sheet ของอุปกรณ์
    - บนมือถือ (ทั้ง iOS/Android) จะเปิดหน้าต่างแชร์ของระบบให้ผู้ใช้สามารถเลือก "บันทึกรูปภาพ" (Save Image) หรือ "บันทึกลงไฟล์" (Save to Files/Drive) ได้ทันทีจากปุ่มดาวน์โหลด
  - **Image Long-Press Direct Save (PNG)**:
    - ในโมดอลพรีวิวเกียรติบัตร เพิ่มป้ายคำแนะนำ `👆 แตะค้างที่รูปภาพเพื่อบันทึกรูป (Save Image) ลงอัลบั้มรูป`
    - ผู้ใช้บน LINE สามารถใช้นิ้วแตะค้างที่รูปเกียรติบัตร แล้วเลือกบันทึกรูปภาพลง Gallery ได้ทันทีโดยไม่ต้องผ่าน Download Link
  - **LINE Guidance Box & PDF Instructions**:
    - ตรวจจับสภาพแวดล้อม LINE ด้วย `isLineBrowser`
    - แสดงกล่องข้อความสีเหลืองอำพันแนะนำวิธีบันทึกภาพ และวิธีดาวน์โหลด PDF ผ่านการแตะปุ่มจุดสามจุด (⋮) ด้านขวาบนของ LINE แล้วเลือก "เปิดในเบราว์เซอร์อื่น" (Chrome / Safari)

### 32. Dynamic Certificate Layout Position Sliders, Color Palette & Real-Time Canvas Preview Engine (แนวทางที่ 1)
- **Requirement & Context**:
  - เมื่อแอดมินอัปโหลดภาพพื้นหลัง Template เกียรติบัตร (Certificate Template Image) รูปแบบและโทนสีของแต่ละหน่วยงาน/โครงการอาจมีตำแหน่ง ขนาดบรรทัด และสีตัวอักษรที่แตกต่างกัน
  - แอดมินต้องการปรับขยับตำแหน่งแนวตั้ง (Y), ขนาดตัวอักษร (Font Size), และ **กำหนดสีตัวอักษร (Text Color)** ของข้อความทั้ง 3 ส่วนได้อย่างอิสระ พร้อมเห็นการเปลี่ยนแปลงแบบเรียลไทม์ (Live Preview) ทันที
- **Three Customizable Text Sections**:
  1. **`NAME SURNAME` (ชื่อ-สกุล ผู้เข้าร่วม)**:
     - ตำแหน่งแนวตั้ง (`nameY`): ปรับได้ตั้งแต่ 150px ถึง 600px (ค่ามาตรฐาน 385px บน baseline 730px)
     - ขนาดตัวอักษร (`nameFontSize`): ปรับได้ตั้งแต่ 16px ถึง 60px (ค่ามาตรฐาน 32px)
     - สีตัวอักษร (`nameColor`): เลือกสีอิสระผ่าน Color Picker พร้อม Palette สียอดนิยม (เขียวเข้ม `#063826`, กรมท่า `#000946`, เทาดำ `#1e293b`, ดำสนิท `#000000`, ทองบรอนซ์ `#854d0e`, แดงเข้ม `#7f1d1d`)
  2. **`PROJECT NAME` (ชื่อโครงการ/กิจกรรม)**:
     - ตำแหน่งแนวตั้ง (`projectY`): ปรับได้ตั้งแต่ 200px ถึง 680px (ค่ามาตรฐาน 453px)
     - ขนาดตัวอักษร (`projectFontSize`): ปรับได้ตั้งแต่ 12px ถึง 44px (ค่ามาตรฐาน 21px)
     - สีตัวอักษร (`projectColor`): ค่ามาตรฐาน `#1e293b`
  3. **`DATE MONTH YEAR` (วันที่จัดกิจกรรม)**:
     - ตำแหน่งแนวตั้ง (`dateY`): ปรับได้ตั้งแต่ 250px ถึง 710px (ค่ามาตรฐาน 521px)
     - ขนาดตัวอักษร (`dateFontSize`): ปรับได้ตั้งแต่ 10px ถึง 32px (ค่ามาตรฐาน 16px)
     - สีตัวอักษร (`dateColor`): ค่ามาตรฐาน `#1e293b`
- **ระบบกำหนดสีตัวอักษรแบบมินิมอล กระชับ สบายตา (Streamlined Compact Color System)**:
  - **กล่องจานสีแบบคลิก (Native HTML5 Color Picker)**: คลิกที่กล่องสีตัวอย่าง (Swatch 24x24px) เพื่อเปิดจานสีสากล / หลอดดูดสี Eyedropper จากหน้าจอได้โดยตรง
  - **ช่องพิมพ์รหัสสี HEX แบบอิสระ (`# [HEX]`)**:
    - กล่องกรอกรหัสสีขนาดกะทัดรัด ความสูงเท่ากล่องสี (h-6) มีสัญลักษณ์ `#` นำหน้า
    - พิมพ์หรือวางรหัส HEX 6 หลักได้ทันที (เช่น `063826`, `7F1D1D`, `000946`, `1E293B`)
  - **ดีไซน์สะอาดตา**: ตัดปุ่มเลือกด่วนและข้อความหัวข้อยาวซ้ำซ้อนออก เหลือเพียงบรรทัดเดียว `สีตัวอักษร: [กล่องสี] [# HEX]` จัดชิดซ้าย-ขวาอย่างสมดุล ไม่เกะกะและไม่กินพื้นที่
  - **การทำงานร่วมกับทั้งระบบ**: ปรับปรุงทั้งในหน้าเพิ่มกิจกรรมใหม่ (`/admin/activity/add`) และหน้าแก้ไขกิจกรรม (`/admin/activity/edit/[id]`)
- **Interactive Live Preview Canvas**:
  - แสดงภาพจำลองเกียรติบัตรจริงผ่าน HTML5 Canvas ในหน้า Admin Activity Form (`/admin/activity/edit/[id]` และ `/admin/activity/add`)
  - ใช้ชื่อจำลอง `MR. SOMCHAI JAIDEE` พร้อมชื่อโครงการและวันที่จริง เพื่อให้แอดมินกะระยะบรรทัดและเทียบความคมชัดของสีกับพื้นหลังได้ตรงช่องอย่างแม่นยำ
  - Debounced Render (120ms) ช่วยให้การเลื่อนสไลเดอร์และการเปลี่ยนสีตอบสนองลื่นไหล ไม่มีอาการกระตุก
  - ปุ่ม **"↺ รีเซ็ตตำแหน่งเริ่มต้น"** ให้แอดมินคืนค่ามาตรฐานได้ในคลิกเดียว
- **Data Persistence & Consumer Integration**:
  - บันทึกโครงสร้าง `certificateLayout: { nameY, nameFontSize, nameColor, projectY, projectFontSize, projectColor, dateY, dateFontSize, dateColor }` ลง Firestore ในเอกสาร `activities/{id}`
  - `src/lib/certificateGenerator.js`: รองรับ `options.certificateLayout` ทั้งพิกัดและสีตัวอักษร โดยคำนวณ `scaleY = canvas.height / 730` อัตโนมัติ พร้อม Fallback คืนค่ามาตรฐาน 100% สำหรับกิจกรรมเดิม
  - รองรับการสร้างเกียรติบัตรตาม Layout และสีที่ปรับแต่งไว้ทั้งในฝั่งนักเรียน (`/student/my-registrations`) และฝั่งแอดมิน (`/admin/activity/seats/[id]`)

### 33. Empty / Dash Quota Badge Suppression in Student & Admin Views
- **Problem & Root Cause**:
  - เมื่อกิจกรรมไม่มีการกำหนดประเภทโควตา หรือข้อมูลการลงทะเบียนมีฟิลด์ `quota` เป็นเครื่องหมายขีด (`"-"`), ค่าว่าง (`""`), ช่องว่าง (`" "`), หรือ `"ไม่ระบุ"`
  - ในหน้ารายการลงทะเบียนของนักเรียน (`/student/my-registrations`) เดิมใช้เงื่อนไขตรวจสอบเพียง `{reg.quota && ...}` ซึ่งค่าสตริง `"-"` ถือเป็น Truthy ใน JavaScript ทำให้เกิดการแสดงป้าย `โควตา: -` รกสายตาบนบัตรคิว/ที่นั่ง
- **Solution & Implementation**:
  - เพิ่มฟังก์ชันตรวจสอบความถูกต้องของประเภทโควตา `hasValidQuota`:
    ```javascript
    const hasValidQuota = (quota) => {
      if (!quota) return false;
      const trimmed = String(quota).trim();
      return trimmed !== '' && trimmed !== '-' && trimmed !== '—' && trimmed !== '–' && trimmed !== 'none' && trimmed !== 'null' && trimmed !== 'undefined' && trimmed !== 'ไม่ระบุ';
    };
    ```
  - อัปเดตจุดแสดงผลป้ายโควตาใน:
    1. `RegistrationCard` (บัตรกิจกรรมที่กำลังจะมาถึง / กำลังดำเนินการ) ใน `src/app/student/my-registrations/page.js`
    2. `CompletedRegistrationCard` (บัตรกิจกรรมที่เสร็จสิ้นแล้ว) ใน `src/app/student/my-registrations/page.js`
### 34. Activity Registrations Recovery & Safe Bulk Update Architecture
- **Incident & Root Cause Analysis**:
  - ในหน้า `/admin/activity/seats/[id]` เดิม ฟังก์ชัน `handleUpdateAll` ทำการวนลูปอัปเดตเอกสารผู้สมัครทุกคนในตาราง (`registrants.map`) โดยนำค่าจาก State `editStates` (ซึ่งเก็บเฉพาะ 12 ฟิลด์ที่เปิดให้กรอก) ไป `batch.update` ทับลง Firestore ทุกคน
  - หากฟิลด์ใดใน `editStates` ว่างเปล่า หรือแถวใดที่แอดมินไม่ได้แตะต้อง ค่าว่างเหล่านั้นจะถูกสั่งเขียนทับฟิลด์เดิมใน Firestore ส่งผลให้ข้อมูลนักเรียน (เช่น ชื่ออังกฤษ, โควตา, รหัสนักเรียน หรือสถานะ) สูญหายหรือถูกเขียนทับ
  - กิจกรรม `rhHpcO7iuwV2118jXYZL` (STAFF 22OCT26) เกิดเหตุข้อมูลการลงทะเบียนหายไปเป็น 0 รายการ
- **Data Recovery Execution**:
  - ดำเนินการกู้คืนข้อมูลสำเร็จ 100% จากตารางประเมินผล `evaluations` ที่เชื่อมโยงกับกิจกรรมนี้ ร่วมกับตารางโปรไฟล์หลัก `studentProfiles`
  - สร้างเอกสารการลงทะเบียน (`registrations`) คืนสู่กิจกรรม `rhHpcO7iuwV2118jXYZL` จำนวน **40 คน** พร้อมข้อมูล `fullName`, `fullNameEn`, `studentId`, `nationalId`, `lineUserId`, `status: 'completed'`, `certificateApproved: true` และ Timestamp ที่ถูกต้อง
- **Permanent Prevention Architecture (Safe Bulk Update)**:
  - **Dirty Checking**: ปรับปรุง `handleUpdateAll` ใน `src/app/admin/activity/seats/[id]/page.js` ให้เปรียบเทียบ `editStates[reg.id]` กับ `originalEditStates[reg.id]` เพื่อกรองเฉพาะแถวที่มีการแก้ไขจริง (`dirtyRegistrants`) เท่านั้น หากไม่มีการแก้ไขจะไม่ส่งคำสั่งไปยัง Firestore เลย
  - **Selective Field Updates**: ในแต่ละแถวที่มีการแก้ไข จะสร้าง Payload เฉพาะฟิลด์ที่ค่าเปลี่ยนไปจริงเท่านั้น (`regUpdatePayload`) ป้องกันการนำค่าสตริงว่างไปเขียนทับฟิลด์อื่นๆ ที่ไม่ได้แก้ไขโดยเด็ดขาด
  - **Batch Chunking (Safe Limit)**: แบ่งการ Commit ออกเป็น Chunk ละไม่เกิน 200 รายการ เพื่อไม่ให้เกินข้อจำกัด 500 operations ของ Firestore Batch API
  - ตรวจสอบผ่าน `npm run build` สำเร็จ 100% เรียบร้อย









