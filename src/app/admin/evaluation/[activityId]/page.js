'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { CSVLink } from "react-csv";

// Legacy Options
const satisfactionOptions = [
    "มากที่สุด", "มาก", "ปานกลาง", "น้อย", "ควรปรับปรุง"
];
const sourceOptions = [
    "เว็บไซต์", "เพจ/โซเชียลมีเดีย", "เพื่อน/ผู้ปกครองแนะนำ",
];

export default function EvaluationResultPage() {
    const params = useParams();
    const { activityId } = params;
    const [activity, setActivity] = useState(null);
    const [evaluations, setEvaluations] = useState([]);
    const [stats, setStats] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const fetchData = async () => {
            if (!activityId) return;
            setIsLoading(true);

            try {
                // 1. Fetch Activity
                const activityRef = doc(db, 'activities', activityId);
                const activitySnap = await getDoc(activityRef);
                let activityData = null;
                if (activitySnap.exists()) {
                    activityData = { id: activitySnap.id, ...activitySnap.data() };
                    setActivity(activityData);
                }

                // 2. Fetch Evaluations
                const q = query(collection(db, 'evaluations'), where('activityId', '==', activityId));
                const querySnapshot = await getDocs(q);
                const evals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // 3. Enrich with Student Profile
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

                // 4. Process Statistics
                const newStats = {};

                // Legacy Stats
                if (!activityData?.enableEvaluation || !activityData?.evaluationQuestions) {
                    const satCounts = {};
                    const srcCounts = {};
                    const others = [];

                    enrichedEvals.forEach(e => {
                        if (e.satisfaction) satCounts[e.satisfaction] = (satCounts[e.satisfaction] || 0) + 1;
                        if (e.source) {
                            if (sourceOptions.includes(e.source)) {
                                srcCounts[e.source] = (srcCounts[e.source] || 0) + 1;
                            } else {
                                others.push(e.source);
                            }
                        }
                    });
                    newStats.legacy = { satisfaction: satCounts, source: srcCounts, otherSources: others };
                }
                // Dynamic Stats
                else {
                    activityData.evaluationQuestions.forEach(q => {
                        if (q.type === 'rating') {
                            const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                            let sum = 0;
                            let total = 0;
                            enrichedEvals.forEach(e => {
                                const val = e.answers?.[q.id];
                                if (val) {
                                    counts[val] = (counts[val] || 0) + 1;
                                    sum += Number(val);
                                    total++;
                                }
                            });
                            newStats[q.id] = {
                                type: 'rating',
                                counts,
                                average: total > 0 ? (sum / total).toFixed(2) : 0,
                                total
                            };
                        } else if (q.type === 'text') {
                            const answers = enrichedEvals
                                .map(e => e.answers?.[q.id])
                                .filter(a => a); // Filter empty
                            newStats[q.id] = { type: 'text', answers };
                        }
                    });
                }
                setStats(newStats);

            } catch (error) {
                console.error("Error fetching evaluation data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [activityId]);

    // Pagination
    const totalPages = Math.ceil(evaluations.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentPageData = evaluations.slice(startIndex, startIndex + itemsPerPage);

    // CSV Export Data Preparation
    const getCsvData = () => {
        if (!activity) return [];

        // Headers
        const headers = [
            { label: "ชื่อ-สกุล", key: "fullName" },
            { label: "รหัสนักเรียน", key: "studentId" },
            { label: "วันที่ประเมิน", key: "submittedAt" }
        ];

        if (activity.evaluationQuestions) {
            activity.evaluationQuestions.forEach((q, i) => {
                headers.push({ label: q.text, key: `q_${q.id}` });
            });
        } else {
            headers.push({ label: "ความพึงพอใจ", key: "satisfaction" });
            headers.push({ label: "ช่องทางรับทราบ", key: "source" });
            headers.push({ label: "ความคิดเห็น", key: "comment" });
        }

        // Rows
        const data = evaluations.map(e => {
            const row = {
                fullName: e.fullName || '-',
                studentId: e.studentId || '-',
                submittedAt: e.submittedAt ? new Date(e.submittedAt.seconds * 1000).toLocaleString('th-TH') : '-'
            };

            if (activity.evaluationQuestions) {
                activity.evaluationQuestions.forEach(q => {
                    row[`q_${q.id}`] = e.answers?.[q.id] || '-';
                });
            } else {
                row.satisfaction = e.satisfaction || '-';
                row.source = e.source || '-';
                row.comment = e.comment || '-';
            }
            return row;
        });

        return { headers, data };
    };

    const csvInfo = getCsvData();

    if (isLoading) return (
        <div className="flex justify-center items-center h-screen bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans">
            <main className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">ผลการประเมิน: {activity?.name}</h1>
                        <p className="text-gray-500">ผู้ตอบแบบสอบถามทั้งหมด {evaluations.length} คน</p>
                    </div>
                    {evaluations.length > 0 && (
                        <CSVLink
                            data={csvInfo.data}
                            headers={csvInfo.headers}
                            filename={`evaluation_${activityId}.csv`}
                            className="px-4 py-2 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-all shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Export CSV
                        </CSVLink>
                    )}
                </div>

                {evaluations.length === 0 ? (
                    <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">ยังไม่มีข้อมูลการประเมิน</h3>
                        <p className="text-gray-500">รอให้ผู้เข้าร่วมกิจกรรมส่งแบบประเมินเข้ามา</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Summary Cards / Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Legacy View */}
                            {stats.legacy && (
                                <>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">ความพึงพอใจโดยรวม</h3>
                                        <div className="space-y-3">
                                            {satisfactionOptions.map(option => {
                                                const count = stats.legacy.satisfaction[option] || 0;
                                                const percentage = evaluations.length > 0 ? (count / evaluations.length * 100).toFixed(1) : 0;
                                                return (
                                                    <div key={option}>
                                                        <div className="flex justify-between items-center mb-1 text-sm">
                                                            <span className="font-medium text-gray-700">{option}</span>
                                                            <span className="text-gray-500">{count} ({percentage}%)</span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 rounded-full h-3">
                                                            <div className="bg-blue-500 h-3 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">ช่องทางการรับทราบข้อมูล</h3>
                                        <div className="space-y-3">
                                            {sourceOptions.map(option => {
                                                const count = stats.legacy.source[option] || 0;
                                                const percentage = evaluations.length > 0 ? (count / evaluations.length * 100).toFixed(1) : 0;
                                                return (
                                                    <div key={option}>
                                                        <div className="flex justify-between items-center mb-1 text-sm">
                                                            <span className="font-medium text-gray-700">{option}</span>
                                                            <span className="text-gray-500">{count} ({percentage}%)</span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 rounded-full h-3">
                                                            <div className="bg-green-500 h-3 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Dynamic View */}
                            {activity?.evaluationQuestions?.map(q => {
                                const qStats = stats[q.id];
                                if (!qStats) return null;

                                if (q.type === 'rating') {
                                    return (
                                        <div key={q.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="text-lg font-bold text-gray-800">{q.text}</h3>
                                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold">
                                                    Avg: {qStats.average} / 5
                                                </span>
                                            </div>
                                            <div className="space-y-3">
                                                {[5, 4, 3, 2, 1].map(score => {
                                                    const count = qStats.counts[score] || 0;
                                                    const percentage = qStats.total > 0 ? (count / qStats.total * 100).toFixed(1) : 0;
                                                    return (
                                                        <div key={score}>
                                                            <div className="flex justify-between items-center mb-1 text-sm">
                                                                <span className="font-medium text-gray-700 flex items-center gap-1">
                                                                    {score} <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                                </span>
                                                                <span className="text-gray-500">{count} ({percentage}%)</span>
                                                            </div>
                                                            <div className="w-full bg-gray-100 rounded-full h-3">
                                                                <div className={`h-3 rounded-full transition-all duration-500 ${score >= 4 ? 'bg-green-500' : score === 3 ? 'bg-yellow-500' : 'bg-red-500'
                                                                    }`} style={{ width: `${percentage}%` }}></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                } else if (q.type === 'text') {
                                    return (
                                        <div key={q.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                                            <h3 className="text-lg font-bold text-gray-800 mb-4">{q.text}</h3>
                                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                                                {qStats.answers.length > 0 ? (
                                                    qStats.answers.map((ans, idx) => (
                                                        <div key={idx} className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700 border border-gray-100">
                                                            &quot;{ans}&quot;
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-gray-400 text-sm italic">ไม่มีคำตอบ</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>

                        {/* Detailed Table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-5 border-b border-gray-100 bg-gray-50/30">
                                <h3 className="font-bold text-gray-800 text-lg">รายการประเมินรายบุคคล</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 w-16">#</th>
                                            <th className="px-6 py-4 min-w-[150px]">ชื่อ-สกุล</th>
                                            <th className="px-6 py-4 min-w-[120px]">รหัสนักเรียน</th>
                                            {activity?.evaluationQuestions ? (
                                                activity.evaluationQuestions.map(q => (
                                                    <th key={q.id} className="px-6 py-4 min-w-[150px]">{q.text}</th>
                                                ))
                                            ) : (
                                                <>
                                                    <th className="px-6 py-4">ความพึงพอใจ</th>
                                                    <th className="px-6 py-4">ช่องทาง</th>
                                                    <th className="px-6 py-4">ความคิดเห็น</th>
                                                </>
                                            )}
                                            <th className="px-6 py-4">วันที่</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {currentPageData.map((evaluation, index) => (
                                            <tr key={evaluation.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 text-gray-500">{startIndex + index + 1}</td>
                                                <td className="px-6 py-4 font-medium text-gray-900">{evaluation.fullName || '-'}</td>
                                                <td className="px-6 py-4 text-gray-600">{evaluation.studentId || '-'}</td>

                                                {activity?.evaluationQuestions ? (
                                                    activity.evaluationQuestions.map(q => (
                                                        <td key={q.id} className="px-6 py-4 text-gray-700">
                                                            {evaluation.answers?.[q.id] || '-'}
                                                        </td>
                                                    ))
                                                ) : (
                                                    <>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${evaluation.satisfaction === 'มากที่สุด' ? 'bg-green-100 text-green-800' :
                                                                evaluation.satisfaction === 'มาก' ? 'bg-blue-100 text-blue-800' :
                                                                    evaluation.satisfaction === 'ปานกลาง' ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-gray-100 text-gray-800'
                                                                }`}>
                                                                {evaluation.satisfaction || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-600">{evaluation.source || '-'}</td>
                                                        <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={evaluation.comment}>{evaluation.comment || '-'}</td>
                                                    </>
                                                )}

                                                <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                                    {evaluation.submittedAt ? new Date(evaluation.submittedAt.seconds * 1000).toLocaleString('th-TH', {
                                                        year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    }) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="p-4 border-t border-gray-100 flex justify-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        ก่อนหน้า
                                    </button>
                                    <span className="px-3 py-1 text-gray-600">หน้า {currentPage} / {totalPages}</span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        ถัดไป
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}