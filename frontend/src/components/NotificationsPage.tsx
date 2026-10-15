import React, { useState, useEffect, useCallback } from 'react';
import {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationFilterCategory,
  ViewType,
} from '../types';
import { api } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  Archive,
  RefreshCw,
  Search,
  Filter,
  UserPlus,
  Clock,
  PhoneMissed,
  CreditCard,
  Layers,
  AlertTriangle,
  ExternalLink,
  Inbox,
  Sparkles,
  Calendar,
} from 'lucide-react';

interface NotificationsPageProps {
  onNavigate?: (url: string) => void;
  onViewChange?: (view: ViewType) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate, onViewChange }) => {
  const { unreadCount, refreshNotifications, markAsRead, markAllAsRead, archiveNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState<NotificationFilterCategory>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Helper to map tab to API query params
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        page_size: 20,
      };

      if (activeTab === 'unread') {
        params.unread_only = true;
        params.archived = 'active';
      } else if (activeTab === 'archived') {
        params.archived = 'archived';
      } else {
        params.archived = 'active';
      }

      if (activeTab === 'leads') params.type = 'LEAD_ASSIGNED';
      else if (activeTab === 'tasks') params.type = 'TASK_DUE';
      else if (activeTab === 'calls') params.type = 'MISSED_CALL';
      else if (activeTab === 'payments') params.type = 'PAYMENT_DUE';
      else if (activeTab === 'meetings') params.type = 'MEETING_SCHEDULED';
      else if (activeTab === 'system') params.type = 'SYSTEM_ALERT';

      if (priorityFilter !== 'ALL') {
        params.priority = priorityFilter as NotificationPriority;
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await api.getNotifications(params);
      setNotifications(res.results);
      setTotalPages(res.total_pages);
      setTotalCount(res.count);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, priorityFilter, searchQuery]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Handle marking read from page
  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  };

  // Handle archiving from page
  const handleArchive = async (id: string) => {
    await archiveNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Handle Mark All Read
  const handleMarkAllRead = async () => {
    await markAllAsRead();
    fetchList();
  };

  // Relative time format
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSecs < 60) return 'Just now';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'LEAD_ASSIGNED':
        return <UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'TASK_DUE':
        return <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'MISSED_CALL':
        return <PhoneMissed className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      case 'PAYMENT_DUE':
        return <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case 'STAGE_CHANGED':
        return <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'SYSTEM_ALERT':
        return <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      default:
        return <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
            URGENT
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
            HIGH
          </span>
        );
      case 'NORMAL':
        return (
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            NORMAL
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500">
            LOW
          </span>
        );
    }
  };

  const handleActionClick = (item: Notification) => {
    if (!item.read_at) {
      handleMarkRead(item.id);
    }
    if (item.action_url) {
      if (onNavigate) {
        onNavigate(item.action_url);
      } else {
        window.location.href = item.action_url;
      }
    }
  };

  const tabs: { key: NotificationFilterCategory; label: string }[] = [
    { key: 'all', label: 'All Notifications' },
    { key: 'unread', label: `Unread (${unreadCount})` },
    { key: 'leads', label: 'Lead Assignments' },
    { key: 'tasks', label: 'Follow-ups' },
    { key: 'calls', label: 'Missed Calls' },
    { key: 'payments', label: 'Payments' },
    { key: 'system', label: 'System Alerts' },
    { key: 'archived', label: 'Archived' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Notifications Center
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Stay updated with lead assignments, follow-ups, calls, and system alerts
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all as read</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              fetchList();
              refreshNotifications();
            }}
            title="Refresh notifications"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setPage(1);
            }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold whitespace-nowrap transition-all border-b-2 cursor-pointer ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters & Search Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search notifications, lead ID, or message..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="NORMAL">Normal Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {loading && notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              No notifications found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {activeTab === 'unread'
                ? "You're all caught up! There are no unread notifications right now."
                : 'No notifications match your current filter settings.'}
            </p>
          </div>
        ) : (
          notifications.map((item) => {
            const isUnread = !item.read_at;
            return (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border transition-all ${
                  isUnread
                    ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 shadow-xs'
                    : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                    {getTypeIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </span>
                      {getPriorityBadge(item.priority)}
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-1.5">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>{formatTime(item.created_at)}</span>
                      {item.entity_id && (
                        <>
                          <span>•</span>
                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                            {item.entity_id}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 mt-3 sm:mt-0 sm:ml-4 shrink-0 self-end sm:self-center">
                  {item.action_url && (
                    <button
                      type="button"
                      onClick={() => handleActionClick(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                    >
                      <span>Action</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(item.id)}
                      title="Mark as read"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}

                  {!item.archived_at && (
                    <button
                      type="button"
                      onClick={() => handleArchive(item.id)}
                      title="Archive notification"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing page {page} of {totalPages} ({totalCount} total)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
