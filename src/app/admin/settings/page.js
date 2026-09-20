'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp, setDoc, updateDoc, query, orderBy, writeBatch } from 'firebase/firestore';
import { useModal } from '../../../context/ModalContext';

// Compact Flat Toggle Switch
const FlatToggleSwitch = ({ label, description, enabled, onChange }) => (
    <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors">
        <div className="space-y-0.5">
            <span className="text-xs font-medium text-slate-900 block">{label}</span>
            {description && <span className="text-[11px] text-slate-500 block">{description}</span>}
        </div>
        <div className="relative inline-flex items-center">
            <input type="checkbox" className="sr-only" checked={enabled} onChange={onChange} />
            <div className={`w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-[#166E7C]' : 'bg-slate-300'}`}></div>
            <div className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${enabled ? 'transform translate-x-4' : ''}`}></div>
        </div>
    </label>
);


export default function SettingsPage() {
    const { showAlert, showConfirm, showToast } = useModal();
    const [categories, setCategories] = useState([]);
    const [courses, setCourses] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);
    const [examiners, setExaminers] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [newCourse, setNewCourse] = useState({ name: '', shortName: '', color: '#3B82F6' });
    const [newTimeSlot, setNewTimeSlot] = useState('');
    const [newExaminer, setNewExaminer] = useState({ name: '', role: '' });
    const [message, setMessage] = useState('');
    const [editingCourse, setEditingCourse] = useState(null);
    const [editingExaminer, setEditingExaminer] = useState(null);

    const [notificationSettings, setNotificationSettings] = useState({
        onCheckIn: true,
        onCheckOut: true,
        onQueueCall: true,
    });

    useEffect(() => {
        const unsubCategories = onSnapshot(query(collection(db, 'categories'), orderBy('name')), (snapshot) => {
            setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Query by name only, then sort by priority in memory
        const unsubCourses = onSnapshot(query(collection(db, 'courseOptions'), orderBy('name')), (snapshot) => {
            const coursesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            coursesData.sort((a, b) => {
                const priorityA = a.priority !== undefined ? a.priority : 999;
                const priorityB = b.priority !== undefined ? b.priority : 999;
                if (priorityA !== priorityB) return priorityA - priorityB;
                return a.name.localeCompare(b.name);
            });
            setCourses(coursesData);
        });

        const timeSlotsQuery = query(collection(db, 'timeSlotOptions'), orderBy('name'));
        const unsubTimeSlots = onSnapshot(timeSlotsQuery, (snapshot) => {
            setTimeSlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const examinersQuery = query(collection(db, 'examiners'), orderBy('name'));
        const unsubExaminers = onSnapshot(examinersQuery, (snapshot) => {
            setExaminers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const settingsRef = doc(db, 'systemSettings', 'notifications');
        const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setNotificationSettings(docSnap.data());
            } else {
                setDoc(settingsRef, { onCheckIn: true, onCheckOut: true, onQueueCall: true });
            }
        });

        return () => {
            unsubCategories();
            unsubCourses();
            unsubTimeSlots();
            unsubExaminers();
            unsubSettings();
        };
    }, []);

    const handleSettingChange = async (settingKey, value) => {
        setMessage('');
        const newSettings = { ...notificationSettings, [settingKey]: value };
        setNotificationSettings(newSettings);
        try {
            const settingsRef = doc(db, 'systemSettings', 'notifications');
            await setDoc(settingsRef, newSettings, { merge: true });
            setMessage('✅ บันทึกการตั้งค่าแล้ว');
            setTimeout(() => setMessage(''), 2500);
        } catch (error) {
            setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
        }
    };

    const handleAddItem = async (type, value) => {
        if (!value.name || (type === 'course' && !value.shortName)) {
            showAlert({
                title: 'แจ้งเตือน',
                message: 'กรุณากรอกข้อมูลให้ครบถ้วน',
                type: 'warning'
            });
            return;
        }
        const collectionNameMap = {
            category: 'categories',
            course: 'courseOptions',
            timeSlot: 'timeSlotOptions',
            examiner: 'examiners'
        };

        const dataToAdd = { ...value, createdAt: serverTimestamp() };
        if (type === 'course') {
            dataToAdd.priority = courses.length;
        }

        try {
            await addDoc(collection(db, collectionNameMap[type]), dataToAdd);
            showToast({ message: 'เพิ่มรายการสำเร็จ', type: 'success' });
            if (type === 'category') setNewCategory('');
            if (type === 'course') setNewCourse({ name: '', shortName: '', color: '#3B82F6' });
            if (type === 'timeSlot') setNewTimeSlot('');
            if (type === 'examiner') setNewExaminer({ name: '', role: '' });
        } catch (error) {
            showAlert({
                title: 'เกิดข้อผิดพลาด',
                message: `ไม่สามารถเพิ่มรายการได้: ${error.message}`,
                type: 'error'
            });
        }
    };

    const handleUpdateCourse = async () => {
        if (!editingCourse || !editingCourse.name || !editingCourse.shortName) return;
        try {
            const courseRef = doc(db, 'courseOptions', editingCourse.id);
            await updateDoc(courseRef, {
                name: editingCourse.name.trim(),
                shortName: editingCourse.shortName.trim(),
                color: editingCourse.color || '#3B82F6',
                priority: editingCourse.priority !== undefined ? editingCourse.priority : 0
            });
            showToast({ message: 'อัปเดตหลักสูตรสำเร็จ', type: 'success' });
            setEditingCourse(null);
        } catch (error) {
            showAlert({
                title: 'เกิดข้อผิดพลาด',
                message: `ไม่สามารถอัปเดตหลักสูตรได้: ${error.message}`,
                type: 'error'
            });
        }
    };

    const handleUpdateExaminer = async () => {
        if (!editingExaminer || !editingExaminer.name?.trim()) return;
        try {
            const examinerRef = doc(db, 'examiners', editingExaminer.id);
            await updateDoc(examinerRef, {
                name: editingExaminer.name.trim(),
                role: (editingExaminer.role || '').trim(),
                updatedAt: serverTimestamp()
            });
            showToast({ message: 'อัปเดตข้อมูลกรรมการสำเร็จ', type: 'success' });
            setEditingExaminer(null);
        } catch (error) {
            showAlert({
                title: 'เกิดข้อผิดพลาด',
                message: `ไม่สามารถอัปเดตข้อมูลกรรมการได้: ${error.message}`,
                type: 'error'
            });
        }
    };

    const handleMoveCourse = async (courseId, direction) => {
        const currentIndex = courses.findIndex(c => c.id === courseId);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= courses.length) return;

        const currentCourse = courses[currentIndex];
        const targetCourse = courses[targetIndex];

        await updateDoc(doc(db, 'courseOptions', currentCourse.id), { priority: targetIndex });
        await updateDoc(doc(db, 'courseOptions', targetCourse.id), { priority: currentIndex });
    };

    const handleDeleteItem = async (type, id) => {
        const typeLabels = { category: 'หมวดหมู่นี้', course: 'หลักสูตรนี้', timeSlot: 'ช่วงเวลานี้', examiner: 'กรรมการท่านนี้' };
        const confirmed = await showConfirm({
            title: 'ยืนยันการลบ',
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบ${typeLabels[type] || 'รายการนี้'}?`,
            type: 'danger',
            confirmText: 'ลบรายการ',
            cancelText: 'ยกเลิก'
        });

        if (confirmed) {
            try {
                const collectionNameMap = {
                    category: 'categories',
                    course: 'courseOptions',
                    timeSlot: 'timeSlotOptions',
                    examiner: 'examiners'
                };
                await deleteDoc(doc(db, collectionNameMap[type], id));
                showToast({ message: 'ลบรายการสำเร็จ', type: 'success' });
            } catch (error) {
                showAlert({
                    title: 'เกิดข้อผิดพลาด',
                    message: `ไม่สามารถลบได้: ${error.message}`,
                    type: 'error'
                });
            }
        }
    };


    return (
        <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
            {/* Header Toolbar */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h1 className="text-sm font-bold text-slate-900">ตั้งค่าระบบ (System Settings)</h1>
                    <p className="text-xs text-slate-500">จัดการการแจ้งเตือน LINE Flex และข้อมูลพื้นฐาน (หมวดหมู่, หลักสูตร, ช่วงเวลา)</p>
                </div>
            </div>

            {/* Alert Message */}
            {message && (
                <div className={`p-2.5 rounded text-xs border font-medium ${message.includes('✅') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {message}
                </div>
            )}

            {/* Notification Settings Card */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-base">🔔</span>
                        <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">การแจ้งเตือนผ่าน LINE</h2>
                    </div>
                    <span className="text-[11px] text-slate-400">LINE Flex Notification Triggers</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FlatToggleSwitch
                        label="แจ้งเตือนเมื่อเช็คอิน"
                        description="ส่งข้อความเมื่อนักเรียนสแกนหรือถูกเช็คอิน"
                        enabled={notificationSettings.onCheckIn}
                        onChange={(e) => handleSettingChange('onCheckIn', e.target.checked)}
                    />
                    <FlatToggleSwitch
                        label="แจ้งเตือนเมื่อจบกิจกรรม"
                        description="ส่งแบบประเมินและข้อความหลังจบกิจกรรม"
                        enabled={notificationSettings.onCheckOut}
                        onChange={(e) => handleSettingChange('onCheckOut', e.target.checked)}
                    />
                    <FlatToggleSwitch
                        label="แจ้งเตือนเมื่อเรียกคิว"
                        description="ส่งข้อความแจ้งเตือนเมื่อถึงคิวของนักเรียน"
                        enabled={notificationSettings.onQueueCall}
                        onChange={(e) => handleSettingChange('onQueueCall', e.target.checked)}
                    />
                </div>
            </div>

            {/* Examiners Master List Card */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                        <span className="text-base">👥</span>
                        <div>
                            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                รายชื่อคณะกรรมการคัดเลือก / สัมภาษณ์ (Examiners Master List)
                            </h2>
                            <p className="text-[11px] text-slate-500">
                                กำหนดรายชื่อกรรมการล่วงหน้าสำหรับเลือกประจำโต๊ะคิว (โต๊ะละ 2 ท่าน) ในห้องควบคุมคิว
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-[#166E7C] border border-teal-200">
                            กรรมการทั้งหมด {examiners.length} ท่าน
                        </span>
                    </div>
                </div>

                {/* Add Examiner Form */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleAddItem('examiner', {
                            name: newExaminer.name.trim(),
                            role: newExaminer.role.trim()
                        });
                    }}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50/70 p-3 rounded-lg border border-slate-200"
                >
                    <div className="sm:col-span-6">
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            ชื่อ-นามสกุล กรรมการ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="เช่น ผศ.ดร.สมชาย ใจดี หรือ อ.วิภาดา รักเรียน"
                            value={newExaminer.name}
                            onChange={(e) => setNewExaminer(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-[#166E7C]"
                            required
                        />
                    </div>
                    <div className="sm:col-span-4">
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            ตำแหน่ง / สาขาวิชา / สังกัด
                        </label>
                        <input
                            type="text"
                            placeholder="เช่น สาขาวิศวกรรมการบิน"
                            value={newExaminer.role}
                            onChange={(e) => setNewExaminer(prev => ({ ...prev, role: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-[#166E7C]"
                        />
                    </div>
                    <div className="sm:col-span-2 flex items-end">
                        <button
                            type="submit"
                            className="w-full py-2 bg-[#166E7C] hover:bg-[#0F5661] text-white text-xs font-semibold rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <span>+</span>
                            <span>เพิ่มกรรมการ</span>
                        </button>
                    </div>
                </form>

                {/* Examiners Grid / List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {examiners.length === 0 ? (
                        <div className="col-span-full py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            ยังไม่มีรายชื่อกรรมการในระบบ กรุณากรอกเพิ่มรายชื่อด้านบน
                        </div>
                    ) : (
                        examiners.map(ex => (
                            <div
                                key={ex.id}
                                className="p-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors flex items-center justify-between gap-2"
                            >
                                {editingExaminer?.id === ex.id ? (
                                    <div className="flex-1 space-y-1.5">
                                        <input
                                            type="text"
                                            value={editingExaminer.name}
                                            onChange={(e) => setEditingExaminer(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900"
                                            placeholder="ชื่อ-นามสกุล"
                                        />
                                        <input
                                            type="text"
                                            value={editingExaminer.role || ''}
                                            onChange={(e) => setEditingExaminer(prev => ({ ...prev, role: e.target.value }))}
                                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-600"
                                            placeholder="สังกัด / สาขา"
                                        />
                                        <div className="flex gap-1 pt-0.5">
                                            <button
                                                type="button"
                                                onClick={handleUpdateExaminer}
                                                className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[11px] font-semibold"
                                            >
                                                บันทึก
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingExaminer(null)}
                                                className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px]"
                                            >
                                                ยกเลิก
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-slate-400 text-xs">👤</span>
                                                <span className="text-xs font-semibold text-slate-900 truncate block">
                                                    {ex.name}
                                                </span>
                                            </div>
                                            {ex.role && (
                                                <span className="text-[11px] text-slate-500 truncate block pl-4">
                                                    {ex.role}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => setEditingExaminer(ex)}
                                                className="p-1 text-slate-400 hover:text-[#166E7C] transition-colors text-xs"
                                                title="แก้ไข"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDeleteItem('examiner', ex.id)}
                                                className="p-1 text-slate-400 hover:text-red-600 transition-colors text-xs"
                                                title="ลบ"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Master Data Management Grid (3 Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 1. Categories */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col h-full space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">🏷️</span>
                            <h2 className="text-xs font-semibold text-slate-900">หมวดหมู่กิจกรรม</h2>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">ทั้งหมด {categories.length} รายการ</span>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleAddItem('category', { name: newCategory.trim() });
                        }}
                        className="flex gap-2"
                    >
                        <input
                            type="text"
                            value={newCategory}
                            onChange={e => setNewCategory(e.target.value)}
                            placeholder="พิมพ์ชื่อหมวดหมู่..."
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-[#166E7C] placeholder:text-slate-400"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 bg-[#166E7C] hover:bg-[#0F5661] text-white text-xs font-semibold rounded-lg transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                        >
                            + เพิ่ม
                        </button>
                    </form>

                    <div className="flex-1 overflow-y-auto max-h-[360px] border border-slate-100 rounded-lg divide-y divide-slate-100">
                        {categories.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">ยังไม่มีหมวดหมู่</div>
                        ) : (
                            categories.map(cat => (
                                <div
                                    key={cat.id}
                                    className="p-2.5 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors"
                                >
                                    <span className="text-xs text-slate-800 font-medium">{cat.name}</span>
                                    <button
                                        onClick={() => handleDeleteItem('category', cat.id)}
                                        className="text-slate-400 hover:text-red-600 transition-colors p-1 text-xs cursor-pointer"
                                        title="ลบหมวดหมู่"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 2. Courses */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col h-full space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">🎓</span>
                            <h2 className="text-xs font-semibold text-slate-900">หลักสูตร (คิว & ผังที่นั่ง)</h2>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">ทั้งหมด {courses.length} รายการ</span>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleAddItem('course', {
                                name: newCourse.name.trim(),
                                shortName: newCourse.shortName.trim(),
                                color: newCourse.color || '#3B82F6'
                            });
                        }}
                        className="space-y-2"
                    >
                        <div className="grid grid-cols-5 gap-2">
                            <input
                                type="text"
                                value={newCourse.name}
                                onChange={e => setNewCourse({ ...newCourse, name: e.target.value })}
                                placeholder="ชื่อหลักสูตร"
                                className="col-span-3 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-[#166E7C] placeholder:text-slate-400"
                            />
                            <input
                                type="text"
                                value={newCourse.shortName}
                                onChange={e => setNewCourse({ ...newCourse, shortName: e.target.value })}
                                placeholder="ตัวย่อ"
                                className="col-span-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-[#166E7C] placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-[11px] text-slate-600">
                                <span>สีหลักสูตร:</span>
                                <input
                                    type="color"
                                    value={newCourse.color}
                                    onChange={e => setNewCourse({ ...newCourse, color: e.target.value })}
                                    className="w-5 h-5 p-0 border-0 rounded cursor-pointer bg-transparent"
                                    title="เลือกสีหลักสูตร"
                                />
                            </div>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2 bg-[#166E7C] hover:bg-[#0F5661] text-white text-xs font-semibold rounded-lg transition-all active:scale-95 cursor-pointer"
                            >
                                + เพิ่มหลักสูตร
                            </button>
                        </div>
                    </form>

                    <div className="flex-1 overflow-y-auto max-h-[360px] border border-slate-100 rounded-lg divide-y divide-slate-100">
                        {courses.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">ยังไม่มีหลักสูตร</div>
                        ) : (
                            courses.map((course, index) => (
                                <div
                                    key={course.id}
                                    className="p-2.5 bg-white hover:bg-slate-50 transition-colors"
                                >
                                    {editingCourse?.id === course.id ? (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-5 gap-2">
                                                <input
                                                    type="text"
                                                    value={editingCourse.name}
                                                    onChange={e => setEditingCourse({ ...editingCourse, name: e.target.value })}
                                                    className="col-span-3 px-2 py-1.5 border border-slate-300 rounded text-xs"
                                                />
                                                <input
                                                    type="text"
                                                    value={editingCourse.shortName}
                                                    onChange={e => setEditingCourse({ ...editingCourse, shortName: e.target.value })}
                                                    className="col-span-2 px-2 py-1.5 border border-slate-300 rounded text-xs"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[11px] text-slate-500">สี:</span>
                                                    <input
                                                        type="color"
                                                        value={editingCourse.color || '#3B82F6'}
                                                        onChange={e => setEditingCourse({ ...editingCourse, color: e.target.value })}
                                                        className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                                                    />
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={() => setEditingCourse(null)}
                                                        className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50"
                                                    >
                                                        ยกเลิก
                                                    </button>
                                                    <button
                                                        onClick={handleUpdateCourse}
                                                        className="px-3 py-1.5 bg-[#166E7C] hover:bg-[#0F5661] text-white rounded-lg text-xs font-semibold shadow-xs"
                                                    >
                                                        บันทึก
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: course.color || '#3B82F6' }}
                                                />
                                                <div className="min-w-0">
                                                    <span className="text-xs text-slate-900 font-medium truncate block">
                                                        {course.name}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1 rounded border border-slate-200">
                                                        {course.shortName}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button
                                                    onClick={() => handleMoveCourse(course.id, 'up')}
                                                    disabled={index === 0}
                                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs"
                                                    title="เลื่อนขึ้น"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    onClick={() => handleMoveCourse(course.id, 'down')}
                                                    disabled={index === courses.length - 1}
                                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs"
                                                    title="เลื่อนลง"
                                                >
                                                    ▼
                                                </button>
                                                <button
                                                    onClick={() => setEditingCourse({ ...course })}
                                                    className="p-1 text-slate-400 hover:text-blue-600 text-xs"
                                                    title="แก้ไข"
                                                >
                                                    ✎
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteItem('course', course.id)}
                                                    className="p-1 text-slate-400 hover:text-red-600 text-xs"
                                                    title="ลบ"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 3. Time Slots */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col h-full space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">⏰</span>
                            <h2 className="text-xs font-semibold text-slate-900">ช่วงเวลา (คิว)</h2>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">ทั้งหมด {timeSlots.length} รายการ</span>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleAddItem('timeSlot', { name: newTimeSlot });
                        }}
                        className="flex gap-2"
                    >
                        <input
                            type="time"
                            value={newTimeSlot}
                            onChange={e => setNewTimeSlot(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-[#166E7C] font-mono"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 bg-[#166E7C] hover:bg-[#0F5661] text-white text-xs font-semibold rounded-lg transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                        >
                            + เพิ่ม
                        </button>
                    </form>


                    <div className="flex-1 overflow-y-auto max-h-[360px] border border-slate-100 rounded-lg divide-y divide-slate-100">
                        {timeSlots.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">ยังไม่มีช่วงเวลา</div>
                        ) : (
                            timeSlots.map(ts => (
                                <div
                                    key={ts.id}
                                    className="p-2.5 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors"
                                >
                                    <span className="text-xs text-slate-800 font-mono font-medium">{ts.name} น.</span>
                                    <button
                                        onClick={() => handleDeleteItem('timeSlot', ts.id)}
                                        className="text-slate-400 hover:text-red-600 transition-colors p-1 text-xs"
                                        title="ลบช่วงเวลา"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}