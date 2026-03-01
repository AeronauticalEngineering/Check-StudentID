'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useParams } from 'next/navigation';

const queueToThaiSpeech = (displayQueueNumber) => {
  if (!displayQueueNumber) return '';

  const match = displayQueueNumber.match(/([A-Za-z]+)[- ]?(\d+)/);
  if (!match) return displayQueueNumber;

  const letters = match[1].toUpperCase();
  const numbers = match[2];

  const letterMap = {
    'A': 'เอ', 'B': 'บี', 'C': 'ซี', 'D': 'ดี', 'E': 'อี', 'F': 'เอฟ',
    'G': 'จี', 'H': 'เอช', 'I': 'ไอ', 'J': 'เจ', 'K': 'เค', 'L': 'แอล',
    'M': 'เอ็ม', 'N': 'เอ็น', 'O': 'โอ', 'P': 'พี', 'Q': 'คิว', 'R': 'อาร์',
    'S': 'เอส', 'T': 'ที', 'U': 'ยู', 'V': 'วี', 'W': 'ดับเบิ้ลยู',
    'X': 'เอ็กซ์', 'Y': 'วาย', 'Z': 'แซด'
  };

  const digitMap = {
    '0': 'ศูนย์', '1': 'หนึ่ง', '2': 'สอง', '3': 'สาม', '4': 'สี่',
    '5': 'ห้า', '6': 'หก', '7': 'เจ็ด', '8': 'แปด', '9': 'เก้า'
  };

  let speech = '';
  for (const char of letters) {
    speech += (letterMap[char] || char) + ', ';
  }
  for (const digit of numbers) {
    speech += (digitMap[digit] || digit) + ', ';
  }

  return speech.trim();
};

const channelNameToThai = (channelName) => {
  if (!channelName) return '';

  const wordMap = {
    'AERO': 'แอโร่',
    'VIP': 'วีไอพี',
    'SERVICE': 'เซอร์วิส',
    'COUNTER': 'เคาน์เตอร์',
    'DESK': 'เดสก์',
    'STATION': 'สเตชั่น',
    'ZONE': 'โซน',
    'ROOM': 'รูม',
    'Channel': 'ช่องบริการที่'
  };

  const digitToThai = {
    '0': 'ศูนย์', '1': 'หนึ่ง', '2': 'สอง', '3': 'สาม', '4': 'สี่',
    '5': 'ห้า', '6': 'หก', '7': 'เจ็ด', '8': 'แปด', '9': 'เก้า'
  };

  let result = channelName.toUpperCase();

  for (const [eng, thai] of Object.entries(wordMap)) {
    result = result.replace(new RegExp(eng, 'gi'), thai);
  }

  result = result.replace(/\d/g, (digit) => digitToThai[digit]);

  return result.trim().replace(/\s+/g, '');
};

