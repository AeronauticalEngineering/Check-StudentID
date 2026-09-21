'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/firebase';
import { collection, doc, updateDoc, deleteDoc, getDocs, query, orderBy, writeBatch } from 'firebase/firestore';
import Papa from 'papaparse';
import { upsertStudentProfile, resetStudentLineBinding, deleteStudentProfile, checkDuplicateNationalId } from '../../../lib/studentService';
import { useModal } from '../../../context/ModalContext';

const getThaiStatus = (status) => {
  switch (status) {
    case 'checked-in':
      return { label: 'เช็คอินแล้ว', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'completed':
      return { label: 'จบกิจกรรมแล้ว', className: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'cancelled':
      return { label: 'ยกเลิกแล้ว', className: 'bg-red-50 text-red-700 border-red-200' };
    case 'calling':
      return { label: 'กำลังเรียก', className: 'bg-amber-50 text-amber-700 border-amber-300 font-semibold animate-pulse' };
    case 'called':
      return { label: 'เรียกคิวแล้ว', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'interviewing':
    case 'serving':
      return { label: 'สอบสัมภาษณ์', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'waitlisted':
      return { label: 'รอคิว', className: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'absent':
      return { label: 'ไม่มารายงานตัว', className: 'bg-red-50 text-red-700 border-red-200' };
    case 'registered':
    default: {
      const lower = String(status || '').toLowerCase();
      if (lower.includes('call')) return { label: 'กำลังเรียก', className: 'bg-amber-50 text-amber-700 border-amber-300 font-semibold animate-pulse' };
      if (lower.includes('interview')) return { label: 'สอบสัมภาษณ์', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      return { label: 'ลงทะเบียนแล้ว', className: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  }
};

export default function AllRegistrantsPage() {
  const { showAlert, showConfirm, showToast } = useModal();
  
  // Master View Mode: 'registrations' (การลงทะเบียนกิจกรรม) | 'profiles' (โปรไฟล์นักเรียนทั้งหมด)
  const [viewMode, setViewMode] = useState('registrations');
  
  const [activitiesMap, setActivitiesMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLineStatus, setFilterLineStatus] = useState('all'); // all, linked, unlinked, (noRegs for profiles)
  const [editStates, setEditStates] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  // Data States
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  
  // Multi-Selection State for Bulk Actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const headerCheckboxRef = useRef(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Fetch all base data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [activitiesSnap, registrationsSnap, profilesSnap] = await Promise.all([
        getDocs(collection(db, 'activities')),
        getDocs(query(collection(db, 'registrations'), orderBy('registeredAt', 'desc'))),
        getDocs(collection(db, 'studentProfiles'))
      ]);

      const actMap = {};
      activitiesSnap.forEach(d => { actMap[d.id] = d.data().name; });
      setActivitiesMap(actMap);

      const regList = registrationsSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        registeredAtDate: d.data().registeredAt ? d.data().registeredAt.toDate() : null
      }));
      setAllRegistrations(regList);

      const profileList = profilesSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAtDate: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : null,
        updatedAtDate: d.data().updatedAt?.toDate ? d.data().updatedAt.toDate() : null
      }));
      // เรียงลำดับโปรไฟล์ตามเวลาล่าสุด
      profileList.sort((a, b) => (b.updatedAtDate || b.createdAtDate || 0) - (a.updatedAtDate || a.createdAtDate || 0));
      setAllProfiles(profileList);

      // เตรียม Initial Edits
      const initialEdits = {};
      regList.forEach(r => {
        initialEdits[r.id] = {
          fullName: r.fullName || '',
          studentId: r.studentId || '',
          nationalId: r.nationalId || '',
          lineUserId: r.lineUserId || '',
        };
      });
      profileList.forEach(p => {
        initialEdits[p.id] = {
          fullName: p.fullName || '',
          studentId: p.studentId || '',
          nationalId: p.nationalId || '',
          lineUserId: p.lineUserId || '',
        };
      });
      setEditStates(initialEdits);

    } catch (error) {
      console.error(error);
      setMessage(`❌ ไม่สามารถโหลดข้อมูลได้: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // เมื่อสลับแท็บ ให้เคลียร์การเลือก
  const handleSwitchViewMode = (newMode) => {
    if (newMode === viewMode) return;
    setViewMode(newMode);
    setFilterLineStatus('all');
    setSelectedIds([]);
    setEditingId(null);
  };

  // นับจำนวนกิจกรรมที่แต่ละคนลงทะเบียน (Map by nationalId)
  const regCountByNatId = useMemo(() => {
    const map = {};
    allRegistrations.forEach(r => {
      const nat = r.nationalId?.trim();
      if (nat) {
        map[nat] = (map[nat] || 0) + 1;
      }
    });
    return map;
  }, [allRegistrations]);

  // ตรวจจับเลขบัตรประชาชนที่ซ้ำซ้อนในตารางโปรไฟล์
  const duplicateProfileNatIds = useMemo(() => {
    const natCounts = {};
    allProfiles.forEach(p => {
      const nat = p.nationalId?.trim();
      if (nat) {
        natCounts[nat] = (natCounts[nat] || 0) + 1;
      }
    });
    const duplicates = new Set();
    Object.entries(natCounts).forEach(([nat, count]) => {
      if (count > 1) duplicates.add(nat);
    });
    return duplicates;
  }, [allProfiles]);

  // Summary Counts for Registrations View
  const regCounts = useMemo(() => {
    let linked = 0;
    let unlinked = 0;
    allRegistrations.forEach(r => {
      if (r.lineUserId) linked++;
      else unlinked++;
    });
    return {
      total: allRegistrations.length,
      linked,
      unlinked
    };
  }, [allRegistrations]);

  // Summary Counts for Profiles View
  const profileCounts = useMemo(() => {
    let linked = 0;
    let unlinked = 0;
    let noRegs = 0;
    allProfiles.forEach(p => {
      if (p.lineUserId) linked++;
      else unlinked++;

      const count = regCountByNatId[p.nationalId?.trim()] || 0;
      if (count === 0) noRegs++;
    });
    return {
      total: allProfiles.length,
      linked,
      unlinked,
      noRegs
    };
  }, [allProfiles, regCountByNatId]);

  // Filtered registrations
  const filteredRegistrations = useMemo(() => {
    return allRegistrations.filter(r => {
      if (filterLineStatus === 'linked' && !r.lineUserId) return false;
      if (filterLineStatus === 'unlinked' && r.lineUserId) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const nat = (r.nationalId || '').toLowerCase();
        const name = (r.fullName || '').toLowerCase();
        const stdId = (r.studentId || '').toLowerCase();
        const actName = (activitiesMap[r.activityId] || '').toLowerCase();

        return nat.includes(term) || name.includes(term) || stdId.includes(term) || actName.includes(term);
      }

      return true;
    });
  }, [allRegistrations, filterLineStatus, searchTerm, activitiesMap]);

  // Filtered student profiles
  const filteredProfiles = useMemo(() => {
    return allProfiles.filter(p => {
      if (filterLineStatus === 'linked' && !p.lineUserId) return false;
      if (filterLineStatus === 'unlinked' && p.lineUserId) return false;
      if (filterLineStatus === 'noRegs' && (regCountByNatId[p.nationalId?.trim()] || 0) > 0) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const nat = (p.nationalId || '').toLowerCase();
        const name = (p.fullName || '').toLowerCase();
        const stdId = (p.studentId || '').toLowerCase();
        const lineName = (p.lineDisplayName || '').toLowerCase();

        return nat.includes(term) || name.includes(term) || stdId.includes(term) || lineName.includes(term);
      }

      return true;
    });
  }, [allProfiles, filterLineStatus, searchTerm, regCountByNatId]);

  // Active items based on viewMode
  const activeItems = viewMode === 'registrations' ? filteredRegistrations : filteredProfiles;

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [viewMode, filterLineStatus, searchTerm, pageSize]);

  const totalPages = Math.max(1, Math.ceil(activeItems.length / pageSize));
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activeItems.slice(start, start + pageSize);
  }, [activeItems, currentPage, pageSize]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  // Multi-Selection Logic
  const isAllCurrentPageSelected = useMemo(() => {
    if (currentItems.length === 0) return false;
    return currentItems.every(item => selectedIds.includes(item.id));
  }, [currentItems, selectedIds]);

  const isSomeCurrentPageSelected = useMemo(() => {
    if (currentItems.length === 0) return false;
    return currentItems.some(item => selectedIds.includes(item.id)) && !isAllCurrentPageSelected;
  }, [currentItems, selectedIds, isAllCurrentPageSelected]);

  // Set indeterminate state on header checkbox
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeCurrentPageSelected;
    }
  }, [isSomeCurrentPageSelected]);

  const handleToggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllPage = () => {
    if (isAllCurrentPageSelected) {
      const currentPageIds = new Set(currentItems.map(item => item.id));
      setSelectedIds(prev => prev.filter(id => !currentPageIds.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...currentItems.map(item => item.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(activeItems.map(item => item.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Bulk Delete Handler
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const count = selectedIds.length;
    const label = viewMode === 'registrations' ? 'รายการลงทะเบียนกิจกรรม' : 'โปรไฟล์นักเรียน';

    const confirmed = await showConfirm({
      title: `ยืนยันการลบ ${count.toLocaleString()} รายการ`,
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบ${label}ที่เลือกไว้ทั้งหมดจำนวน ${count.toLocaleString()} รายการ?\n\n⚠️ คำเตือน: ข้อมูลที่ถูกลบจะไม่สามารถกู้คืนได้`,
      type: 'danger',
      confirmText: `ลบ ${count.toLocaleString()} รายการ`,
      cancelText: 'ยกเลิก'
    });

    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      if (viewMode === 'registrations') {
        // Batch delete registrations (Firestore batch limit is 500)
        const CHUNK_SIZE = 450;
        for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
          const chunk = selectedIds.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(id => {
            batch.delete(doc(db, 'registrations', id));
          });
          await batch.commit();
        }
        showToast({ message: `ลบข้อมูลการลงทะเบียนจำนวน ${count.toLocaleString()} รายการเรียบร้อยแล้ว`, type: 'success' });
      } else {
        // Delete student profiles
        const selectedProfilesMap = new Map(allProfiles.map(p => [p.id, p]));
        for (const id of selectedIds) {
          const p = selectedProfilesMap.get(id);
          if (p) {
            await deleteStudentProfile(p.nationalId, p.lineUserId || p.id);
          } else {
            await deleteDoc(doc(db, 'studentProfiles', id));
          }
        }
        showToast({ message: `ลบโปรไฟล์นักเรียนจำนวน ${count.toLocaleString()} รายการเรียบร้อยแล้ว`, type: 'success' });
      }

      setSelectedIds([]);
      await fetchData();
    } catch (error) {
      console.error('Bulk delete error:', error);
      showAlert({ title: 'เกิดข้อผิดพลาดในการลบหลายรายการ', message: error.message, type: 'error' });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleInputChange = (id, field, value) => {
    setEditStates(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  // Update Activity Registration item
  const handleUpdateRegistrant = async (registrantId) => {
    const dataToUpdate = editStates[registrantId];
    const trimmedNat = dataToUpdate.nationalId.trim();
    const trimmedName = dataToUpdate.fullName.trim();
    const trimmedStd = dataToUpdate.studentId.trim() || null;

    if (!trimmedName) {
      showAlert({ title: 'ข้อมูลไม่ครบถ้วน', message: 'กรุณากรอกชื่อ-นามสกุล', type: 'warning' });
      return;
    }

    if (trimmedNat.length !== 13 || !/^\d{13}$/.test(trimmedNat)) {
      showAlert({ title: 'ข้อมูลไม่ถูกต้อง', message: 'เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก', type: 'warning' });
      return;
    }

    try {
      // ตรวจสอบเลขบัตรประชาชนซ้ำซ้อน
      const isDuplicate = await checkDuplicateNationalId(trimmedNat, dataToUpdate.lineUserId || registrantId);
      if (isDuplicate) {
        showAlert({
          title: 'เลขบัตรประชาชนซ้ำซ้อน',
          message: `เลขประจำตัวประชาชน ${trimmedNat} มีอยู่ในระบบแล้วและเป็นของผู้ใช้อื่น`,
          type: 'error'
        });
        return;
      }

      await updateDoc(doc(db, 'registrations', registrantId), {
        fullName: trimmedName,
        studentId: trimmedStd,
        nationalId: trimmedNat,
        lineUserId: dataToUpdate.lineUserId || null
      });

      if (trimmedNat) {
        await upsertStudentProfile({
          nationalId: trimmedNat,
          fullName: trimmedName,
          studentId: trimmedStd,
          lineUserId: dataToUpdate.lineUserId || null,
          source: 'admin_edit'
        });
      }

      showToast({ message: 'อัปเดตข้อมูลการลงทะเบียนสำเร็จ', type: 'success' });
      setEditingId(null);
      fetchData();
    } catch (error) {
      showAlert({ title: 'เกิดข้อผิดพลาด', message: error.message, type: 'error' });
    }
  };

  // Update Student Profile item
  const handleUpdateProfile = async (profileId) => {
    const dataToUpdate = editStates[profileId];
    const trimmedNat = dataToUpdate.nationalId.trim();
    const trimmedName = dataToUpdate.fullName.trim();
    const trimmedStd = dataToUpdate.studentId.trim() || null;

    if (!trimmedName) {
      showAlert({ title: 'ข้อมูลไม่ครบถ้วน', message: 'กรุณากรอกชื่อ-นามสกุล', type: 'warning' });
      return;
    }

    if (trimmedNat.length !== 13 || !/^\d{13}$/.test(trimmedNat)) {
      showAlert({ title: 'ข้อมูลไม่ถูกต้อง', message: 'เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก', type: 'warning' });
      return;
    }

    try {
      // ตรวจสอบความซ้ำซ้อน
      const isDuplicate = await checkDuplicateNationalId(trimmedNat, profileId);
      if (isDuplicate) {
        showAlert({
          title: 'เลขบัตรประชาชนซ้ำซ้อน',
          message: `เลขประจำตัวประชาชน ${trimmedNat} ซ้ำซ้อนกับผู้ใช้อื่นในระบบ`,
          type: 'error'
        });
        return;
      }

      await upsertStudentProfile({
        nationalId: trimmedNat,
        fullName: trimmedName,
        studentId: trimmedStd,
        lineUserId: dataToUpdate.lineUserId || (profileId.startsWith('U') ? profileId : null),
        source: 'admin_edit'
      });

      showToast({ message: 'อัปเดตโปรไฟล์นักเรียนสำเร็จ', type: 'success' });
      setEditingId(null);
      fetchData();
    } catch (error) {
      showAlert({ title: 'เกิดข้อผิดพลาด', message: error.message, type: 'error' });
    }
  };

  const handleDeleteRegistrant = async (registrantId) => {
    const confirmed = await showConfirm({
      title: 'ยืนยันการลบข้อมูล',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการลบรายการลงทะเบียนนี้?',
      type: 'danger',
      confirmText: 'ลบข้อมูล',
      cancelText: 'ยกเลิก'
    });

    if (confirmed) {
      try {
        await deleteDoc(doc(db, 'registrations', registrantId));
        showToast({ message: 'ลบข้อมูลการลงทะเบียนสำเร็จ', type: 'success' });
        fetchData();
      } catch (error) {
        showAlert({ title: 'เกิดข้อผิดพลาด', message: `ไม่สามารถลบข้อมูลได้: ${error.message}`, type: 'error' });
      }
    }
  };

  const handleDeleteProfile = async (profileId, nationalId, lineUserId) => {
    const confirmed = await showConfirm({
      title: 'ยืนยันลบโปรไฟล์นักเรียน',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบโปรไฟล์นักเรียนเลขบัตร ${nationalId || profileId} ออกจากระบบ?\n(ประวัติการผูก LINE จะถูกลบออก)`,
      type: 'danger',
      confirmText: 'ลบโปรไฟล์',
      cancelText: 'ยกเลิก'
    });

    if (confirmed) {
      try {
        await deleteStudentProfile(nationalId, lineUserId || profileId);
        showToast({ message: 'ลบโปรไฟล์นักเรียนสำเร็จ', type: 'success' });
        fetchData();
      } catch (error) {
        showAlert({ title: 'เกิดข้อผิดพลาด', message: `ไม่สามารถลบโปรไฟล์ได้: ${error.message}`, type: 'error' });
      }
    }
  };

  const handleResetLine = async (lineUserId, registrantId = null) => {
    if (!lineUserId) return;
    const confirmed = await showConfirm({
      title: 'ยืนยันรีเซตการผูกบัญชี LINE',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการ "รีเซตการผูกบัญชี LINE" สำหรับนักเรียนคนนี้?\n\n(นักเรียนจะสามารถกรอกข้อมูลและผูกบัญชี LINE ใหม่อีกครั้งได้)',
      type: 'warning',
      confirmText: 'รีเซต LINE',
      cancelText: 'ยกเลิก'
    });

    if (confirmed) {
      try {
        await resetStudentLineBinding(lineUserId, registrantId);
        showToast({ message: 'รีเซตการผูกบัญชี LINE สำเร็จ', type: 'success' });
        fetchData();
      } catch (error) {
        showAlert({ title: 'เกิดข้อผิดพลาด', message: `ไม่สามารถรีเซต LINE ได้: ${error.message}`, type: 'error' });
      }
    }
  };

  const handleCopyLineId = (lineId) => {
    if (!lineId) return;
    navigator.clipboard.writeText(lineId);
    showToast({ message: 'คัดลอก LINE User ID เรียบร้อยแล้ว', type: 'info' });
  };

  const handleExportCSV = async () => {
    try {
      let csvData = [];
      let filename = 'export.csv';

      if (viewMode === 'registrations') {
        csvData = filteredRegistrations.map((reg, index) => ({
          'ลำดับ': index + 1,
          'ชื่อ-สกุล': reg.fullName || '',
          'รหัสนักศึกษา': reg.studentId || '',
          'เลขบัตรประชาชน': reg.nationalId || '',
          'Line User ID': reg.lineUserId || '',
          'กิจกรรม': activitiesMap[reg.activityId] || 'Unknown',
          'สถานะ': getThaiStatus(reg.status).label,
          'วันที่ลงทะเบียน': reg.registeredAtDate ? reg.registeredAtDate.toLocaleString('th-TH') : ''
        }));
        filename = 'activity_registrations_export.csv';
      } else {
        csvData = filteredProfiles.map((p, index) => ({
          'ลำดับ': index + 1,
          'ชื่อ-สกุล': p.fullName || '',
          'รหัสนักศึกษา': p.studentId || '',
          'เลขบัตรประชาชน': p.nationalId || '',
          'Line User ID': p.lineUserId || '',
          'ชื่อใน LINE': p.lineDisplayName || '',
          'จำนวนกิจกรรมที่สมัคร': regCountByNatId[p.nationalId?.trim()] || 0,
          'แหล่งที่มา': p.source || 'user_setup',
          'วันที่สร้าง': p.createdAtDate ? p.createdAtDate.toLocaleString('th-TH') : '',
          'อัปเดตล่าสุด': p.updatedAtDate ? p.updatedAtDate.toLocaleString('th-TH') : ''
        }));
        filename = 'student_profiles_export.csv';
      }

      const csv = Papa.unparse(csvData, { quotes: true, delimiter: ',', header: true });
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    } catch (error) {
      showAlert({ title: 'เกิดข้อผิดพลาด', message: `Export CSV ไม่สำเร็จ: ${error.message}`, type: 'error' });
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-3 font-sans">
      {/* Master View Mode Switcher (แท็บหลักสลับมุมมอง) */}
      <div className="bg-white p-2 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSwitchViewMode('registrations')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'registrations'
                ? 'bg-[#000946] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>🎟️ การลงทะเบียนกิจกรรม</span>
            <span className={`px-1.5 py-0.5 rounded text-[11px] ${viewMode === 'registrations' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'}`}>
              {allRegistrations.length.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchViewMode('profiles')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'profiles'
                ? 'bg-[#000946] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>👤 โปรไฟล์นักเรียนทั้งหมด</span>
            <span className={`px-1.5 py-0.5 rounded text-[11px] ${viewMode === 'profiles' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'}`}>
              {allProfiles.length.toLocaleString()}
            </span>
          </button>
        </div>

        {duplicateProfileNatIds.size > 0 && (
          <div className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-medium flex items-center gap-1.5 animate-pulse">
            <span>⚠️</span>
            <span>พบเลขบัตร ปชช. ซ้ำซ้อน {duplicateProfileNatIds.size} รายการในฐานข้อมูล</span>
          </div>
        )}
      </div>

      {/* Sub-Control Bar: Filters, Search & Export */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {(viewMode === 'registrations' ? [
            { key: 'all', label: 'ทั้งหมด', count: regCounts.total },
            { key: 'linked', label: 'ผูก LINE แล้ว', count: regCounts.linked },
            { key: 'unlinked', label: 'ยังไม่ผูก LINE', count: regCounts.unlinked }
          ] : [
            { key: 'all', label: 'ทั้งหมด', count: profileCounts.total },
            { key: 'linked', label: 'ผูก LINE แล้ว', count: profileCounts.linked },
            { key: 'unlinked', label: 'ยังไม่ผูก LINE', count: profileCounts.unlinked },
            { key: 'noRegs', label: 'ยังไม่ลงกิจกรรม', count: profileCounts.noRegs }
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setFilterLineStatus(tab.key); setSelectedIds([]); }}
              className={`px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap flex items-center gap-1.5 border cursor-pointer ${
                filterLineStatus === tab.key
                  ? 'bg-slate-900 text-white border-slate-900 font-medium'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[11px] px-1 rounded ${filterLineStatus === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search, Refresh & Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder={viewMode === 'registrations' ? "ค้นหาชื่อ, รหัส นศ., บัตร ปชช., กิจกรรม..." : "ค้นหาชื่อ, รหัส นศ., บัตร ปชช., ชื่อ LINE..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-6 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-800 outline-none focus:border-slate-400 placeholder:text-slate-400"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => { setSelectedIds([]); fetchData(); }}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded border border-slate-200 flex items-center gap-1 whitespace-nowrap cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>รีเฟรช</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={activeItems.length === 0}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded border border-slate-200 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>CSV ({activeItems.length.toLocaleString()})</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Toolbar Bar (แสดงเมื่อมีการเลือกอย่างน้อย 1 รายการ) */}
      {selectedIds.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn shadow-xs">
          <div className="flex items-center gap-2 flex-wrap text-xs text-rose-950 font-medium">
            <span className="px-2 py-0.5 bg-rose-600 text-white rounded-md font-bold text-xs shadow-xs">
              เลือกอยู่ {selectedIds.length.toLocaleString()} รายการ
            </span>
            <span className="text-rose-800">
              (จาก {activeItems.length.toLocaleString()} รายการในผลการค้นหา)
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            <button
              type="button"
              onClick={handleToggleSelectAllPage}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs rounded border border-slate-200 transition-colors cursor-pointer"
            >
              {isAllCurrentPageSelected ? 'ยกเลิกหน้านี้' : `เลือกทั้งหน้านี้ (${currentItems.length})`}
            </button>

            {selectedIds.length < activeItems.length && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs rounded border border-slate-200 transition-colors cursor-pointer"
              >
                เลือกทั้งหมดที่ค้นพบ ({activeItems.length.toLocaleString()})
              </button>
            )}

            <button
              type="button"
              onClick={handleClearSelection}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 text-xs rounded border border-slate-200 transition-colors cursor-pointer"
            >
              ยกเลิกการเลือก
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:scale-98 text-white text-xs font-semibold rounded shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer ml-auto sm:ml-0"
            >
              {isBulkDeleting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>กำลังลบ...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>ลบที่เลือก ({selectedIds.length.toLocaleString()})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-2.5 rounded text-xs border ${message.includes('❌') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {message}
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {viewMode === 'registrations' ? (
            /* ========================================================================= */
            /* TABLE 1: Activity Registrations (การลงทะเบียนกิจกรรม)                       */
            /* ========================================================================= */
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center border-r border-slate-200 whitespace-nowrap">
                    <input
                      type="checkbox"
                      ref={headerCheckboxRef}
                      checked={isAllCurrentPageSelected}
                      onChange={handleToggleSelectAllPage}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                      title="เลือก/ยกเลิกทั้งหมดในหน้านี้"
                    />
                  </th>
                  <th className="px-3 py-2.5 w-12 text-center border-r border-slate-200 whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 min-w-[160px] border-r border-slate-200 whitespace-nowrap">ชื่อ-สกุล</th>
                  <th className="px-3 py-2.5 min-w-[120px] border-r border-slate-200 whitespace-nowrap">รหัสผู้สมัคร</th>
                  <th className="px-3 py-2.5 min-w-[150px] border-r border-slate-200 whitespace-nowrap">เลขบัตร ปชช.</th>
                  <th className="px-3 py-2.5 w-24 min-w-[90px] text-center border-r border-slate-200 whitespace-nowrap">LINE</th>
                  <th className="px-3 py-2.5 min-w-[160px] border-r border-slate-200 whitespace-nowrap">กิจกรรม</th>
                  <th className="px-3 py-2.5 min-w-[120px] text-center border-r border-slate-200 whitespace-nowrap">สถานะ</th>
                  <th className="px-3 py-2.5 w-28 min-w-[100px] text-center whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan="9" className="p-10 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>กำลังโหลดข้อมูลการลงทะเบียน...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-10 text-center text-slate-400">
                      ไม่พบข้อมูลการลงทะเบียนกิจกรรม
                    </td>
                  </tr>
                ) : (
                  currentItems.map((reg, index) => {
                    const isEditing = editingId === reg.id;
                    const isSelected = selectedIds.includes(reg.id);
                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                    const isDuplicate = duplicateProfileNatIds.has(reg.nationalId?.trim());

                    return (
                      <tr
                        key={reg.id}
                        className={`transition-colors ${
                          isEditing
                            ? 'bg-amber-50/50'
                            : isSelected
                            ? 'bg-indigo-50/40 hover:bg-indigo-50/60'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3 py-2 text-center border-r border-slate-100 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(reg.id)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                          />
                        </td>
                        <td className="px-3 py-2 text-center text-slate-400 border-r border-slate-100 bg-slate-50/40 whitespace-nowrap">
                          {rowNumber}
                        </td>
                        <td className="px-3 py-2 text-slate-900 font-medium border-r border-slate-100">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editStates[reg.id]?.fullName}
                              onChange={e => handleInputChange(reg.id, 'fullName', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white outline-none focus:border-slate-500"
                            />
                          ) : (
                            <Link
                              href={`/admin/registrants/${encodeURIComponent(reg.nationalId || reg.id)}`}
                              className="text-left text-slate-900 hover:text-indigo-600 font-semibold transition-colors flex items-center gap-1.5 group"
                              title="คลิกเพื่อเปิดหน้าประวัติการลงทะเบียนของนักเรียนคนนี้"
                            >
                              <span>{reg.fullName}</span>
                              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-500 transition-opacity">
                                ↗
                              </span>
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 border-r border-slate-100 whitespace-nowrap font-mono">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editStates[reg.id]?.studentId}
                              onChange={e => handleInputChange(reg.id, 'studentId', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white outline-none focus:border-slate-500 font-mono"
                            />
                          ) : (
                            reg.studentId || '-'
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 border-r border-slate-100 whitespace-nowrap font-mono">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editStates[reg.id]?.nationalId}
                              onChange={e => handleInputChange(reg.id, 'nationalId', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white outline-none focus:border-slate-500 font-mono"
                              maxLength={13}
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span>{reg.nationalId || '-'}</span>
                              {isDuplicate && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-100 text-rose-700 font-bold border border-rose-300" title="เลขบัตร ปชช. นี้ซ้ำซ้อนในระบบ">
                                  ซ้ำ
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center border-r border-slate-100 whitespace-nowrap">
                          {reg.lineUserId ? (
                            <button
                              onClick={() => handleCopyLineId(reg.lineUserId)}
                              title="คลิกเพื่อคัดลอก LINE User ID"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap font-medium cursor-pointer"
                            >
                              <span>ผูกแล้ว</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-400 border border-slate-200 whitespace-nowrap">
                              ยังไม่ผูก
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 border-r border-slate-100">
                          <span className="truncate block max-w-[220px]" title={activitiesMap[reg.activityId]}>
                            {activitiesMap[reg.activityId] || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center border-r border-slate-100 whitespace-nowrap">
                          {(() => {
                            const statusObj = getThaiStatus(reg.status);
                            return (
                              <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap border ${statusObj.className}`}>
                                {statusObj.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleUpdateRegistrant(reg.id)}
                                className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs cursor-pointer"
                                title="บันทึก"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-xs cursor-pointer"
                                title="ยกเลิก"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              {reg.lineUserId && (
                                <button
                                  onClick={() => handleResetLine(reg.lineUserId, reg.id)}
                                  className="p-1 text-amber-600 hover:bg-amber-50 rounded border border-transparent hover:border-amber-200 cursor-pointer"
                                  title="รีเซตการผูกบัญชี LINE"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                                  </svg>
                                </button>
                              )}
                              <Link
                                href={`/admin/registrants/${encodeURIComponent(reg.nationalId || reg.id)}`}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded border border-transparent hover:border-indigo-200"
                                title="เปิดหน้าประวัติการลงทะเบียนของนักเรียนคนนี้"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                              </Link>
                              <button
                                onClick={() => setEditingId(reg.id)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 cursor-pointer"
                                title="แก้ไข"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteRegistrant(reg.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 cursor-pointer"
                                title="ลบข้อมูล"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ========================================================================= */
            /* TABLE 2: Student Profiles (โปรไฟล์นักเรียนทั้งหมด)                           */
            /* ========================================================================= */
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center border-r border-slate-200 whitespace-nowrap">
                    <input
                      type="checkbox"
                      ref={headerCheckboxRef}
                      checked={isAllCurrentPageSelected}
                      onChange={handleToggleSelectAllPage}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                      title="เลือก/ยกเลิกทั้งหมดในหน้านี้"
                    />
                  </th>
                  <th className="px-3 py-2.5 w-12 text-center border-r border-slate-200 whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 min-w-[160px] border-r border-slate-200 whitespace-nowrap">ชื่อ-สกุล</th>
                  <th className="px-3 py-2.5 min-w-[120px] border-r border-slate-200 whitespace-nowrap">รหัสผู้สมัคร</th>
                  <th className="px-3 py-2.5 min-w-[150px] border-r border-slate-200 whitespace-nowrap">เลขบัตร ปชช.</th>
                  <th className="px-3 py-2.5 w-28 min-w-[100px] text-center border-r border-slate-200 whitespace-nowrap">สถานะ LINE</th>
                  <th className="px-3 py-2.5 min-w-[120px] text-center border-r border-slate-200 whitespace-nowrap">กิจกรรมที่สมัคร</th>
                  <th className="px-3 py-2.5 min-w-[110px] text-center border-r border-slate-200 whitespace-nowrap">แหล่งที่มา</th>
                  <th className="px-3 py-2.5 min-w-[130px] border-r border-slate-200 whitespace-nowrap">วันที่สร้าง/แก้ไข</th>
                  <th className="px-3 py-2.5 w-28 min-w-[100px] text-center whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan="10" className="p-10 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>กำลังโหลดข้อมูลโปรไฟล์นักเรียน...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="p-10 text-center text-slate-400">
                      ไม่พบข้อมูลโปรไฟล์นักเรียน
                    </td>
                  </tr>
                ) : (
                  currentItems.map((profile, index) => {
                    const isEditing = editingId === profile.id;
                    const isSelected = selectedIds.includes(profile.id);
                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                    const regCount = regCountByNatId[profile.nationalId?.trim()] || 0;
                    const isDuplicate = duplicateProfileNatIds.has(profile.nationalId?.trim());

                    return (
                      <tr
                        key={profile.id}
                        className={`transition-colors ${
                          isEditing
                            ? 'bg-amber-50/50'
                            : isSelected
                            ? 'bg-indigo-50/40 hover:bg-indigo-50/60'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3 py-2 text-center border-r border-slate-100 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(profile.id)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                          />
                        </td>
                        <td className="px-3 py-2 text-center text-slate-400 border-r border-slate-100 bg-slate-50/40 whitespace-nowrap">
                          {rowNumber}
                        </td>
                        <td className="px-3 py-2 text-slate-900 font-medium border-r border-slate-100">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editStates[profile.id]?.fullName}
                              onChange={e => handleInputChange(profile.id, 'fullName', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white outline-none focus:border-slate-500"
                            />
                          ) : (
                            <Link
                              href={`/admin/registrants/${encodeURIComponent(profile.nationalId || profile.id)}`}
                              className="text-left text-slate-900 hover:text-indigo-600 font-semibold transition-colors flex items-center gap-1.5 group"
                              title="คลิกเพื่อเปิดหน้าประวัติของนักเรียนคนนี้"
                            >
                              <span>{profile.fullName || 'ไม่ระบุชื่อ'}</span>
                              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-500 transition-opacity">
                                ↗
                              </span>
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 border-r border-slate-100 whitespace-nowrap font-mono">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editStates[profile.id]?.studentId}
                              onChange={e => handleInputChange(profile.id, 'studentId', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white outline-none focus:border-slate-500 font-mono"
                            />
                          ) : (
                            profile.studentId || '-'
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 border-r border-slate-100 whitespace-nowrap font-mono">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editStates[profile.id]?.nationalId}
                              onChange={e => handleInputChange(profile.id, 'nationalId', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white outline-none focus:border-slate-500 font-mono"
                              maxLength={13}
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span>{profile.nationalId || '-'}</span>
                              {isDuplicate && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-100 text-rose-700 font-bold border border-rose-300" title="เลขบัตร ปชช. นี้ซ้ำซ้อนในระบบ">
                                  ซ้ำ
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center border-r border-slate-100 whitespace-nowrap">
                          {profile.lineUserId ? (
                            <button
                              onClick={() => handleCopyLineId(profile.lineUserId)}
                              title="คลิกเพื่อคัดลอก LINE User ID"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap font-medium cursor-pointer"
                            >
                              <span>{profile.lineDisplayName ? `ผูก: ${profile.lineDisplayName}` : 'ผูกแล้ว'}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-400 border border-slate-200 whitespace-nowrap">
                              ยังไม่ผูก
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center border-r border-slate-100 whitespace-nowrap">
                          {regCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {regCount} กิจกรรม
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs text-slate-400 bg-slate-100 border border-slate-200">
                              ยังไม่ลงกิจกรรม
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center border-r border-slate-100 whitespace-nowrap">
                          <span className="text-[11px] text-slate-500 font-normal">
                            {profile.source === 'student_self_registration' ? 'นักเรียนสร้างเอง' : profile.source === 'admin_import' ? 'นำเข้าโดย Admin' : (profile.source || 'ทั่วไป')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500 border-r border-slate-100 whitespace-nowrap text-[11px]">
                          {profile.updatedAtDate ? profile.updatedAtDate.toLocaleString('th-TH') : profile.createdAtDate ? profile.createdAtDate.toLocaleString('th-TH') : '-'}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleUpdateProfile(profile.id)}
                                className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs cursor-pointer"
                                title="บันทึก"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-xs cursor-pointer"
                                title="ยกเลิก"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              {profile.lineUserId && (
                                <button
                                  onClick={() => handleResetLine(profile.lineUserId)}
                                  className="p-1 text-amber-600 hover:bg-amber-50 rounded border border-transparent hover:border-amber-200 cursor-pointer"
                                  title="รีเซตการผูกบัญชี LINE"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                                  </svg>
                                </button>
                              )}
                              <Link
                                href={`/admin/registrants/${encodeURIComponent(profile.nationalId || profile.id)}`}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded border border-transparent hover:border-indigo-200"
                                title="เปิดหน้าประวัติของนักเรียนคนนี้"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                              </Link>
                              <button
                                onClick={() => setEditingId(profile.id)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 cursor-pointer"
                                title="แก้ไข"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteProfile(profile.id, profile.nationalId, profile.lineUserId)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 cursor-pointer"
                                title="ลบข้อมูลโปรไฟล์"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Compact Pagination Bar */}
        {!isLoading && activeItems.length > 0 && (
          <div className="px-3 py-2 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                แสดง {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, activeItems.length)} จาก {activeItems.length.toLocaleString()} รายการ
              </span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <span>หน้าละ:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="หน้าแรก"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                ‹
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((num) => (
                  <button
                    key={num}
                    onClick={() => setCurrentPage(num)}
                    className={`min-w-[24px] h-6 rounded flex items-center justify-center border cursor-pointer ${
                      currentPage === num
                        ? 'bg-slate-900 text-white border-slate-900 font-medium'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="หน้าสุดท้าย"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
