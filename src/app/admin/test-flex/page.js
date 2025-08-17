'use client';

import { useState } from 'react';
import { createCheckInSuccessFlex, createRegistrationSuccessFlex } from '../../../lib/flexMessageTemplates';

// Mock data for testing
const mockCheckInData = {
  activityName: "ทดสอบการเช็คอิน",
  fullName: "ผู้ใช้ทดสอบ",
  seatNumber: "A1"
};

const mockRegisterData = {
  activityName: "ทดสอบการลงทะเบียน",
  fullName: "ผู้ใช้ทดสอบ"
};

export default function TestFlexMessagePage() {
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState(null);

  const handleSendFlex = async (flexType) => {
    if (!userId.trim()) {
      alert("กรุณากรอก LINE User ID");
      return;
    }
    
    setIsLoading(true);
    setResponse(null);

    let flexMessage;
    if (flexType === 'checkin') {
        flexMessage = createCheckInSuccessFlex(mockCheckInData);
    } else {
        flexMessage = createRegistrationSuccessFlex(mockRegisterData);
    }

    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.trim(),
          flexMessage: flexMessage
        })
      });

      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(`API Error (${res.status}): ${result.message || 'Unknown error'}`);
      }

      setResponse({
        type: 'success',
        message: 'ส่ง Flex Message สำเร็จ!',
        data: JSON.stringify(result, null, 2)
      });

    } catch (error) {
      console.error('Failed to send Flex Message:', error);
      setResponse({
        type: 'error',
        message: 'เกิดข้อผิดพลาดในการส่ง:',
        data: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-8 font-sans">
      <main className="max-w-2xl mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">ทดสอบส่ง Flex Message</h1>
          <p className="text-gray-500 mb-6">ใช้หน้านี้เพื่อทดสอบ API การส่ง Notification ไปยังผู้ใช้โดยตรง</p>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                LINE User ID ของผู้รับ
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="U1234567890..."
                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm"
              />
            </div>
            
            <div className="flex items-center gap-4">
                <button
                onClick={() => handleSendFlex('checkin')}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                >
                {isLoading ? 'กำลังส่ง...' : 'ทดสอบ (เช็คอินสำเร็จ)'}
                </button>
                <button
                onClick={() => handleSendFlex('register')}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 disabled:bg-green-300"
                >
                {isLoading ? 'กำลังส่ง...' : 'ทดสอบ (ลงทะเบียนสำเร็จ)'}
                </button>
            </div>
          </div>

          {response && (
            <div className="mt-6 p-4 rounded-md border">
              <h2 className={`text-lg font-bold ${response.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                ผลลัพธ์:
              </h2>
              <p className="font-semibold">{response.message}</p>
              <pre className="mt-2 p-3 bg-gray-50 rounded-md text-xs whitespace-pre-wrap break-all">
                <code>{response.data}</code>
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}