'use client';

import React, { useState, useEffect, use, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { db } from '../../../../../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';

export default function SeatingChartPage({ params }) {
    const { id: activityId } = use(params);
    const [activity, setActivity] = useState(null);
    const [registrants, setRegistrants] = useState([]);
    const [courseOptions, setCourseOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

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

        // Check both zones A and B for this row
        for (let col = 1; col <= 10; col++) {
            const seatA = `A${rowNumber - 5}-${col}`;
            const seatB = `B${rowNumber - 5}-${col}`;

            const regA = seatMap[seatA];
            const regB = seatMap[seatB];

            if (regA?.course) {
                courseCounts[regA.course] = (courseCounts[regA.course] || 0) + 1;
            }
            if (regB?.course) {
                courseCounts[regB.course] = (courseCounts[regB.course] || 0) + 1;
            }
        }

        // Find the course with most students in this row
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

        // VIP Rows (1-5)
        const vipRows = [
            { row: 1, label: 'VIP1' },
            { row: 2, label: 'VIP3' },
            { row: 3, label: 'VIP5' },
            { row: 4, label: 'VIP7' },
            { row: 5, label: 'VIP9' }
        ];

        vipRows.forEach(vip => {
            rows.push({
                row: vip.row,
                color: 'bg-gray-100',
                borderColor: 'border-gray-300',
                label: vip.label,
                labelBg: 'bg-gray-200',
                textColor: 'text-gray-600',
                course: null
            });
        });

        // Student Rows (6-23) -> A1 to A18
        for (let i = 6; i <= 23; i++) {
            const rowCourse = getRowCourse(i);
            const courseData = rowCourse ? courseOptions.find(c => c.name === rowCourse) : null;

            rows.push({
                row: i,
                label: `A${i - 5}`,
                color: 'bg-white',
                borderColor: 'border-gray-300',
                labelBg: 'bg-gray-100',
                textColor: 'text-black',
                course: rowCourse,
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

    // Filter by search
    const highlightedSeats = new Set();
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        registrants.forEach(reg => {
            if (
                reg.seatNumber &&
                (reg.fullName?.toLowerCase().includes(query) ||
                    reg.studentId?.toLowerCase().includes(query) ||
                    reg.nationalId?.includes(query) ||
                    reg.seatNumber?.toLowerCase().includes(query))
            ) {
                highlightedSeats.add(reg.seatNumber);
            }
        });
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Render EXAM Chart (6 Zones: A-F, 10x10 each)
    const renderExamChart = () => {
        const zones = ['A', 'B', 'C', 'D', 'E', 'F'];

        return (
            <div className="bg-white rounded-lg shadow-lg p-6 overflow-x-auto">
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">ผังที่นั่งสอบข้อเขียน (10 x 10 ต่อโซน)</h2>
                    <p className="text-sm text-gray-500">เลขที่นั่งเรียงจาก 001-600 แบ่งเป็น 6 โซน (A-F)</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-items-center">
                    {zones.map((zoneChar, zoneIndex) => (
                        <div key={zoneChar} className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                            <div className="text-center font-bold text-lg mb-3 text-blue-800 bg-blue-100 py-1 rounded-lg">
                                Zone {zoneChar} ({zoneChar}001 - {zoneChar}100)
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
                                    const isHighlighted = highlightedSeats.has(displaySeatLabel);
                                    const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                    return (
                                        <div
                                            key={seatNum}
                                            className={`w-8 h-8 border rounded flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all relative group
                                            ${isHighlighted ? 'ring-2 ring-yellow-400 z-20' : ''}
                                            ${registrant ? 'text-white shadow-sm' : 'text-gray-300 bg-white hover:bg-gray-100'}`}
                                            style={{
                                                backgroundColor: courseColor || (registrant ? '#6b7280' : undefined),
                                                borderColor: courseColor ? 'transparent' : '#e5e7eb'
                                            }}
                                            title={registrant ? `${displaySeatLabel}: ${registrant.fullName}\n${registrant.course}` : displaySeatLabel}
                                        >
                                            {seatNum}

                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 hidden md:block">
                                                {displaySeatLabel}
                                                {registrant && <div className="font-normal">{registrant.fullName}</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                {/* Legend */}
                <div className="mt-8 flex flex-wrap gap-4 justify-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    {courseOptions.map(course => (
                        <div key={course.id} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded shadow-sm" style={{ backgroundColor: course.color }}></div>
                            <span className="text-xs text-gray-600 font-medium">{course.name}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border border-gray-300 bg-white"></div>
                        <span className="text-xs text-gray-600">ว่าง</span>
                    </div>
                </div>
            </div>
        );
    };

    // Render Theater Chart (Existing Logic)
    const renderTheaterChart = () => {
        return (
            <div className="bg-white rounded-lg shadow-lg p-4 overflow-x-auto">
                {/* Stage */}
                <div className="bg-blue-100 border-2 border-blue-200 rounded-lg py-3 mb-2 text-center">
                    <div className="font-bold text-blue-800">Stage</div>
                </div>

                {/* Sofa */}
                <div className="bg-blue-50 border-2 border-blue-100 rounded-lg py-2 mb-4 text-center">
                    <div className="font-semibold text-blue-600 text-sm">Sofa</div>
                </div>

                {/* Seating Area */}
                <div className="flex gap-4 justify-center items-start">
                    {/* Zone A */}
                    <div className="flex-1 max-w-md">
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
                                        const isHighlighted = highlightedSeats.has(seatLabel);
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
                                                className={`w-7 h-7 border rounded flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all
                                                ${isHighlighted ? 'ring-2 ring-yellow-400 z-20' : ''}
                                                ${registrant ? 'text-white' : 'text-black/50'}
                                                hover:scale-110 hover:z-30`}
                                                style={{
                                                    backgroundColor: courseColor || (registrant ? '#6b7280' : config.color),
                                                    borderColor: courseColor ? 'transparent' : config.borderColor
                                                }}
                                                title={registrant ? `${seatLabel}: ${registrant.fullName}\n${registrant.course}` : seatLabel}
                                            >
                                                {col + 1}
                                            </div>
                                        );
                                    })}

                                    {/* VIP label */}
                                    <div className="w-8 text-xs text-gray-500 pl-1">
                                        {config.row <= 5 ? `VIP${(config.row * 2) - 1}` : ''}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Center Labels */}
                    <div className="w-20 flex flex-col space-y-0 pt-0">
                        <div className="h-7 flex items-center justify-center font-bold text-sm mb-0.5">
                            <div className="w-full text-center"></div>
                        </div>
                        <div className="space-y-0.5">
                            {zoneRowConfig.map((config, idx) => {
                                const courseColor = config.course ? getCourseColor(config.course) : null;
                                return (
                                    <div
                                        key={idx}
                                        className={`h-7 flex flex-col items-center justify-center rounded text-[10px] font-bold border px-1`}
                                        style={{
                                            backgroundColor: courseColor || (config.labelBg === 'bg-gray-200' ? '#e5e7eb' : '#f3f4f6'),
                                            borderColor: courseColor ? 'transparent' : '#e5e7eb',
                                            color: courseColor ? '#ffffff' : (config.textColor === 'text-gray-600' ? '#4b5563' : '#000000')
                                        }}
                                    >
                                        <div>{config.label}</div>
                                        {config.course && (
                                            <div className="text-[7px] font-normal opacity-90">{config.courseShortName}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Zone B */}
                    <div className="flex-1 max-w-md">
                        <div className="h-7 flex items-center justify-center font-bold text-sm mb-0.5">Zone B</div>
                        <div className="space-y-0.5">
                            {zoneRowConfig.map((config, idx) => (
                                <div key={idx} className="flex gap-0.5 items-center">
                                    {/* VIP label */}
                                    <div className="w-8 text-xs text-gray-500 text-right pr-1">
                                        {config.row <= 5 ? `VIP${config.row * 2}` : ''}
                                    </div>

                                    {/* Seats 1-10 */}
                                    {Array.from({ length: 10 }, (_, col) => {
                                        const seatLabel = config.row <= 5 ? `VIP_B${config.row}-${col + 1}` : `B${config.row - 5}-${col + 1}`;
                                        const ajLabel = ajSeats[seatLabel];
                                        const registrant = seatMap[seatLabel];
                                        const isHighlighted = highlightedSeats.has(seatLabel);
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
                                                className={`w-7 h-7 border rounded flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all
                                                ${isHighlighted ? 'ring-2 ring-yellow-400 z-20' : ''}
                                                ${registrant ? 'text-white' : 'text-black/50'}
                                                hover:scale-110 hover:z-30`}
                                                style={{
                                                    backgroundColor: courseColor || (registrant ? '#6b7280' : config.color),
                                                    borderColor: courseColor ? 'transparent' : config.borderColor
                                                }}
                                                title={registrant ? `${seatLabel}: ${registrant.fullName}\n${registrant.course}` : seatLabel}
                                            >
                                                {col + 1}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="mt-6 flex flex-wrap gap-4 justify-center">
                    {courseOptions.map(course => (
                        <div key={course.id} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: course.color }}></div>
                            <span className="text-xs text-gray-600">{course.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <Link href={`/admin/activity/seats/${activityId}`} className="flex items-center text-gray-500 hover:text-blue-600 transition-colors">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        กลับ
                    </Link>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold">ผังที่นั่ง - {activity?.name}</h1>
                    </div>
                </div>

                {/* Search */}
                <div className="bg-white p-3 rounded-lg mb-4">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหา: ชื่อ, รหัส..."
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                </div>

                {/* Render Chart based on Activity Type */}
                {activity?.type === 'exam' ? renderExamChart() : renderTheaterChart()}
            </div>
        </div>
    );
}
