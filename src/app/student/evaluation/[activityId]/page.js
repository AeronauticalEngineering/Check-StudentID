'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import useLiff from '../../../../hooks/useLiff';

const EMOJI_RATINGS = [
    {
        score: 1,
        label: 'น้อยที่สุด',
        color: '#EF4444',
        starColor: '#EF4444',
        activeClasses: 'bg-red-50 border-red-500 ring-2 ring-red-400/50 shadow-md shadow-red-100 -translate-y-1',
        renderFace: () => (
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                <circle cx="50" cy="50" r="48" fill="#EF4444" />
                {/* Left Eye: X */}
                <line x1="28" y1="32" x2="40" y2="44" stroke="#111827" strokeWidth="5.5" strokeLinecap="round" />
                <line x1="40" y1="32" x2="28" y2="44" stroke="#111827" strokeWidth="5.5" strokeLinecap="round" />
                {/* Right Eye: X */}
                <line x1="60" y1="32" x2="72" y2="44" stroke="#111827" strokeWidth="5.5" strokeLinecap="round" />
                <line x1="72" y1="32" x2="60" y2="44" stroke="#111827" strokeWidth="5.5" strokeLinecap="round" />
                {/* Mouth: Open crying/gasping frown */}
                <path d="M 34 66 C 34 52, 66 52, 66 66 C 66 80, 34 80, 34 66 Z" fill="#111827" />
            </svg>
        )
    },
    {
        score: 2,
        label: 'น้อย',
        color: '#F97316',
        starColor: '#F97316',
        activeClasses: 'bg-orange-50 border-orange-500 ring-2 ring-orange-400/50 shadow-md shadow-orange-100 -translate-y-1',
        renderFace: () => (
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                <circle cx="50" cy="50" r="48" fill="#F97316" />
                {/* Eyes: dots */}
                <circle cx="34" cy="38" r="6" fill="#111827" />
                <circle cx="66" cy="38" r="6" fill="#111827" />
                {/* Mouth: sad frown */}
                <path d="M 34 68 Q 50 50 66 68" stroke="#111827" strokeWidth="6" strokeLinecap="round" fill="none" />
            </svg>
        )
    },
    {
        score: 3,
        label: 'ปานกลาง',
        color: '#EAB308',
        starColor: '#EAB308',
        activeClasses: 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/50 shadow-md shadow-amber-100 -translate-y-1',
        renderFace: () => (
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                <circle cx="50" cy="50" r="48" fill="#FACC15" />
                {/* Eyes: dots */}
                <circle cx="34" cy="38" r="6" fill="#111827" />
                <circle cx="66" cy="38" r="6" fill="#111827" />
                {/* Mouth: straight line */}
                <line x1="32" y1="62" x2="68" y2="62" stroke="#111827" strokeWidth="6" strokeLinecap="round" />
            </svg>
        )
    },
    {
        score: 4,
        label: 'มาก',
        color: '#84CC16',
        starColor: '#84CC16',
        activeClasses: 'bg-lime-50 border-lime-500 ring-2 ring-lime-400/50 shadow-md shadow-lime-100 -translate-y-1',
        renderFace: () => (
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                <circle cx="50" cy="50" r="48" fill="#84CC16" />
                {/* Eyes: dots */}
                <circle cx="34" cy="38" r="6" fill="#111827" />
                <circle cx="66" cy="38" r="6" fill="#111827" />
                {/* Mouth: gentle smile */}
                <path d="M 34 58 Q 50 74 66 58" stroke="#111827" strokeWidth="6" strokeLinecap="round" fill="none" />
            </svg>
        )
    },
    {
        score: 5,
        label: 'มากที่สุด',
        color: '#22C55E',
        starColor: '#22C55E',
        activeClasses: 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/50 shadow-md shadow-emerald-100 -translate-y-1',
        renderFace: () => (
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                <circle cx="50" cy="50" r="48" fill="#22C55E" />
                {/* Eyes: laughing arches ^ ^ */}
                <path d="M 27 38 Q 34 26 41 38" stroke="#111827" strokeWidth="5.5" strokeLinecap="round" fill="none" />
                <path d="M 59 38 Q 66 26 73 38" stroke="#111827" strokeWidth="5.5" strokeLinecap="round" fill="none" />
                {/* Mouth: big happy open grin */}
                <path d="M 30 54 Q 50 54 70 54 C 70 78, 30 78, 30 54 Z" fill="#111827" />
            </svg>
        )
    }
];

