'use client';

import React, { useState, useEffect, use, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from '../../../../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';

export default function StudentSeatingChartPage({ params }) {
    const { id: activityId } = use(params);
    const searchParams = useSearchParams();
    const mySeatNumber = searchParams.get('seat');

    const [activity, setActivity] = useState(null);
    const [registrants, setRegistrants] = useState([]);
    const [courseOptions, setCourseOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const activityDoc = await getDoc(doc(db, 'activities', activityId));
                if (activityDoc.exists()) {
                    setActivity({ id: activityDoc.id, ...activityDoc.data() });
                }

                const q = query(collection(db, 'registrations'), where('activityId', '==', activityId));
                const snapshot = await getDocs(q);
                const registrantsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setRegistrants(registrantsData);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        const unsubCourses = onSnapshot(query(collection(db, 'courseOptions'), orderBy('name')), (snapshot) => {
            setCourseOptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        fetchData();
        return () => unsubCourses();
    }, [activityId]);

    // Create seat map
    const seatMap = useMemo(() => {
        const map = {};
        registrants.forEach(reg => {
            if (reg.seatNumber) {
                map[reg.seatNumber] = reg;
            }
        });
        return map;
    }, [registrants]);

    // Helper to find course color
    const getCourseColor = (courseName) => {
        if (!courseName) return null;
        const course = courseOptions.find(c => c.name === courseName || c.shortName === courseName);
        return course?.color || null;
    };

    // Calculate dominant course for each row
    const getRowCourse = useCallback((rowNumber) => {
        const courseCounts = {};
        for (let col = 1; col <= 10; col++) {
            const seatA = `A${rowNumber}-${col}`;
            const seatB = `B${rowNumber}-${col}`;
            const regA = seatMap[seatA];
            const regB = seatMap[seatB];
            if (regA?.course) courseCounts[regA.course] = (courseCounts[regA.course] || 0) + 1;
            if (regB?.course) courseCounts[regB.course] = (courseCounts[regB.course] || 0) + 1;
        }
        let dominantCourse = null;
        let maxCount = 0;
        Object.entries(courseCounts).forEach(([course, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominantCourse = course;
            }
        });
        return dominantCourse;
    }, [seatMap]);

    // Zone row configuration
    const zoneRowConfig = useMemo(() => {
        const rows = [];
        const vipRows = [
            { row: 1, label: 'VIP1' }, { row: 2, label: 'VIP3' },
            { row: 3, label: 'VIP5' }, { row: 4, label: 'VIP7' }, { row: 5, label: 'VIP9' }
        ];
        vipRows.forEach(vip => {
            rows.push({
                row: vip.row, color: 'bg-gray-100', borderColor: 'border-gray-300',
                label: vip.label, labelBg: 'bg-gray-200', textColor: 'text-gray-600', course: null
            });
        });
        for (let i = 6; i <= 23; i++) {
            const rowCourse = getRowCourse(i);
            const courseData = rowCourse ? courseOptions.find(c => c.name === rowCourse) : null;
            rows.push({
                row: i, label: `A${i - 5}`, color: 'bg-white', borderColor: 'border-gray-300',
                labelBg: 'bg-gray-100', textColor: 'text-black', course: rowCourse,
                courseShortName: courseData?.shortName || rowCourse
            });
        }
        return rows;
    }, [getRowCourse, courseOptions]);

    const ajSeats = {
        'A6-1': 'AJ1', 'B6-10': 'AJ2', 'A9-1': 'AJ3', 'B9-10': 'AJ4',
        'A12-1': 'AJ5', 'B12-10': 'AJ6', 'A15-1': 'AJ7', 'B15-10': 'AJ8',
        'A18-1': 'AJ9', 'B18-10': 'AJ10', 'A21-1': 'AJ11', 'B21-10': 'AJ12',
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const renderExamChart = () => {
        const zones = ['A', 'B', 'C', 'D', 'E', 'F'];
        return (
            <div className="bg-white rounded-lg shadow-lg p-4 overflow-x-auto">
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">ผังที่นั่งสอบ</h2>
                    <p className="text-sm text-gray-500">ที่นั่งของคุณคือ <span className="font-bold text-primary text-lg">{mySeatNumber}</span></p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-items-center">
                    {zones.map((zoneChar, zoneIndex) => (
                        <div key={zoneChar} className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                            <div className="text-center font-bold text-lg mb-3 text-blue-800 bg-blue-100 py-1 rounded-lg">
                                Zone {zoneChar}
                            </div>
                            <div className="grid grid-cols-10 gap-1">
                                {Array.from({ length: 100 }, (_, i) => {
                                    const seatNum = i + 1;
                                    const runningNumber = (zoneIndex * 100) + seatNum;
                                    const displaySeatLabel = `${zoneChar}${runningNumber.toString().padStart(3, '0')}`;
                                    const registrant = seatMap[displaySeatLabel];
                                    const isMySeat = displaySeatLabel === mySeatNumber;
                                    const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                    return (
                                        <div
                                            key={seatNum}
                                            className={`w-8 h-8 border rounded flex items-center justify-center text-[10px] font-bold relative
                                            ${isMySeat ? 'ring-4 ring-red-500 z-30 scale-110 animate-pulse' : ''}
                                            ${registrant ? 'text-white shadow-sm' : 'text-gray-300 bg-white'}`}
                                            style={{
                                                backgroundColor: isMySeat ? '#ef4444' : (courseColor || (registrant ? '#6b7280' : undefined)),
                                                borderColor: courseColor ? 'transparent' : '#e5e7eb'
                                            }}
                                        >
                                            {seatNum}
                                            {isMySeat && (
                                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-40">
                                                    คุณ
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderTheaterChart = () => {
        return (
            <div className="bg-white rounded-lg shadow-lg p-4 overflow-x-auto">
                <div className="bg-blue-100 border-2 border-blue-200 rounded-lg py-3 mb-2 text-center">
                    <div className="font-bold text-blue-800">เวที (Stage)</div>
                </div>
                <div className="flex gap-4 justify-center items-start min-w-[800px]">
                    {/* Zone A */}
                    <div className="flex-1 max-w-md">
                        <div className="h-7 flex items-center justify-center font-bold text-sm mb-0.5">Zone A</div>
                        <div className="space-y-0.5">
                            {zoneRowConfig.map((config, idx) => (
                                <div key={idx} className="flex gap-0.5 items-center">
                                    <div className="w-6 text-xs text-gray-500 text-right pr-1">{config.row}</div>
                                    {Array.from({ length: 10 }, (_, col) => {
                                        const seatLabel = `A${config.row}-${col + 1}`;
                                        const ajLabel = ajSeats[seatLabel];
                                        const registrant = seatMap[seatLabel];
                                        const isMySeat = seatLabel === mySeatNumber;
                                        const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                        if (ajLabel) return <div key={col} className="w-7 h-7 bg-cyan-400 border border-cyan-600 rounded flex items-center justify-center text-[10px] font-bold text-black shadow-sm z-10">{ajLabel}</div>;

                                        return (
                                            <div
                                                key={col}
                                                className={`w-7 h-7 border rounded flex items-center justify-center text-[10px] font-bold transition-all relative
                                                ${isMySeat ? 'ring-4 ring-red-500 z-30 scale-125 animate-pulse' : ''}
                                                ${registrant ? 'text-white' : 'text-black/50'}`}
                                                style={{
                                                    backgroundColor: isMySeat ? '#ef4444' : (courseColor || (registrant ? '#6b7280' : config.color)),
                                                    borderColor: courseColor ? 'transparent' : config.borderColor
                                                }}
                                            >
                                                {col + 1}
                                                {isMySeat && (
                                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-40 shadow-lg">
                                                        คุณ
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div className="w-8 text-xs text-gray-500 pl-1">{config.row <= 5 ? `VIP${(config.row * 2) - 1}` : ''}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Center Labels */}
                    <div className="w-20 flex flex-col space-y-0 pt-0">
                        <div className="h-7"></div>
                        <div className="space-y-0.5">
                            {zoneRowConfig.map((config, idx) => (
                                <div key={idx} className="h-7 flex flex-col items-center justify-center rounded text-[10px] font-bold border px-1 bg-gray-100 text-gray-600">
                                    <div>{config.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Zone B */}
                    <div className="flex-1 max-w-md">
                        <div className="h-7 flex items-center justify-center font-bold text-sm mb-0.5">Zone B</div>
                        <div className="space-y-0.5">
                            {zoneRowConfig.map((config, idx) => (
                                <div key={idx} className="flex gap-0.5 items-center">
                                    <div className="w-8 text-xs text-gray-500 text-right pr-1">{config.row <= 5 ? `VIP${config.row * 2}` : ''}</div>
                                    {Array.from({ length: 10 }, (_, col) => {
                                        const seatLabel = `B${config.row}-${col + 1}`;
                                        const ajLabel = ajSeats[seatLabel];
                                        const registrant = seatMap[seatLabel];
                                        const isMySeat = seatLabel === mySeatNumber;
                                        const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                        if (ajLabel) return <div key={col} className="w-7 h-7 bg-cyan-400 border border-cyan-600 rounded flex items-center justify-center text-[10px] font-bold text-black shadow-sm z-10">{ajLabel}</div>;

                                        return (
                                            <div
                                                key={col}
                                                className={`w-7 h-7 border rounded flex items-center justify-center text-[10px] font-bold transition-all relative
                                                ${isMySeat ? 'ring-4 ring-red-500 z-30 scale-125 animate-pulse' : ''}
                                                ${registrant ? 'text-white' : 'text-black/50'}`}
                                                style={{
                                                    backgroundColor: isMySeat ? '#ef4444' : (courseColor || (registrant ? '#6b7280' : config.color)),
                                                    borderColor: courseColor ? 'transparent' : config.borderColor
                                                }}
                                            >
                                                {col + 1}
                                                {isMySeat && (
                                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-40 shadow-lg">
                                                        คุณ
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <Link href="/student/my-registrations" className="flex items-center text-gray-600 hover:text-primary transition-colors bg-white px-4 py-2 rounded-lg shadow-sm border">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        กลับไปหน้าการลงทะเบียน
                    </Link>
                    <h1 className="text-lg md:text-xl font-bold text-gray-800">ผังที่นั่ง: {activity?.name}</h1>
                </div>

                {activity?.type === 'exam' ? renderExamChart() : renderTheaterChart()}

                <div className="mt-6 text-center text-sm text-gray-500">
                    * ที่นั่งของคุณจะแสดงเป็นสีแดงและมีกรอบกระพริบ
                </div>
            </div>
        </div>
    );
}
