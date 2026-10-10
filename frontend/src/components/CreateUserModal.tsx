import React, { useState } from 'react';
import { User, Team, UserRole, CreateUserPayload } from '../types';
import { api } from '../services/api';
import {
  X,
  UserPlus,
  Mail,
  Phone,
  Shield,
  Briefcase,
  GraduationCap,
  Building,
  MapPin,
  Calendar,
  Lock,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface CreateUserModalProps {
  currentUser: User | null;
  teams: Team[];
  onClose: () => void;
  onSuccess: (newUser: User) => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  currentUser,
  teams,
  onClose,
  onSuccess,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN' || (currentUser as any)?.is_superuser;
  const isManager = currentUser?.role === 'MANAGER';

  // For manager, authorized team is their managed team or team
  const managerAuthorizedTeamId = currentUser?.managed_team_id || currentUser?.team || (teams.length > 0 ? teams[0].id : null);
  const managerAuthorizedTeamName = currentUser?.managed_team_name || currentUser?.team_name || (teams.find(t => t.id === managerAuthorizedTeamId)?.name) || 'Authorized Team';

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [role, setRole] = useState<UserRole>(isManager ? 'SALES_EMPLOYEE' : 'SALES_EMPLOYEE');
  const [teamId, setTeamId] = useState<number | string>(isManager ? (managerAuthorizedTeamId || '') : (teams.length > 0 ? teams[0].id : ''));
  const [designation, setDesignation] = useState('');
  const [reportingManagerId, setReportingManagerId] = useState<number | string>(isManager ? (currentUser?.id || '') : '');
  const [department, setDepartment] = useState('Admissions & Counselling');
  const [workLocation, setWorkLocation] = useState('Bangalore HQ');
  const [dateOfJoining, setDateOfJoining] = useState(new Date().toISOString().split('T')[0]);
  const [password, setPassword] = useState('');

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

    if (!email.trim()) {
      errors.email = 'Email Address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address.';
    }

    if (!mobileNumber.trim()) {
      errors.mobileNumber = 'Mobile Number is required.';
    } else {
      const digits = mobileNumber.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        errors.mobileNumber = 'Enter a valid contact number (7 to 15 digits).';
      }
    }

    if (role === 'SALES_EMPLOYEE' && (!teamId || teamId === '')) {
      errors.teamId = 'Each Career Counsellor must be assigned to a team.';
    }

    if (password && password.length < 8) {
      errors.password = 'Initial password must be at least 8 characters.';
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
      const payload: CreateUserPayload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        mobile_number: mobileNumber.trim(),
        role: isManager ? 'SALES_EMPLOYEE' : role,
        team: isManager
          ? (typeof managerAuthorizedTeamId === 'number' ? managerAuthorizedTeamId : null)
          : (teamId ? Number(teamId) : null),
        designation: designation.trim() || undefined,
        department: department.trim() || undefined,
        work_location: workLocation.trim() || undefined,
        date_of_joining: dateOfJoining || null,
        reporting_manager: isManager ? (currentUser?.id || null) : (reportingManagerId ? Number(reportingManagerId) : null),
        password: password.trim() || undefined,
      };

      const createdUser = await api.createUser(payload);
      onSuccess(createdUser);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to create employee account.';
      setGeneralError(errMsg);

      // Attempt to map specific backend errors to inline fields
      const newErrors: Record<string, string> = {};
      if (errMsg.toLowerCase().includes('email')) {
        newErrors.email = errMsg.includes(':') ? errMsg.split(':')[1].trim() : errMsg;
      }
      if (errMsg.toLowerCase().includes('mobile')) {
        newErrors.mobileNumber = errMsg.includes(':') ? errMsg.split(':')[1].trim() : errMsg;
      }
      if (errMsg.toLowerCase().includes('team')) {
        newErrors.teamId = errMsg.includes(':') ? errMsg.split(':')[1].trim() : errMsg;
      }
      if (errMsg.toLowerCase().includes('role')) {
        newErrors.role = errMsg.includes(':') ? errMsg.split(':')[1].trim() : errMsg;
      }
      if (Object.keys(newErrors).length > 0) {
        setFormErrors((prev) => ({ ...prev, ...newErrors }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#E2E8F0] flex items-center justify-between bg-linear-to-r from-blue-50/70 via-indigo-50/30 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="create-user-modal-title" className="text-base font-bold text-[#0F172A]">
                Add New Employee
              </h2>
              <p className="text-xs text-[#64748B]">
                {isAdmin
                  ? 'Onboard staff members, allocate teams, and configure access permissions'
                  : `Add a new Career Counsellor to ${managerAuthorizedTeamName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-create-user-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5 text-xs text-[#0F172A]">
          {/* General Error Banner */}
          {generalError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-medium leading-relaxed">{generalError}</div>
            </div>
          )}

          {/* System Managed Banner */}
          <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-start gap-3">
            <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
            <div className="text-[11px] text-[#475569] space-y-1">
              <span className="font-semibold text-[#0F172A]">System Managed Setup: </span>
              Employee ID will be uniquely generated (<code className="font-mono text-blue-700 bg-blue-50 px-1 py-0.5 rounded">EMP-XXXX</code>), account activated immediately, and initial password change required upon first sign-in.
            </div>
          </div>

          {/* SECTION 1: REQUIRED PERSONAL & CONTACT FIELDS */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3 flex items-center gap-1.5">
              <span>Required Information</span>
              <span className="text-rose-500">*</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Full Name */}
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="user-full-name" className="font-semibold text-slate-700 flex items-center justify-between">
                  <span>Full Name <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="text"
                  id="user-full-name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (formErrors.fullName) setFormErrors((prev) => ({ ...prev, fullName: '' }));
                  }}
                  placeholder="e.g. Aarav Patel"
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition ${
                    formErrors.fullName ? 'border-rose-400 bg-rose-50/20' : 'border-[#CBD5E1] bg-white'
                  }`}
                  required
                />
                {formErrors.fullName && <p className="text-[11px] text-rose-600 font-medium">{formErrors.fullName}</p>}
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label htmlFor="user-email" className="font-semibold text-slate-700 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Address <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="email"
                  id="user-email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  placeholder="e.g. aarav.patel@skillmove.in"
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition ${
                    formErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-[#CBD5E1] bg-white'
                  }`}
                  required
                />
                {formErrors.email && <p className="text-[11px] text-rose-600 font-medium">{formErrors.email}</p>}
              </div>

              {/* Mobile Number */}
              <div className="space-y-1">
                <label htmlFor="user-mobile" className="font-semibold text-slate-700 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mobile Number <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="tel"
                  id="user-mobile"
                  value={mobileNumber}
                  onChange={(e) => {
                    setMobileNumber(e.target.value);
                    if (formErrors.mobileNumber) setFormErrors((prev) => ({ ...prev, mobileNumber: '' }));
                  }}
                  placeholder="e.g. +91 98765 43210"
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition ${
                    formErrors.mobileNumber ? 'border-rose-400 bg-rose-50/20' : 'border-[#CBD5E1] bg-white'
                  }`}
                  required
                />
                {formErrors.mobileNumber && (
                  <p className="text-[11px] text-rose-600 font-medium">{formErrors.mobileNumber}</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: ROLE & TEAM ALLOCATION */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">
              Role & Team Allocation
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Role Selection */}
              <div className="space-y-1">
                <label htmlFor="user-role" className="font-semibold text-slate-700 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  <span>Role <span className="text-rose-500">*</span></span>
                </label>
                {isManager ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-not-allowed">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Career Counsellor</span>
                    <span className="ml-auto text-[10px] text-slate-400 font-semibold uppercase">Authorized</span>
                  </div>
                ) : (
                  <select
                    id="user-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs border border-[#CBD5E1] bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer"
                  >
                    <option value="SALES_EMPLOYEE">Career Counsellor (Sales Employee)</option>
                    <option value="MANAGER">Sales Manager</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                )}
                {formErrors.role && <p className="text-[11px] text-rose-600 font-medium">{formErrors.role}</p>}
              </div>

              {/* Team Allocation */}
              <div className="space-y-1">
                <label htmlFor="user-team" className="font-semibold text-slate-700 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Team {role === 'SALES_EMPLOYEE' && <span className="text-rose-500">*</span>}
                  </span>
                </label>
                {isManager ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-not-allowed">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{managerAuthorizedTeamName}</span>
                    <span className="ml-auto text-[10px] text-slate-400 font-semibold uppercase">Locked</span>
                  </div>
                ) : (
                  <select
                    id="user-team"
                    value={teamId}
                    onChange={(e) => {
                      setTeamId(e.target.value);
                      if (formErrors.teamId) setFormErrors((prev) => ({ ...prev, teamId: '' }));
                    }}
                    className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer ${
                      formErrors.teamId ? 'border-rose-400 bg-rose-50/20' : 'border-[#CBD5E1] bg-white'
                    }`}
                  >
                    <option value="">Select Team...</option>
                    {teams.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                      </option>
                    ))}
                  </select>
                )}
                {formErrors.teamId && <p className="text-[11px] text-rose-600 font-medium">{formErrors.teamId}</p>}
              </div>
            </div>
          </div>

          {/* SECTION 3: OPTIONAL EMPLOYMENT DETAILS */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">
              Optional Employment Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Designation */}
              <div className="space-y-1">
                <label htmlFor="user-designation" className="font-semibold text-slate-700 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Designation</span>
                </label>
                <input
                  type="text"
                  id="user-designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Career Counsellor"
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>

              {/* Department */}
              <div className="space-y-1">
                <label htmlFor="user-department" className="font-semibold text-slate-700 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  <span>Department</span>
                </label>
                <input
                  type="text"
                  id="user-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Admissions & Counselling"
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>

              {/* Work Location */}
              <div className="space-y-1">
                <label htmlFor="user-location" className="font-semibold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Work Location</span>
                </label>
                <input
                  type="text"
                  id="user-location"
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                  placeholder="e.g. Bangalore HQ / Remote"
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>

              {/* Date of Joining */}
              <div className="space-y-1">
                <label htmlFor="user-doj" className="font-semibold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Date of Joining</span>
                </label>
                <input
                  type="date"
                  id="user-doj"
                  value={dateOfJoining}
                  onChange={(e) => setDateOfJoining(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: INITIAL PASSWORD */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="user-password" className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Initial Password (Optional)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Leave blank for system default</span>
            </div>
            <input
              type="password"
              id="user-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: '' }));
              }}
              placeholder="e.g. Welcome@2026 (min 8 characters)"
              className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 ${
                formErrors.password ? 'border-rose-400 bg-rose-50/20' : 'border-[#CBD5E1] bg-white'
              }`}
            />
            {formErrors.password && <p className="text-[11px] text-rose-600 font-medium">{formErrors.password}</p>}
            <p className="text-[11px] text-slate-500">
              The user will be prompted to choose a new password upon first sign-in.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
            <button
              type="button"
              id="cancel-create-user-btn"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-create-user-btn"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Employee...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