function EmojiRatingSelector({ value, onChange, name }) {
    // เรียงแนวตั้งจาก 5 (มากที่สุด) ลงไป 1 (น้อยที่สุด) ตามแบบฟอร์มมาตรฐาน
    const verticalItems = [...EMOJI_RATINGS].reverse();

    return (
        <div className="space-y-2.5 my-3">
            {verticalItems.map((item) => {
                const isSelected = value == item.score;
                return (
                    <button
                        key={item.score}
                        type="button"
                        onClick={() => onChange(item.score)}
                        className={`w-full group relative flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                            isSelected
                                ? `${item.activeClasses} shadow-sm`
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
                        }`}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={item.score}
                            checked={isSelected}
                            onChange={() => onChange(item.score)}
                            className="sr-only"
                        />

                        {/* Left: Radio indicator + Emoji Face + Label */}
                        <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'border-slate-800 bg-slate-800' : 'border-slate-300 bg-white'}`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>

                            {/* Emoji Face */}
                            <div className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 transition-transform duration-200 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}>
                                {item.renderFace()}
                            </div>

                            {/* Label & Score */}
                            <div className="text-left">
                                <span className={`text-sm sm:text-base leading-tight transition-colors ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                    {item.score} - {item.label}
                                </span>
                            </div>
                        </div>

                        {/* Right: Black Pill with 5 Stars */}
                        <div className="bg-black/90 px-2 py-1 rounded-full flex items-center gap-0.5 sm:gap-1 shadow-xs shrink-0">
                            {[1, 2, 3, 4, 5].map((starIdx) => (
                                <svg
                                    key={starIdx}
                                    viewBox="0 0 20 20"
                                    className="w-3 h-3 sm:w-3.5 sm:h-3.5"
                                    fill={starIdx <= item.score ? item.starColor : '#FFFFFF'}
                                >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            ))}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

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

            router.push('/student/my-registrations');
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
            <form onSubmit={handleSubmit} className="bg-white shadow-lg border border-gray-100 rounded-2xl p-6 md:p-8 space-y-6">
                <h1 className="text-xl font-bold text-center text-gray-800">
                    แบบประเมินกิจกรรม
                </h1>
                <p className="text-center text-gray-500 text-sm -mt-3">{activity?.name}</p>

                {/* Dynamic Questions */}
                {activity.evaluationQuestions ? (
                    activity.evaluationQuestions.map((q, index) => (
                        <div key={q.id} className="border-b border-gray-100 pb-6 last:border-0">
                            <p className="font-semibold text-gray-800 mb-3">
                                {index + 1}. {q.text}
                                {q.isRequired !== false && <span className="text-red-500 ml-1">*</span>}
                            </p>

                            {q.type === 'rating' && (
                                <EmojiRatingSelector
                                    name={`q_${q.id}`}
                                    value={answers[q.id]}
                                    onChange={(val) => handleAnswerChange(q.id, val)}
                                />
                            )}

                            {q.type === 'text' && (
                                <textarea
                                    value={answers[q.id] || ''}
                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    rows="3"
                                    placeholder="พิมพ์คำตอบของคุณ..."
                                />
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
                                            <span className="ml-3 text-gray-700">{opt}</span>
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
                                                    value={opt}
                                                    checked={isChecked}
                                                    onChange={(e) => handleCheckboxChange(q.id, opt, e.target.checked)}
                                                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <span className="ml-3 text-gray-700">{opt}</span>
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
                            <p className="font-semibold text-gray-800 mb-1">1. ท่านมีความพึงพอใจต่อกิจกรรมนี้มากน้อยเพียงใด <span className="text-red-500">*</span></p>
                            <EmojiRatingSelector
                                name="satisfaction"
                                value={satisfaction === 'มากที่สุด' ? 5 : satisfaction === 'มาก' ? 4 : satisfaction === 'ปานกลาง' ? 3 : satisfaction === 'น้อย' ? 2 : satisfaction === 'ควรปรับปรุง' || satisfaction === 'น้อยที่สุด' ? 1 : satisfaction}
                                onChange={(val) => {
                                    const labelMap = { 5: 'มากที่สุด', 4: 'มาก', 3: 'ปานกลาง', 2: 'น้อย', 1: 'ควรปรับปรุง' };
                                    setSatisfaction(labelMap[val] || val);
                                }}
                            />
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