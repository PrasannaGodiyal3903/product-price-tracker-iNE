import React, { useEffect } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export const Toast: React.FC<Props> = ({ toasts, onDismiss }) => {
  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '.5rem', alignItems: 'flex-end' }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bg = toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--error)' : 'var(--ink)';

  return (
    <div
      onClick={() => onDismiss(toast.id)}
      style={{
        background: bg,
        color: '#fff',
        padding: '.65rem 1rem',
        fontSize: '.8125rem',
        fontWeight: 500,
        maxWidth: 320,
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0,0,0,.16)',
        animation: 'toast-in .2s ease',
        borderLeft: '3px solid rgba(255,255,255,.3)',
      }}
    >
      {toast.text}
    </div>
  );
};
