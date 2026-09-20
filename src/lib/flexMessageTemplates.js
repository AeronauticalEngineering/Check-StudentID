// src/lib/flexMessageTemplates.js

/**
 * สร้าง Flex Message สำหรับแจ้งเตือนเมื่อเช็คอินสำเร็จ (กิจกรรมปกติ/ระบุที่นั่ง)
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
        color: "#000946",
        gravity: "center",
        margin: "md",
        size: "md"
      }
    ],
    paddingAll: "15px",
    backgroundColor: "#F8FAFC"
  },
  body: {
    type: "box",
    layout: "vertical",
    spacing: "md",
    contents: [
      { type: "text", text: "หลักสูตร", size: "sm", color: "#94A3B8" },
      { type: "text", text: String(courseName || "-"), weight: "bold", size: "md", margin: "none", wrap: true, color: "#0F172A" },
      { type: "text", text: "กิจกรรม", size: "sm", color: "#94A3B8", margin: "md" },
      { type: "text", text: String(activityName || "-"), weight: "bold", size: "md", margin: "none", wrap: true, color: "#0F172A" },
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
              { type: "text", text: "ชื่อ", color: "#94A3B8", size: "sm", flex: 3 },
              { type: "text", text: String(fullName || "-"), wrap: true, color: "#334155", size: "sm", flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: "รหัสผู้สมัคร", color: "#94A3B8", size: "sm", flex: 3 },
              { type: "text", text: String(studentId || "-"), wrap: true, color: "#334155", size: "sm", flex: 5 }
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
      { type: "text", text: "เลขที่นั่ง", color: "#CBD5E1", size: "sm" },
      { type: "text", text: String(seatNumber || "-"), size: "3xl", weight: "bold", color: "#FFFFFF", wrap: true }
    ],
    backgroundColor: "#000946",
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
        color: "#000946",
        size: "md",
        align: "center"
      }
    ],
    paddingAll: "15px",
    backgroundColor: "#F8FAFC",
    justifyContent: "center"
  },
  body: {
    type: "box",
    layout: "vertical",
    spacing: "md",
    contents: [
      { type: "text", text: "กิจกรรม", size: "sm", color: "#94A3B8" },
      { type: "text", text: String(activityName || "-"), weight: "bold", size: "md", margin: "none", wrap: true, color: "#0F172A" },
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
              { type: "text", text: "ชื่อ", color: "#94A3B8", size: "sm", flex: 2 },
              { type: "text", text: String(fullName || "-"), wrap: true, color: "#334155", size: "sm", flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: "หลักสูตร", color: "#94A3B8", size: "sm", flex: 2 },
              { type: "text", text: String(course || "-"), wrap: true, color: "#334155", size: "sm", flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: "ช่วงเวลา", color: "#94A3B8", size: "sm", flex: 2 },
              { type: "text", text: String(timeSlot || "-"), wrap: true, color: "#334155", size: "sm", flex: 5 }
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
      { type: "text", text: "หมายเลขคิวของคุณคือ", color: "#CBD5E1", size: "sm" },
      { type: "text", text: String(queueNumber || "-"), size: "3xl", weight: "bold", color: "#FFFFFF", wrap: true }
    ],
    backgroundColor: "#000946",
    alignItems: "center",
    paddingAll: "20px"
  }
});

/**
 * สร้าง Flex Message สำหรับแจ้งเตือนเมื่อลงทะเบียนสำเร็จ
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
        color: "#000946",
        gravity: "center",
        margin: "md",
        size: "md"
      }
    ],
    paddingAll: "15px",
    backgroundColor: "#F8FAFC"
  },
  body: {
    type: "box",
    layout: "vertical",
    spacing: "md",
    contents: [
      { type: "text", text: "หมวดหมู่", size: "sm", color: "#94A3B8" },
      { type: "text", text: String(categoryName || "-"), weight: "bold", size: "md", margin: "none", wrap: true, color: "#0F172A" },
      { type: "text", text: "กิจกรรม", size: "sm", color: "#94A3B8", margin: "md" },
      { type: "text", text: String(activityName || "-"), weight: "bold", size: "md", margin: "none", wrap: true, color: "#0F172A" },
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
              { type: "text", text: "ชื่อ", color: "#94A3B8", size: "sm", flex: 3 },
              { type: "text", text: String(fullName || "-"), wrap: true, color: "#334155", size: "sm", flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: "รหัสผู้สมัคร", color: "#94A3B8", size: "sm", flex: 3 },
              { type: "text", text: String(studentId || "-"), wrap: true, color: "#334155", size: "sm", flex: 5 }
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
      { type: "text", text: "โปรดเตรียม QR Code สำหรับสแกนเข้างาน", align: "center", color: "#64748B", size: "sm" }
    ],
    paddingAll: "14px",
    backgroundColor: "#F1F5F9"
  }
});

/**
 * สร้าง Flex Message สำหรับเสร็จสิ้นกิจกรรม / สัมภาษณ์ (ปรับแต่งได้)
 * @param {object} param
 * @param {string} param.activityId - ID ของกิจกรรม
 * @param {string} param.activityName - ชื่อกิจกรรม
 * @param {boolean} param.requireEvaluation - แทรกปุ่มแบบประเมินหรือไม่
 * @param {boolean} param.isQueueType - เป็นการสัมภาษณ์(คิว) หรือ อบรมปกติ
 */
