'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useParams } from 'next/navigation';

// --- จุดที่แก้ไข: ย้ายตัวแปร Array ออกมาไว้นอก Component ---
const satisfactionOptions = [
    "มากที่สุด",
    "มาก",
    "ปานกลาง",
    "น้อย",
    "ควรปรับปรุง"
];

const sourceOptions = [
    "เว็บไซต์",
    "เพจ/โซเชียลมีเดีย",
    "เพื่อน/ผู้ปกครองแนะนำ",
];

export default function EvaluationResultPage() {
    const params = useParams();
    const { activityId } = params;
    const [activity, setActivity] = useState(null);
    const [evaluations, setEvaluations] = useState([]);
    const [satisfactionCounts, setSatisfactionCounts] = useState({});
    const [sourceCounts, setSourceCounts] = useState({});
    const [otherSources, setOtherSources] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!activityId) return;
            setIsLoading(true);

            try {
                // Fetch Activity Details
                const activityRef = doc(db, 'activities', activityId);
                const activitySnap = await getDoc(activityRef);
                if (activitySnap.exists()) {
                    setActivity(activitySnap.data());
                }

                // Fetch Evaluations
                const q = query(collection(db, 'evaluations'), where('activityId', '==', activityId));
                const querySnapshot = await getDocs(q);
                const evals = querySnapshot.docs.map(doc => doc.data());
                setEvaluations(evals);

                // Process evaluation data
                if (evals.length > 0) {
                    const satCounts = evals.reduce((acc, curr) => {
                        if (curr.satisfaction) {
                            acc[curr.satisfaction] = (acc[curr.satisfaction] || 0) + 1;
                        }
                        return acc;
                    }, {});
                    setSatisfactionCounts(satCounts);

                    const srcCounts = {};
                    const others = [];
                    evals.forEach(e => {
                        if (e.source) {
                            if (sourceOptions.includes(e.source)) {
                                srcCounts[e.source] = (srcCounts[e.source] || 0) + 1;
                            } else {
                                others.push(e.source);
                            }
                        }
                    });
                    setSourceCounts(srcCounts);
                    setOtherSources(others);
                }
            } catch (error) {
                console.error("Error fetching evaluation data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    // --- จุดที่แก้ไข: เอา sourceOptions ออกจาก dependency array ---
    }, [activityId]);

    const getTotalResponses = () => evaluations.length;

    if (isLoading) return <p className="text-center p-8">กำลังโหลดข้อมูลการประเมิน...</p>;
    
    if (evaluations.length === 0 && !isLoading) {
         return (
            <div className="container mx-auto p-4 md:p-8">
                <h1 className="text-2xl font-bold">ผลการประเมิน</h1>
                <h2 className="text-xl text-gray-600 mb-6">{activity?.name || '...'}</h2>
                <div className="text-center p-10 bg-white rounded-lg shadow">
                    <p className="text-gray-500">ยังไม่มีผู้ส่งแบบประเมินสำหรับกิจกรรมนี้</p>
                </div>
            </div>
         )
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-2xl font-bold">ผลการประเมิน</h1>
            <h2 className="text-xl text-gray-600 mb-6">{activity?.name} (ผู้ตอบ {getTotalResponses()} คน)</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Satisfaction Results */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">1. ความพึงพอใจโดยรวมต่อกระบวนการรับสมัคร</h3>
                    <div className="space-y-3">
                        {satisfactionOptions.map(option => {
                            const count = satisfactionCounts[option] || 0;
                            const percentage = getTotalResponses() > 0 ? (count / getTotalResponses() * 100).toFixed(1) : 0;
                            return (
                                <div key={option}>
                                    <div className="flex justify-between items-center mb-1 text-sm">
                                        <span className="font-medium text-gray-700">{option}</span>
                                        <span>{count} คน ({percentage}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-4">
                                        <div 
                                            className="bg-primary h-4 rounded-full transition-all duration-500" 
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sources Results */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">2. ช่องทางการรับทราบข้อมูล</h3>
                    <div className="space-y-3">
                        {sourceOptions.map(option => {
                            const count = sourceCounts[option] || 0;
                            const percentage = getTotalResponses() > 0 ? (count / getTotalResponses() * 100).toFixed(1) : 0;
                            return (
                                <div key={option}>
                                    <div className="flex justify-between items-center mb-1 text-sm">
                                        <span className="font-medium text-gray-700">{option}</span>
                                        <span>{count} คน ({percentage}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-4">
                                        <div 
                                            className="bg-green-600 h-4 rounded-full transition-all duration-500" 
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {otherSources.length > 0 && (
                        <div className="mt-6">
                            <h4 className="text-md font-semibold mb-2">ช่องทางอื่น ๆ ({otherSources.length} รายการ)</h4>
                             <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3 bg-gray-50">
                                {otherSources.map((source, i) => (
                                    <p key={i} className="p-2 border-b last:border-b-0 text-sm">{source}</p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}