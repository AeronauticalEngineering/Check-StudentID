'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import GlobalModal, { ToastContainer } from '../components/common/GlobalModal';

const ModalContext = createContext({
  showAlert: () => Promise.resolve(),
  showConfirm: () => Promise.resolve(false),
  showToast: () => {},
});

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState(null);
  const [toasts, setToasts] = useState([]);
  const resolveRef = useRef(null);

  // Show Alert Modal
  const showAlert = useCallback(({
    title = 'แจ้งเตือน',
    message = '',
    type = 'info', // 'info' | 'success' | 'warning' | 'error'
    confirmText = 'ตกลง',
  } = {}) => {
    // If a simple string is passed as first argument
    if (typeof arguments[0] === 'string') {
      message = arguments[0];
      type = 'info';
    }

    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModalState({
        isOpen: true,
        mode: 'alert',
        title,
        message,
        type,
        confirmText,
      });
    });
  }, []);

  // Show Confirmation Dialog Modal
  const showConfirm = useCallback(({
    title = 'ยืนยันการทำรายการ',
    message = 'คุณแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?',
    type = 'warning', // 'warning' | 'danger' | 'info'
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
  } = {}) => {
    // If a simple string is passed as first argument
    if (typeof arguments[0] === 'string') {
      message = arguments[0];
      type = 'warning';
    }

    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModalState({
        isOpen: true,
        mode: 'confirm',
        title,
        message,
        type,
        confirmText,
        cancelText,
      });
    });
  }, []);

  // Show Toast Notification
  const showToast = useCallback(({
    message = '',
    type = 'success', // 'success' | 'error' | 'info'
    duration = 2800,
  } = {}) => {
    if (typeof arguments[0] === 'string') {
      message = arguments[0];
    }
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const handleClose = useCallback((result = false) => {
    setModalState(null);
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
  }, []);

  const handleRemoveToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showToast }}>
      {children}
      {modalState && (
        <GlobalModal
          {...modalState}
          onConfirm={() => handleClose(true)}
          onCancel={() => handleClose(false)}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={handleRemoveToast} />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
