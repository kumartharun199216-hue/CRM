import React, { useState, useEffect } from 'react';
import { Lead, Team, User, PipelineStage } from '../types';
import { X, Save, AlertCircle, UserCheck, ShieldCheck } from 'lucide-react';

interface LeadModalProps {
  lead?: Lead | null;
  isOpen: boolean;
  teams: Team[];
  users: User[];
  stages: PipelineStage[];
  currentUser: User;
  onClose: () => void;
  onSave: (data: Partial<Lead>) => Promise<void>;
}

export const LeadModal: React.FC<LeadModalProps> = ({
  lead,
  isOpen,
  teams,
  users,
  stages,
  currentUser,
  onClose,
  onSave,
}) => {
  const isEditing = !!lead;
  const isAdmin = currentUser.role === 'ADMIN';
  const isManager = currentUser.role === 'MANAGER';

  const authorizedTeamId = currentUser.managed_team_id || currentUser.team;

  // Student / Lead Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [qualification, setQualification] = useState('');
  const [college, setCollege] = useState('');
  const [yop, setYop] = useState('');
  const [keySkills, setKeySkills] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [experience, setExperience] = useState('');
  const [priority, setPriority] = useState('');
  const [leadStatus, setLeadStatus] = useState('');
  const [careerCounsellor, setCareerCounsellor] = useState('');
  const [city, setCity] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');

  // Ownership & Pipeline
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<number | ''>('');
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setName(lead.name || lead.title || lead.contact_name || '');
      setEmail(lead.email || '');
      setPhone(lead.phone || '');
      setQualification(lead.qualification || '');
      setCollege(lead.college || '');
      setYop(lead.yop || '');
      setKeySkills(lead.key_skills || '');
      setTargetRole(lead.target_role || '');
      setExperience(lead.experience || '');
      setPriority(lead.priority || '');
      setLeadStatus(lead.status || '');
      setCareerCounsellor(lead.career_counsellor || '');
      setCity(lead.city || '');
      setNextFollowUp(lead.next_follow_up ? lead.next_follow_up.substring(0, 16) : '');
      setSelectedTeamId(lead.team);
      setAssignedEmployeeId(lead.assigned_employee || '');
      setSelectedStageId(lead.stage);
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setQualification('');
      setCollege('');
      setYop('');
      setKeySkills('');
      setTargetRole('');
      setExperience('');
      setPriority('');
      setLeadStatus('');
      setCareerCounsellor('');
      setCity('');
      setNextFollowUp('');

      if (isManager && authorizedTeamId) {
        setSelectedTeamId(authorizedTeamId);
      } else if (teams.length > 0) {
        setSelectedTeamId(teams[0].id);
      } else {
        setSelectedTeamId('');
      }
      setAssignedEmployeeId('');
      // Default to initial pipeline stage (order 1) if available
      const initialStage = stages.find((s) => s.order === 1) || (stages.length > 0 ? stages[0] : null);
      setSelectedStageId(initialStage ? initialStage.id : null);
    }
    setError(null);
  }, [lead, isOpen, isManager, authorizedTeamId, teams, stages]);

  if (!isOpen) return null;

  // Filter available sales employees belonging to the selected team
  const availableEmployees = users.filter(
    (u) => u.role === 'SALES_EMPLOYEE' && u.team === selectedTeamId
  );

  const canChangeTeam = isAdmin && !isEditing;
  const canReassignEmployee = isAdmin || isManager;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Mandatory validation
    if (!name.trim()) {
      setError('Lead Name is required.');
      return;
    }

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    if (!phone.trim()) {
      setError('Mobile Phone is required.');
      return;
    }

    if (!selectedTeamId) {
      setError('Lead team is required.');
      return;
    }

    if (!assignedEmployeeId) {
      setError('Every lead must have a valid assigned Sales Employee.');
      return;
    }

    // Verify assigned employee belongs to selected team if creating or actively reassigning
    const isAssignmentUnchanged = isEditing && (assignedEmployeeId === lead?.assigned_employee && selectedTeamId === lead?.team);
    if (!isAssignmentUnchanged) {
      const employee = users.find((u) => u.id === assignedEmployeeId);
      if (!employee || employee.team !== selectedTeamId) {
        setError('The assigned employee must belong to the lead’s team.');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        title: name.trim(),
        contact_name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        qualification: qualification.trim(),
        college: college.trim(),
        yop: yop.trim(),
        key_skills: keySkills.trim(),
        target_role: targetRole.trim(),
        experience: experience.trim(),
        priority: priority.trim(),
        status: leadStatus.trim(),
        career_counsellor: careerCounsellor.trim(),
        city: city.trim(),
        next_follow_up: nextFollowUp ? new Date(nextFollowUp).toISOString() : null,
        team: selectedTeamId as number,
        assigned_employee: assignedEmployeeId as number,
        stage: selectedStageId,
        // Preserve existing financial fields on edit without requesting them from user
        ...(isEditing && lead ? {
          estimated_revenue: lead.estimated_revenue,
          placement_fee: lead.placement_fee,
        } : {}),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save lead record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="crm-card bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] relative">
        {/* Header */}
        <div className="p-4 border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between bg-[#F8FAFC] dark:bg-[#111827]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {isEditing ? `Edit Lead — ${lead.lead_id || `#${lead.id}`}` : 'Create New Lead'}
              </h3>
              {isEditing && (
                <span className="crm-pill crm-pill-blue font-mono text-[11px] font-semibold">
                  {lead.lead_id || `#${lead.id}`}
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              {isEditing
                ? 'Update student fields, pipeline stage and team assignment'
                : 'Register a new student lead. Lead ID is automatically generated (e.g. SM-LD-0001).'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#EFF6FF] dark:hover:bg-[#1E293B] rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto scrollbar-thin">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-rose-950/30 border border-red-200 dark:border-rose-900/50 rounded-xl flex items-start gap-2 text-xs text-[#DC2626] dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626] dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Lead ID Read-Only Indicator */}
          <div className="p-2.5 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/30 border border-[#BFDBFE] dark:border-blue-900/50 flex items-center justify-between text-xs text-[#1E3A8A] dark:text-blue-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
              <span>
                Lead ID: <strong className="font-mono text-[#0F172A] dark:text-[#F8FAFC]">{isEditing ? lead.lead_id || `#${lead.id}` : 'Auto-generated (e.g. SM-LD-0001)'}</strong>
              </span>
            </div>
            <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] italic">Managed automatically by database sequence</span>
          </div>

          {/* Section: Mandatory Student Fields */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 uppercase tracking-wider">
              Mandatory Student Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1">
                  Lead Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  required
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1">
                  Email <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  required
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1">
                  Mobile Phone <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555-123-4567"
                  required
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 transition"
                />
              </div>
            </div>
          </div>

          {/* Section: Academic & Qualification Details (Optional) */}
          <div className="space-y-3 pt-3 border-t border-[#E2E8F0] dark:border-[#334155]">
            <h4 className="text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 uppercase tracking-wider flex items-center justify-between">
              <span>Academic & Qualifications (Optional)</span>
              <span className="text-[11px] font-normal text-[#64748B] dark:text-[#94A3B8] lowercase">can remain empty</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">Degree / Qualification</label>
                <input
                  type="text"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="B.Tech Computer Science"
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">College / University</label>
                <input
                  type="text"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="State University"
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">Year of Passing (YOP)</label>
                <input
                  type="text"
                  value={yop}
                  onChange={(e) => setYop(e.target.value)}
                  placeholder="2025"
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] font-mono transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">Target Role</label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="Software Engineer"
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">Experience</label>
                <input
                  type="text"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="Fresher / 1-2 years"
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">City / Location</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Bangalore, India"
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">Key Skills</label>
              <textarea
                value={keySkills}
                onChange={(e) => setKeySkills(e.target.value)}
                placeholder="Python, React, Django, SQL..."
                rows={2}
                className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"
              />
            </div>
          </div>

          {/* Section: Status & Follow-up */}
          <div className="space-y-3 pt-3 border-t border-[#E2E8F0] dark:border-[#334155]">
            <h4 className="text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 uppercase tracking-wider">
              Status & Priority
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] transition"
                >
                  <option value="">None</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">Status</label>
                <input
                  type="text"
                  value={leadStatus}
                  onChange={(e) => setLeadStatus(e.target.value)}
                  placeholder="e.g. Active, Pending"
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">Career Counsellor</label>
                <input
                  type="text"
                  value={careerCounsellor}
                  onChange={(e) => setCareerCounsellor(e.target.value)}
                  placeholder="Counsellor Name"
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">Next Follow-up</label>
                <input
                  type="datetime-local"
                  value={nextFollowUp}
                  onChange={(e) => setNextFollowUp(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] transition"
                />
              </div>
            </div>
          </div>

          {/* Section: Ownership & Pipeline Stage */}
          <div className="space-y-3 pt-3 border-t border-[#E2E8F0] dark:border-[#334155]">
            <h4 className="text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 uppercase tracking-wider">
              CRM Ownership & Pipeline Stage
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Team */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1">
                  Team <span className="text-[#DC2626]">*</span>
                </label>
                {canChangeTeam ? (
                  <select
                    value={selectedTeamId}
                    onChange={(e) => {
                      const tid = Number(e.target.value);
                      setSelectedTeamId(tid);
                      setAssignedEmployeeId('');
                    }}
                    required
                    className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] transition"
                  >
                    <option value="">Select Team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#64748B] dark:text-[#94A3B8]">
                    {lead?.team_name || teams.find((t) => t.id === selectedTeamId)?.name || 'Authorized Team'}
                  </div>
                )}
              </div>

              {/* Assigned Sales Employee */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1">
                  Assigned Sales Employee <span className="text-[#DC2626]">*</span>
                </label>
                {canReassignEmployee ? (
                  <select
                    value={assignedEmployeeId}
                    onChange={(e) => setAssignedEmployeeId(Number(e.target.value))}
                    required
                    className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] transition"
                  >
                    <option value="">Select Sales Employee</option>
                    {availableEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name || emp.username}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
                    {lead?.assigned_employee_name || users.find((u) => u.id === assignedEmployeeId)?.full_name || users.find((u) => u.id === assignedEmployeeId)?.username || 'Assigned'}
                  </div>
                )}
                {canReassignEmployee && availableEmployees.length === 0 && selectedTeamId && (
                  <p className="text-[10px] text-[#D97706] mt-1">
                    No Sales Employees registered in this team.
                  </p>
                )}
              </div>

              {/* Pipeline Stage */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1">
                  Pipeline Stage
                </label>
                <select
                  value={selectedStageId ?? ''}
                  onChange={(e) =>
                    setSelectedStageId(e.target.value === '' ? null : Number(e.target.value))
                  }
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] transition"
                >
                  <option value="">Unassigned Stage</option>
                  {stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.order}. {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="crm-btn-secondary px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="crm-btn-primary flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
