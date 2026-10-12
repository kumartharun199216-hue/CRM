import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme, ThemeMode } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showDropdown?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showDropdown = true }) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation for dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      }
    }
  };

  const handleSelect = (mode: ThemeMode) => {
    setTheme(mode);
    setIsOpen(false);
  };

  const tooltipText =
    theme === 'system'
      ? `System Theme (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`
      : resolvedTheme === 'dark'
      ? 'Dark Mode — Click to switch'
      : 'Light Mode — Click to switch';

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        id="theme-toggle-btn"
        onClick={() => {
          if (showDropdown) {
            setIsOpen((prev) => !prev);
          } else {
            toggleTheme();
          }
        }}
        onKeyDown={handleKeyDown}
        aria-label={`Current theme: ${theme}. Toggle theme options`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={tooltipText}
        className="w-10 h-10 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] bg-transparent hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] border border-transparent hover:border-[#E2E8F0] dark:hover:border-[#334155] transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
      >
        <span className="relative flex items-center justify-center w-5 h-5">
          {resolvedTheme === 'dark' ? (
            <Moon className="w-5 h-5 text-[#60A5FA] transition-transform duration-200 rotate-0 scale-100" />
          ) : (
            <Sun className="w-5 h-5 text-[#D97706] transition-transform duration-200 rotate-0 scale-100" />
          )}
        </span>
      </button>

      {/* Accessible Theme Selection Dropdown */}
      {showDropdown && isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="theme-toggle-btn"
          className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider border-b border-[#F1F5F9] dark:border-[#273449] mb-1">
            Appearance
          </div>

          {/* Light Mode Option */}
          <button
            type="button"
            role="menuitem"
            id="theme-option-light"
            onClick={() => handleSelect('light')}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition cursor-pointer ${
              theme === 'light'
                ? 'bg-[#EFF6FF] text-[#2563EB] dark:bg-[#172554] dark:text-[#60A5FA]'
                : 'text-[#0F172A] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sun className="w-4 h-4 text-[#D97706]" />
              <span>Light Mode</span>
            </div>
            {theme === 'light' && <Check className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />}
          </button>

          {/* Dark Mode Option */}
          <button
            type="button"
            role="menuitem"
            id="theme-option-dark"
            onClick={() => handleSelect('dark')}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition cursor-pointer ${
              theme === 'dark'
                ? 'bg-[#EFF6FF] text-[#2563EB] dark:bg-[#172554] dark:text-[#60A5FA]'
                : 'text-[#0F172A] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Moon className="w-4 h-4 text-[#60A5FA]" />
              <span>Dark Mode</span>
            </div>
            {theme === 'dark' && <Check className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />}
          </button>

          {/* System Default Option */}
          <button
            type="button"
            role="menuitem"
            id="theme-option-system"
            onClick={() => handleSelect('system')}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition cursor-pointer ${
              theme === 'system'
                ? 'bg-[#EFF6FF] text-[#2563EB] dark:bg-[#172554] dark:text-[#60A5FA]'
                : 'text-[#0F172A] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Monitor className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" />
              <span>System Default</span>
            </div>
            {theme === 'system' && <Check className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />}
          </button>
        </div>
      )}
    </div>
  );
};
