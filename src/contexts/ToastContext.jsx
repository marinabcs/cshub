import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    timersRef.current[id] = setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  const success = useCallback((msg) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg) => addToast(msg, 'error', 6000), [addToast]);
  const warning = useCallback((msg) => addToast(msg, 'warning', 5000), [addToast]);
  const info = useCallback((msg) => addToast(msg, 'info'), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info }}>
      {children}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '400px'
        }}>
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

const TOAST_STYLES = {
  success: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', icon: '✓', color: '#10b981' },
  error: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', icon: '✕', color: '#ef4444' },
  warning: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', icon: '!', color: '#f59e0b' },
  info: { bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.4)', icon: 'i', color: '#8b5cf6' }
};

function ToastItem({ toast, onClose }) {
  const s = TOAST_STYLES[toast.type] || TOAST_STYLES.info;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      background: s.bg,
      backdropFilter: 'blur(12px)',
      border: `1px solid ${s.border}`,
      borderRadius: '12px',
      color: 'white',
      fontSize: '14px',
      animation: 'toastSlideIn 0.25s ease-out',
      cursor: 'pointer'
    }} onClick={onClose}>
      <span style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: s.color,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: '700',
        flexShrink: 0
      }}>
        {s.icon}
      </span>
      <span style={{ flex: 1 }}>{toast.message}</span>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider');
  }
  return context;
}
