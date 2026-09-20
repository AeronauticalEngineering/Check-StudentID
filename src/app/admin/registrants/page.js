'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/firebase';
import { collection, doc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import Papa from 'papaparse';
import { upsertStudentProfile, resetStudentLineBinding, deleteStudentProfile } from '../../../lib/studentService';
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
  const [activitiesMap, setActivitiesMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLineStatus, setFilterLineStatus] = useState('all'); // all, linked, unlinked
  const [editStates, setEditStates] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [allRegistrations, setAllRegistrations] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);


  useEffect(() => {
    const fetchActivities = async () => {
      const snap = await getDocs(collection(db, 'activities'));
      const map = {};
      snap.forEach(d => map[d.id] = d.data().name);
      setActivitiesMap(map);
    };
    fetchActivities();
  }, []);

  const fetchRegistrations = async () => {
    setIsLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, 'registrations'), orderBy('registeredAt', 'desc')));

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        registeredAtDate: doc.data().registeredAt ? doc.data().registeredAt.toDate() : null
      }));

      setAllRegistrations(data);

      const initialEdits = {};
      data.forEach(r => {
        initialEdits[r.id] = {
          fullName: r.fullName || '',
          studentId: r.studentId || '',
          nationalId: r.nationalId || '',
          lineUserId: r.lineUserId || '',
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
    fetchRegistrations();
  }, []);

  // Summary Counts
  const counts = useMemo(() => {
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

  // Filtered registrations
  const filteredRegistrations = useMemo(() => {
    return allRegistrations.filter(r => {
      // LINE status filter
      if (filterLineStatus === 'linked' && !r.lineUserId) return false;
      if (filterLineStatus === 'unlinked' && r.lineUserId) return false;

      // Search filter
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

  useEffect(() => {
    setCurrentPage(1);
  }, [filterLineStatus, searchTerm, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRegistrations.length / pageSize));
  const currentRegistrations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegistrations.slice(start, start + pageSize);
  }, [filteredRegistrations, currentPage, pageSize]);

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

  const handleInputChange = (registrantId, field, value) => {
    setEditStates(prev => ({
      ...prev,
      [registrantId]: { ...prev[registrantId], [field]: value }
    }));
  };

  const handleUpdateRegistrant = async (registrantId) => {
    const dataToUpdate = editStates[registrantId];
    try {
      await updateDoc(doc(db, 'registrations', registrantId), {
        fullName: dataToUpdate.fullName.trim(),
        studentId: dataToUpdate.studentId.trim() || null,
        nationalId: dataToUpdate.nationalId.trim(),
        lineUserId: dataToUpdate.lineUserId || null
      });

      if (dataToUpdate.nationalId) {
        await upsertStudentProfile({
          nationalId: dataToUpdate.nationalId.trim(),
          fullName: dataToUpdate.fullName.trim(),
          studentId: dataToUpdate.studentId.trim() || null,
          lineUserId: dataToUpdate.lineUserId || null,
          source: 'admin_edit'
        });
      }

      setMessage('✅ อัปเดตข้อมูลสำเร็จ');
      setEditingId(null);
      fetchRegistrations();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const handleDeleteRegistrant = async (registrantId, lineUserId, nationalId) => {
    const confirmed = await showConfirm({
      title: 'ยืนยันการลบข้อมูล',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?\n(ระบบจะลบประวัติการลงทะเบียนและรีเซต LINE ของนักเรียน)',
      type: 'danger',
      confirmText: 'ลบข้อมูล',
      cancelText: 'ยกเลิก'
    });

    if (confirmed) {
      try {
        await deleteDoc(doc(db, 'registrations', registrantId));
        if (lineUserId || nationalId) {
          await deleteStudentProfile(nationalId, lineUserId);
        }

        showToast({ message: 'ลบข้อมูลการลงทะเบียนสำเร็จ', type: 'success' });
        fetchRegistrations();
      } catch (error) {
        showAlert({
          title: 'เกิดข้อผิดพลาด',
          message: `ไม่สามารถลบข้อมูลได้: ${error.message}`,
          type: 'error'
        });
      }
    }
  };

  const handleResetLine = async (lineUserId, registrantId) => {
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
        fetchRegistrations();
      } catch (error) {
        showAlert({
          title: 'เกิดข้อผิดพลาด',
          message: `ไม่สามารถรีเซต LINE ได้: ${error.message}`,
          type: 'error'
        });
      }
    }
  };


  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleCopyLineId = (lineId) => {
    if (!lineId) return;
    navigator.clipboard.writeText(lineId);
    setMessage('✅ คัดลอก LINE User ID เรียบร้อยแล้ว');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleExportCSV = async () => {
    try {
      const csvData = filteredRegistrations.map((reg, index) => ({
        'ลำดับ': index + 1,
        'ชื่อ-สกุล': reg.fullName || '',
        'รหัสนักศึกษา': reg.studentId || '',
        'เลขบัตรประชาชน': reg.nationalId || '',
        'Line User ID': reg.lineUserId || '',
        'กิจกรรม': activitiesMap[reg.activityId] || 'Unknown',
        'สถานะ': getThaiStatus(reg.status).label,
        'วันที่ลงทะเบียน': reg.registeredAtDate ? reg.registeredAtDate.toLocaleString('th-TH') : ''
      }));

      const csv = Papa.unparse(csvData, { quotes: true, delimiter: ',', header: true });
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'registrants_export.csv';
      link.click();
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-3">
      {/* Control Bar: Filters, Search & Export */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {[
            { key: 'all', label: 'ทั้งหมด', count: counts.total },
            { key: 'linked', label: 'ผูก LINE แล้ว', count: counts.linked },
            { key: 'unlinked', label: 'ยังไม่ผูก LINE', count: counts.unlinked }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterLineStatus(tab.key)}
              className={`px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap flex items-center gap-1.5 border ${
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
              placeholder="ค้นหาชื่อ, รหัส นศ., บัตร ปชช..."
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
                className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchRegistrations()}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded border border-slate-200 flex items-center gap-1 whitespace-nowrap"
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
            disabled={filteredRegistrations.length === 0}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded border border-slate-200 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>CSV ({filteredRegistrations.length.toLocaleString()})</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-2.5 rounded text-xs border ${message.includes('❌') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {message}
        </div>
      )}

      {/* Clean Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-3 py-2.5 w-12 text-center border-r border-slate-200 whitespace-nowrap">#</th>
                <th className="px-3 py-2.5 min-w-[160px] border-r border-slate-200 whitespace-nowrap">ชื่อ-สกุล</th>
                <th className="px-3 py-2.5 min-w-[120px] border-r border-slate-200 whitespace-nowrap">รหัสผู้สมัคร</th>
                <th className="px-3 py-2.5 min-w-[140px] border-r border-slate-200 whitespace-nowrap">เลขบัตร ปชช.</th>
                <th className="px-3 py-2.5 w-24 min-w-[90px] text-center border-r border-slate-200 whitespace-nowrap">LINE</th>
                <th className="px-3 py-2.5 min-w-[160px] border-r border-slate-200 whitespace-nowrap">กิจกรรม</th>
                <th className="px-3 py-2.5 min-w-[120px] text-center border-r border-slate-200 whitespace-nowrap">สถานะ</th>
                <th className="px-3 py-2.5 w-28 min-w-[100px] text-center whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังโหลดข้อมูล...</span>
                    </div>
                  </td>
                </tr>
              ) : currentRegistrations.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-10 text-center text-slate-400">
                    ไม่พบข้อมูลผู้ลงทะเบียน
                  </td>
                </tr>
              ) : (
                currentRegistrations.map((reg, index) => {
                  const isEditing = editingId === reg.id;
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  return (
                    <tr key={reg.id} className={`transition-colors ${isEditing ? 'bg-amber-50/50' : 'hover:bg-slate-50/70'}`}>
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
                          />
                        ) : (
                          reg.nationalId || '-'
                        )}
                      </td>
                      <td className="px-3 py-2 text-center border-r border-slate-100 whitespace-nowrap">
                        {reg.lineUserId ? (
                          <button
                            onClick={() => handleCopyLineId(reg.lineUserId)}
                            title="คลิกเพื่อคัดลอก LINE User ID"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap font-medium"
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
                              className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs"
                              title="บันทึก"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-xs"
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
                                className="p-1 text-amber-600 hover:bg-amber-50 rounded border border-transparent hover:border-amber-200"
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
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200"
                              title="แก้ไข"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteRegistrant(reg.id, reg.lineUserId, reg.nationalId)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200"
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
        </div>

        {/* Compact Pagination Bar */}
        {!isLoading && filteredRegistrations.length > 0 && (
          <div className="px-3 py-2 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                แสดง {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredRegistrations.length)} จาก {filteredRegistrations.length.toLocaleString()} รายการ
              </span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <span>หน้าละ:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none"
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
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="หน้าแรก"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ‹
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((num) => (
                  <button
                    key={num}
                    onClick={() => setCurrentPage(num)}
                    className={`min-w-[24px] h-6 rounded flex items-center justify-center border ${
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
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
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
