// src/lib/flexMessageTemplates.js

/**
 * สร้าง Flex Message สำหรับแจ้งเตือนเมื่อเช็คอินสำเร็จ (กิจกรรมปกติ)
 * @param {object} data - ข้อมูลสำหรับแสดงผล
 * @param {string} data.courseName - ชื่อหลักสูตร
 * @param {string} data.activityName - ชื่อกิจกรรม
 * @param {string} data.fullName - ชื่อเต็มของนักเรียน
 * @param {string} data.studentId - รหัสผู้สมัคร
 * @param {string} data.seatNumber - เลขที่นั่ง
 * @returns {object} - JSON Object ของ Flex Message
 */
export const createCheckInSuccessFlex = ({ courseName, activityName, fullName, studentId, seatNumber }) => ({
  type: "bubble",
  header: {
    type: "box",
    layout: "horizontal",
    contents: [
     
      {
        type: "text",
        text: "ยืนยันการเข้าร่วมกิจกรรม",
        weight: "bold",
        color: "#4A4A4A",
        gravity: "center",
        margin: "md",
        size: "md"
      }
    ],
    paddingAll: "15px",
    backgroundColor: "#FAFAFA"
  },
  body: {
    type: "box",
    layout: "vertical",
    spacing: "md",
    contents: [
      { type: "text", text: "หลักสูตร", size: "sm", color: "#AAAAAA" },
      { type: "text", text: courseName || "-", weight: "bold", size: "md", margin: "none", wrap: true },
      { type: "text", text: "กิจกรรม", size: "sm", color: "#AAAAAA", margin: "md" },
      { type: "text", text: activityName || "-", weight: "bold", size: "md", margin: "none", wrap: true },
      { type: "separator", margin: "lg" },
      {
        type: "box",
        layout: "vertical",
        margin: "lg",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: "ชื่อ", color: "#AAAAAA", size: "sm", flex: 3 },
              { type: "text", text: fullName || "-", wrap: true, color: "#666666", size: "sm", flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: "รหัสผู้สมัคร", color: "#AAAAAA", size: "sm", flex: 3 },
              { type: "text", text: studentId || "-", wrap: true, color: "#666666", size: "sm", flex: 5 }
            ]
          }
        ]
      }
    ]
  },
  footer: {
    type: "box",
    layout: "vertical",
    contents: [
      { type: "text", text: "เลขที่นั่ง", color: "#E6E6FA" },
      { type: "text", text: seatNumber || "-", size: "4xl", weight: "bold", color: "#FFFFFF" }
    ],
    backgroundColor: "#071D4A",
    alignItems: "center",
    paddingAll: "20px"
  }
});

/**
 * สร้าง Flex Message สำหรับแจ้งเตือนเมื่อเช็คอิน (กิจกรรมคิว)
 * @param {object} data - ข้อมูลสำหรับแสดงผล
 * @param {string} data.activityName - ชื่อกิจกรรม
 * @param {string} data.fullName - ชื่อเต็มของนักเรียน
 * @param {string} data.course - ชื่อหลักสูตร
 * @param {string} data.timeSlot - ช่วงเวลา
 * @param {string} data.queueNumber - หมายเลขคิว
 * @returns {object} - JSON Object ของ Flex Message
 */
export const createQueueCheckInSuccessFlex = ({ activityName, fullName, course, timeSlot, queueNumber }) => ({
  type: "bubble",
  header: {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "text",
        text: "ได้รับคิวเรียบร้อยแล้ว",
        weight: "bold",
        color: "#4A4A4A",
        size: "md",
        align: "center"
      }
    ],
    paddingAll: "15px",
    backgroundColor: "#FAFAFA",
    justifyContent: "center"
  },
  body: {
    type: "box",
    layout: "vertical",
    spacing: "md",
    contents: [
      { type: "text", text: "กิจกรรม", size: "sm", color: "#AAAAAA" },
      { type: "text", text: activityName || "-", weight: "bold", size: "md", margin: "none", wrap: true },
      { type: "separator", margin: "lg" },
      {
        type: "box",
        layout: "vertical",
        margin: "lg",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: "ชื่อ", color: "#AAAAAA", size: "sm", flex: 2 },
              { type: "text", text: fullName || "-", wrap: true, color: "#666666", size: "sm", flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: "หลักสูตร", color: "#AAAAAA", size: "sm", flex: 2 },
              { type: "text", text: course || "-", wrap: true, color: "#666666", size: "sm", flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: "ช่วงเวลา", color: "#AAAAAA", size: "sm", flex: 2 },
              { type: "text", text: timeSlot || "-", wrap: true, color: "#666666", size: "sm", flex: 5 }
            ]
          }
        ]
      }
    ]
  },
  footer: {
    type: "box",
    layout: "vertical",
    contents: [
      { type: "text", text: "หมายเลขคิวของคุณคือ", color: "#E6E6FA" },
      { type: "text", text: String(queueNumber) || "-", size: "4xl", weight: "bold", color: "#FFFFFF" }
    ],
    backgroundColor: "#071D4A",
    alignItems: "center",
    paddingAll: "20px"
  }
});