export default function QueueDisplayPage() {
  const params = useParams();
  const { id: activityId } = params;
  const [activity, setActivity] = useState(null);
  const [channels, setChannels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pulsingChannels, setPulsingChannels] = useState({});
  const [voiceEnabled, setVoiceEnabled] = useState(false); // To enable audio context interactively

  const fetchActivity = useCallback(async () => {
    if (activityId) {
      const activityRef = doc(db, 'activities', activityId);
      const activitySnap = await getDoc(activityRef);
      if (activitySnap.exists()) {
        setActivity({ id: activitySnap.id, ...activitySnap.data() });
      }
    }
  }, [activityId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Handle Thai Text-to-Speech
  const speakQueueNumber = useCallback((queueNum, channelNameText) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;

    // Stop any currently playing speech to avoid overlap
    window.speechSynthesis.cancel();

    const thaiText = queueToThaiSpeech(queueNum);
    const thaiChannelName = channelNameToThai(channelNameText);
    const fullText = `เชิญ, หมายเลข, ${thaiText} ที่, ${thaiChannelName}`;

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = 'th-TH';
    utterance.rate = 0.85; // ความเร็วเดิมของ user
    utterance.pitch = 1;
    utterance.volume = 1;

    // Find Thai voice if available
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = voices.find(v => v.lang.includes('th'));
    if (thaiVoice) {
      utterance.voice = thaiVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  useEffect(() => {
    if (activityId) {
      const channelsRef = collection(db, 'queueChannels');
      const qChannels = query(channelsRef, where('activityId', '==', activityId), orderBy('channelNumber'));

      const unsubscribeChannels = onSnapshot(qChannels, (querySnapshot) => {
        const channelsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Check for new pings to trigger animations
        setChannels(prevChannels => {
          const updatedChannels = channelsData;

          updatedChannels.forEach(newChannel => {
            const oldChannel = prevChannels.find(old => old.id === newChannel.id);
            // If pingId has changed, it means this channel was just called
            if (oldChannel && oldChannel.pingId !== newChannel.pingId && newChannel.pingId) {
              // Trigger pulse for this channel
              setPulsingChannels(prev => ({ ...prev, [newChannel.id]: true }));

              // Remove pulse after 5 seconds
              setTimeout(() => {
                setPulsingChannels(prev => ({ ...prev, [newChannel.id]: false }));
              }, 5000);

              // Play Audio on the display screen
              speakQueueNumber(newChannel.currentDisplayQueueNumber, newChannel.channelName || `ช่องบริการ ${newChannel.channelNumber}`);
            }
          });

          return updatedChannels;
        });

        setIsLoading(false);
      });

      return () => {
        unsubscribeChannels();
      }
    }
  }, [activityId, speakQueueNumber]);





  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 md:p-8 font-sans">
      <div className="w-full mx-auto">
        <header className="relative text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight">สถานะคิว</h1>
          <p className="text-xl text-gray-600 mt-2">{activity?.name}</p>

          <button
            onClick={() => {
              setVoiceEnabled(!voiceEnabled);
              if (!voiceEnabled && 'speechSynthesis' in window) {
                // Init audio context
                const utterance = new SpeechSynthesisUtterance('');
                window.speechSynthesis.speak(utterance);
              }
            }}
            className={`absolute right-0 top-0 mt-4 mr-4 p-3 rounded-full flex items-center justify-center transition-all ${voiceEnabled
              ? 'bg-green-100 text-green-600 shadow-md ring-2 ring-green-400'
              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
              }`}
            title={voiceEnabled ? 'ปิดเสียงประกาศ' : 'เปิดเสียงประกาศ'}
          >
            {voiceEnabled ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            )}
          </button>
        </header>

        {isLoading ? (
          <div className="text-center text-gray-500">กำลังโหลดข้อมูลล่าสุด...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 md:gap-8">
            {channels.map((channel, index) => {
              const isPulsing = pulsingChannels[channel.id];
              return (
                <div
                  key={channel.id}
                  className={`rounded-2xl shadow-lg overflow-hidden transition-all duration-300 transform 
                  ${isPulsing ? 'scale-110 ring-8 ring-red-500 ring-opacity-50 z-10' : 'hover:scale-105'} 
                  ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                `}
                >
                  <div className={`p-6 transition-colors duration-500 ${isPulsing ? 'bg-red-600 text-white' : ''}`}>
                    <h3 className={`text-xl font-bold truncate ${isPulsing ? 'text-white' : 'text-gray-800'}`}>
                      {channel.channelName || `ช่องบริการ ${channel.channelNumber}`}
                    </h3>
                    <p className={`text-sm font-medium inline-block px-3 py-1 rounded-full mt-1 ${isPulsing ? 'bg-white/20 text-white' : 'text-white bg-card'}`}>
                      {channel.servingCourse || 'ยังไม่ระบุหลักสูตร'}
                    </p>
                  </div>

                  <div className={`px-6 py-8 text-center transition-colors duration-500 ${isPulsing ? 'bg-white border-4 border-red-600' : 'bg-gradient-to-br from-blue-50 to-indigo-100'}`}>
                    <p className={`text-sm font-medium ${isPulsing ? 'text-red-600 animate-pulse' : 'text-gray-500'}`}>
                      {isPulsing ? 'กำลังเรียกคิว!' : 'คิวปัจจุบัน'}
                    </p>
                    <p className={`text-5xl font-bold tracking-tighter my-2 ${isPulsing ? 'text-red-600 animate-bounce' : 'text-primary'}`}>
                      {channel.currentDisplayQueueNumber || '-'}
                    </p>
                    <p className={`text-xl font-bold h-8 truncate ${isPulsing ? 'text-red-800' : 'text-gray-700 font-medium'}`}>
                      {channel.currentStudentName || 'ว่าง'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  );
}