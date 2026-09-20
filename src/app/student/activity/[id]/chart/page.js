'use client';

import React, { useState, useEffect, use, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from '../../../../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';

function formatSeatLabel(zoneName, runningNumber, labelFormat) {
    const numStr = runningNumber.toString().padStart(3, '0');
    if (labelFormat === 'numberOnly') {
        return numStr;
    }
    if (labelFormat === 'withZone') {
        if (/^[A-Za-z]+$/.test(zoneName)) {
            return `${zoneName}${numStr}`;
        }
        return `${zoneName}-${numStr}`;
    }
    if (/^[A-Za-z]+$/.test(zoneName)) {
        return `${zoneName}${numStr}`;
    }
    return numStr;
}

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

        const fetchCourses = async () => {
            const snap = await getDocs(query(collection(db, 'courseOptions'), orderBy('name')));
            setCourseOptions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };

        fetchData();
        fetchCourses();
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

    // Derived Theater / Graduation Configuration
    const theaterConfig = useMemo(() => {
        const cfg = activity?.theaterConfig || {};
        const vipRows = cfg.vipRows !== undefined ? Number(cfg.vipRows) : 5;
        const studentRows = cfg.studentRows !== undefined ? Number(cfg.studentRows) : 18;
        const seatsPerRow = cfg.seatsPerRow !== undefined ? Number(cfg.seatsPerRow) : 10;
        const ajInterval = cfg.ajInterval !== undefined ? Number(cfg.ajInterval) : 3;
        const ajRowsCustom = cfg.ajRowsCustom || '';

        let targetAjRows = [];
        if (ajRowsCustom && ajRowsCustom.trim()) {
            targetAjRows = ajRowsCustom
                .split(',')
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n) && n >= 1 && n <= studentRows);
        } else if (ajInterval > 0) {
            for (let r = 1; r <= studentRows; r += ajInterval) {
                targetAjRows.push(r);
            }
        }

        return {
            vipRows,
            studentRows,
            seatsPerRow,
            targetAjRows
        };
    }, [activity]);

    // Dynamic AJ Seats Map
    const ajSeats = useMemo(() => {
        const map = {};
        const { targetAjRows, seatsPerRow } = theaterConfig;

        let ajIndex = 1;
        targetAjRows.forEach(r => {
            map[`A${r}-1`] = `AJ${ajIndex++}`;
            map[`B${r}-${seatsPerRow}`] = `AJ${ajIndex++}`;
        });

        return map;
    }, [theaterConfig]);

    // Dominant course for Theater rows
    const getRowCourse = useCallback((studentRowIndex) => {
        const courseCounts = {};
        const seatsPerRow = theaterConfig.seatsPerRow;

        for (let col = 1; col <= seatsPerRow; col++) {
            const seatA = `A${studentRowIndex}-${col}`;
            const seatB = `B${studentRowIndex}-${col}`;
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
    }, [seatMap, theaterConfig.seatsPerRow]);

    // Zone row configuration
    const zoneRowConfig = useMemo(() => {
        const rows = [];
        const { vipRows, studentRows } = theaterConfig;

        for (let v = 1; v <= vipRows; v++) {
            rows.push({
                type: 'vip',
                vipRowIndex: v,
                labelLeft: `VIP${(v * 2) - 1}`,
                labelRight: `VIP${v * 2}`,
                labelCenter: `VIP${(v * 2) - 1}`,
                course: null
            });
        }
        for (let s = 1; s <= studentRows; s++) {
            const rowCourse = getRowCourse(s);
            const courseData = rowCourse ? courseOptions.find(c => c.name === rowCourse) : null;
            rows.push({
                type: 'student',
                studentRowIndex: s,
                labelLeft: `${s}`,
                labelRight: `${s}`,
                labelCenter: `A${s}`,
                course: rowCourse,
                courseShortName: courseData?.shortName || rowCourse
            });
        }
        return rows;
    }, [theaterConfig, getRowCourse, courseOptions]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const renderExamChart = () => {
        const config = activity?.examConfig || {};
        const zoneCount = Number(config.zoneCount || 4);
        const rows = Number(config.rows || 10);
        const cols = Number(config.cols || 10);
        const seatsPerZone = rows * cols;
        const labelFormat = config.labelFormat || (config.zones?.[0]?.name && /^[A-Za-z]+$/.test(config.zones[0].name) ? 'withZone' : 'numberOnly');

        let zones = [];
        if (Array.isArray(config.zones) && config.zones.length > 0 && typeof config.zones[0] === 'object') {
            zones = config.zones.map((z, i) => {
                const startNum = z.startNumber !== undefined ? Number(z.startNumber) : (i * seatsPerZone) + 1;
                return {
                    name: z.name || String(i + 1),
                    startNumber: startNum,
                    endNumber: z.endNumber !== undefined ? Number(z.endNumber) : startNum + seatsPerZone - 1
                };
            });
        } else {
            const isAlpha = Array.isArray(config.zones) && typeof config.zones[0] === 'string';
            zones = Array.from({ length: zoneCount }, (_, i) => {
                const startNum = (i * seatsPerZone) + 1;
                return {
                    name: isAlpha ? config.zones[i] : String(i + 1),
                    startNumber: startNum,
                    endNumber: startNum + seatsPerZone - 1
                };
            });
        }

        return (
            <div className="bg-white rounded-lg shadow-sm border border-slate-300 p-4 md:p-6 overflow-x-auto" ref={chartContainerRef}>
                <div className="text-center mb-6">
                    <h2 className="text-lg font-bold text-slate-900">{config.roomName || 'ผังที่นั่งสอบ'}</h2>
                    {config.location && <p className="text-xs text-slate-600 mb-1">สถานที่: {config.location}</p>}
                    <p className="text-xs text-slate-600 font-medium">ที่นั่งของคุณคือ <span className="font-bold text-blue-700 text-sm">{mySeatNumber || '-'}</span></p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
                    {zones.map((zoneObj, zoneIndex) => {
                        const zoneName = zoneObj.name;
                        const startNum = zoneObj.startNumber;
                        const endNum = zoneObj.endNumber;
                        const startLabel = formatSeatLabel(zoneName, startNum, labelFormat);
                        const endLabel = formatSeatLabel(zoneName, endNum, labelFormat);

                        return (
                            <div key={zoneIndex} className="border border-slate-300 rounded-lg p-3 bg-slate-50 w-full max-w-lg space-y-2">
                                <div className="text-center font-bold text-xs py-1.5 px-3 rounded bg-slate-800 text-white flex justify-between items-center">
                                    <span>โซน {zoneName}</span>
                                    <span className="text-[11px] text-slate-300 font-mono">
                                        {startLabel} - {endLabel} ({seatsPerZone} ที่นั่ง)
                                    </span>
                                </div>
                                <div
                                    className="grid gap-1 overflow-x-auto p-1 bg-white rounded border border-slate-200"
                                    style={{
                                        gridTemplateColumns: `repeat(${cols}, minmax(28px, 1fr))`
                                    }}
                                >
                                    {Array.from({ length: seatsPerZone }, (_, i) => {
                                        const row = Math.floor(i / cols);
                                        const col = i % cols;
                                        const seatOffset = (col * rows) + row;
                                        const runningNumber = startNum + seatOffset;
                                        const displaySeatLabel = formatSeatLabel(zoneName, runningNumber, labelFormat);
                                        const registrant = seatMap[displaySeatLabel];
                                        const isMySeat = displaySeatLabel === mySeatNumber;
                                        const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                        return (
                                            <div
                                                key={displaySeatLabel || i}
                                                ref={isMySeat ? mySeatRef : null}
                                                className={`h-7 rounded border flex items-center justify-center text-[10px] font-bold relative ${
                                                    isMySeat
                                                        ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-400 z-30 scale-110'
                                                        : registrant
                                                            ? 'text-white border-transparent'
                                                            : 'text-slate-700 bg-white border-slate-300'
                                                }`}
                                                style={{
                                                    backgroundColor: isMySeat ? '#dc2626' : (courseColor || (registrant ? '#0b0084' : undefined))
                                                }}
                                            >
                                                {runningNumber}
                                                {isMySeat && (
                                                    <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap z-40">
                                                        คุณ
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderTheaterChart = () => {
        const { seatsPerRow } = theaterConfig;

        return (
            <div className="bg-white rounded-lg shadow-sm border border-slate-300 p-4 md:p-6 overflow-x-auto" ref={chartContainerRef}>
                <div className="min-w-[820px] w-fit mx-auto space-y-4">
                    {/* Stage */}
                    <div className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2.5 text-center">
                        <div className="font-bold text-white text-xs tracking-wider uppercase">เวที / Stage</div>
                    </div>

                    {/* Symmetrical Layout with Spacious Center Aisle */}
                    <div className="flex justify-center items-start gap-6 md:gap-8 pt-2">
                        {/* Zone A (Left Wing) */}
                        <div className="flex-1 max-w-md">
                            <div className="text-center font-bold text-xs text-slate-900 bg-slate-100 border border-slate-300 py-1 rounded mb-2">
                                Zone A
                            </div>
                            <div className="space-y-1">
                                {zoneRowConfig.map((config, idx) => (
                                    <div key={idx} className="flex items-center justify-end gap-1">
                                        <span className="w-8 text-[11px] font-semibold text-slate-600 text-right pr-1">
                                            {config.labelLeft}
                                        </span>

                                        <div className="flex gap-1">
                                            {Array.from({ length: seatsPerRow }, (_, col) => {
                                                const seatLabel = config.type === 'vip'
                                                    ? `VIP_A${config.vipRowIndex}-${col + 1}`
                                                    : `A${config.studentRowIndex}-${col + 1}`;

                                                const ajLabel = ajSeats[seatLabel];
                                                const registrant = seatMap[seatLabel];
                                                const isMySeat = seatLabel === mySeatNumber;
                                                const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                                if (ajLabel) {
                                                    return (
                                                        <div
                                                            key={col}
                                                            className="w-7 h-7 bg-cyan-600 border border-cyan-700 rounded flex items-center justify-center text-[9px] font-bold text-white shadow-none"
                                                            title={`อาจารย์คุมแถว: ${ajLabel}`}
                                                        >
                                                            {ajLabel}
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div
                                                        key={col}
                                                        ref={isMySeat ? mySeatRef : null}
                                                        className={`w-7 h-7 border rounded flex items-center justify-center text-[10px] font-bold transition-all relative ${
                                                            isMySeat
                                                                ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-400 z-30 scale-110'
                                                                : config.type === 'vip'
                                                                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                                                                    : registrant
                                                                        ? 'text-white border-transparent'
                                                                        : 'bg-white border-slate-300 text-slate-800'
                                                        }`}
                                                        style={{
                                                            backgroundColor: isMySeat ? '#dc2626' : (courseColor || (registrant ? '#0b0084' : undefined))
                                                        }}
                                                    >
                                                        {col + 1}
                                                        {isMySeat && (
                                                            <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap z-40">
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

                        {/* Center Aisle Badge */}
                        <div className="w-16 sm:w-20 flex flex-col items-center space-y-1 pt-7">
                            {zoneRowConfig.map((config, idx) => (
                                <div
                                    key={idx}
                                    className={`w-14 h-7 flex items-center justify-center rounded text-[10px] font-bold border ${
                                        config.type === 'vip'
                                            ? 'bg-amber-100 border-amber-300 text-amber-900'
                                            : 'bg-slate-800 border-slate-700 text-white'
                                    }`}
                                >
                                    <span>{config.labelCenter}</span>
                                </div>
                            ))}
                        </div>

                        {/* Zone B (Right Wing) */}
                        <div className="flex-1 max-w-md">
                            <div className="text-center font-bold text-xs text-slate-900 bg-slate-100 border border-slate-300 py-1 rounded mb-2">
                                Zone B
                            </div>
                            <div className="space-y-1">
                                {zoneRowConfig.map((config, idx) => (
                                    <div key={idx} className="flex items-center justify-start gap-1">
                                        <div className="flex gap-1">
                                            {Array.from({ length: seatsPerRow }, (_, col) => {
                                                const seatLabel = config.type === 'vip'
                                                    ? `VIP_B${config.vipRowIndex}-${col + 1}`
                                                    : `B${config.studentRowIndex}-${col + 1}`;

                                                const ajLabel = ajSeats[seatLabel];
                                                const registrant = seatMap[seatLabel];
                                                const isMySeat = seatLabel === mySeatNumber;
                                                const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                                if (ajLabel) {
                                                    return (
                                                        <div
                                                            key={col}
                                                            className="w-7 h-7 bg-cyan-600 border border-cyan-700 rounded flex items-center justify-center text-[9px] font-bold text-white shadow-none"
                                                            title={`อาจารย์คุมแถว: ${ajLabel}`}
                                                        >
                                                            {ajLabel}
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div
                                                        key={col}
                                                        ref={isMySeat ? mySeatRef : null}
                                                        className={`w-7 h-7 border rounded flex items-center justify-center text-[10px] font-bold transition-all relative ${
                                                            isMySeat
                                                                ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-400 z-30 scale-110'
                                                                : config.type === 'vip'
                                                                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                                                                    : registrant
                                                                        ? 'text-white border-transparent'
                                                                        : 'bg-white border-slate-300 text-slate-800'
                                                        }`}
                                                        style={{
                                                            backgroundColor: isMySeat ? '#dc2626' : (courseColor || (registrant ? '#0b0084' : undefined))
                                                        }}
                                                    >
                                                        {col + 1}
                                                        {isMySeat && (
                                                            <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap z-40">
                                                                คุณ
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <span className="w-8 text-[11px] font-semibold text-slate-600 text-left pl-1">
                                            {config.labelRight}
                                        </span>
                                    </div>
                                ))}
                            </div>
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
