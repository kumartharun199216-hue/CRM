import React, { useState, useEffect } from 'react';
import { User, UserUpdatePayload } from '../types';
import { api } from '../services/api';
import {
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  Briefcase,
  GraduationCap,
  Building,
  MapPin,
  Calendar,
  Lock,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  X,
  KeyRound,
  RefreshCw,
  Users,
  Clock,
  Check,
} from 'lucide-react';

interface MyProfilePageProps {
  currentUser: User;
  onProfileUpdated?: (updatedUser: User) => void;
  onNavigateToChangePassword?: () => void;
}

export const MyProfilePage: React.FC<MyProfilePageProps> = ({
  currentUser,
  onProfileUpdated,
  onNavigateToChangePassword,
}) => {
  const [profile, setProfile] = useState<User>(currentUser);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form edit state
  const [formData, setFormData] = useState({
    fullName: currentUser.full_name || currentUser.name || `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.username,
    mobileNumber: currentUser.mobile_number || '',
    workLocation: currentUser.work_location || '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch latest profile from backend on mount or refresh
  const fetchProfile = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await api.getProfile();
      setProfile(data);
      setFormData({
        fullName: data.full_name || data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.username,
        mobileNumber: data.mobile_number || '',
        workLocation: data.work_location || '',
      });
      if (onProfileUpdated) {
        onProfileUpdated(data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleStartEdit = () => {
    setFormData({
      fullName: profile.full_name || profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username,
      mobileNumber: profile.mobile_number || '',
      workLocation: profile.work_location || '',
    });
    setFormErrors({});
    setSuccessMessage(null);
    setErrorMessage(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData({
      fullName: profile.full_name || profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username,
      mobileNumber: profile.mobile_number || '',
      workLocation: profile.work_location || '',
    });
    setFormErrors({});
    setErrorMessage(null);
    setIsEditing(false);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full Name is required.';
    } else if (formData.fullName.trim().length < 2) {
      errors.fullName = 'Full Name must be at least 2 characters.';
    }

    if (formData.mobileNumber.trim()) {
      const digitsOnly = formData.mobileNumber.replace(/\D/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        errors.mobileNumber = 'Enter a valid mobile phone number (7 to 15 digits).';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload: UserUpdatePayload = {
      full_name: formData.fullName.trim(),
      mobile_number: formData.mobileNumber.trim(),
      work_location: formData.workLocation.trim(),
    };

    try {
      const updated = await api.updateProfile(payload);
      setProfile(updated);
      setFormData({
        fullName: updated.full_name || updated.name || `${updated.first_name || ''} ${updated.last_name || ''}`.trim() || updated.username,
        mobileNumber: updated.mobile_number || '',
        workLocation: updated.work_location || '',
      });
      setIsEditing(false);
      setSuccessMessage('Your profile details have been successfully updated.');
      if (onProfileUpdated) {
        onProfileUpdated(updated);
      }
    } catch (err: any) {
      if (err.data && typeof err.data === 'object') {
        const backendErrors: Record<string, string> = {};
        for (const [key, val] of Object.entries(err.data)) {
          backendErrors[key] = Array.isArray(val) ? val.join(' ') : String(val);
        }
        setFormErrors(backendErrors);
        setErrorMessage('Please correct the highlighted errors and try again.');
      } else {
        setErrorMessage(err.message || 'Failed to update profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="crm-pill crm-pill-purple flex items-center gap-1.5" id="profile-hero-role-badge">
            <Shield className="w-3.5 h-3.5 text-[#7C3AED]" /> System Administrator
          </span>
        );
      case 'MANAGER':
        return (
          <span className="crm-pill crm-pill-blue flex items-center gap-1.5" id="profile-hero-role-badge">
            <Briefcase className="w-3.5 h-3.5 text-[#2563EB]" /> Admissions Manager
          </span>
        );
      case 'SALES_EMPLOYEE':
      default:
        return (
          <span className="crm-pill bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center gap-1.5" id="profile-hero-role-badge">
            <GraduationCap className="w-3.5 h-3.5 text-[#2563EB]" /> Career Counsellor
          </span>
        );
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Not Specified';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'Not Recorded';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Avatar Initials
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const displayName = profile.full_name || profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username;
  const displayEmployeeId = profile.employee_id || `EMP-${String(profile.id).padStart(4, '0')}`;
  const displayDesignation = profile.designation || (profile.role === 'ADMIN' ? 'System Administrator' : profile.role === 'MANAGER' ? 'Sales Manager' : 'Career Counsellor');

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12" id="my-profile-page">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-[#0F172A] m-0">My Profile</h2>
            <span className="crm-pill bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] text-[11px] font-mono">
              {displayEmployeeId}
            </span>
          </div>
          <p className="text-xs text-[#64748B] font-medium m-0 truncate mt-0.5">
            Manage your personal profile details, contact preferences, and view organizational credentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchProfile}
            disabled={loading || saving}
            className="crm-btn-secondary px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Reload profile"
            id="refresh-profile-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {onNavigateToChangePassword && (
            <button
              type="button"
              id="change-password-nav-btn"
              onClick={onNavigateToChangePassword}
              className="crm-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:border-[#BFDBFE]"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Change Password</span>
            </button>
          )}

          {!isEditing ? (
            <button
              type="button"
              id="edit-profile-btn"
              onClick={handleStartEdit}
              className="crm-btn-primary px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-white" />
              <span>Edit Profile</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="cancel-edit-profile-btn"
                onClick={handleCancelEdit}
                disabled={saving}
                className="crm-btn-secondary px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                id="save-profile-btn"
                onClick={handleSaveProfile}
                disabled={saving}
                className="crm-btn-primary px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-white" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMessage && (
        <div
          id="profile-success-alert"
          className="p-3.5 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl text-xs text-[#065F46] flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-[#059669] hover:text-[#065F46] font-bold text-sm cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          id="profile-error-alert"
          className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#DC2626] flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[#DC2626] hover:text-[#991B1B] font-bold text-sm cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Hero Profile Banner Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs">
        <div className="h-28 bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#4F46E5] relative p-6">
          <div className="absolute top-3 right-4 flex items-center gap-2">
            <span className="text-[11px] font-medium text-white/80 bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-xs border border-white/15">
              Skill Move Sales CRM
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-4">
            <div className="flex items-end gap-4">
              {/* Profile Avatar / Initials */}
              <div className="w-22 h-22 rounded-2xl bg-white p-1 border-2 border-white shadow-md shrink-0">
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white text-2xl font-bold tracking-wider shadow-inner">
                  {getInitials(displayName)}
                </div>
              </div>

              <div className="space-y-1 mb-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold text-[#0F172A] tracking-tight m-0" id="profile-hero-name">
                    {displayName}
                  </h1>
                  <span
                    id="profile-hero-status-badge"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      profile.is_active !== false
                        ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                        : 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        profile.is_active !== false ? 'bg-[#10B981] animate-pulse' : 'bg-[#94A3B8]'
                      }`}
                    />
                    {profile.account_status || (profile.is_active !== false ? 'ACTIVE' : 'INACTIVE')}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] font-medium m-0 flex items-center gap-2">
                  <span className="font-semibold text-[#334155]">{displayDesignation}</span>
                  <span>•</span>
                  <span className="font-mono text-[11px] bg-[#F8FAFC] px-1.5 py-0.5 rounded text-[#475569] border border-[#E2E8F0]" id="profile-hero-employee-id">
                    {displayEmployeeId}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getRoleBadge(profile.role)}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#E2E8F0]">
            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]/60">
              <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#2563EB]" /> Team
              </div>
              <div className="text-xs font-bold text-[#0F172A] truncate mt-1">
                {profile.team_name || (profile.team ? `Team #${profile.team}` : 'Unassigned')}
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]/60">
              <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#2563EB]" /> Department
              </div>
              <div className="text-xs font-bold text-[#0F172A] truncate mt-1">
                {profile.department || 'Admissions'}
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]/60">
              <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#2563EB]" /> Work Location
              </div>
              <div className="text-xs font-bold text-[#0F172A] truncate mt-1">
                {profile.work_location || 'Headquarters'}
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]/60">
              <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#2563EB]" /> Joined Date
              </div>
              <div className="text-xs font-bold text-[#0F172A] truncate mt-1">
                {formatDate(profile.date_of_joining || profile.date_joined)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Details Form / View */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Section 1: Permitted Personal Details */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 m-0">
                <UserIcon className="w-4 h-4 text-[#2563EB]" />
                <span>Personal & Contact Information</span>
              </h3>
              <p className="text-[11px] text-[#64748B] mt-0.5 m-0">
                {isEditing
                  ? 'Update your name, mobile phone number, and work location.'
                  : 'Your personal identification and direct contact preferences.'}
              </p>
            </div>
            {isEditing && (
              <span className="text-[11px] font-semibold text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-0.5 rounded-full">
                Editing Permitted Fields
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                Full Name <span className="text-[#DC2626]">*</span>
              </label>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    id="profile-input-full-name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. John Doe"
                    disabled={saving}
                    className={`w-full px-3 py-2 text-xs rounded-lg border bg-white text-[#0F172A] focus:outline-hidden focus:ring-2 transition ${
                      formErrors.fullName
                        ? 'border-[#EF4444] focus:ring-[#EF4444]/20'
                        : 'border-[#CBD5E1] focus:border-[#2563EB] focus:ring-[#2563EB]/20'
                    }`}
                  />
                  {formErrors.fullName && (
                    <p className="text-[11px] text-[#DC2626] mt-1 font-medium">{formErrors.fullName}</p>
                  )}
                </div>
              ) : (
                <div
                  id="profile-field-full-name"
                  className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A]"
                >
                  {displayName}
                </div>
              )}
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                Mobile Number
              </label>
              {isEditing ? (
                <div>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="tel"
                      id="profile-input-mobile"
                      value={formData.mobileNumber}
                      onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      disabled={saving}
                      className={`w-full pl-9 pr-3 py-2 text-xs rounded-lg border bg-white text-[#0F172A] focus:outline-hidden focus:ring-2 transition ${
                        formErrors.mobile_number || formErrors.mobileNumber
                          ? 'border-[#EF4444] focus:ring-[#EF4444]/20'
                          : 'border-[#CBD5E1] focus:border-[#2563EB] focus:ring-[#2563EB]/20'
                      }`}
                    />
                  </div>
                  {(formErrors.mobile_number || formErrors.mobileNumber) && (
                    <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                      {formErrors.mobile_number || formErrors.mobileNumber}
                    </p>
                  )}
                </div>
              ) : (
                <div
                  id="profile-field-mobile"
                  className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] flex items-center gap-2"
                >
                  <Phone className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>{profile.mobile_number || 'Not provided'}</span>
                </div>
              )}
            </div>

            {/* Work Location */}
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                Work Location / Office Branch
              </label>
              {isEditing ? (
                <div>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      id="profile-input-work-location"
                      value={formData.workLocation}
                      onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })}
                      placeholder="e.g. Headquarters, Building B"
                      disabled={saving}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition"
                    />
                  </div>
                </div>
              ) : (
                <div
                  id="profile-field-work-location"
                  className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>{profile.work_location || 'Not specified'}</span>
                </div>
              )}
            </div>

            {/* Email Address (Protected / Read-Only with security explanation) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#334155] flex items-center gap-1.5">
                  <span>Email Address</span>
                  <Lock className="w-3 h-3 text-[#64748B]" />
                </label>
                <span className="text-[10px] text-[#64748B] font-medium">Policy Protected</span>
              </div>
              <div
                id="profile-field-email"
                className="px-3.5 py-2.5 bg-[#F1F5F9]/70 border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#334155] flex items-center justify-between cursor-not-allowed"
                title="Email changes must follow the authorized verification and security policy."
              >
                <div className="flex items-center gap-2 truncate">
                  <Mail className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </div>
                <span className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-[#E2E8F0] shrink-0 ml-2">
                  Read Only
                </span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-1 italic">
                Email changes require administrator approval and security verification.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Protected Employment & Organization Details */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 m-0">
                <Briefcase className="w-4 h-4 text-[#7C3AED]" />
                <span>Employment & Organization Details</span>
              </h3>
              <p className="text-[11px] text-[#64748B] mt-0.5 m-0">
                Official HR and administrative records. Protected from unauthorized self-modification.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B] bg-[#F1F5F9] border border-[#E2E8F0] px-2.5 py-0.5 rounded-full">
              <Lock className="w-3 h-3 text-[#64748B]" /> Organization Managed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Employee ID */}
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span>Employee ID</span>
                <Lock className="w-3 h-3 text-[#64748B]" />
              </label>
              <div
                id="profile-field-employee-id"
                className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-mono font-bold text-[#0F172A]"
              >
                {displayEmployeeId}
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span>Assigned Role</span>
                <Lock className="w-3 h-3 text-[#64748B]" />
              </label>
              <div
                id="profile-field-role"
                className="px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg flex items-center justify-between"
              >
                <span className="text-xs font-semibold text-[#0F172A]">{profile.role}</span>
                {getRoleBadge(profile.role)}
              </div>
            </div>

            {/* Designation */}
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span>Designation</span>
                <Lock className="w-3 h-3 text-[#64748B]" />
              </label>
              <div
                id="profile-field-designation"
                className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A]"
              >
                {displayDesignation}
              </div>
            </div>

            {/* Department */}
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span>Department</span>
                <Lock className="w-3 h-3 text-[#64748B]" />
              </label>
              <div
                id="profile-field-department"
                className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A]"
              >
                {profile.department || 'Admissions & Student Operations'}
              </div>
            </div>

            {/* Date of Joining */}
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span>Date of Joining</span>
                <Lock className="w-3 h-3 text-[#64748B]" />
              </label>
              <div
                id="profile-field-date-of-joining"
                className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] flex items-center gap-2"
              >
                <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                <span>{formatDate(profile.date_of_joining)}</span>
              </div>
            </div>

            {/* Account Status */}
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span>Account Status</span>
                <Lock className="w-3 h-3 text-[#64748B]" />
              </label>
              <div
                id="profile-field-account-status"
                className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold flex items-center gap-2"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    profile.is_active !== false ? 'bg-[#10B981]' : 'bg-[#94A3B8]'
                  }`}
                />
                <span className={profile.is_active !== false ? 'text-[#059669]' : 'text-[#64748B]'}>
                  {profile.account_status || (profile.is_active !== false ? 'ACTIVE' : 'INACTIVE')}
                </span>
              </div>
            </div>

            {/* Date Created */}
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span>Account Created</span>
                <Lock className="w-3 h-3 text-[#64748B]" />
              </label>
              <div
                id="profile-field-date-created"
                className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#64748B] flex items-center gap-2"
              >
                <Clock className="w-3.5 h-3.5 text-[#64748B]" />
                <span>{formatDateTime(profile.date_joined)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Team & Reporting Hierarchy */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 m-0">
                <Users className="w-4 h-4 text-[#059669]" />
                <span>Team & Reporting Hierarchy</span>
              </h3>
              <p className="text-[11px] text-[#64748B] mt-0.5 m-0">
                Operational team membership and direct supervisory structure.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B] bg-[#F1F5F9] border border-[#E2E8F0] px-2.5 py-0.5 rounded-full">
              <Lock className="w-3 h-3 text-[#64748B]" /> Administrative Assignment
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Team Assignment */}
            <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  Assigned Team
                </span>
                <Lock className="w-3 h-3 text-[#64748B]" />
              </div>
              <div id="profile-field-team" className="text-sm font-bold text-[#0F172A]">
                {profile.team_name || (profile.team ? `Team #${profile.team}` : 'No Team Assigned')}
              </div>
              <p className="text-[11px] text-[#64748B] m-0">
                {profile.role === 'ADMIN'
                  ? 'As an Administrator, you have organization-wide oversight across all teams.'
                  : profile.role === 'MANAGER'
                  ? 'You manage counsellor assignments and student distribution for your team.'
                  : 'Your leads and student inquiries are allocated within this team.'}
              </p>
            </div>

            {/* Reporting Manager */}
            <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  Reporting Manager
                </span>
                <Lock className="w-3 h-3 text-[#64748B]" />
              </div>
              <div id="profile-field-reporting-manager" className="text-sm font-bold text-[#0F172A]">
                {profile.reporting_manager_name || (profile.role === 'ADMIN' ? 'Executive Leadership' : profile.role === 'MANAGER' ? 'Head of Admissions' : 'Unassigned')}
              </div>
              {profile.reporting_manager_email && (
                <div className="text-xs text-[#2563EB] flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  <span>{profile.reporting_manager_email}</span>
                </div>
              )}
              <p className="text-[11px] text-[#64748B] m-0">
                Direct reporting manager for performance reviews and escalated student approvals.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Action Footer when editing */}
        {isEditing && (
          <div className="flex items-center justify-end gap-3 p-4 bg-white border border-[#E2E8F0] rounded-xl shadow-xs">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className="crm-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="crm-btn-primary px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
export default MyProfilePage;
