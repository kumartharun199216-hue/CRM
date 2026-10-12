import React, { useState } from 'react';
import { User, Team, UserRole, AdminUpdateUserPayload } from '../types';
import { api } from '../services/api';
import {
  X,
  UserCheck,
  Mail,
  Phone,
  Shield,
  Briefcase,
  GraduationCap,
  Building,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Info,
  Lock,
} from 'lucide-react';

interface EditUserModalProps {
  user: User;
  currentUser: User | null;
  teams: Team[];
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  currentUser,
  teams,
  onClose,
  onSuccess,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN' || (currentUser as any)?.is_superuser;
  const isManager = currentUser?.role === 'MANAGER';

  // Current values
  const currentFullName =
    user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;

  // Form State
  const [fullName, setFullName] = useState(currentFullName);
  const [email, setEmail] = useState(user.email || '');
  const [mobileNumber, setMobileNumber] = useState(user.mobile_number || '');
  const [role, setRole] = useState<UserRole>(user.role);
  const [teamId, setTeamId] = useState<number | string>(user.team || '');
  const [designation, setDesignation] = useState(user.designation || '');
  const [department, setDepartment] = useState(user.department || 'Admissions & Counselling');
  const [workLocation, setWorkLocation] = useState(user.work_location || 'Bangalore HQ');
  const [dateOfJoining, setDateOfJoining] = useState(
    user.date_of_joining ? String(user.date_of_joining).split('T')[0] : ''
  );

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Validate form before submitting
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full Name is required.';
    }

    if (isAdmin) {
      if (!email.trim()) {
        errors.email = 'Email Address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errors.email = 'Enter a valid email address.';
      }
    }

    if (!mobileNumber.trim()) {
      errors.mobileNumber = 'Mobile Number is required.';
    } else {
      const digits = mobileNumber.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        errors.mobileNumber = 'Enter a valid contact number (7 to 15 digits).';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const payload: AdminUpdateUserPayload = {
        full_name: fullName.trim(),
        mobile_number: mobileNumber.trim(),
        designation: designation.trim(),
        department: department.trim(),
        work_location: workLocation.trim(),
        date_of_joining: dateOfJoining || null,
      };

      // Only Admins can modify email, role, and team
      if (isAdmin) {
        if (email.trim() && email.trim() !== user.email) {
          payload.email = email.trim();
        }
        payload.role = role;
        payload.team = teamId ? Number(teamId) : null;
      }

      const res = await api.updateUser(user.id, payload);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setGeneralError(err?.message || 'Failed to update employee details.');
    } finally {
      setSubmitting(false);
    }
  };

  const employeeId = user.employee_id || `EMP-${String(user.id).padStart(4, '0')}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      id="edit-user-modal-overlay"
    >
      <div
        className="bg-white dark:bg-[#172033] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        id="edit-user-modal"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-[#111827]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Edit Employee Details</h2>
                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-mono font-medium rounded border border-blue-200 dark:border-blue-900/50">
                  {employeeId}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update account profile, credentials contact, and organizational assignments.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            id="close-edit-user-modal-btn"
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* General Error Alert */}
          {generalError && (
            <div
              className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in"
              id="edit-user-error-banner"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Update Error: </span>
                <span>{generalError}</span>
              </div>
            </div>
          )}

          {/* Manager Boundary Info Notice */}
          {isManager && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Manager Scope: </span>
                You are authorized to update contact details and designation for Counsellors within your team. Role and team assignments require System Administrator access.
              </div>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              Personal & Contact Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="edit-user-fullname-input"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (formErrors.fullName) {
                      setFormErrors((prev) => ({ ...prev, fullName: '' }));
                    }
                  }}
                  placeholder="e.g. Rahul Sharma"
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${
                    formErrors.fullName
                      ? 'border-rose-400 bg-rose-50/30 dark:bg-rose-950/30 ring-2 ring-rose-200'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30'
                  } outline-none transition`}
                />
                {formErrors.fullName && (
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{formErrors.fullName}</p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center justify-between">
                  <span>
                    Email Address <span className="text-rose-500">*</span>
                  </span>
                  {!isAdmin && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 font-normal">
                      <Lock className="w-2.5 h-2.5" /> Admin Only
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    id="edit-user-email-input"
                    value={email}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formErrors.email) {
                        setFormErrors((prev) => ({ ...prev, email: '' }));
                      }
                    }}
                    placeholder="rahul.sharma@skillmove.com"
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border ${
                      !isAdmin
                        ? 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-700'
                        : formErrors.email
                        ? 'border-rose-400 bg-rose-50/30 dark:bg-rose-950/30 ring-2 ring-rose-200'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30'
                    } outline-none transition`}
                  />
                </div>
                {formErrors.email && (
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{formErrors.email}</p>
                )}
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    id="edit-user-mobile-input"
                    value={mobileNumber}
                    onChange={(e) => {
                      setMobileNumber(e.target.value);
                      if (formErrors.mobileNumber) {
                        setFormErrors((prev) => ({ ...prev, mobileNumber: '' }));
                      }
                    }}
                    placeholder="9876543210"
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border ${
                      formErrors.mobileNumber
                        ? 'border-rose-400 bg-rose-50/30 dark:bg-rose-950/30 ring-2 ring-rose-200'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30'
                    } outline-none transition font-mono`}
                  />
                </div>
                {formErrors.mobileNumber && (
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{formErrors.mobileNumber}</p>
                )}
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Designation / Title
                </label>
                <input
                  type="text"
                  id="edit-user-designation-input"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Admissions Counsellor"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Role & Organization Assignments */}
          <div className="space-y-4 pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
              <span>Role & Organizational Assignment</span>
              {!isAdmin && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 normal-case font-normal flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Managed by System Admin
                </span>
              )}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  System Role
                </label>
                {isAdmin ? (
                  <select
                    id="edit-user-role-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition cursor-pointer"
                  >
                    <option value="SALES_EMPLOYEE">Career Counsellor (Sales Employee)</option>
                    <option value="MANAGER">Sales Manager</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                ) : (
                  <div className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 flex items-center justify-between cursor-not-allowed">
                    <span className="font-medium">
                      {role === 'SALES_EMPLOYEE'
                        ? 'Career Counsellor'
                        : role === 'MANAGER'
                        ? 'Sales Manager'
                        : 'System Administrator'}
                    </span>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                )}
              </div>

              {/* Team Assignment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Assigned Team
                </label>
                {isAdmin ? (
                  <select
                    id="edit-user-team-select"
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition cursor-pointer"
                  >
                    <option value="">No Team Assigned</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 flex items-center justify-between cursor-not-allowed">
                    <span className="font-medium">{user.team_name || 'Assigned Team'}</span>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                )}
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Department
                </label>
                <div className="relative">
                  <Building className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    id="edit-user-department-input"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Admissions & Counselling"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition"
                  />
                </div>
              </div>

              {/* Work Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Work Location
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    id="edit-user-location-input"
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                    placeholder="Bangalore HQ"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition"
                  />
                </div>
              </div>

              {/* Date of Joining */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Date of Joining
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    id="edit-user-doj-input"
                    value={dateOfJoining}
                    onChange={(e) => setDateOfJoining(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              id="cancel-edit-user-btn"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-edit-user-btn"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
