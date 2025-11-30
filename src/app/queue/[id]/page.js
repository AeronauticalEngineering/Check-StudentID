'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useParams } from 'next/navigation';

export default function QueueDisplayPage() {
  const params = useParams();
  const { id: activityId } = params;
  const [activity, setActivity] = useState(null);
  const [channels, setChannels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    if (activityId) {
      const channelsRef = collection(db, 'queueChannels');
      const qChannels = query(channelsRef, where('activityId', '==', activityId), orderBy('channelNumber'));
      
      const unsubscribeChannels = onSnapshot(qChannels, (querySnapshot) => {
        const channelsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setChannels(channelsData);
        setIsLoading(false);
      });
      
      return () => {
          unsubscribeChannels();
      }
    }
  }, [activityId]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 md:p-8 font-sans">
      <div className="w-full mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight">สถานะคิว</h1>
          <p className="text-xl text-gray-600 mt-2">{activity?.name}</p>
        </header>
        
        {isLoading ? (
          <div className="text-center text-gray-500">กำลังโหลดข้อมูลล่าสุด...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 md:gap-8">
            {channels.map((channel, index) => (
              <div 
                key={channel.id} 
                className={`rounded-2xl shadow-lg overflow-hidden transition-all duration-300 transform hover:scale-105 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 truncate">{channel.channelName || `ช่องบริการ ${channel.channelNumber}`}</h3>
                  <p className="text-sm font-medium text-white bg-card inline-block px-3 py-1 rounded-full mt-1">
                    {channel.servingCourse || 'ยังไม่ระบุหลักสูตร'}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 px-6 py-8 text-center">
                  <p className="text-sm font-medium text-gray-500">คิวปัจจุบัน</p>
                  <p className="text-5xl font-bold text-primary tracking-tighter my-2">
                    {channel.currentDisplayQueueNumber || '-'}
                  </p>
                  <p className="text-xl text-gray-700 h-8 truncate font-medium">
                    {channel.currentStudentName || 'ว่าง'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}