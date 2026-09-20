'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import Papa from 'papaparse';
import { useModal } from '../../../context/ModalContext';

// Formatting timestamp to concise Thai date & time
const formatDateTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Clean & Subtle Status Badge
const StatusBadge = ({ type }) => {
  switch (type) {
    case 'check-in':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          เช็คอิน
        </span>
      );
    case 'check-out':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          เช็คเอาท์
        </span>
      );
    case 'queue-call':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
          เรียกคิว
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          {type || 'ทั่วไป'}
        </span>
      );
  }
};

export default function AdminHistoryPage() {
  const { showAlert, showConfirm, showToast } = useModal();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  // Selected Logs for Bulk Delete
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setIsLoading(true);
    const q = query(
      collection(db, 'checkInLogs'),
      orderBy('timestamp', 'desc'),
      limit(1000)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const data = querySnapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            dateObj: d.timestamp ? (d.timestamp.toDate ? d.timestamp.toDate() : new Date(d.timestamp)) : null
          };
        });
        setLogs(data);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching logs:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Summary Counts
  const counts = useMemo(() => {
    let checkIns = 0;
    let checkOuts = 0;
    let queueCalls = 0;

    logs.forEach((log) => {
      if (log.type === 'check-in') checkIns++;
      else if (log.type === 'check-out') checkOuts++;
      else if (log.type === 'queue-call') queueCalls++;
    });

    return {
      total: logs.length,
      checkIns,
      checkOuts,
      queueCalls
    };
  }, [logs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return logs.filter((log) => {
      if (filterType !== 'all' && log.type !== filterType) {
        return false;
      }

      if (dateFilter === 'today') {
        if (!log.dateObj || log.dateObj < today) return false;
      } else if (dateFilter === 'yesterday') {
        if (!log.dateObj || log.dateObj < yesterday || log.dateObj >= today) return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const student = (log.studentName || '').toLowerCase();
        const activity = (log.activityName || '').toLowerCase();
        const seat = (log.assignedSeat || '').toLowerCase();
        const admin = (log.adminId || '').toLowerCase();

        return (
          student.includes(term) ||
          activity.includes(term) ||
          seat.includes(term) ||
          admin.includes(term)
        );
      }

      return true;
    });
  }, [logs, filterType, dateFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, dateFilter, searchTerm, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

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

  // Delete a single log
  const handleDeleteSingle = async (logId, studentName) => {
    const confirmed = await showConfirm({
      title: 'ยืนยันการลบประวัติ',
      message: `คุณต้องการลบประวัติของ "${studentName || 'รายการนี้'}" ใช่หรือไม่?\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
      type: 'danger',
      confirmText: 'ลบข้อมูล',
      cancelText: 'ยกเลิก',
    });

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'checkInLogs', logId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(logId);
        return next;
      });
      showToast({ message: 'ลบรายการประวัติสำเร็จ', type: 'success' });
    } catch (err) {
      console.error('Error deleting log:', err);
      showAlert({
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถลบข้อมูลได้: ' + err.message,
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk delete selected logs
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await showConfirm({
      title: 'ยืนยันการลบข้อมูลแบบกลุ่ม',
      message: `คุณต้องการลบประวัติที่เลือกจำนวน ${selectedIds.size} รายการใช่หรือไม่?\nข้อมูลที่ถูกลบจะไม่สามารถกู้คืนได้`,
      type: 'danger',
      confirmText: `ลบ ${selectedIds.size} รายการ`,
      cancelText: 'ยกเลิก',
    });

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      // Firestore batch limit is 500 ops per commit
      const chunkSize = 450;
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          batch.delete(doc(db, 'checkInLogs', id));
        });
        await batch.commit();
      }
      const count = selectedIds.size;
      setSelectedIds(new Set());
      showToast({ message: `ลบประวัติจำนวน ${count} รายการสำเร็จ`, type: 'success' });
    } catch (err) {
      console.error('Error deleting selected logs:', err);
      showAlert({
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถลบข้อมูลได้: ' + err.message,
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle selection
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/Deselect all on current page
  const isAllPageSelected = paginatedLogs.length > 0 && paginatedLogs.every((l) => selectedIds.has(l.id));
  const handleToggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        paginatedLogs.forEach((l) => next.delete(l.id));
      } else {
        paginatedLogs.forEach((l) => next.add(l.id));
      }
      return next;
    });
  };

  const handleExportCSV = () => {
    try {
      const csvData = filteredLogs.map((log, index) => ({
        'ลำดับ': index + 1,
        'ประเภท': log.type === 'check-in' ? 'เช็คอิน' : log.type === 'check-out' ? 'เช็คเอาท์' : 'เรียกคิว',
        'ชื่อนักเรียน': log.studentName || '-',
        'กิจกรรม': log.activityName || '-',
        'ที่นั่ง/คิว': log.assignedSeat || '-',
        'วันเวลา': formatDateTime(log.timestamp),
        'ผู้ดำเนินการ': log.adminId || 'ระบบ'
      }));

      const csv = Papa.unparse(csvData, { quotes: true, delimiter: ',', header: true });
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      showToast({ message: 'ส่งออกไฟล์ CSV สำเร็จ 📄', type: 'success' });
    } catch (error) {
      console.error('Export CSV failed:', error);
      showAlert({
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถ Export CSV ได้: ' + error.message,
        type: 'error',
      });
    }
  };


  return (
    <div className="p-4 md:p-6 space-y-3 font-sans">
      {/* Control Bar: Filters, Search, Selection Actions & Export */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Type Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {[
            { key: 'all', label: 'ทั้งหมด', count: counts.total },
            { key: 'check-in', label: 'เช็คอิน', count: counts.checkIns },
            { key: 'check-out', label: 'เช็คเอาท์', count: counts.checkOuts },
            { key: 'queue-call', label: 'เรียกคิว', count: counts.queueCalls }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className={`px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap flex items-center gap-1.5 border ${
                filterType === tab.key
                  ? 'bg-slate-900 text-white border-slate-900 font-medium'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[11px] px-1 rounded ${filterType === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Action Buttons, Date Filter, Search & Export */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Bulk Delete Button when items selected */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200 animate-in fade-in">
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>ลบที่เลือก ({selectedIds.size})</span>
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-red-600 hover:text-red-800 text-[11px] px-1.5 py-0.5 rounded"
                title="ยกเลิกการเลือก"
              >
                ✕
              </button>
            </div>
          )}

          {/* Date Selector */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-slate-400"
          >
            <option value="all">ทุกช่วงเวลา</option>
            <option value="today">วันนี้</option>
            <option value="yesterday">เมื่อวานนี้</option>
          </select>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-60">
            <input
              type="text"
              placeholder="ค้นหาชื่อ, กิจกรรม, ที่นั่ง, คิว..."
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

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded border border-slate-200 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Clean Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-2 py-2.5 w-10 text-center border-r border-slate-200">
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={handleToggleSelectAllPage}
                    className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    title="เลือกทั้งหมดในหน้านี้"
                  />
                </th>
                <th className="px-3 py-2.5 w-12 text-center border-r border-slate-200">#</th>
                <th className="px-3 py-2.5 w-24 border-r border-slate-200">ประเภท</th>
                <th className="px-3 py-2.5 min-w-[160px] border-r border-slate-200">ชื่อนักเรียน</th>
                <th className="px-3 py-2.5 min-w-[180px] border-r border-slate-200">กิจกรรม</th>
                <th className="px-3 py-2.5 w-24 text-center border-r border-slate-200">ที่นั่ง/คิว</th>
                <th className="px-3 py-2.5 w-32 border-r border-slate-200">วัน-เวลา</th>
                <th className="px-3 py-2.5 w-24 text-center border-r border-slate-200">ผู้ดำเนินการ</th>
                <th className="px-3 py-2.5 w-16 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังโหลดข้อมูล...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-10 text-center text-slate-400">
                    ไม่พบรายการประวัติที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  const isSelected = selectedIds.has(log.id);
                  return (
                    <tr
                      key={log.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-2 py-2 text-center border-r border-slate-100">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(log.id)}
                          className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-slate-400 border-r border-slate-100 bg-slate-50/40">
                        {rowNumber}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100">
                        <StatusBadge type={log.type || 'check-in'} />
                      </td>
                      <td className="px-3 py-2 text-slate-900 font-medium border-r border-slate-100">
                        {log.studentName || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 border-r border-slate-100">
                        <span className="truncate block max-w-[240px]" title={log.activityName}>
                          {log.activityName || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center border-r border-slate-100">
                        {log.assignedSeat ? (
                          <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200 font-mono">
                            {log.assignedSeat}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap border-r border-slate-100">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-500 border-r border-slate-100">
                        <span className="inline-block px-1.5 py-0.5 bg-slate-50 rounded text-slate-600 border border-slate-200">
                          {log.adminId || 'ระบบ'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleDeleteSingle(log.id, log.studentName)}
                          disabled={isDeleting}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="ลบรายการประวัตินี้"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Compact Pagination */}
        {!isLoading && filteredLogs.length > 0 && (
          <div className="px-3 py-2 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            {/* Counts & Size */}
            <div className="flex items-center gap-2">
              <span>
                แสดง {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredLogs.length)} จาก {filteredLogs.length.toLocaleString()}
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
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Page Buttons */}
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
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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