'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import Link from 'next/link';

export default function SelectEvaluationPage() {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const activitiesSnapshot = await getDocs(collection(db, 'activities'));
        const activitiesList = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActivities(activitiesList);
      } catch (error) {
        console.error("Error fetching activities:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, []);

  if (isLoading) {
    return <div className="text-center p-8">กำลังโหลดกิจกรรม...</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">เลือกกิจกรรมเพื่อดูผลการประเมิน</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activities.map(activity => (
          <Link key={activity.id} href={`/admin/evaluation/${activity.id}`}>
            <div className="block p-6 bg-white border rounded-lg shadow hover:shadow-lg transition-shadow">
              <h2 className="text-lg font-semibold">{activity.name}</h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}