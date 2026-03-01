'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import useLiff from '../../../../hooks/useLiff';

export default function EvaluationPage() {
    const params = useParams();
    const router = useRouter();
    const { activityId } = params;
    const { liffProfile, studentDbProfile } = useLiff();

    const [activity, setActivity] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Dynamic Answers State
    const [answers, setAnswers] = useState({});

    // Legacy State (Fallback)
    const [satisfaction, setSatisfaction] = useState('');
    const [source, setSource] = useState('');
    const [otherSource, setOtherSource] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchActivity = async () => {
            if (!activityId) return;
            try {
                const docRef = doc(db, 'activities', activityId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setActivity({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setMessage('ไม่พบกิจกรรม');
                }
            } catch (error) {
                console.error("Error fetching activity:", error);
                setMessage('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            } finally {
                setIsLoading(false);
            }
        };
        fetchActivity();
    }, [activityId]);

    const handleAnswerChange = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleCheckboxChange = (questionId, optionValue, isChecked) => {
        setAnswers(prev => {
            const currentAnswers = prev[questionId] || [];
            if (isChecked) {
                return { ...prev, [questionId]: [...currentAnswers, optionValue] };
            } else {
                return { ...prev, [questionId]: currentAnswers.filter(item => item !== optionValue) };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage('');

        // Validation
        if (activity?.evaluationQuestions) {
            // Dynamic Validation
            for (const q of activity.evaluationQuestions) {
                // By default, if isRequired is undefined, it is assumed to be true.
                const isRequired = q.isRequired !== false;

                if (isRequired) {
                    const answer = answers[q.id];
                    if (q.type === 'checkbox') {
                        if (!answer || !Array.isArray(answer) || answer.length === 0) {
                            setMessage('กรุณากรอกข้อมูลในข้อที่บังคับให้ครบถ้วน');
                            setIsSubmitting(false);
                            return;
                        }
                    } else if (!answer || (typeof answer === 'string' && !answer.trim())) {
                        setMessage('กรุณากรอกข้อมูลในข้อที่บังคับให้ครบถ้วน');
                        setIsSubmitting(false);
                        return;
                    }
                }
            }
        } else {
            // Legacy Validation
            if (!satisfaction || !source) {
                setMessage('กรุณากรอกข้อมูลให้ครบทุกข้อ');
                setIsSubmitting(false);
                return;
            }
            if (source === 'อื่น ๆ' && !otherSource.trim()) {
                setMessage('กรุณาระบุช่องทางอื่น ๆ');
                setIsSubmitting(false);
                return;
            }
        }

        try {
            const evaluationData = {
                activityId,
                userId: liffProfile?.userId || 'unknown',
                lineUserId: liffProfile?.userId || 'unknown',
                fullName: studentDbProfile?.fullName || liffProfile?.displayName || '',
                studentId: studentDbProfile?.studentId || '',
                nationalId: studentDbProfile?.nationalId || '',
                submittedAt: serverTimestamp()
            };

            if (activity?.evaluationQuestions) {
                evaluationData.answers = answers;
                evaluationData.type = 'dynamic';
            } else {
                evaluationData.satisfaction = satisfaction;
                evaluationData.source = source === 'อื่น ๆ' ? otherSource.trim() : source;
                evaluationData.type = 'legacy';
            }

            await addDoc(collection(db, 'evaluations'), evaluationData);

            setMessage('ขอบคุณสำหรับการประเมิน!');
            setTimeout(() => router.push('/student/my-registrations'), 2000);
        } catch (error) {
            console.error("Submit error:", error);
            setMessage('เกิดข้อผิดพลาดในการส่งข้อมูล');
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="text-center p-10">กำลังโหลด...</div>;
    if (!activity) return <div className="text-center p-10 text-red-500">ไม่พบข้อมูลกิจกรรม</div>;

    // Legacy Options
    const satisfactionOptions = ["มากที่สุด", "มาก", "ปานกลาง", "น้อย", "ควรปรับปรุง"];
    const sourceOptions = ["เว็บไซต์", "เพจ/โซเชียลมีเดีย", "เพื่อน/ผู้ปกครองแนะนำ", "อื่น ๆ"];

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-8">
            <h1 className="text-2xl font-bold mb-2">แบบประเมินกิจกรรม</h1>
            <p className="text-gray-600 mb-6">{activity.name}</p>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">

                {/* Dynamic Questions */}
                {activity.evaluationQuestions ? (
                    activity.evaluationQuestions.map((q, index) => (
                        <div key={q.id} className="border-b border-gray-100 pb-6 last:border-0">
                            <p className="font-semibold text-gray-800 mb-3">
                                {index + 1}. {q.text}
                                {q.isRequired !== false && <span className="text-red-500 ml-1">*</span>}
                            </p>

                            {q.type === 'rating' && (
                                <div className="space-y-2">
                                    {[5, 4, 3, 2, 1].map(score => (
                                        <label key={score} className="flex items-center p-3 border rounded-xl hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-200 cursor-pointer transition-all">
                                            <input
                                                type="radio"
                                                name={`q_${q.id}`}
                                                value={score}
                                                checked={answers[q.id] == score}
                                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                                            />
                                            <span className="ml-3 text-gray-700 font-medium">
                                                {score} - {score === 5 ? 'มากที่สุด' : score === 4 ? 'มาก' : score === 3 ? 'ปานกลาง' : score === 2 ? 'น้อย' : 'น้อยที่สุด'}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {q.type === 'text' && (
                                <textarea
                                    value={answers[q.id] || ''}
                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    rows="3"
                                    placeholder="พิมพ์คำตอบของคุณที่นี่..."
                                ></textarea>
                            )}

                            {q.type === 'radio' && q.options && (
                                <div className="space-y-2">
                                    {q.options.map((opt, optIdx) => (
                                        <label key={optIdx} className="flex items-center p-3 border rounded-xl hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-200 cursor-pointer transition-all">
                                            <input
                                                type="radio"
                                                name={`q_${q.id}`}
                                                value={opt}
                                                checked={answers[q.id] === opt}
                                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                                            />
                                            <span className="ml-3 text-gray-700 font-medium">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {q.type === 'checkbox' && q.options && (
                                <div className="space-y-2">
                                    {q.options.map((opt, optIdx) => {
                                        const isChecked = (answers[q.id] || []).includes(opt);
                                        return (
                                            <label key={optIdx} className="flex items-center p-3 border rounded-xl hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-200 cursor-pointer transition-all">
                                                <input
                                                    type="checkbox"
                                                    name={`q_${q.id}`}
                                                    value={opt}
                                                    checked={isChecked}
                                                    onChange={(e) => handleCheckboxChange(q.id, opt, e.target.checked)}
                                                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <span className="ml-3 text-gray-700 font-medium">{opt}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    /* Legacy Fallback */
                    <>
                        <div>
                            <p className="font-semibold">1. ความพึงพอใจโดยรวมต่อกระบวนการรับสมัคร</p>
                            <div className="mt-2 space-y-2">
                                {satisfactionOptions.map((option) => (
                                    <label key={option} className="flex items-center p-3 border rounded-md has-[:checked]:bg-blue-50 has-[:checked]:border-primary cursor-pointer">
                                        <input
                                            type="radio"
                                            name="satisfaction"
                                            value={option}
                                            checked={satisfaction === option}
                                            onChange={(e) => setSatisfaction(e.target.value)}
                                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                        />
                                        <span className="ml-3 text-gray-700">{option}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold">2. ท่านทราบข้อมูลการรับสมัครจากช่องทางใด</p>
                            <div className="mt-2 space-y-2">
                                {sourceOptions.map((option) => (
                                    <label key={option} className="flex items-center p-3 border rounded-md has-[:checked]:bg-blue-50 has-[:checked]:border-primary cursor-pointer">
                                        <input
                                            type="radio"
                                            name="source"
                                            value={option}
                                            checked={source === option}
                                            onChange={(e) => setSource(e.target.value)}
                                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                        />
                                        <span className="ml-3 text-gray-700">{option === 'อื่น ๆ' ? 'อื่น ๆ (โปรดระบุ)' : option}</span>
                                    </label>
                                ))}
                                {source === 'อื่น ๆ' && (
                                    <div className="pl-8 pt-2">
                                        <textarea
                                            value={otherSource}
                                            onChange={e => setOtherSource(e.target.value)}
                                            className="w-full mt-1 p-2 border rounded"
                                            rows="2"
                                            placeholder="กรุณาระบุช่องทาง..."
                                            required
                                        ></textarea>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {message && (
                    <div className={`p-4 rounded-xl text-center font-medium ${message.includes('ขอบคุณ') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message}
                    </div>
                )}

                <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-blue-300 shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                    {isSubmitting ? 'กำลังส่ง...' : 'ส่งแบบประเมิน'}
                </button>
            </form>
        </div>
    );
}