export const createActivityCompleteFlex = ({ activityId, activityName, requireEvaluation = true, isQueueType = false }) => {
  const titleText = isQueueType ? "สัมภาษณ์เสร็จสมบูรณ์" : "จบกิจกรรมเรียบร้อย";
  const descText = requireEvaluation
    ? "กรุณาทำแบบประเมินด้านล่างเพื่อสำเร็จกระบวนการ"
    : "ขอขอบคุณที่เข้าร่วมกิจกรรมในครั้งนี้";

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || 'dummy-liff-id';
  const evalUri = `https://line.me/R/app/${liffId}/student/evaluation/${activityId || ''}`;

  const flexObj = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "NOTIFICATION",
          color: "#94A3B8",
          size: "xs"
        },
        {
          type: "text",
          text: titleText,
          weight: "bold",
          size: "xl",
          color: "#000946",
          margin: "xs"
        }
      ],
      paddingAll: "18px",
      backgroundColor: "#F8FAFC"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "กิจกรรม", size: "sm", color: "#94A3B8" },
        { type: "text", text: String(activityName || "-"), weight: "bold", size: "md", wrap: true, color: "#0F172A" },
        { type: "separator", margin: "md" },
        { type: "text", text: descText, wrap: true, margin: "md", color: "#64748B", size: "sm" }
      ]
    }
  };

  if (requireEvaluation) {
    flexObj.footer = {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "ทำแบบประเมิน",
            uri: evalUri
          },
          style: "primary",
          color: "#000946"
        }
      ],
      paddingAll: "15px"
    };
  } else {
    flexObj.footer = {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "ขอบคุณที่ให้ความร่วมมือ", align: "center", color: "#94A3B8", size: "sm" }
      ],
      paddingAll: "15px"
    };
  }

  return flexObj;
};

/**
 * สร้าง Flex Message สำหรับส่งแบบประเมิน (คงไว้เพื่อ Backward Compatibility)
 */
export const createEvaluationRequestFlex = ({ activityId, activityName }) => {
  return createActivityCompleteFlex({
    activityId,
    activityName,
    requireEvaluation: true,
    isQueueType: true
  });
};

/**
 * สร้าง Flex Message สำหรับแจ้งเตือนเมื่อถึงคิว
 */
export const createQueueCallFlex = ({ activityName, channelName, queueNumber, courseName, activityId, requireEvaluation = false }) => {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || 'dummy-liff-id';
  const evalUri = `https://line.me/R/app/${liffId}/student/evaluation/${activityId || ''}`;

  const flexObj = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "NOTIFICATION",
          color: "#94A3B8",
          size: "xs"
        },
        {
          type: "text",
          text: "ถึงคิวของคุณแล้ว",
          color: "#FFFFFF",
          size: "xl",
          weight: "bold"
        }
      ],
      paddingAll: "20px",
      backgroundColor: "#000946",
      spacing: "xs"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: String(activityName || "-"),
          wrap: true,
          weight: "bold",
          size: "lg",
          color: "#0F172A"
        },
        {
          type: "box",
          layout: "baseline",
          contents: [
            {
              type: "text",
              text: "หลักสูตร:",
              color: "#94A3B8",
              size: "sm",
              flex: 2
            },
            {
              type: "text",
              text: String(courseName || "-"),
              wrap: true,
              color: "#334155",
              size: "sm",
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
          size: "md",
          align: "center",
          color: "#64748B"
        },
        {
          type: "text",
          text: String(channelName || "-"),
          weight: "bold",
          size: "xxl",
          align: "center",
          color: "#000946",
          margin: "sm"
        },
        {
          type: "text",
          text: `หมายเลขคิว ${String(queueNumber || "-")}`,
          size: "lg",
          align: "center",
          color: "#0F172A",
          margin: "md",
          wrap: true,
          weight: "bold"
        }
      ],
      spacing: "sm",
      paddingAll: "18px",
      backgroundColor: "#F8FAFC"
    }
  };

  if (requireEvaluation) {
    flexObj.footer.contents.push({
      type: "button",
      action: {
        type: "uri",
        label: "ทำแบบประเมิน",
        uri: evalUri
      },
      style: "primary",
      color: "#FF741F",
      margin: "md"
    });
  }

  return flexObj;
};