import React, { useState, useEffect } from 'react';
import { CommunicationTemplate, User } from '../types';
import { api } from '../services/api';
import { X, Plus, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface TemplatesModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  currentUser,
  onClose,
}) => {
  const canCreate = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = () => {
    setLoading(true);
    api.getTemplates()
      .then(setTemplates)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to fetch templates'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setIsCreating(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createTemplate({
        name,
        channel,
        subject: channel === 'EMAIL' ? subject : undefined,
        body,
      });
      setName('');
      setSubject('');
      setBody('');
      setIsCreating(false);
      loadTemplates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="crm-card bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] relative">
        {/* Header */}
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#2563EB]" />
              Communication Templates
            </h3>
            <p className="text-xs text-[#64748B]">
              Reusable templates for Google SMTP email and WhatsApp Business messaging
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#EFF6FF] rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto scrollbar-thin">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#DC2626] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
              <span>{error}</span>
            </div>
          )}

          {canCreate && !isCreating && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="crm-btn-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Template</span>
            </button>
          )}

          {isCreating && (
            <form onSubmit={handleCreate} className="p-4 crm-card border border-[#E2E8F0] bg-[#F8FAFC] rounded-xl space-y-3">
              <h4 className="text-xs font-semibold text-[#0F172A]">New Template</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#0F172A] mb-1">Template Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Introduction Follow-up"
                    className="w-full text-xs bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F172A] mb-1">Channel *</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as 'EMAIL' | 'WHATSAPP')}
                    className="w-full text-xs bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition"
                  >
                    <option value="EMAIL">Email (Google SMTP)</option>
                    <option value="WHATSAPP">WhatsApp Business</option>
                  </select>
                </div>
              </div>

              {channel === 'EMAIL' && (
                <div>
                  <label className="block text-xs font-medium text-[#0F172A] mb-1">Email Subject *</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    placeholder="Subject..."
                    className="w-full text-xs bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#0F172A] mb-1">Body *</label>
                <textarea
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  placeholder="Template text content..."
                  className="w-full text-xs bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] font-sans transition"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="crm-btn-secondary px-3 py-1.5 rounded-xl text-xs font-medium text-[#0F172A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary px-4 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                >
                  Save Template
                </button>
              </div>
            </form>
          )}

          {/* Templates list */}
          <div className="space-y-2">
            {loading ? (
              <p className="text-xs text-[#64748B]">Loading templates...</p>
            ) : templates.length === 0 ? (
              <p className="text-xs text-[#64748B] italic">No communication templates registered.</p>
            ) : (
              templates.map((tmpl) => (
                <div key={tmpl.id} className="p-3.5 crm-card border border-[#E2E8F0] bg-white rounded-xl space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">{tmpl.name}</span>
                    <span className="crm-pill crm-pill-purple font-mono text-[10px]">
                      {tmpl.channel}
                    </span>
                  </div>
                  {tmpl.subject && (
                    <div className="text-[11px] text-[#64748B]">
                      Subject: <span className="text-[#0F172A] font-medium">{tmpl.subject}</span>
                    </div>
                  )}
                  <p className="text-xs text-[#0F172A] font-mono bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-lg whitespace-pre-wrap">
                    {tmpl.body}
                  </p>
                  <div className="text-[10px] text-[#64748B] flex justify-between">
                    <span>Created by: {tmpl.created_by_name}</span>
                    <span>{new Date(tmpl.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="crm-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-medium text-[#0F172A] transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
