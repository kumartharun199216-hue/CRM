import React, { useState, useRef, useEffect } from 'react';
import { User, ViewType } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { useNotifications } from '../context/NotificationContext';
import {
  Search,
  Bell,
  HelpCircle,
  Menu,
  Shield,
  Briefcase,
  GraduationCap,
  UserCircle,
  KeyRound,
  LogOut,
  ChevronDown,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  ExternalLink,
} from 'lucide-react';

interface TopNavigationProps {
  user: User;
  onViewChange?: (view: ViewType) => void;
  onLogout: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onToggleSidebar?: () => void;
  rightActions?: React.ReactNode;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  user,
  onViewChange,
  onLogout,
  searchQuery = '',
  onSearchChange,
  onToggleSidebar,
  rightActions,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync internal search state with prop
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Click outside listeners
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setIsHelpOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Keyboard shortcut ⌘K / Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getRoleBadge = () => {
    switch (user.role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F3E8FF] text-[#7C3AED] dark:bg-[#3B0764] dark:text-[#D8B4FE] border border-[#E9D5FF] dark:border-[#6D28D9]">
            <Shield className="w-3 h-3 text-[#7C3AED] dark:text-[#D8B4FE]" /> Admin
          </span>
        );
      case 'MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] dark:bg-[#172554] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF]">
            <Briefcase className="w-3 h-3 text-[#2563EB] dark:text-[#60A5FA]" /> Manager
          </span>
        );
      case 'SALES_EMPLOYEE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#DCFCE7] text-[#166534] dark:bg-[#14532D] dark:text-[#86EFAC] border border-[#BBF7D0] dark:border-[#166534]">
            <GraduationCap className="w-3 h-3 text-[#166534] dark:text-[#86EFAC]" /> Counsellor
          </span>
        );
    }
  };

  const getInitials = (name?: string, email?: string) => {
    const target = name || email || 'U';
    const parts = target.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return target.slice(0, 2).toUpperCase();
  };

  const {
    unreadCount,
    recentNotifications,
    loading: notifLoading,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  } = useNotifications();

  const formatNotifTime = (isoString: string) => {
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

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'LEAD_ASSIGNED':
        return <UserCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'TASK_DUE':
        return <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'MISSED_CALL':
        return <Bell className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'PAYMENT_DUE':
        return <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'STAGE_CHANGED':
        return <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default:
        return <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 transition-colors duration-200">
      {/* Left Area: Mobile Hamburger + Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {onToggleSidebar && (
          <button
            type="button"
            id="mobile-sidebar-toggle-btn"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
            className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Global Search Input */}
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8] dark:text-[#64748B]">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            id="global-search-input"
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
              onSearchChange?.(e.target.value);
            }}
            placeholder="Search leads, students, contacts... (Press ⌘K)"
            className="w-full h-10 pl-9 pr-14 rounded-lg bg-[#F8FAFC] dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] text-xs font-normal text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] focus:ring-1 focus:ring-[#2563EB] transition-colors"
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] bg-[#E2E8F0] dark:bg-[#1E293B] rounded border border-[#CBD5E1] dark:border-[#334155]">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right Area: Contextual Actions, Help, Notifications, Theme Toggle, Profile */}
      <div className="flex items-center gap-2">
        {rightActions && <div className="hidden sm:flex items-center gap-2 mr-2">{rightActions}</div>}

        {/* Help Button & Popover */}
        <div className="relative" ref={helpRef}>
          <button
            type="button"
            id="top-nav-help-btn"
            onClick={() => setIsHelpOpen((prev) => !prev)}
            aria-label="Open CRM Quick Help"
            title="Help & Shortcuts"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {isHelpOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] shadow-xl p-4 z-50 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9] dark:border-[#273449] mb-3">
                <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Skill Move CRM Help</span>
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  className="text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 text-[#475569] dark:text-[#CBD5E1]">
                <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] dark:border-[#273449]">
                  <span>Focus Global Search</span>
                  <kbd className="font-mono bg-[#F1F5F9] dark:bg-[#1E293B] px-1.5 py-0.5 rounded text-[10px]">⌘K / Ctrl+K</kbd>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] dark:border-[#273449]">
                  <span>12-Stage Admissions</span>
                  <span className="font-medium text-[#2563EB] dark:text-[#60A5FA]">Configurable</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span>Theme Switching</span>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Light • Dark • System</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notifications Button & Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            id="top-nav-notifications-btn"
            onClick={() => {
              setIsNotificationsOpen((prev) => !prev);
              if (!isNotificationsOpen) {
                refreshNotifications();
              }
            }}
            aria-label={`Notifications, ${unreadCount} unread`}
            title="Notifications"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors relative cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span
                id="top-nav-notif-count-badge"
                className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#111827] shadow-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] shadow-2xl overflow-hidden z-50">
              {/* Header */}
              <div className="px-4 py-3 border-b border-[#F1F5F9] dark:border-[#273449] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-semibold text-[#2563EB] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#172554] px-2 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    className="text-[11px] font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Items List */}
              <div className="divide-y divide-[#F1F5F9] dark:divide-[#273449] max-h-80 overflow-y-auto">
                {recentNotifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                    <Bell className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <span>No notifications right now</span>
                  </div>
                ) : (
                  recentNotifications.map((item) => {
                    const isUnread = !item.read_at;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isUnread) markAsRead(item.id);
                          if (item.action_url) {
                            setIsNotificationsOpen(false);
                            window.location.href = item.action_url;
                          }
                        }}
                        className={`p-3 text-xs hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition cursor-pointer flex items-start gap-3 ${
                          isUnread ? 'bg-[#EFF6FF]/50 dark:bg-[#172554]/30' : ''
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                          {getNotifIcon(item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="font-semibold text-xs text-[#0F172A] dark:text-[#F8FAFC] truncate">
                              {item.title}
                            </span>
                            <span className="text-[10px] text-[#94A3B8] dark:text-[#64748B] shrink-0">
                              {formatNotifTime(item.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] line-clamp-2 m-0">
                            {item.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-2 border-t border-[#F1F5F9] dark:border-[#273449] bg-slate-50/50 dark:bg-[#131c2e] text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsNotificationsOpen(false);
                    onViewChange?.('notifications');
                  }}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#172554] transition cursor-pointer"
                >
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Theme Toggle (40x40 with Sun/Moon/Monitor dropdown) */}
        <ThemeToggle />

        {/* User Profile Avatar & Dropdown */}
        <div className="relative pl-2 border-l border-[#E2E8F0] dark:border-[#334155]" ref={profileRef}>
          <button
            type="button"
            id="top-nav-user-menu-btn"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            aria-expanded={isProfileOpen}
            aria-label="User account menu"
            className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white text-xs font-bold shadow-xs">
              {getInitials(user.full_name, user.email)}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] leading-none truncate max-w-[120px]">
                {user.full_name || user.username}
              </span>
              <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] leading-none mt-1">
                {user.role === 'ADMIN' ? 'Admin' : user.role === 'MANAGER' ? 'Manager' : 'Counsellor'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] hidden md:block" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] shadow-xl py-1.5 z-50 text-xs">
              <div className="px-3.5 py-2 border-b border-[#F1F5F9] dark:border-[#273449]">
                <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                  {user.full_name || user.username}
                </div>
                <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5">
                  {user.email}
                </div>
                <div className="mt-2">{getRoleBadge()}</div>
              </div>

              <div className="py-1">
                {onViewChange && (
                  <>
                    <button
                      type="button"
                      id="top-nav-menu-profile"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onViewChange('profile');
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition cursor-pointer"
                    >
                      <UserCircle className="w-4 h-4 text-[#2563EB]" />
                      <span>My Profile</span>
                    </button>
                    <button
                      type="button"
                      id="top-nav-menu-change-pw"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onViewChange('change-password');
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-[#7C3AED]" />
                      <span>Change Password</span>
                    </button>
                  </>
                )}
              </div>

              <div className="border-t border-[#F1F5F9] dark:border-[#273449] pt-1">
                <button
                  type="button"
                  id="top-nav-menu-logout"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#7F1D1D]/30 transition cursor-pointer font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
