'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { queueToThaiSpeech, channelNameToThai } from '../../../lib/speechUtils';

export default function QueueDisplayPage({ params }) {
  const unwrappedParams = use(params);
  const activityId = unwrappedParams.id;

  const [activity, setActivity] = useState(null);
  const [channels, setChannels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pulsingChannels, setPulsingChannels] = useState({});
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Pre-load speech voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Handle Thai Text-to-Speech
  const speakQueueNumber = useCallback((queueNum, channelNameText) => {
    if (!voiceEnabled || !('speechSynthesis' in window) || !queueNum) return;

    window.speechSynthesis.cancel();

    const thaiText = queueToThaiSpeech(queueNum);
    const thaiChannelName = channelNameToThai(channelNameText);
    const fullText = `เชิญ, หมายเลข, ${thaiText} ที่, ${thaiChannelName}`;

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = 'th-TH';
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.volume = 1;

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
      const qChannels = query(channelsRef, where('activityId', '==', activityId));

      const unsubscribeChannels = onSnapshot(
        qChannels,
        (querySnapshot) => {
          const channelsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Sort client-side by channelNumber so composite index is not strictly required
          channelsData.sort((a, b) => (Number(a.channelNumber) || 0) - (Number(b.channelNumber) || 0));

          setChannels(prevChannels => {
            const updatedChannels = channelsData;

            updatedChannels.forEach(newChannel => {
              const oldChannel = prevChannels.find(old => old.id === newChannel.id);
              const qNum = newChannel.currentDisplayQueueNumber || newChannel.currentQueue;
              const chDisplayName = newChannel.name || newChannel.channelName || `ช่องบริการ ${newChannel.channelNumber || 1}`;

              const isPingChanged = oldChannel && newChannel.pingId && oldChannel.pingId !== newChannel.pingId;
              const isQueueChanged = oldChannel && qNum && (
                qNum !== (oldChannel.currentDisplayQueueNumber || oldChannel.currentQueue) ||
                (newChannel.lastCalledAt?.seconds && newChannel.lastCalledAt?.seconds !== oldChannel.lastCalledAt?.seconds)
              );

              if (isPingChanged || isQueueChanged) {
                setPulsingChannels(prev => ({ ...prev, [newChannel.id]: true }));

                setTimeout(() => {
                  setPulsingChannels(prev => ({ ...prev, [newChannel.id]: false }));
                }, 5000);

                speakQueueNumber(qNum, chDisplayName);
              }
            });

            return updatedChannels;
          });

          setIsLoading(false);
        },
        (err) => {
          console.error('Queue channels onSnapshot error:', err);
          setIsLoading(false);
        }
      );

      return () => {
        unsubscribeChannels();
      };
    }
  }, [activityId, speakQueueNumber]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Dynamic grid column class based on channel count
  const getGridColsClass = (count) => {
    if (count <= 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    if (count === 3) return 'grid-cols-1 md:grid-cols-3';
    if (count === 4) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
    if (count <= 6) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5';
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 p-4 md:p-6 lg:p-8 flex flex-col font-sans select-none">
      {/* High Contrast Header Bar */}
      <header className="bg-white border border-slate-200 shadow-xs px-5 py-3 rounded-2xl flex items-center justify-between gap-4 mb-4 md:mb-6 shrink-0">
        {/* Left: Activity Name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#000946] flex items-center justify-center text-white shrink-0 shadow-xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-bold text-[#000946] truncate">
              {activity?.name || 'สถานะการเรียกคิว'}
            </h1>
            <p className="text-sm font-normal text-slate-500 hidden sm:block">
              จอแสดงผลสถานะคิวและเรียกผู้สมัคร
            </p>
          </div>
        </div>

        {/* Center: Live Clock */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 shadow-xs">
          <svg className="w-4 h-4 text-[#000946]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{currentTime}</span>
        </div>

        {/* Right: Sound & Fullscreen Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setVoiceEnabled(!voiceEnabled);
              if (!voiceEnabled && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance('');
                window.speechSynthesis.speak(utterance);
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-sm font-normal transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              voiceEnabled
                ? 'bg-[#000946] text-white hover:bg-[#000946]/90'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
            title={voiceEnabled ? 'คลิกเพื่อปิดเสียงประกาศ' : 'คลิกเพื่อเปิดเสียงประกาศ'}
          >
            {voiceEnabled ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
            <span className="hidden md:inline">{voiceEnabled ? 'เสียงเปิด' : 'เสียงปิด'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 px-3.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-xl text-sm font-normal transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="ขยายเต็มจอ (Fullscreen)"
          >
            {isFullscreen ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>ย่อจอ</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span>เต็มจอ</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Full-Height Channel Display Grid */}
      {isLoading ? (
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-500 text-sm font-normal shadow-xs">
          <div className="w-10 h-10 border-3 border-[#000946] border-t-transparent rounded-full animate-spin mb-3"></div>
          กำลังโหลดข้อมูลสถานะคิว...
        </div>
      ) : channels.length === 0 ? (
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 text-sm font-normal shadow-xs gap-2">
          <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>ยังไม่มีช่องบริการที่เปิดใช้งาน</span>
        </div>
      ) : (
        <div className={`flex-1 grid gap-4 md:gap-6 lg:gap-8 ${getGridColsClass(channels.length)} min-h-0 overflow-y-auto`}>
          {channels.map((channel) => {
            const isPulsing = pulsingChannels[channel.id];
            return (
              <div
                key={channel.id}
                className={`rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 shadow-sm ${
                  isPulsing
                    ? 'bg-red-50/40 border-red-500 ring-8 ring-red-500/30 z-10 scale-[1.02]'
                    : 'bg-white border-slate-200'
                }`}
              >
                {/* Station Header */}
                <div
                  className={`px-5 py-3.5 flex items-center justify-between gap-2 shrink-0 ${
                    isPulsing
                      ? 'bg-red-600 text-white'
                      : 'bg-[#000946] text-white'
                  }`}
                >
                  <h2 className="text-base md:text-lg lg:text-xl font-bold truncate text-white">
                    {channel.name || channel.channelName || `ช่องบริการ ${channel.channelNumber}`}
                  </h2>
                  <span className="text-sm font-normal px-3 py-0.5 rounded-full bg-white/20 text-white truncate border border-white/20">
                    {channel.servingCourse || 'ทุกหลักสูตร'}
                  </span>
                </div>

                {/* Massive Queue Display Area */}
                <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 text-center min-h-[160px] space-y-3">
                  <span
                    className={`text-sm font-normal uppercase tracking-wider block px-3 py-1 rounded-full ${
                      isPulsing ? 'bg-red-100 text-red-700 font-bold animate-pulse' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isPulsing ? 'กำลังเรียกคิว!' : 'หมายเลขคิว'}
                  </span>

                  <div
                    className={`font-bold tracking-tight leading-none my-auto transition-transform ${
                      channels.length <= 2
                        ? 'text-7xl md:text-8xl lg:text-9xl'
                        : channels.length <= 4
                        ? 'text-6xl md:text-7xl lg:text-8xl'
                        : 'text-5xl md:text-6xl lg:text-7xl'
                    } ${isPulsing ? 'text-red-600 animate-bounce' : 'text-[#000946]'}`}
                  >
                    {channel.currentDisplayQueueNumber || channel.currentQueue || '-'}
                  </div>

                  <div
                    className={`w-full text-base md:text-lg lg:text-xl font-bold truncate mt-2 px-2 ${
                      isPulsing ? 'text-red-900' : 'text-slate-900'
                    }`}
                  >
                    {channel.currentStudentName?.trim()
                      ? channel.currentStudentName
                      : ((channel.currentDisplayQueueNumber || channel.currentQueue) && channel.status === 'calling'
                          ? 'กำลังเรียกคิว'
                          : 'ว่าง (รอเรียก)')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}