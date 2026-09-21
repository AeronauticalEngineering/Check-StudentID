import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { userId, flexMessage, altText } = await request.json();
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!userId || !flexMessage || !accessToken) {
      return NextResponse.json(
        { success: false, message: 'Missing required parameters: userId, flexMessage, or Access Token' },
        { status: 400 }
      );
    }

    const trimmedUserId = typeof userId === 'string' ? userId.trim() : '';
    // ตรวจสอบรูปแบบ LINE User ID หรือ Group/Room ID (ขึ้นต้นด้วย U, C หรือ R ตามด้วยเลขฐานสิบหก 32 ตัว)
    const isValidLineTarget = /^[UCR][0-9a-fA-F]{32}$/.test(trimmedUserId);

    // หากเป็น Mock User เช่น 'U_PC_USER_001' (PC Mode) หรือรูปแบบที่ไม่ถูกต้อง ให้ข้ามอย่างปลอดภัยโดยไม่ Error
    if (!isValidLineTarget) {
      return NextResponse.json(
        {
          success: true,
          skipped: true,
          message: `Skipped sending LINE notification: '${userId}' is not a valid real LINE User ID (e.g. PC test mode or unlinked LINE)`
        },
        { status: 200 }
      );
    }

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: trimmedUserId,
        messages: [
          {
            type: 'flex',
            altText: altText || 'คุณได้รับการแจ้งเตือนใหม่',
            contents: flexMessage,
          },
        ],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('LINE API Error response:', result);
      return NextResponse.json(
        { success: false, message: result.message || 'Failed to send message to LINE API', details: result },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Notification sent successfully!', result });
  } catch (error) {
    console.error('Send Notification Error:', error);
    return NextResponse.json(
      { success: false, message: `LINE API Error: ${error.message}`, details: error.message },
      { status: 500 }
    );
  }
}