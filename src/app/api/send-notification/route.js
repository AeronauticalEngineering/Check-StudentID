import { NextResponse } from 'next/server';

export async function POST(request) {
  // 👇 1. เปลี่ยนจากการรับ `message` มาเป็น `flexMessage` ให้ตรงกัน
  const { userId, flexMessage, altText } = await request.json();
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  // 👇 2. ตรวจสอบพารามิเตอร์ `flexMessage` แทน
  if (!userId || !flexMessage || !accessToken) {
    return NextResponse.json(
      { message: 'Missing required parameters: userId, flexMessage, or Access Token' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: userId,
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
      console.error('LINE API Error:', result);
      throw new Error(result.message || 'Failed to send message to LINE API');
    }

    return NextResponse.json({ message: 'Notification sent successfully!', result });
  } catch (error) {
    console.error('Internal Server Error:', error);
    return NextResponse.json(
      { message: `LINE API Error: ${error.message}`, details: error },
      { status: 500 }
    );
  }
}