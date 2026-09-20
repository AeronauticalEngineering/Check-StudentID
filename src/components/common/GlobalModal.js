'use client';

import React, { useEffect } from 'react';

export default function GlobalModal({
  isOpen,
  mode = 'alert', // 'alert' | 'confirm'
  title = 'แจ้งเตือน',
  message = '',
  type = 'info', // 'info' | 'success' | 'warning' | 'error' | 'danger'
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก',
  onConfirm = () => {},
  onCancel = () => {},
}) {
  // Handle ESC and Enter keyboard keys
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && mode === 'alert') {
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, onConfirm, onCancel]);

  if (!isOpen) return null;

  // Icon and Colors Configuration
  const getIconAndColors = () => {
    switch (type) {
      case 'success':
        return {
          iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
          btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ),
        };
      case 'danger':
      case 'error':
        return {
          iconBg: 'bg-rose-50 text-rose-600 border border-rose-200',
          btnColor: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-50 text-amber-600 border border-amber-200',
          btnColor: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
        };
      case 'info':
      default:
        return {
          iconBg: 'bg-teal-50 text-teal-600 border border-teal-200',
          btnColor: 'bg-gradient-to-r from-teal-600 to-[#166E7C] hover:from-teal-500 text-white shadow-teal-500/20',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
    }
  };

  const config = getIconAndColors();

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm sm:max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs ${config.iconBg}`}>
            {config.icon}
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
              {title}
            </h3>
            <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line break-words font-normal">
              {message}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          {mode === 'confirm' && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all active:scale-95"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`px-5 py-2 text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer ${config.btnColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Global Toast Container Component
export function ToastContainer({ toasts, onRemove }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            onClick={() => onRemove(toast.id)}
            className={`pointer-events-auto cursor-pointer flex items-center gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-3 duration-200 ${
              isSuccess
                ? 'bg-slate-900/95 text-white border-emerald-500/40'
                : isError
                ? 'bg-slate-900/95 text-white border-rose-500/40'
                : 'bg-slate-900/95 text-white border-teal-500/40'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : isError
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-teal-500/20 text-teal-300'
              }`}
            >
              {isSuccess ? '✓' : isError ? '!' : 'ℹ'}
            </div>
            <div className="text-xs font-medium text-slate-100 flex-1 leading-snug whitespace-pre-line">
              {toast.message}
            </div>
          </div>
        );
      })}
    </div>
  );
}
