import React, { useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { Notification } from '../types';
import {
  Bell,
  UserPlus,
  Clock,
  CreditCard,
  PhoneMissed,
  Layers,
  AlertTriangle,
  Info,
  X,
  ExternalLink,
} from 'lucide-react';

interface ToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onAction?: (actionUrl?: string | null) => void;
}

const ToastItem: React.FC<ToastProps> = ({ notification, onDismiss, onAction }) => {
  const { markAsRead } = useNotifications();

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, 6000);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  const getIcon = () => {
    switch (notification.type) {
      case 'LEAD_ASSIGNED':
        return <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'TASK_DUE':
        return <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'MISSED_CALL':
        return <PhoneMissed className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'PAYMENT_DUE':
        return <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'STAGE_CHANGED':
        return <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'SYSTEM_ALERT':
        return <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      default:
        return <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getPriorityStyle = () => {
    switch (notification.priority) {
      case 'URGENT':
        return 'border-l-4 border-l-rose-500 bg-white dark:bg-[#1e293b] shadow-xl';
      case 'HIGH':
        return 'border-l-4 border-l-amber-500 bg-white dark:bg-[#1e293b] shadow-lg';
      default:
        return 'border-l-4 border-l-blue-500 bg-white dark:bg-[#1e293b] shadow-md';
    }
  };

  const handleClick = () => {
    markAsRead(notification.id);
    onDismiss(notification.id);
    if (notification.action_url && onAction) {
      onAction(notification.action_url);
    }
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 ${getPriorityStyle()} transition-all transform animate-in slide-in-from-top-2 fade-in duration-200 w-80 sm:w-96`}
      role="alert"
    >
      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0" onClick={handleClick}>
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:underline">
            {notification.title}
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
            {notification.priority}
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 cursor-pointer mb-1.5">
          {notification.message}
        </p>

        {notification.action_url && (
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 cursor-pointer"
          >
            <span>View Details</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        aria-label="Dismiss alert"
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC<{ onNavigate?: (url: string) => void }> = ({ onNavigate }) => {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifications"
      className="fixed top-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          notification={toast}
          onDismiss={dismissToast}
          onAction={(url) => {
            if (url && onNavigate) {
              onNavigate(url);
            }
          }}
        />
      ))}
    </aside>
  );
};
