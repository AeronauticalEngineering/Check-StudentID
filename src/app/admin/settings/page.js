'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp, setDoc, updateDoc, query, orderBy } from 'firebase/firestore';

// Modern ToggleSwitch Component
const ToggleSwitch = ({ label, enabled, onChange }) => (
    <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
        <span className="text-gray-700 font-medium">{label}</span>
        <div className="relative">
            <input type="checkbox" className="sr-only" checked={enabled} onChange={onChange} />
            <div className={`block w-14 h-8 rounded-full transition-colors duration-300 ease-in-out ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full shadow-md transition-transform duration-300 ease-in-out ${enabled ? 'transform translate-x-6' : ''}`}></div>
        </div>
    </label>
);

export default function SettingsPage() {
    const [categories, setCategories] = useState([]);
    const [courses, setCourses] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [newCourse, setNewCourse] = useState({ name: '', shortName: '', color: '#3B82F6' });
    const [newTimeSlot, setNewTimeSlot] = useState('');
    const [message, setMessage] = useState('');
    const [editingCourse, setEditingCourse] = useState(null);

    const [notificationSettings, setNotificationSettings] = useState({
        onCheckIn: true,
        onCheckOut: true,
        onQueueCall: true,
    });

    useEffect(() => {
        const unsubCategories = onSnapshot(query(collection(db, 'categories'), orderBy('name')), (snapshot) => {
            setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Query by name only, then sort by priority in memory (to support old data without priority field)
        const unsubCourses = onSnapshot(query(collection(db, 'courseOptions'), orderBy('name')), (snapshot) => {
            const coursesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by priority first (if exists), then by name
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
            setTimeout(() => setMessage(''), 2000);
        } catch (error) {
            setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
        }
    };

    const handleAddItem = async (type, value) => {
        if (!value.name || (type === 'course' && !value.shortName)) {
            alert('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }
        const collectionNameMap = {
            category: 'categories',
            course: 'courseOptions',
            timeSlot: 'timeSlotOptions'
        };

        // Auto-assign priority for new courses
        const dataToAdd = { ...value, createdAt: serverTimestamp() };
        if (type === 'course') {
            dataToAdd.priority = courses.length; // Assign next priority
        }

        await addDoc(collection(db, collectionNameMap[type]), dataToAdd);
        if (type === 'category') setNewCategory('');
        if (type === 'course') setNewCourse({ name: '', shortName: '', color: '#3B82F6' });
        if (type === 'timeSlot') setNewTimeSlot('');
    };

    const handleUpdateCourse = async () => {
        if (!editingCourse || !editingCourse.name || !editingCourse.shortName) return;
        const courseRef = doc(db, 'courseOptions', editingCourse.id);
        await updateDoc(courseRef, {
            name: editingCourse.name,
            shortName: editingCourse.shortName,
            color: editingCourse.color || '#3B82F6',
            priority: editingCourse.priority !== undefined ? editingCourse.priority : 0
        });
        setEditingCourse(null);
    };

    const handleMoveCourse = async (courseId, direction) => {
        const currentIndex = courses.findIndex(c => c.id === courseId);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= courses.length) return;

        const currentCourse = courses[currentIndex];
        const targetCourse = courses[targetIndex];

        // Swap priorities
        await updateDoc(doc(db, 'courseOptions', currentCourse.id), { priority: targetIndex });
        await updateDoc(doc(db, 'courseOptions', targetCourse.id), { priority: currentIndex });
    };

    const handleDeleteItem = async (type, id) => {
        if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) {
            const collectionNameMap = {
                category: 'categories',
                course: 'courseOptions',
                timeSlot: 'timeSlotOptions'
            };
            await deleteDoc(doc(db, collectionNameMap[type], id));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">ตั้งค่าระบบ</h1>
                    <p className="text-gray-500 mt-1">จัดการการแจ้งเตือนและข้อมูลพื้นฐานของระบบ</p>
                </header>

                {message && (
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-fade-in ${message.includes('✅') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        <span className="text-xl">{message.includes('✅') ? '🎉' : '⚠️'}</span>
                        <p className="font-medium">{message.replace('✅ ', '').replace('❌ ', '')}</p>
                    </div>
                )}

                <div className="space-y-8">
                    {/* Notification Settings */}
                    <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-green-100 rounded-lg text-green-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            </div>
                            <h2 className="text-xl font-bold text-gray-800">การแจ้งเตือน LINE</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <ToggleSwitch label="แจ้งเตือนเมื่อเช็คอิน" enabled={notificationSettings.onCheckIn} onChange={(e) => handleSettingChange('onCheckIn', e.target.checked)} />
                            <ToggleSwitch label="แจ้งเตือนเมื่อจบกิจกรรม" enabled={notificationSettings.onCheckOut} onChange={(e) => handleSettingChange('onCheckOut', e.target.checked)} />
                            <ToggleSwitch label="แจ้งเตือนเมื่อเรียกคิว" enabled={notificationSettings.onQueueCall} onChange={(e) => handleSettingChange('onQueueCall', e.target.checked)} />
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Categories */}
                        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                </div>
                                <h2 className="text-lg font-bold text-gray-800">หมวดหมู่กิจกรรม</h2>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); handleAddItem('category', { name: newCategory }); }} className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    placeholder="เพิ่มหมวดหมู่ใหม่..."
                                    className="flex-grow px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">เพิ่ม</button>
                            </form>
                            <div className="flex-grow overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                                <ul className="space-y-2">
                                    {categories.map(cat => (
                                        <li key={cat.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center group hover:bg-blue-50 transition-colors">
                                            <span className="font-medium text-gray-700">{cat.name}</span>
                                            <button onClick={() => handleDeleteItem('category', cat.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        {/* Courses */}
                        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                </div>
                                <h2 className="text-lg font-bold text-gray-800">หลักสูตร (คิว)</h2>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); handleAddItem('course', newCourse); }} className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newCourse.name}
                                    onChange={e => setNewCourse({ ...newCourse, name: e.target.value })}
                                    placeholder="ชื่อหลักสูตร"
                                    className="w-1/3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm"
                                />
                                <input
                                    type="text"
                                    value={newCourse.shortName}
                                    onChange={e => setNewCourse({ ...newCourse, shortName: e.target.value })}
                                    placeholder="ตัวย่อ"
                                    className="w-1/4 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm"
                                />
                                <input
                                    type="color"
                                    value={newCourse.color}
                                    onChange={e => setNewCourse({ ...newCourse, color: e.target.value })}
                                    className="w-12 h-10 p-1 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer"
                                    title="เลือกสี"
                                />
                                <button type="submit" className="flex-grow px-3 py-2 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/20 text-sm">เพิ่ม</button>
                            </form>
                            <div className="flex-grow overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                                <ul className="space-y-2">
                                    {courses.map((course, index) => (
                                        <li key={course.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center group hover:bg-purple-50 transition-colors">
                                            {editingCourse?.id === course.id ? (
                                                <div className="flex gap-2 w-full items-center">
                                                    <input type="text" value={editingCourse.name} onChange={e => setEditingCourse({ ...editingCourse, name: e.target.value })} className="p-1 border rounded w-1/3 text-sm" />
                                                    <input type="text" value={editingCourse.shortName} onChange={e => setEditingCourse({ ...editingCourse, shortName: e.target.value })} className="p-1 border rounded w-1/4 text-sm" />
                                                    <input type="color" value={editingCourse.color || '#3B82F6'} onChange={e => setEditingCourse({ ...editingCourse, color: e.target.value })} className="w-8 h-8 p-0.5 border rounded cursor-pointer" />
                                                    <button onClick={handleUpdateCourse} className="text-green-600 hover:text-green-700"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                                                    <button onClick={() => setEditingCourse(null)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: course.color || '#3B82F6' }}></div>
                                                            <span className="font-medium text-gray-800 text-sm">{course.name}</span>
                                                        </div>
                                                        <span className="text-xs text-gray-500 font-mono bg-white px-1.5 py-0.5 rounded border self-start mt-1 ml-5">{course.shortName}</span>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleMoveCourse(course.id, 'up')} disabled={index === 0} className="text-gray-400 hover:text-blue-600 p-1 disabled:opacity-30 disabled:cursor-not-allowed" title="ย้ายขึ้น"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
                                                        <button onClick={() => handleMoveCourse(course.id, 'down')} disabled={index === courses.length - 1} className="text-gray-400 hover:text-blue-600 p-1 disabled:opacity-30 disabled:cursor-not-allowed" title="ย้ายลง"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                                                        <button onClick={() => setEditingCourse({ ...course })} className="text-gray-400 hover:text-blue-600 p-1" title="แก้ไข"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                        <button onClick={() => handleDeleteItem('course', course.id)} className="text-gray-400 hover:text-red-600 p-1" title="ลบ"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                                    </div>
                                                </>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        {/* Time Slots */}
                        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h2 className="text-lg font-bold text-gray-800">ช่วงเวลา (คิว)</h2>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); handleAddItem('timeSlot', { name: newTimeSlot }); }} className="flex gap-2 mb-4">
                                <input
                                    type="time"
                                    value={newTimeSlot}
                                    onChange={e => setNewTimeSlot(e.target.value)}
                                    className="flex-grow px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                />
                                <button type="submit" className="px-4 py-2 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20">เพิ่ม</button>
                            </form>
                            <div className="flex-grow overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                                <ul className="space-y-2">
                                    {timeSlots.map(ts => (
                                        <li key={ts.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center group hover:bg-orange-50 transition-colors">
                                            <span className="font-medium text-gray-700 font-mono">{ts.name}</span>
                                            <button onClick={() => handleDeleteItem('timeSlot', ts.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}