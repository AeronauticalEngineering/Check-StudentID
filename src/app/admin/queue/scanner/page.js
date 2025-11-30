'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';

export default function SelectQueueScannerPage() {
  const [queueActivities, setQueueActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQueueActivities = async () => {
      try {
        const activitiesRef = collection(db, 'activities');
        const q = query(activitiesRef, where('type', '==', 'queue'));
        const querySnapshot = await getDocs(q);
        const activities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setQueueActivities(activities);
      } catch (error) {
        console.error("Error fetching queue activities:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQueueActivities();
  }, []);

  if (isLoading) return <div className="text-center p-8">กำลังโหลด...</div>;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">เลือกกิจกรรมเพื่อสแกนรับคิว</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queueActivities.map(activity => (
          <Link key={activity.id} href={`/admin/queue/scanner/${activity.id}`}>
            <div className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <h2 className="text-lg font-semibold">{activity.name}</h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}