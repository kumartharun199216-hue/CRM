import React, { useState, useRef, useEffect } from 'react';
import { User, ViewType } from '../types';
import { ThemeToggle } from './ThemeToggle';
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

  const notifications = [
    {
      id: 1,
      title: 'Active Follow-ups Pending',
      time: '15m ago',
      desc: 'Scheduled consultations awaiting status update today.',
      read: false,
    },
    {
      id: 2,
      title: 'Pipeline Progression',
      time: '1h ago',
      desc: 'Student moved to Pending Closure stage.',
      read: false,
    },
    {
      id: 3,
      title: 'Daily Admissions Summary',
      time: '4h ago',
      desc: 'New lead inquiries updated across admissions queues.',
      read: true,
    },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

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
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            aria-label={`Notifications, ${unreadCount} unread`}
            title="Notifications"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors relative cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span
                id="top-nav-notif-count-badge"
                className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#DC2626] ring-2 ring-white dark:ring-[#111827]"
              />
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-[#F1F5F9] dark:border-[#273449] flex items-center justify-between">
                <span className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">Notifications</span>
                <span className="text-[10px] font-semibold text-[#2563EB] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#172554] px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              </div>
              <div className="divide-y divide-[#F1F5F9] dark:divide-[#273449] max-h-80 overflow-y-auto">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 text-xs hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition cursor-pointer ${!item.read ? 'bg-[#EFF6FF]/40 dark:bg-[#172554]/30' : ''
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{item.title}</span>
                      <span className="text-[10px] text-[#94A3B8] dark:text-[#64748B]">{item.time}</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] m-0">{item.desc}</p>
                  </div>
                ))}
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
