'use client';

import React, { useState, useEffect, use, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { db } from '../../../../../../lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';

export function formatSeatLabel(zoneName, runningNumber, labelFormat) {
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

export default function SeatingChartPage({ params }) {
    const { id: activityId } = use(params);
    const [activity, setActivity] = useState(null);
    const [registrants, setRegistrants] = useState([]);
    const [courseOptions, setCourseOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [message, setMessage] = useState('');

    // Exam Room Config Modal State
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [examForm, setExamForm] = useState({
        roomName: '',
        location: '',
        zoneCount: 4,
        rows: 10,
        cols: 10,
        labelFormat: 'numberOnly',
        zones: []
    });

    // Theater / Graduation Config Modal State
    const [isTheaterModalOpen, setIsTheaterModalOpen] = useState(false);
    const [theaterForm, setTheaterForm] = useState({
        hallName: '',
        location: '',
        vipRows: 5,
        studentRows: 18,
        seatsPerRow: 10,
        ajInterval: 3,
        ajRowsCustom: '1, 4, 7, 10, 13, 16'
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const activityDoc = await getDoc(doc(db, 'activities', activityId));
            if (activityDoc.exists()) {
                const data = activityDoc.data();
                setActivity({ id: activityDoc.id, ...data });

                // Initialize examForm
                const eConfig = data.examConfig || {};
                const zCount = Number(eConfig.zoneCount || 4);
                const rCount = Number(eConfig.rows || 10);
                const cCount = Number(eConfig.cols || 10);
                const spz = rCount * cCount;
                const loadedFormat = eConfig.labelFormat || 'numberOnly';

                let loadedZones = [];
                if (Array.isArray(eConfig.zones) && eConfig.zones.length > 0 && typeof eConfig.zones[0] === 'object') {
                    loadedZones = eConfig.zones.map((z, idx) => {
                        const startNum = z.startNumber !== undefined ? Number(z.startNumber) : (idx * spz) + 1;
                        return {
                            name: z.name || String(idx + 1),
                            startNumber: startNum,
                            endNumber: z.endNumber !== undefined ? Number(z.endNumber) : startNum + spz - 1
                        };
                    });
                } else {
                    const isAlpha = Array.isArray(eConfig.zones) && typeof eConfig.zones[0] === 'string';
                    loadedZones = Array.from({ length: zCount }, (_, i) => {
                        const startNum = (i * spz) + 1;
                        return {
                            name: isAlpha ? eConfig.zones[i] : String(i + 1),
                            startNumber: startNum,
                            endNumber: startNum + spz - 1
                        };
                    });
                }

                setExamForm({
                    roomName: eConfig.roomName || data.name || '',
                    location: eConfig.location || data.location || '',
                    zoneCount: zCount,
                    rows: rCount,
                    cols: cCount,
                    labelFormat: loadedFormat,
                    zones: loadedZones
                });

                // Initialize theaterForm
                const tConfig = data.theaterConfig || {};
                setTheaterForm({
                    hallName: tConfig.hallName || data.name || '',
                    location: tConfig.location || data.location || '',
                    vipRows: tConfig.vipRows !== undefined ? tConfig.vipRows : 5,
                    studentRows: tConfig.studentRows !== undefined ? tConfig.studentRows : 18,
                    seatsPerRow: tConfig.seatsPerRow !== undefined ? tConfig.seatsPerRow : 10,
                    ajInterval: tConfig.ajInterval !== undefined ? tConfig.ajInterval : 3,
                    ajRowsCustom: tConfig.ajRowsCustom || '1, 4, 7, 10, 13, 16'
                });
            }

            const q = query(collection(db, 'registrations'), where('activityId', '==', activityId));
            const snapshot = await getDocs(q);
            const registrantsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setRegistrants(registrantsData);
        } catch (error) {
            console.error("Error fetching data:", error);
            setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [activityId]);

    useEffect(() => {
        const unsubCourses = onSnapshot(query(collection(db, 'courseOptions'), orderBy('name')), (snapshot) => {
            setCourseOptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        fetchData();
        return () => unsubCourses();
    }, [fetchData]);

    // Derived Exam Configuration
    const examConfig = useMemo(() => {
        const cfg = activity?.examConfig || {};
        const zoneCount = Number(cfg.zoneCount || 4);
        const rows = Number(cfg.rows || 10);
        const cols = Number(cfg.cols || 10);
        const seatsPerZone = rows * cols;
        const maxSeats = zoneCount * seatsPerZone;
        const labelFormat = cfg.labelFormat || (cfg.zones?.[0]?.name && /^[A-Za-z]+$/.test(cfg.zones[0].name) ? 'withZone' : 'numberOnly');

        let zones = [];
        if (Array.isArray(cfg.zones) && cfg.zones.length > 0 && typeof cfg.zones[0] === 'object') {
            zones = cfg.zones.map((z, i) => {
                const startNum = z.startNumber !== undefined ? Number(z.startNumber) : (i * seatsPerZone) + 1;
                return {
                    name: z.name || String(i + 1),
                    startNumber: startNum,
                    endNumber: z.endNumber !== undefined ? Number(z.endNumber) : startNum + seatsPerZone - 1
                };
            });
        } else {
            const isAlpha = Array.isArray(cfg.zones) && typeof cfg.zones[0] === 'string';
            zones = Array.from({ length: zoneCount }, (_, i) => {
                const startNum = (i * seatsPerZone) + 1;
                return {
                    name: isAlpha ? cfg.zones[i] : String(i + 1),
                    startNumber: startNum,
                    endNumber: startNum + seatsPerZone - 1
                };
            });
        }

        return {
            roomName: cfg.roomName || activity?.name || 'ห้องสอบข้อเขียน',
            location: cfg.location || activity?.location || 'ไม่ระบุสถานที่',
            zoneCount,
            rows,
            cols,
            seatsPerZone,
            maxSeats,
            labelFormat,
            zones
        };
    }, [activity]);

    // Derived Theater / Graduation Configuration
    const theaterConfig = useMemo(() => {
        const cfg = activity?.theaterConfig || {};
        const vipRows = cfg.vipRows !== undefined ? Number(cfg.vipRows) : 5;
        const studentRows = cfg.studentRows !== undefined ? Number(cfg.studentRows) : 18;
        const seatsPerRow = cfg.seatsPerRow !== undefined ? Number(cfg.seatsPerRow) : 10;
        const ajInterval = cfg.ajInterval !== undefined ? Number(cfg.ajInterval) : 3;
        const ajRowsCustom = cfg.ajRowsCustom || '';

        // Calculate AJ Target Rows
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

        const totalVipSeats = vipRows * seatsPerRow * 2;
        const totalAjSeats = targetAjRows.length * 2;
        const totalStudentSeats = (studentRows * seatsPerRow * 2) - totalAjSeats;
        const maxSeats = totalVipSeats + (studentRows * seatsPerRow * 2);

        return {
            hallName: cfg.hallName || activity?.name || 'หอประชุมใหญ่',
            location: cfg.location || activity?.location || 'ไม่ระบุสถานที่',
            vipRows,
            studentRows,
            seatsPerRow,
            ajInterval,
            ajRowsCustom,
            targetAjRows,
            totalVipSeats,
            totalAjSeats,
            totalStudentSeats,
            maxSeats
        };
    }, [activity]);

    // Zone Configuration Handlers
    const handleZoneCountChange = (newCount) => {
        const count = Math.max(1, Math.min(26, Number(newCount) || 1));
        const seatsPerZone = Number(examForm.rows || 10) * Number(examForm.cols || 10);
        setExamForm(prev => {
            let updatedZones = [...(prev.zones || [])];
            if (updatedZones.length < count) {
                for (let i = updatedZones.length; i < count; i++) {
                    const prevEnd = i > 0 ? (Number(updatedZones[i - 1].startNumber) + seatsPerZone - 1) : 0;
                    const startNum = prevEnd + 1;
                    const isAlpha = updatedZones.length > 0 && /^[A-Za-z]+$/.test(updatedZones[0].name);
                    updatedZones.push({
                        name: isAlpha ? String.fromCharCode(65 + i) : String(i + 1),
                        startNumber: startNum,
                        endNumber: startNum + seatsPerZone - 1
                    });
                }
            } else if (updatedZones.length > count) {
                updatedZones = updatedZones.slice(0, count);
            }
            return {
                ...prev,
                zoneCount: count,
                zones: updatedZones
            };
        });
    };

    const handleDimensionChange = (key, value) => {
        const val = Math.max(1, Math.min(30, Number(value) || 1));
        setExamForm(prev => {
            const newRows = key === 'rows' ? val : Number(prev.rows || 10);
            const newCols = key === 'cols' ? val : Number(prev.cols || 10);
            const newSeatsPerZone = newRows * newCols;
            const updatedZones = (prev.zones || []).map(z => ({
                ...z,
                endNumber: Number(z.startNumber) + newSeatsPerZone - 1
            }));
            return {
                ...prev,
                [key]: val,
                zones: updatedZones
            };
        });
    };

    const handleZoneFieldChange = (index, field, value) => {
        const seatsPerZone = Number(examForm.rows || 10) * Number(examForm.cols || 10);
        setExamForm(prev => {
            const updatedZones = [...prev.zones];
            if (field === 'startNumber') {
                const startNum = Math.max(1, Number(value) || 1);
                updatedZones[index] = {
                    ...updatedZones[index],
                    startNumber: startNum,
                    endNumber: startNum + seatsPerZone - 1
                };
            } else if (field === 'name') {
                updatedZones[index] = {
                    ...updatedZones[index],
                    name: value
                };
            }
            return { ...prev, zones: updatedZones };
        });
    };

    const setNamingPreset = (presetType) => {
        setExamForm(prev => {
            const updatedZones = (prev.zones || []).map((z, idx) => ({
                ...z,
                name: presetType === 'alpha' ? String.fromCharCode(65 + idx) : String(idx + 1)
            }));
            return {
                ...prev,
                labelFormat: presetType === 'alpha' ? 'withZone' : prev.labelFormat,
                zones: updatedZones
            };
        });
    };

    const resetContinuousNumbers = () => {
        const seatsPerZone = Number(examForm.rows || 10) * Number(examForm.cols || 10);
        setExamForm(prev => {
            const updatedZones = (prev.zones || []).map((z, idx) => {
                const startNum = (idx * seatsPerZone) + 1;
                return {
                    ...z,
                    startNumber: startNum,
                    endNumber: startNum + seatsPerZone - 1
                };
            });
            return { ...prev, zones: updatedZones };
        });
    };

    // Handle Saving Exam Config
    const handleSaveExamConfig = async (e) => {
        e.preventDefault();
        setIsSavingConfig(true);
        try {
            const zoneCount = Math.max(1, Math.min(26, Number(examForm.zoneCount) || 4));
            const rows = Math.max(1, Math.min(30, Number(examForm.rows) || 10));
            const cols = Math.max(1, Math.min(30, Number(examForm.cols) || 10));
            const seatsPerZone = rows * cols;
            const maxSeats = zoneCount * seatsPerZone;

            // Sanitize zones
            const sanitizedZones = (examForm.zones || []).map((z, idx) => {
                const startNum = Math.max(1, Number(z.startNumber) || ((idx * seatsPerZone) + 1));
                return {
                    name: z.name ? z.name.trim() : String(idx + 1),
                    startNumber: startNum,
                    endNumber: startNum + seatsPerZone - 1
                };
            });

            const updatedExamConfig = {
                roomName: examForm.roomName.trim(),
                location: examForm.location.trim(),
                zoneCount,
                rows,
                cols,
                seatsPerZone,
                maxSeats,
                labelFormat: examForm.labelFormat || 'numberOnly',
                zones: sanitizedZones
            };

            const activityRef = doc(db, 'activities', activityId);
            await updateDoc(activityRef, {
                examConfig: updatedExamConfig,
                location: examForm.location.trim(),
                capacity: maxSeats
            });

            setActivity(prev => ({
                ...prev,
                examConfig: updatedExamConfig,
                location: examForm.location.trim(),
                capacity: maxSeats
            }));

            setMessage('✅ บันทึกการตั้งค่าห้องสอบและเลขแต่ละโซนสำเร็จ!');
            setIsConfigModalOpen(false);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error updating exam config:", error);
            setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsSavingConfig(false);
        }
    };

    // Reset Exam Form to Default Values
    const handleResetExamForm = () => {
        const rows = 10;
        const cols = 10;
        const seatsPerZone = rows * cols;
        const defaultZones = Array.from({ length: 4 }, (_, i) => {
            const startNum = (i * seatsPerZone) + 1;
            return {
                name: String(i + 1),
                startNumber: startNum,
                endNumber: startNum + seatsPerZone - 1
            };
        });

        setExamForm({
            roomName: activity?.name || 'ห้องสอบข้อเขียน',
            location: activity?.location || 'ไม่ระบุสถานที่',
            zoneCount: 4,
            rows: 10,
            cols: 10,
            labelFormat: 'numberOnly',
            zones: defaultZones
        });
    };

    // Handle Saving Theater / Graduation Config
    const handleSaveTheaterConfig = async (e) => {
        e.preventDefault();
        setIsSavingConfig(true);
        try {
            const vipRows = Math.max(0, Math.min(20, Number(theaterForm.vipRows) || 0));
            const studentRows = Math.max(1, Math.min(50, Number(theaterForm.studentRows) || 18));
            const seatsPerRow = Math.max(1, Math.min(30, Number(theaterForm.seatsPerRow) || 10));
            const ajInterval = Math.max(0, Math.min(20, Number(theaterForm.ajInterval) || 0));
            const ajRowsCustom = theaterForm.ajRowsCustom.trim();

            let targetAjRows = [];
            if (ajRowsCustom) {
                targetAjRows = ajRowsCustom
                    .split(',')
                    .map(s => parseInt(s.trim(), 10))
                    .filter(n => !isNaN(n) && n >= 1 && n <= studentRows);
            } else if (ajInterval > 0) {
                for (let r = 1; r <= studentRows; r += ajInterval) {
                    targetAjRows.push(r);
                }
            }

            const totalVipSeats = vipRows * seatsPerRow * 2;
            const totalAjSeats = targetAjRows.length * 2;
            const totalStudentSeats = (studentRows * seatsPerRow * 2) - totalAjSeats;
            const maxSeats = totalVipSeats + (studentRows * seatsPerRow * 2);

            const updatedTheaterConfig = {
                hallName: theaterForm.hallName.trim(),
                location: theaterForm.location.trim(),
                vipRows,
                studentRows,
                seatsPerRow,
                ajInterval,
                ajRowsCustom,
                totalVipSeats,
                totalAjSeats,
                totalStudentSeats,
                maxSeats
            };

            const activityRef = doc(db, 'activities', activityId);
            await updateDoc(activityRef, {
                theaterConfig: updatedTheaterConfig,
                location: theaterForm.location.trim(),
                capacity: maxSeats
            });

            setActivity(prev => ({
                ...prev,
                theaterConfig: updatedTheaterConfig,
                location: theaterForm.location.trim(),
                capacity: maxSeats
            }));

            setMessage('✅ บันทึกการตั้งค่าผังหอประชุม (VIP & AJ) สำเร็จ!');
            setIsTheaterModalOpen(false);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error updating theater config:", error);
            setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsSavingConfig(false);
        }
    };

    // Reset Theater Form to Default Values
    const handleResetTheaterForm = () => {
        setTheaterForm({
            hallName: activity?.name || 'หอประชุมใหญ่',
            location: activity?.location || 'ไม่ระบุสถานที่',
            vipRows: 5,
            studentRows: 18,
            seatsPerRow: 10,
            ajInterval: 3,
            ajRowsCustom: '1, 4, 7, 10, 13, 16'
        });
    };

    // Seat Mapping
    const seatMap = useMemo(() => {
        const map = {};
        registrants.forEach(reg => {
            if (reg.seatNumber) {
                map[reg.seatNumber] = reg;
            }
        });
        return map;
    }, [registrants]);

    const getCourseColor = (courseName) => {
        if (!courseName) return null;
        const course = courseOptions.find(c => c.name === courseName || c.shortName === courseName);
        return course?.color || null;
    };

    // Dynamic AJ Seats Map for Theater
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

    // Dynamic zoneRowConfig for Theater
    const zoneRowConfig = useMemo(() => {
        const rows = [];
        const { vipRows, studentRows } = theaterConfig;

        // VIP Rows (1..vipRows)
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

        // Student Rows (1..studentRows)
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

    // Filter by search
    const highlightedSeats = useMemo(() => {
        const set = new Set();
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            registrants.forEach(reg => {
                if (
                    reg.seatNumber &&
                    ((reg.fullName && reg.fullName.toLowerCase().includes(query)) ||
                        (reg.studentId && reg.studentId.toLowerCase().includes(query)) ||
                        (reg.nationalId && reg.nationalId.includes(query)) ||
                        (reg.seatNumber && reg.seatNumber.toLowerCase().includes(query)))
                ) {
                    set.add(reg.seatNumber);
                }
            });
        }
        return set;
    }, [searchQuery, registrants]);

    if (isLoading) {
        return (
            <div className="p-12 text-center text-slate-500 text-xs">
                <div className="w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                กำลังโหลดผังที่นั่ง...
            </div>
        );
    }

    // Dynamic Exam Chart Rendering based on examConfig
    const renderExamChart = () => {
        const { zones, rows, cols, seatsPerZone, labelFormat } = examConfig;

        return (
            <div className="bg-white rounded-lg border border-slate-300 p-4 md:p-6 space-y-4">
                {/* Zones Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 justify-items-center">
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
                                        // Column-Major calculation
                                        const row = Math.floor(i / cols);
                                        const col = i % cols;
                                        const seatNum = (col * rows) + row;
                                        const runningNumber = startNum + seatNum;
                                        const displaySeatLabel = formatSeatLabel(zoneName, runningNumber, labelFormat);

                                        const registrant = seatMap[displaySeatLabel];
                                        const isHighlighted = highlightedSeats.has(displaySeatLabel);
                                        const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                        return (
                                            <div
                                                key={seatNum}
                                                className={`h-7 rounded border flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors relative group ${
                                                    isHighlighted ? 'ring-2 ring-amber-500 z-20' : ''
                                                } ${
                                                    registrant
                                                        ? 'text-white border-transparent'
                                                        : 'text-slate-700 bg-white border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                                                }`}
                                                style={{
                                                    backgroundColor: courseColor || (registrant ? '#0b0084' : undefined)
                                                }}
                                                title={registrant ? `${displaySeatLabel}: ${registrant.fullName}\n${registrant.course || ''}` : displaySeatLabel}
                                            >
                                                {runningNumber}

                                                {/* Tooltip */}
                                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-slate-900 text-white text-[11px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 hidden md:block border border-slate-700">
                                                    <div className="font-bold">{displaySeatLabel}</div>
                                                    {registrant && <div>{registrant.fullName}</div>}
                                                    {registrant?.course && <div className="text-[10px] text-slate-300">{registrant.course}</div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap gap-3 justify-center text-xs text-slate-700 font-medium">
                    {courseOptions.map(course => (
                        <div key={course.id} className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: course.color }}></span>
                            <span>{course.name}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded border-2 border-slate-300 bg-white"></span>
                        <span>ที่นั่งว่าง</span>
                    </div>
                </div>
            </div>
        );
    };

    // Symmetrical High-Contrast Theater / Graduation Chart Rendering
    const renderTheaterChart = () => {
        const { seatsPerRow } = theaterConfig;

        return (
            <div className="bg-white rounded-lg border border-slate-300 p-4 md:p-6 space-y-4 overflow-x-auto">
                <div className="min-w-[820px] w-fit mx-auto space-y-4">
                    {/* High-Contrast Stage */}
                    <div className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2.5 text-center">
                        <div className="font-bold text-white text-xs tracking-wider uppercase">เวที / Stage</div>
                    </div>

                    {/* Perfectly Symmetrical Layout with Spacious Center Aisle */}
                    <div className="flex justify-center items-start gap-6 md:gap-8 pt-2">
                        {/* Zone A (Left Wing) */}
                        <div className="flex-1 max-w-md">
                            <div className="text-center font-bold text-xs text-slate-900 bg-slate-100 border border-slate-300 py-1 rounded mb-2">
                                Zone A
                            </div>
                            <div className="space-y-1">
                                {zoneRowConfig.map((config, idx) => (
                                    <div key={idx} className="flex items-center justify-end gap-1">
                                        {/* Left Row Indicator */}
                                        <span className="w-8 text-[11px] font-semibold text-slate-600 text-right pr-1">
                                            {config.labelLeft}
                                        </span>

                                        {/* Zone A Seats 1..seatsPerRow */}
                                        <div className="flex gap-1">
                                            {Array.from({ length: seatsPerRow }, (_, col) => {
                                                const seatLabel = config.type === 'vip'
                                                    ? `VIP_A${config.vipRowIndex}-${col + 1}`
                                                    : `A${config.studentRowIndex}-${col + 1}`;

                                                const ajLabel = ajSeats[seatLabel];
                                                const registrant = seatMap[seatLabel];
                                                const isHighlighted = highlightedSeats.has(seatLabel);
                                                const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                                // High Contrast AJ Seat
                                                if (ajLabel) {
                                                    return (
                                                        <div
                                                            key={col}
                                                            className="w-7 h-7 bg-cyan-600 border border-cyan-700 rounded flex items-center justify-center text-[9px] font-bold text-white cursor-pointer"
                                                            title={`อาจารย์คุมแถว: ${ajLabel}`}
                                                        >
                                                            {ajLabel}
                                                        </div>
                                                    );
                                                }

                                                // High Contrast VIP Seat
                                                if (config.type === 'vip') {
                                                    return (
                                                        <div
                                                            key={col}
                                                            className={`w-7 h-7 rounded border flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors ${
                                                                isHighlighted ? 'ring-2 ring-amber-500 z-20' : ''
                                                            } ${
                                                                registrant
                                                                    ? 'text-white border-transparent'
                                                                    : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                                            }`}
                                                            style={{
                                                                backgroundColor: courseColor || (registrant ? '#0b0084' : undefined)
                                                            }}
                                                            title={registrant ? `${seatLabel}: ${registrant.fullName}` : seatLabel}
                                                        >
                                                            {col + 1}
                                                        </div>
                                                    );
                                                }

                                                // Normal Student Seat
                                                return (
                                                    <div
                                                        key={col}
                                                        className={`w-7 h-7 border rounded flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors ${
                                                            isHighlighted ? 'ring-2 ring-amber-500 z-20' : ''
                                                        } ${
                                                            registrant
                                                                ? 'text-white border-transparent'
                                                                : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100 hover:border-slate-400'
                                                        }`}
                                                        style={{
                                                            backgroundColor: courseColor || (registrant ? '#0b0084' : undefined)
                                                        }}
                                                        title={registrant ? `${seatLabel}: ${registrant.fullName}\n${registrant.course || ''}` : seatLabel}
                                                    >
                                                        {col + 1}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Center Aisle Badge (ทางเดินกลาง) */}
                        <div className="w-16 sm:w-20 flex flex-col items-center space-y-1 pt-7">
                            {zoneRowConfig.map((config, idx) => {
                                const isVip = config.type === 'vip';
                                return (
                                    <div
                                        key={idx}
                                        className={`w-14 h-7 flex items-center justify-center rounded text-[10px] font-bold border ${
                                            isVip
                                                ? 'bg-amber-100 border-amber-300 text-amber-900'
                                                : 'bg-slate-800 border-slate-700 text-white'
                                        }`}
                                    >
                                        <span>{config.labelCenter}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Zone B (Right Wing) */}
                        <div className="flex-1 max-w-md">
                            <div className="text-center font-bold text-xs text-slate-900 bg-slate-100 border border-slate-300 py-1 rounded mb-2">
                                Zone B
                            </div>
                            <div className="space-y-1">
                                {zoneRowConfig.map((config, idx) => (
                                    <div key={idx} className="flex items-center justify-start gap-1">
                                        {/* Zone B Seats 1..seatsPerRow */}
                                        <div className="flex gap-1">
                                            {Array.from({ length: seatsPerRow }, (_, col) => {
                                                const seatLabel = config.type === 'vip'
                                                    ? `VIP_B${config.vipRowIndex}-${col + 1}`
                                                    : `B${config.studentRowIndex}-${col + 1}`;

                                                const ajLabel = ajSeats[seatLabel];
                                                const registrant = seatMap[seatLabel];
                                                const isHighlighted = highlightedSeats.has(seatLabel);
                                                const courseColor = registrant ? getCourseColor(registrant.course) : null;

                                                // High Contrast AJ Seat
                                                if (ajLabel) {
                                                    return (
                                                        <div
                                                            key={col}
                                                            className="w-7 h-7 bg-cyan-600 border border-cyan-700 rounded flex items-center justify-center text-[9px] font-bold text-white cursor-pointer"
                                                            title={`อาจารย์คุมแถว: ${ajLabel}`}
                                                        >
                                                            {ajLabel}
                                                        </div>
                                                    );
                                                }

                                                // High Contrast VIP Seat
                                                if (config.type === 'vip') {
                                                    return (
                                                        <div
                                                            key={col}
                                                            className={`w-7 h-7 rounded border flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors ${
                                                                isHighlighted ? 'ring-2 ring-amber-500 z-20' : ''
                                                            } ${
                                                                registrant
                                                                    ? 'text-white border-transparent'
                                                                    : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                                            }`}
                                                            style={{
                                                                backgroundColor: courseColor || (registrant ? '#0b0084' : undefined)
                                                            }}
                                                            title={registrant ? `${seatLabel}: ${registrant.fullName}` : seatLabel}
                                                        >
                                                            {col + 1}
                                                        </div>
                                                    );
                                                }

                                                // Normal Student Seat
                                                return (
                                                    <div
                                                        key={col}
                                                        className={`w-7 h-7 border rounded flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors ${
                                                            isHighlighted ? 'ring-2 ring-amber-500 z-20' : ''
                                                        } ${
                                                            registrant
                                                                ? 'text-white border-transparent'
                                                                : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100 hover:border-slate-400'
                                                        }`}
                                                        style={{
                                                            backgroundColor: courseColor || (registrant ? '#0b0084' : undefined)
                                                        }}
                                                        title={registrant ? `${seatLabel}: ${registrant.fullName}\n${registrant.course || ''}` : seatLabel}
                                                    >
                                                        {col + 1}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Right Row Indicator */}
                                        <span className="w-8 text-[11px] font-semibold text-slate-600 text-left pl-1">
                                            {config.labelRight}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* High-Contrast Legend */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap gap-4 justify-center text-xs text-slate-700 font-medium">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-amber-50 border border-amber-300"></span>
                        <span>VIP ({theaterConfig.totalVipSeats} ที่นั่ง)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-cyan-600 border border-cyan-700"></span>
                        <span>AJ อาจารย์คุมแถว ({theaterConfig.totalAjSeats} ที่นั่ง)</span>
                    </div>
                    {courseOptions.map(course => (
                        <div key={course.id} className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: course.color }}></span>
                            <span>{course.name}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded border-2 border-slate-300 bg-white"></span>
                        <span>ที่นั่งว่าง</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 space-y-3">
            {/* Top Toolbar */}
            <div className="bg-white p-3 rounded-lg border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Link
                        href={`/admin/activity/seats/${activityId}`}
                        className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-bold"
                        title="กลับหน้าจัดการข้อมูลนักเรียน"
                    >
                        ←
                    </Link>
                    <div>
                        <h1 className="text-sm font-bold text-slate-900">
                            ผังที่นั่ง - {activity?.type === 'exam' ? examConfig.roomName : theaterConfig.hallName}
                        </h1>
                        <p className="text-xs text-slate-600 font-medium">
                            {activity?.type === 'exam' ? (
                                <>สถานที่: {examConfig.location} • {examConfig.zones.length} โซน ({examConfig.rows}×{examConfig.cols}) • รวม {examConfig.maxSeats} ที่นั่ง • ผู้ลงทะเบียน {registrants.length} คน</>
                            ) : (
                                <>สถานที่: {theaterConfig.location} • VIP {theaterConfig.vipRows} แถว • นร. {theaterConfig.studentRows} แถว (แถวละ {theaterConfig.seatsPerRow * 2} ที่นั่ง) • AJ {theaterConfig.totalAjSeats} ที่นั่ง • ผู้ลงทะเบียน {registrants.length} คน</>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {activity?.type === 'exam' ? (
                        <button
                            onClick={() => setIsConfigModalOpen(true)}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded border border-slate-300 transition-colors"
                        >
                            ⚙️ แก้ไขห้องสอบ
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsTheaterModalOpen(true)}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded border border-slate-300 transition-colors"
                        >
                            ⚙️ ตั้งค่าผังหอประชุม (VIP & AJ)
                        </button>
                    )}
                </div>
            </div>

            {message && (
                <div className={`p-2.5 rounded text-xs border font-medium ${message.startsWith('✅') ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                    {message}
                </div>
            )}

            {/* Search Box */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-300">
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาชื่อนักเรียน, รหัสผู้สมัคร, เลขบัตร ปชช., หรือเลขที่นั่งเพื่อไฮไลท์..."
                        className="w-full pl-8 pr-6 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 font-medium outline-none focus:border-slate-600 placeholder:text-slate-400"
                    />
                    <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-700 text-xs font-bold"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Seating Layout Render */}
            {activity?.type === 'exam' ? renderExamChart() : renderTheaterChart()}

            {/* Config Exam Room Modal */}
            {isConfigModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg border border-slate-300 max-w-xl w-full p-4 space-y-3 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">แก้ไขข้อมูลห้องสอบและผังที่นั่ง</h3>
                                <p className="text-[11px] text-slate-500">กำหนดโซนและช่วงเลขที่นั่งเริ่มต้นของแต่ละโซน</p>
                            </div>
                            <button
                                onClick={() => setIsConfigModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveExamConfig} className="space-y-3 text-xs overflow-y-auto pr-1">
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">ชื่อห้องสอบ</label>
                                <input
                                    type="text"
                                    value={examForm.roomName}
                                    onChange={(e) => setExamForm({ ...examForm, roomName: e.target.value })}
                                    placeholder="เช่น ห้องสอบข้อเขียน อาคาร 3"
                                    required
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-medium"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">สถานที่จัดสอบ</label>
                                <input
                                    type="text"
                                    value={examForm.location}
                                    onChange={(e) => setExamForm({ ...examForm, location: e.target.value })}
                                    placeholder="เช่น อาคาร 3 ชั้น 2"
                                    required
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">จำนวน ZONE</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="26"
                                        value={examForm.zoneCount}
                                        onChange={(e) => handleZoneCountChange(e.target.value)}
                                        required
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-medium"
                                    />
                                    <span className="text-[10px] text-slate-500">เช่น 4 โซน</span>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">จำนวนแถว (Rows)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={examForm.rows}
                                        onChange={(e) => handleDimensionChange('rows', e.target.value)}
                                        required
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-medium"
                                    />
                                    <span className="text-[10px] text-slate-500">แถวต่อโซน</span>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">คอลัมน์ (Cols)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={examForm.cols}
                                        onChange={(e) => handleDimensionChange('cols', e.target.value)}
                                        required
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-medium"
                                    />
                                    <span className="text-[10px] text-slate-500">ที่นั่งต่อแถว</span>
                                </div>
                            </div>

                            {/* Live Calculation Preview */}
                            <div className="p-2.5 bg-slate-50 border border-slate-300 rounded space-y-1 text-slate-700">
                                <div className="flex justify-between">
                                    <span>ที่นั่งต่อหนึ่งโซน:</span>
                                    <strong className="text-slate-900 font-bold">
                                        {Number(examForm.rows || 0) * Number(examForm.cols || 0)} ที่นั่ง
                                    </strong>
                                </div>
                                <div className="flex justify-between">
                                    <span>ความจุรวมสูงสุด (Max ที่นั่ง):</span>
                                    <strong className="text-[#0b0084] font-bold">
                                        {Number(examForm.zoneCount || 0) * Number(examForm.rows || 0) * Number(examForm.cols || 0)} ที่นั่ง
                                    </strong>
                                </div>
                            </div>

                            {/* Custom Zone Start Numbers Configuration */}
                            <div className="pt-2 border-t border-slate-200 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-xs">
                                            กำหนดรายละเอียดแต่ละโซน (ชื่อ & เลขเริ่มต้น)
                                        </h4>
                                        <p className="text-[10px] text-slate-500">
                                            กำหนดเลขเริ่มต้นได้อิสระ เช่น โซน 1-3 เริ่ม 1, 101, 201 และ โซน 4 เริ่มที่ 801
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-slate-500 mr-1">ตั้งชื่อ:</span>
                                        <button
                                            type="button"
                                            onClick={() => setNamingPreset('numeric')}
                                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-medium border border-slate-300"
                                        >
                                            1, 2, 3...
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNamingPreset('alpha')}
                                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-medium border border-slate-300"
                                        >
                                            A, B, C...
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetContinuousNumbers}
                                            title="คำนวณเลขรันต่อเนื่องตามลำดับ"
                                            className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded text-[10px] font-medium border border-teal-200"
                                        >
                                            ↺ รีเซ็ตเลขรัน
                                        </button>
                                    </div>
                                </div>

                                {/* Label Format Selector */}
                                <div className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                    <label className="text-[11px] font-medium text-slate-700">รูปแบบรหัสที่นั่ง:</label>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-800">
                                            <input
                                                type="radio"
                                                name="labelFormat"
                                                value="numberOnly"
                                                checked={examForm.labelFormat === 'numberOnly'}
                                                onChange={() => setExamForm({ ...examForm, labelFormat: 'numberOnly' })}
                                            />
                                            <span>เฉพาะตัวเลข (เช่น 801..900)</span>
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-800">
                                            <input
                                                type="radio"
                                                name="labelFormat"
                                                value="withZone"
                                                checked={examForm.labelFormat === 'withZone'}
                                                onChange={() => setExamForm({ ...examForm, labelFormat: 'withZone' })}
                                            />
                                            <span>มีชื่อโซน (เช่น 4-801 หรือ D801)</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Zones Table List */}
                                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100">
                                    <div className="bg-slate-100/80 px-2.5 py-1.5 grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-600 sticky top-0">
                                        <span className="col-span-1 text-center">#</span>
                                        <span className="col-span-3">ชื่อโซน</span>
                                        <span className="col-span-4">เลขเริ่มต้น</span>
                                        <span className="col-span-4 text-right">ช่วงที่นั่งผลลัพธ์</span>
                                    </div>
                                    {(examForm.zones || []).map((zone, idx) => {
                                        const seatsPerZone = Number(examForm.rows || 10) * Number(examForm.cols || 10);
                                        const startNum = Number(zone.startNumber || 1);
                                        const endNum = startNum + seatsPerZone - 1;
                                        const startLabel = formatSeatLabel(zone.name, startNum, examForm.labelFormat);
                                        const endLabel = formatSeatLabel(zone.name, endNum, examForm.labelFormat);

                                        return (
                                            <div key={idx} className="px-2.5 py-1.5 grid grid-cols-12 gap-2 items-center text-xs hover:bg-slate-50">
                                                <span className="col-span-1 text-center font-bold text-slate-500 text-[11px]">
                                                    {idx + 1}
                                                </span>
                                                <div className="col-span-3">
                                                    <input
                                                        type="text"
                                                        value={zone.name}
                                                        onChange={(e) => handleZoneFieldChange(idx, 'name', e.target.value)}
                                                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-semibold text-slate-900 bg-white"
                                                        placeholder="ชื่อโซน"
                                                        required
                                                    />
                                                </div>
                                                <div className="col-span-4">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={zone.startNumber}
                                                        onChange={(e) => handleZoneFieldChange(idx, 'startNumber', e.target.value)}
                                                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold text-teal-800 bg-white"
                                                        placeholder="เริ่มที่"
                                                        required
                                                    />
                                                </div>
                                                <div className="col-span-4 text-right">
                                                    <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                                        {startLabel} - {endLabel}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={handleResetExamForm}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded border border-slate-300 transition-colors cursor-pointer"
                                >
                                    ↺ รีเซ็ตค่าเริ่มต้น
                                </button>
                                <div className="flex gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setIsConfigModalOpen(false)}
                                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-medium cursor-pointer"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingConfig}
                                        className="px-5 py-2 bg-[#166E7C] hover:bg-[#0F5661] text-white font-semibold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 text-xs cursor-pointer"
                                    >
                                        {isSavingConfig ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Config Theater / Graduation Modal */}
            {isTheaterModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg border border-slate-300 max-w-lg w-full p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <h3 className="text-sm font-bold text-slate-900">ตั้งค่าผังหอประชุม (VIP & อาจารย์คุมแถว AJ)</h3>
                            <button
                                onClick={() => setIsTheaterModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveTheaterConfig} className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">ชื่อหอประชุม / กิจกรรม</label>
                                    <input
                                        type="text"
                                        value={theaterForm.hallName}
                                        onChange={(e) => setTheaterForm({ ...theaterForm, hallName: e.target.value })}
                                        placeholder="เช่น หอประชุมใหญ่"
                                        required
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">สถานที่</label>
                                    <input
                                        type="text"
                                        value={theaterForm.location}
                                        onChange={(e) => setTheaterForm({ ...theaterForm, location: e.target.value })}
                                        placeholder="เช่น อาคารเฉลิมพระเกียรติ"
                                        required
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-medium"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">จำนวนแถว VIP</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        value={theaterForm.vipRows}
                                        onChange={(e) => setTheaterForm({ ...theaterForm, vipRows: e.target.value })}
                                        required
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-medium"
                                    />
                                    <span className="text-[10px] text-slate-500">0-20 แถว</span>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">จำนวนแถวนักเรียน</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={theaterForm.studentRows}
                                        onChange={(e) => setTheaterForm({ ...theaterForm, studentRows: e.target.value })}
                                        required
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-medium"
                                    />
                                    <span className="text-[10px] text-slate-500">A1 ถึง An</span>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">ที่นั่งต่อฝั่ง (A/B)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={theaterForm.seatsPerRow}
                                        onChange={(e) => setTheaterForm({ ...theaterForm, seatsPerRow: e.target.value })}
                                        required
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-medium"
                                    />
                                    <span className="text-[10px] text-slate-500">เช่น 10 (รวม 20/แถว)</span>
                                </div>
                            </div>

                            {/* AJ อาจารย์คุมแถว Config */}
                            <div className="p-3 bg-slate-50 border border-slate-300 rounded space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800">การวางตำแหน่งอาจารย์คุมแถว (AJ)</span>
                                    <span className="text-[10px] text-slate-600 font-medium">วางหัวแถว Zone A และท้ายแถว Zone B</span>
                                </div>

                                <div>
                                    <label className="block text-slate-700 font-semibold mb-1">ระยะห่างแถวอาจารย์ (AJ Interval)</label>
                                    <select
                                        value={theaterForm.ajInterval}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setTheaterForm({ ...theaterForm, ajInterval: val });
                                        }}
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white outline-none font-medium"
                                    >
                                        <option value="0">ไม่กำหนดอาจารย์คุมแถว (0 คน)</option>
                                        <option value="1">ทุกๆ 1 แถว (แถว 1, 2, 3...)</option>
                                        <option value="2">ทุกๆ 2 แถว (แถว 1, 3, 5...)</option>
                                        <option value="3">ทุกๆ 3 แถว (แถว 1, 4, 7, 10, 13, 16... แนะนำ)</option>
                                        <option value="4">ทุกๆ 4 แถว (แถว 1, 5, 9, 13...)</option>
                                        <option value="5">ทุกๆ 5 แถว (แถว 1, 6, 11, 16...)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-slate-700 font-semibold mb-1">หรือระบุเลขแถวนักเรียนที่ต้องการให้อาจารย์นั่ง (คั่นด้วยจุลภาค)</label>
                                    <input
                                        type="text"
                                        value={theaterForm.ajRowsCustom}
                                        onChange={(e) => setTheaterForm({ ...theaterForm, ajRowsCustom: e.target.value })}
                                        placeholder="เช่น 1, 4, 7, 10, 13, 16"
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white outline-none focus:border-slate-500 font-medium"
                                    />
                                    <span className="text-[10px] text-slate-500">ถ้าเว้นว่างจะใช้ระยะห่างแถว (Interval) ด้านบน</span>
                                </div>
                            </div>

                            {/* Live Calculation Preview */}
                            <div className="p-2.5 bg-slate-50 border border-slate-300 rounded space-y-1 text-slate-700">
                                <div className="flex justify-between">
                                    <span>ที่นั่ง VIP ทั้งหมด:</span>
                                    <span className="font-bold text-slate-900">
                                        {Number(theaterForm.vipRows || 0) * Number(theaterForm.seatsPerRow || 0) * 2} ที่นั่ง
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>ที่นั่งอาจารย์คุมแถว (AJ):</span>
                                    <span className="font-bold text-cyan-700">
                                        {(() => {
                                            const sRows = Number(theaterForm.studentRows || 0);
                                            const custom = theaterForm.ajRowsCustom.trim();
                                            if (custom) {
                                                const valid = custom.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= sRows);
                                                return valid.length * 2;
                                            }
                                            const interval = Number(theaterForm.ajInterval || 0);
                                            if (interval > 0) {
                                                let count = 0;
                                                for (let r = 1; r <= sRows; r += interval) count++;
                                                return count * 2;
                                            }
                                            return 0;
                                        })()} ที่นั่ง
                                    </span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200 pt-1">
                                    <span>ความจุรวมทั้งหอประชุม:</span>
                                    <strong className="text-[#0b0084] font-bold">
                                        {(Number(theaterForm.vipRows || 0) + Number(theaterForm.studentRows || 0)) * Number(theaterForm.seatsPerRow || 0) * 2} ที่นั่ง
                                    </strong>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={handleResetTheaterForm}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded border border-slate-300 transition-colors"
                                >
                                    ↺ รีเซ็ตค่าเริ่มต้น
                                </button>
                                <div className="flex gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setIsTheaterModalOpen(false)}
                                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-medium cursor-pointer"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingConfig}
                                        className="px-5 py-2 bg-[#166E7C] hover:bg-[#0F5661] text-white font-semibold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 text-xs cursor-pointer"
                                    >
                                        {isSavingConfig ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                                    </button>
                                </div>

                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
