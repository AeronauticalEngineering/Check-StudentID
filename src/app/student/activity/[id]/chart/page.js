'use client';

import React, { useState, useEffect, use, useMemo, useCallback, useRef } from 'react';
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
    const [showScrollButton, setShowScrollButton] = useState(false);
    const mySeatRef = useRef(null);
    const chartContainerRef = useRef(null);

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

    // Auto-scroll to my seat when data is loaded
    useEffect(() => {
        if (!isLoading && mySeatRef.current) {
            setTimeout(() => {
                mySeatRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'center'
                });
            }, 300);
        }
    }, [isLoading, mySeatNumber]);

    // Track scroll position to show/hide "Go to My Seat" button
    useEffect(() => {
        const handleScroll = () => {
            if (mySeatRef.current && chartContainerRef.current) {
                const seatRect = mySeatRef.current.getBoundingClientRect();
                const containerRect = chartContainerRef.current.getBoundingClientRect();

                // Check if seat is visible in viewport
                const isVisible = (
                    seatRect.top >= containerRect.top &&
                    seatRect.bottom <= containerRect.bottom &&
                    seatRect.left >= containerRect.left &&
                    seatRect.right <= containerRect.right
                );

                setShowScrollButton(!isVisible);
            }
        };

        const container = chartContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            window.addEventListener('scroll', handleScroll);
            // Initial check
            handleScroll();
        }

        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isLoading]);

    // Function to scroll to my seat
    const scrollToMySeat = () => {
        mySeatRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    };

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
        'A1-1': 'AJ1', 'B1-10': 'AJ2',      // A1
        'A4-1': 'AJ3', 'B4-10': 'AJ4',      // A4 (เว้น 2 แถว)
        'A7-1': 'AJ5', 'B7-10': 'AJ6',    // A7 (เว้น 2 แถว)
        'A10-1': 'AJ7', 'B10-10': 'AJ8',    // A10 (เว้น 2 แถว)
        'A13-1': 'AJ9', 'B13-10': 'AJ10',   // A13 (เว้น 2 แถว)
        'A16-1': 'AJ11', 'B16-10': 'AJ12',  // A16 (เว้น 2 แถว)
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
            <div className="bg-white rounded-lg shadow-lg p-4 overflow-x-auto" ref={chartContainerRef}>
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
                                    // Column-Major Logic: 1, 11, 21... in first row
                                    const row = Math.floor(i / 10);
                                    const col = i % 10;
                                    const seatNum = (col * 10) + row + 1;

                                    const runningNumber = (zoneIndex * 100) + seatNum;
                                    const displaySeatLabel = `${zoneChar}${runningNumber.toString().padStart(3, '0')}`;
                                    const registrant = seatMap[displaySeatLabel];
                                    const isMySeat = displaySeatLabel === mySeatNumber;
                                    const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                    return (
                                        <div
                                            key={seatNum}
                                            ref={isMySeat ? mySeatRef : null}
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
            <div className="bg-white rounded-lg shadow-lg p-4 overflow-x-auto" ref={chartContainerRef}>
                {/* Stage - Fixed width, no responsive */}
                <div className="w-[900px] mx-auto bg-blue-100 border-2 border-blue-200 rounded-lg py-3 mb-2 text-center">
                    <div className="font-bold text-blue-800">Stage</div>
                </div>

                {/* Sofa - Fixed width, no responsive */}
                <div className="w-[900px] mx-auto bg-blue-50 border-2 border-blue-100 rounded-lg py-2 mb-4 text-center">
                    <div className="font-semibold text-blue-600 text-sm">Sofa</div>
                </div>

                {/* Seating Area */}
                <div className="flex gap-4 justify-center items-start w-[900px] mx-auto">
                    {/* Zone A */}
                    <div className="w-[350px]">
                        <div className="h-7 flex items-center justify-center font-bold text-sm mb-0.5">Zone A</div>
                        <div className="space-y-0.5">
                            {zoneRowConfig.map((config, idx) => (
                                <div key={idx} className="flex gap-0.5 items-center">
                                    {/* Row numbers */}
                                    <div className="w-6 text-xs text-gray-500 text-right pr-1">
                                        {config.row > 5 ? config.row - 5 : ''}
                                    </div>

                                    {/* Seats 1-10 */}
                                    {Array.from({ length: 10 }, (_, col) => {
                                        const seatLabel = config.row <= 5 ? `VIP_A${config.row}-${col + 1}` : `A${config.row - 5}-${col + 1}`;
                                        const ajLabel = ajSeats[seatLabel];
                                        const registrant = seatMap[seatLabel];
                                        const isMySeat = seatLabel === mySeatNumber;
                                        const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                        // AJ Seat Styling
                                        if (ajLabel) {
                                            return (
                                                <div key={col} className="w-7 h-7 bg-cyan-400 border border-cyan-600 rounded flex items-center justify-center text-[10px] font-bold text-black shadow-sm z-10">
                                                    {ajLabel}
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                key={col}
                                                ref={isMySeat ? mySeatRef : null}
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
                    <div className="w-[350px]">
                        <div className="h-7 flex items-center justify-center font-bold text-sm mb-0.5">Zone B</div>
                        <div className="space-y-0.5">
                            {zoneRowConfig.map((config, idx) => (
                                <div key={idx} className="flex gap-0.5 items-center">
                                    {/* Seats 1-10 */}
                                    {Array.from({ length: 10 }, (_, col) => {
                                        const seatLabel = config.row <= 5 ? `VIP_B${config.row}-${col + 1}` : `B${config.row - 5}-${col + 1}`;
                                        const ajLabel = ajSeats[seatLabel];
                                        const registrant = seatMap[seatLabel];
                                        const isMySeat = seatLabel === mySeatNumber;
                                        const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                        // AJ Seat Styling
                                        if (ajLabel) {
                                            return (
                                                <div key={col} className="w-7 h-7 bg-cyan-400 border border-cyan-600 rounded flex items-center justify-center text-[10px] font-bold text-black shadow-sm z-10">
                                                    {ajLabel}
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                key={col}
                                                ref={isMySeat ? mySeatRef : null}
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
                                    {/* Row numbers */}
                                    <div className="w-6 text-xs text-gray-500 text-left pl-1">
                                        {config.row > 5 ? config.row - 5 : ''}
                                    </div>
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

                {/* Floating "Go to My Seat" Button */}
                {showScrollButton && mySeatNumber && (
                    <button
                        onClick={scrollToMySeat}
                        className="fixed bottom-8 right-8 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 transition-all transform hover:scale-105 z-50 animate-bounce"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-bold">ไปยังที่นั่งของฉัน</span>
                    </button>
                )}

                <div className="mt-6 text-center text-sm text-gray-500">
                    * ที่นั่งของคุณจะแสดงเป็นสีแดงและมีกรอบกระพริบ
                    {activity?.type !== 'exam' && <><br />* หากที่นั่งอยู่ใน Zone B ระบบจะเลื่อนไปยังตำแหน่งที่นั่งโดยอัตโนมัติ</>}
                </div>
            </div>
        </div>
    );
}