/**
 * สร้าง Flex Message สำหรับแจ้งเตือนเมื่อลงทะเบียนสำเร็จ (ฉบับแก้ไข)
 */
export const createRegistrationSuccessFlex = ({ categoryName, activityName, fullName, studentId }) => ({
  type: "bubble",
  header: {
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "text",
        text: "ลงทะเบียนกิจกรรมสำเร็จ",
        weight: "bold",
        color: "#283593",
        gravity: "center",
        margin: "md",
        size: "md"
      }
    ],
    paddingAll: "15px",
    backgroundColor: "#FAFAFA" 
  },
  body: {
    type: "box",
    layout: "vertical",
    spacing: "md",
    contents: [
      { type: "text", text: "หมวดหมู่", size: "sm", color: "#AAAAAA" }, // ✅ Changed text
      { type: "text", text: categoryName || "-", weight: "bold", size: "md", margin: "none", wrap: true }, // ✅ Changed variable
      { type: "text", text: "กิจกรรม", size: "sm", color: "#AAAAAA", margin: "md" },
      { type: "text", text: activityName || "-", weight: "bold", size: "md", margin: "none", wrap: true },
      { type: "separator", margin: "lg" },
      {
        type: "box",
        layout: "vertical",
        margin: "lg",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: "ชื่อ", color: "#AAAAAA", size: "sm", flex: 3 },
              { type: "text", text: fullName || "-", wrap: true, color: "#666666", size: "sm", flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: "รหัสผู้สมัคร", color: "#AAAAAA", size: "sm", flex: 3 },
              { type: "text", text: studentId || "-", wrap: true, color: "#666666", size: "sm", flex: 5 }
            ]
          }
        ]
      }
    ]
  }
});

/**
 * สร้าง Flex Message สำหรับส่งแบบประเมิน
 */
export const createEvaluationRequestFlex = ({ activityId, activityName }) => ({
  type: "bubble",
  body: {
    type: "box",
    layout: "vertical",
    contents: [
      { type: "text", text: "สัมภาษณ์สมบูรณ์!!", weight: "bold", size: "xl" },
      { type: "text", text: `กิจกรรม: ${activityName}`, margin: "md" },
      { type: "text", text: "กรุณาทำแบบประเมินเพื่อสำเร็จกระบวนการสอบ", wrap: true, margin: "md" }
    ]
  },
  footer: {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "button",
        action: {
          type: "uri",
          label: "ทำแบบประเมิน",
          uri: `https://line.me/R/app/${process.env.NEXT_PUBLIC_LIFF_ID}/student/evaluation/${activityId}`
        },
        style: "primary",
        color: "#071D4A"
      }
    ]
  }
});

/**
 * สร้าง Flex Message สำหรับแจ้งเตือนเมื่อถึงคิว
 */
export const createQueueCallFlex = ({ activityName, channelName, queueNumber, courseName }) => ({
  type: "bubble",
  header: {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "text",
        text: "NOTIFICATION",
        color: "#ffffff66",
        size: "sm"
      },
      {
        type: "text",
        text: "ถึงคิวของคุณแล้ว",
        color: "#ffffff",
        size: "xl",
        flex: 4,
        weight: "bold"
      }
    ],
    paddingAll: "20px",
    backgroundColor: "#071D4A",
    spacing: "md",
    paddingTop: "22px"
  },
  body: {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "text",
        text: activityName,
        wrap: true,
        weight: "bold",
        size: "lg"
      },
      {
        type: "box",
        layout: "baseline",
        contents: [
          {
            type: "text",
            text: "หลักสูตร:",
            color: "#8c8c8c",
            size: "md",
            flex: 2
          },
          {
            type: "text",
            text: courseName,
            wrap: true,
            color: "#4a4a4a",
            size: "md",
            flex: 5
          }
        ],
        spacing: "sm",
        margin: "md"
      }
    ]
  },
  footer: {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "text",
        text: "กรุณาไปที่",
        size: "lg",
        align: "center",
        color: "#4A4A4A"
      },
      {
        type: "text",
        text: channelName,
        weight: "bold",
        size: "xxl",
        align: "center",
        color: "#1a237e",
        margin: "md"
      },
      {
        type: "text",
        text: `หมายเลขคิว ${queueNumber}`,
        size: "lg",
        align: "center",
        color: "#4A4A4A",
        margin: "md"
      }
    ],
    spacing: "sm"
  }
});