'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { CSVLink } from "react-csv";

const satisfactionOptions = [
    "มากที่สุด", "มาก", "ปานกลาง", "น้อย", "ควรปรับปรุง"
];
const sourceOptions = [
    "เว็บไซต์", "เพจ/โซเชียลมีเดีย", "เพื่อน/ผู้ปกครองแนะนำ",
];

export default function EvaluationResultPage({ params }) {
    const unwrappedParams = use(params);
    const activityId = unwrappedParams.activityId;

    const [activity, setActivity] = useState(null);
    const [evaluations, setEvaluations] = useState([]);
    const [totalParticipants, setTotalParticipants] = useState(0);
    const [stats, setStats] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

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

                // Fetch Registrations for "checked-in" and "completed" count
                const qReg = query(collection(db, 'registrations'), where('activityId', '==', activityId));
                const regSnapshot = await getDocs(qReg);
                let participantCount = 0;
                regSnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.status === 'checked-in' || data.status === 'completed') {
                        participantCount++;
                    }
                });
                setTotalParticipants(participantCount);

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
                                .filter(a => a);
                            newStats[q.id] = { type: 'text', answers };
                        } else if (q.type === 'radio' || q.type === 'checkbox') {
                            const counts = {};
                            (q.options || []).forEach(opt => { counts[opt] = 0; });
                            let totalAnswers = 0;
                            enrichedEvals.forEach(e => {
                                const val = e.answers?.[q.id];
                                if (Array.isArray(val)) {
                                    val.forEach(item => {
                                        counts[item] = (counts[item] || 0) + 1;
                                        totalAnswers++;
                                    });
                                } else if (val) {
                                    counts[val] = (counts[val] || 0) + 1;
                                    totalAnswers++;
                                }
                            });
                            newStats[q.id] = {
                                type: q.type,
                                counts,
                                total: totalAnswers,
                                respondents: enrichedEvals.filter(e => e.answers?.[q.id]).length
                            };
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

    // Filter evaluations
    const filteredEvaluations = useMemo(() => {
        if (!searchTerm.trim()) return evaluations;
        const q = searchTerm.toLowerCase().trim();
        return evaluations.filter(e =>
            (e.fullName && e.fullName.toLowerCase().includes(q)) ||
            (e.studentId && e.studentId.toLowerCase().includes(q)) ||
            (e.comment && e.comment.toLowerCase().includes(q))
        );
    }, [evaluations, searchTerm]);

    // Pagination Calculations
    const totalPages = Math.max(1, Math.ceil(filteredEvaluations.length / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedEvaluations = filteredEvaluations.slice(startIndex, startIndex + pageSize);

    // CSV Export Data Preparation
    const getCsvData = () => {
        if (!activity) return { headers: [], data: [] };

        const headers = [
            { label: "ชื่อ-สกุล", key: "fullName" },
            { label: "รหัสนักเรียน", key: "studentId" },
            { label: "วันที่ประเมิน", key: "submittedAt" }
        ];

        if (activity.evaluationQuestions) {
            activity.evaluationQuestions.forEach(q => {
                headers.push({ label: q.text, key: `q_${q.id}` });
            });
        } else {
            headers.push({ label: "ความพึงพอใจ", key: "satisfaction" });
            headers.push({ label: "ช่องทางรับทราบ", key: "source" });
            headers.push({ label: "ความคิดเห็น", key: "comment" });
        }

        const data = evaluations.map(e => {
            const row = {
                fullName: e.fullName || '-',
                studentId: e.studentId || '-',
                submittedAt: e.submittedAt ? new Date(e.submittedAt.seconds * 1000).toLocaleString('th-TH') : '-'
            };

            if (activity.evaluationQuestions) {
                activity.evaluationQuestions.forEach(q => {
                    const ans = e.answers?.[q.id];
                    row[`q_${q.id}`] = Array.isArray(ans) ? ans.join(', ') : (ans || '-');
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

    if (isLoading) {
        return (
            <div className="p-12 text-center text-slate-500 text-xs font-medium">
                <div className="w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                กำลังโหลดรายงานผลการประเมิน...
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto font-sans">
            {/* Header Toolbar */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Link
                        href="/admin/evaluation"
                        className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors font-bold text-xs"
                        title="กลับหน้ารายการกิจกรรม"
                    >
                        ←
                    </Link>
                    <div>
                        <h1 className="text-sm font-bold text-slate-900">
                            ผลการประเมิน: {activity?.name}
                        </h1>
                        <p className="text-xs text-slate-500">
                            ผู้ตอบแบบสอบถาม {evaluations.length} คน
                            {totalParticipants > 0 && ` • จากผู้เข้าร่วมทั้งหมด ${totalParticipants} คน (ยังไม่ประเมิน ${Math.max(0, totalParticipants - evaluations.length)} คน)`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {evaluations.length > 0 && (
                        <CSVLink
                            data={csvInfo.data}
                            headers={csvInfo.headers}
                            filename={`evaluation_${activityId}.csv`}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
                        >
                            <span>📥</span>
                            <span>ส่งออก CSV</span>
                        </CSVLink>
                    )}
                </div>
            </div>

            {evaluations.length === 0 ? (
                <div className="bg-white p-12 rounded-lg border border-slate-200 text-center space-y-2">
                    <div className="text-2xl">📝</div>
                    <h3 className="text-xs font-semibold text-slate-800">ยังไม่มีข้อมูลการประเมิน</h3>
                    <p className="text-xs text-slate-400">ระบบจะแสดงผลสรุปและสถิติเมื่อมีผู้เข้าร่วมส่งแบบประเมินเข้ามา</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Legacy View */}
                        {stats.legacy && (
                            <>
                                <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                                    <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">
                                        ความพึงพอใจโดยรวม
                                    </h3>
                                    <div className="space-y-2 text-xs">
                                        {satisfactionOptions.map(option => {
                                            const count = stats.legacy.satisfaction[option] || 0;
                                            const percentage = evaluations.length > 0 ? (count / evaluations.length * 100).toFixed(1) : 0;
                                            return (
                                                <div key={option} className="space-y-1">
                                                    <div className="flex justify-between items-center text-slate-700">
                                                        <span className="font-medium">{option}</span>
                                                        <span className="text-slate-500 font-mono">{count} คน ({percentage}%)</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="bg-[#166E7C] h-2 rounded-full transition-all duration-300"
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>

                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                                    <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">
                                        ช่องทางการรับทราบข้อมูล
                                    </h3>
                                    <div className="space-y-2 text-xs">
                                        {sourceOptions.map(option => {
                                            const count = stats.legacy.source[option] || 0;
                                            const percentage = evaluations.length > 0 ? (count / evaluations.length * 100).toFixed(1) : 0;
                                            return (
                                                <div key={option} className="space-y-1">
                                                    <div className="flex justify-between items-center text-slate-700">
                                                        <span className="font-medium">{option}</span>
                                                        <span className="text-slate-500 font-mono">{count} คน ({percentage}%)</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Dynamic Questions View */}
                        {activity?.evaluationQuestions?.map(q => {
                            const qStats = stats[q.id];
                            if (!qStats) return null;

                            if (q.type === 'rating') {
                                return (
                                    <div key={q.id} className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                            <h3 className="text-xs font-semibold text-slate-900">{q.text}</h3>
                                            <span className="bg-slate-100 border border-slate-200 text-slate-800 px-2 py-0.5 rounded text-xs font-bold font-mono">
                                                เฉลี่ย {qStats.average} / 5
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-xs">
                                            {[5, 4, 3, 2, 1].map(score => {
                                                const count = qStats.counts[score] || 0;
                                                const percentage = qStats.total > 0 ? (count / qStats.total * 100).toFixed(1) : 0;
                                                return (
                                                    <div key={score} className="space-y-1">
                                                        <div className="flex justify-between items-center text-slate-700">
                                                            <span className="font-medium flex items-center gap-1">
                                                                <span>{score} ดาว</span>
                                                            </span>
                                                            <span className="text-slate-500 font-mono">{count} คน ({percentage}%)</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className={`h-2 rounded-full transition-all duration-300 ${
                                                                    score >= 4 ? 'bg-emerald-600' : score === 3 ? 'bg-amber-500' : 'bg-red-500'
                                                                }`}
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            } else if (q.type === 'text') {
                                return (
                                    <div key={q.id} className="bg-white p-4 rounded-lg border border-slate-200 space-y-3 lg:col-span-2">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <h3 className="text-xs font-semibold text-slate-900">{q.text}</h3>
                                            <span className="text-[11px] text-slate-400">ทั้งหมด {qStats.answers.length} ความคิดเห็น</span>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                            {qStats.answers.length > 0 ? (
                                                qStats.answers.map((ans, idx) => (
                                                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800">
                                                        &ldquo;{ans}&rdquo;
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-slate-400 text-xs italic">ไม่มีคำตอบ</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            } else if (q.type === 'radio' || q.type === 'checkbox') {
                                const optionsList = q.options && q.options.length > 0
                                    ? q.options
                                    : Object.keys(qStats.counts || {});
                                return (
                                    <div key={q.id} className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                            <h3 className="text-xs font-semibold text-slate-900">{q.text}</h3>
                                            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                                                {q.type === 'radio' ? '🔘 ตัวเลือกเดี่ยว' : '☑️ ตัวเลือกหลายข้อ'} ({qStats.respondents || 0} ผู้ตอบ)
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-xs">
                                            {optionsList.map((opt, optIdx) => {
                                                const count = qStats.counts?.[opt] || 0;
                                                const baseTotal = q.type === 'radio' ? (qStats.total || 1) : (qStats.respondents || 1);
                                                const percentage = baseTotal > 0 ? (count / baseTotal * 100).toFixed(1) : 0;
                                                return (
                                                    <div key={optIdx} className="space-y-1">
                                                        <div className="flex justify-between items-center text-slate-700">
                                                            <span className="font-medium truncate pr-2">{opt}</span>
                                                            <span className="text-slate-500 font-mono shrink-0">{count} คน ({percentage}%)</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className="h-2 rounded-full transition-all duration-300 bg-[#166E7C]"
                                                                style={{ width: `${Math.min(100, percentage)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>

                    {/* Detailed Submissions Table */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden space-y-0">
                        {/* Table Search & Toolbar */}
                        <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-slate-900">รายการประเมินรายบุคคล</h3>
                                <span className="text-[11px] text-slate-500 font-medium">({filteredEvaluations.length} รายการ)</span>
                            </div>

                            <div className="relative w-full sm:w-64">
                                <input
                                    type="text"
                                    placeholder="ค้นหาชื่อ, รหัสนักเรียน..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full pl-7 pr-6 py-1 bg-white border border-slate-200 rounded text-xs text-slate-900 outline-none focus:border-slate-400 placeholder:text-slate-400"
                                />
                                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2 top-1 text-slate-400 hover:text-slate-700 text-xs font-bold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* High-density Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                        <th className="px-3 py-2 w-12 text-center">#</th>
                                        <th className="px-3 py-2 min-w-[140px]">ชื่อ-สกุล</th>
                                        <th className="px-3 py-2 min-w-[100px]">รหัสนักเรียน</th>
                                        {activity?.evaluationQuestions ? (
                                            activity.evaluationQuestions.map(q => (
                                                <th key={q.id} className="px-3 py-2 min-w-[120px]">{q.text}</th>
                                            ))
                                        ) : (
                                            <>
                                                <th className="px-3 py-2 min-w-[100px]">ความพึงพอใจ</th>
                                                <th className="px-3 py-2 min-w-[100px]">ช่องทาง</th>
                                                <th className="px-3 py-2 min-w-[160px]">ความคิดเห็น</th>
                                            </>
                                        )}
                                        <th className="px-3 py-2 min-w-[120px] text-right">วันที่ประเมิน</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedEvaluations.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center text-xs text-slate-400">
                                                ไม่พบข้อมูลการประเมินที่ตรงกับคำค้นหา
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedEvaluations.map((evaluation, index) => (
                                            <tr key={evaluation.id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-3 py-2 text-center text-slate-400 font-mono">
                                                    {startIndex + index + 1}
                                                </td>
                                                <td className="px-3 py-2 font-medium text-slate-900">
                                                    {evaluation.fullName || '-'}
                                                </td>
                                                <td className="px-3 py-2 text-slate-600 font-mono">
                                                    {evaluation.studentId || '-'}
                                                </td>

                                                {activity?.evaluationQuestions ? (
                                                    activity.evaluationQuestions.map(q => (
                                                         <td key={q.id} className="px-3 py-2 text-slate-700">
                                                            {Array.isArray(evaluation.answers?.[q.id])
                                                                ? evaluation.answers[q.id].join(', ')
                                                                : (evaluation.answers?.[q.id] || '-')}
                                                        </td>
                                                    ))
                                                ) : (
                                                    <>
                                                        <td className="px-3 py-2">
                                                            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${
                                                                evaluation.satisfaction === 'มากที่สุด' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                evaluation.satisfaction === 'มาก' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                evaluation.satisfaction === 'ปานกลาง' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                'bg-slate-100 text-slate-700 border-slate-200'
                                                            }`}>
                                                                {evaluation.satisfaction || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-600">
                                                            {evaluation.source || '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-600 max-w-xs truncate" title={evaluation.comment}>
                                                            {evaluation.comment || '-'}
                                                        </td>
                                                    </>
                                                )}

                                                <td className="px-3 py-2 text-right text-slate-500 font-mono whitespace-nowrap">
                                                    {evaluation.submittedAt ? new Date(evaluation.submittedAt.seconds * 1000).toLocaleString('th-TH', {
                                                        year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    }) : '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Compact Pagination Bar */}
                        <div className="p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50/50 text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                                <span>แสดง {filteredEvaluations.length > 0 ? startIndex + 1 : 0} - {Math.min(startIndex + pageSize, filteredEvaluations.length)} จาก {filteredEvaluations.length} รายการ</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none"
                                >
                                    <option value={15}>15 / หน้า</option>
                                    <option value={25}>25 / หน้า</option>
                                    <option value={50}>50 / หน้า</option>
                                    <option value={100}>100 / หน้า</option>
                                </select>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        ◀ ก่อนหน้า
                                    </button>
                                    <span className="px-2 font-medium text-slate-700 font-mono">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        ถัดไป ▶
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}