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
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

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
                const evals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // ดึงข้อมูลนักเรียนจาก studentProfiles เพื่อเติมชื่อและรหัส
                const enrichedEvals = await Promise.all(evals.map(async (evaluation) => {
                    if (evaluation.lineUserId) {
                        try {
                            const profileQuery = query(
                                collection(db, 'studentProfiles'), 
                                where('lineUserId', '==', evaluation.lineUserId)
                            );
                            const profileSnapshot = await getDocs(profileQuery);
                            if (!profileSnapshot.empty) {
                                const profileData = profileSnapshot.docs[0].data();
                                return {
                                    ...evaluation,
                                    fullName: profileData.fullName || evaluation.fullName,
                                    studentId: profileData.studentId || evaluation.studentId,
                                    nationalId: profileData.nationalId || evaluation.nationalId
                                };
                            }
                        } catch (error) {
                            console.error('Error fetching profile:', error);
                        }
                    }
                    return evaluation;
                }));
                
                setEvaluations(enrichedEvals);

                // Process evaluation data
                if (enrichedEvals.length > 0) {
                    const satCounts = enrichedEvals.reduce((acc, curr) => {
                        if (curr.satisfaction) {
                            acc[curr.satisfaction] = (acc[curr.satisfaction] || 0) + 1;
                        }
                        return acc;
                    }, {});
                    setSatisfactionCounts(satCounts);

                    const srcCounts = {};
                    const others = [];
                    enrichedEvals.forEach(e => {
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

    // Pagination
    const totalPages = Math.ceil(evaluations.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageData = evaluations.slice(startIndex, endIndex);

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

            {/* รายละเอียดการประเมินของแต่ละคน */}
            <div className="mt-8 bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">รายละเอียดการประเมินทั้งหมด</h3>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3">#</th>
                                <th className="p-3">ชื่อ-สกุล</th>
                                <th className="p-3">รหัสนักเรียน</th>
                                <th className="p-3">ความพึงพอใจ</th>
                                <th className="p-3">ช่องทางรับทราบ</th>
                                <th className="p-3">ความคิดเห็น</th>
                                <th className="p-3">วันที่ประเมิน</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentPageData.map((evaluation, index) => {
                                const globalIndex = startIndex + index + 1;
                                return (
                                    <tr key={index} className="border-b hover:bg-gray-50">
                                        <td className="p-3">{globalIndex}</td>
                                        <td className="p-3 font-medium">{evaluation.fullName || '-'}</td>
                                        <td className="p-3">{evaluation.studentId || '-'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                evaluation.satisfaction === 'มากที่สุด' ? 'bg-green-100 text-green-800' :
                                                evaluation.satisfaction === 'มาก' ? 'bg-blue-100 text-blue-800' :
                                                evaluation.satisfaction === 'ปานกลาง' ? 'bg-yellow-100 text-yellow-800' :
                                                evaluation.satisfaction === 'น้อย' ? 'bg-orange-100 text-orange-800' :
                                                evaluation.satisfaction === 'ควรปรับปรุง' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {evaluation.satisfaction || '-'}
                                            </span>
                                        </td>
                                        <td className="p-3">{evaluation.source || '-'}</td>
                                        <td className="p-3 max-w-xs">
                                            <div className="truncate" title={evaluation.comment}>
                                                {evaluation.comment || '-'}
                                            </div>
                                        </td>
                                        <td className="p-3 text-gray-500 whitespace-nowrap">
                                            {evaluation.submittedAt ? new Date(evaluation.submittedAt.seconds * 1000).toLocaleString('th-TH', {
                                                year: 'numeric', month: 'short', day: 'numeric', 
                                                hour: '2-digit', minute: '2-digit'
                                            }) : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {evaluations.length > itemsPerPage && (
                    <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-gray-600">
                            แสดง {startIndex + 1} - {Math.min(endIndex, evaluations.length)} จาก {evaluations.length} รายการ
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ← ก่อนหน้า
                            </button>
                            
                            <div className="flex gap-1">
                                {[...Array(totalPages)].map((_, i) => {
                                    const pageNum = i + 1;
                                    if (
                                        pageNum === 1 || 
                                        pageNum === totalPages || 
                                        (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                                    ) {
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`px-3 py-2 rounded-md ${
                                                    currentPage === pageNum
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    } else if (pageNum === currentPage - 3 || pageNum === currentPage + 3) {
                                        return <span key={pageNum} className="px-2 py-2">...</span>;
                                    }
                                    return null;
                                })}
                            </div>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ถัดไป →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}