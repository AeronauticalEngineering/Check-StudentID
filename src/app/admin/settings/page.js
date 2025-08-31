'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp, getDoc, setDoc, updateDoc, query, orderBy } from 'firebase/firestore';

// ToggleSwitch Component
const ToggleSwitch = ({ label, enabled, onChange }) => (
    <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border cursor-pointer">
        <span className="text-gray-700 font-medium">{label}</span>
        <div className="relative">
            <input type="checkbox" className="sr-only" checked={enabled} onChange={onChange} />
            <div className={`block w-14 h-8 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-gray-300'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full shadow-md transition-transform ${enabled ? 'transform translate-x-6' : ''}`}></div>
        </div>
    </label>
);

export default function SettingsPage() {
    const [categories, setCategories] = useState([]);
    const [courses, setCourses] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [newCourse, setNewCourse] = useState({ name: '', shortName: '' });
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
        const unsubCourses = onSnapshot(query(collection(db, 'courseOptions'), orderBy('name')), (snapshot) => {
            setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
        await addDoc(collection(db, collectionNameMap[type]), { ...value, createdAt: serverTimestamp() });
        if (type === 'category') setNewCategory('');
        if (type === 'course') setNewCourse({ name: '', shortName: '' });
        if (type === 'timeSlot') setNewTimeSlot('');
    };

    const handleUpdateCourse = async () => {
        if (!editingCourse || !editingCourse.name || !editingCourse.shortName) return;
        const courseRef = doc(db, 'courseOptions', editingCourse.id);
        await updateDoc(courseRef, {
            name: editingCourse.name,
            shortName: editingCourse.shortName,
        });
        setEditingCourse(null);
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
        <div className="bg-gray-100 min-h-screen">
            <main className="container mx-auto p-4 md:p-8 font-sans">
                <h1 className="text-3xl font-bold mb-6 text-gray-800">ตั้งค่าระบบ</h1>
                {message && <p className="text-center mb-4 font-semibold text-blue-700">{message}</p>}

                {/* --- ส่วนที่แก้ไข: จัด Layout ใหม่ --- */}
                <div className="space-y-8">
                    {/* Notification Settings */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4 text-gray-700">การแจ้งเตือน LINE</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <ToggleSwitch label="แจ้งเตือนเมื่อเช็คอิน" enabled={notificationSettings.onCheckIn} onChange={(e) => handleSettingChange('onCheckIn', e.target.checked)} />
                            <ToggleSwitch label="แจ้งเตือนเมื่อจบกิจกรรม" enabled={notificationSettings.onCheckOut} onChange={(e) => handleSettingChange('onCheckOut', e.target.checked)} />
                            <ToggleSwitch label="แจ้งเตือนเมื่อเรียกคิว" enabled={notificationSettings.onQueueCall} onChange={(e) => handleSettingChange('onQueueCall', e.target.checked)} />
                        </div>
                    </div>

                    {/* Other Settings in 3 columns */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Categories */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-4 text-gray-700">หมวดหมู่กิจกรรม</h2>
                            <form onSubmit={(e) => { e.preventDefault(); handleAddItem('category', { name: newCategory }); }} className="flex gap-2 mb-4">
                                <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="เพิ่มหมวดหมู่ใหม่" className="p-2 border rounded flex-grow" />
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">เพิ่ม</button>
                            </form>
                            <ul className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                                {categories.map(cat => (
                                    <li key={cat.id} className="p-2 border-b last:border-b-0 flex justify-between items-center">
                                        <span>{cat.name}</span>
                                        <button onClick={() => handleDeleteItem('category', cat.id)} className="text-red-500 hover:text-red-700 text-sm">ลบ</button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Courses for Queue */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-4 text-gray-700">หลักสูตร (สำหรับกิจกรรมคิว)</h2>
                            <form onSubmit={(e) => { e.preventDefault(); handleAddItem('course', newCourse); }} className="flex gap-2 mb-4">
                                <input type="text" value={newCourse.name} onChange={e => setNewCourse({...newCourse, name: e.target.value})} placeholder="ชื่อหลักสูตร" className="p-2 border rounded w-1/2" />
                                <input type="text" value={newCourse.shortName} onChange={e => setNewCourse({...newCourse, shortName: e.target.value})} placeholder="ตัวย่อ" className="p-2 border rounded w-1/4" />
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-grow">เพิ่ม</button>
                            </form>
                            <ul className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                                {courses.map(course => (
                                    <li key={course.id} className="p-2 border-b last:border-b-0 flex justify-between items-center gap-2">
                                        {editingCourse?.id === course.id ? (
                                            <>
                                                <input type="text" value={editingCourse.name} onChange={e => setEditingCourse({...editingCourse, name: e.target.value})} className="p-1 border rounded w-1/2" />
                                                <input type="text" value={editingCourse.shortName} onChange={e => setEditingCourse({...editingCourse, shortName: e.target.value})} className="p-1 border rounded w-1/4" />
                                                <button onClick={handleUpdateCourse} className="text-green-500 text-sm">บันทึก</button>
                                                <button onClick={() => setEditingCourse(null)} className="text-gray-500 text-sm">ยกเลิก</button>
                                            </>
                                        ) : (
                                            <>
                                                <span>{course.name} ({course.shortName})</span>
                                                <div>
                                                    <button onClick={() => setEditingCourse({...course})} className="text-blue-500 hover:text-blue-700 text-sm mr-2">แก้ไข</button>
                                                    <button onClick={() => handleDeleteItem('course', course.id)} className="text-red-500 hover:text-red-700 text-sm">ลบ</button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Time Slots */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-4 text-gray-700">ช่วงเวลา (สำหรับกิจกรรมคิว)</h2>
                            <form onSubmit={(e) => { e.preventDefault(); handleAddItem('timeSlot', { name: newTimeSlot }); }} className="flex gap-2 mb-4">
                                <input type="time" value={newTimeSlot} onChange={e => setNewTimeSlot(e.target.value)} className="p-2 border rounded flex-grow" />
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">เพิ่ม</button>
                            </form>
                            <ul className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                                {timeSlots.map(ts => (
                                    <li key={ts.id} className="p-2 border-b last:border-b-0 flex justify-between items-center">
                                        <span>{ts.name}</span>
                                        <button onClick={() => handleDeleteItem('timeSlot', ts.id)} className="text-red-500 hover:text-red-700 text-sm">ลบ</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}