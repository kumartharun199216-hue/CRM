import React, { useState, useEffect } from 'react';
import { Lead, CommunicationTemplate, CommunicationLog } from '../types';
import { api } from '../services/api';
import {
  X,
  Mail,
  MessageSquare,
  Phone,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Paperclip,
  FileText
} from 'lucide-react';

interface CommunicationModalProps {
  lead: Lead | null;
  initialChannel?: 'EMAIL' | 'WHATSAPP' | 'CALL';
  isOpen: boolean;
  onClose: () => void;
}

export const CommunicationModal: React.FC<CommunicationModalProps> = ({
  lead,
  initialChannel = 'EMAIL',
  isOpen,
  onClose,
}) => {
  const [channel, setChannel] = useState<'EMAIL' | 'WHATSAPP' | 'CALL'>(initialChannel);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CommunicationTemplate | null>(null);
  const [logs, setLogs] = useState<CommunicationLog[]>([]);

  // Email form
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // WhatsApp form
  const [whatsappMessage, setWhatsappMessage] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error' | 'blocker'; text: string } | null>(null);

  useEffect(() => {
    setChannel(initialChannel);
  }, [initialChannel]);

  useEffect(() => {
    if (lead && isOpen) {
      setResultMsg(null);
      setSelectedTemplate(null);
      api.getTemplates()
        .then(setTemplates)
        .catch(() => {});

      api.getCommunicationLogs({ lead: lead.id })
        .then(setLogs)
        .catch(() => {});
    }
  }, [lead, isOpen]);

  if (!isOpen || !lead) return null;

  const handleApplyTemplate = async (template: CommunicationTemplate) => {
    setSelectedTemplate(template);
    if (template.channel === 'EMAIL') {
      try {
        const preview = await api.previewTemplate({
          template_id: template.id,
          lead_id: lead.id,
          subject: template.subject,
          body: template.body,
        });
        setEmailSubject(preview.subject || template.subject || '');
        setEmailBody(preview.body || template.body || '');
      } catch {
        setEmailSubject(template.subject || '');
        setEmailBody(template.body);
      }
    } else if (template.channel === 'WHATSAPP') {
      setWhatsappMessage(template.body);
    }
  };

  const handleClearTemplate = () => {
    setSelectedTemplate(null);
    setEmailSubject('');
    setEmailBody('');
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResultMsg(null);

    try {
      await api.sendEmail({
        lead_id: lead.id,
        template_id: selectedTemplate?.id,
        subject: emailSubject,
        body: emailBody,
      });
      const attCount = selectedTemplate?.attachments?.length || 0;
      const attText = attCount > 0 ? ` with ${attCount} attachment${attCount > 1 ? 's' : ''} enclosed` : '';
      setResultMsg({
        type: 'success',
        text: `Email dispatched and accepted by Google SMTP for ${lead.email}${attText}.`,
      });
      setEmailSubject('');
      setEmailBody('');
      setSelectedTemplate(null);
      api.getCommunicationLogs({ lead: lead.id }).then(setLogs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Email failed to send.';
      setResultMsg({
        type: msg.includes('blocker') ? 'blocker' : 'error',
        text: msg,
      });
      api.getCommunicationLogs({ lead: lead.id }).then(setLogs);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResultMsg(null);

    try {
      await api.sendWhatsApp({
        lead_id: lead.id,
        message: whatsappMessage,
      });
      setResultMsg({ type: 'success', text: `WhatsApp message delivered to ${lead.phone}.` });
      setWhatsappMessage('');
      api.getCommunicationLogs({ lead: lead.id }).then(setLogs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'WhatsApp failed to send.';
      setResultMsg({
        type: msg.includes('blocker') ? 'blocker' : 'error',
        text: msg,
      });
      api.getCommunicationLogs({ lead: lead.id }).then(setLogs);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitiateCall = async () => {
    setSubmitting(true);
    setResultMsg(null);

    try {
      await api.initiateCall({ lead_id: lead.id });
      setResultMsg({ type: 'success', text: `Call initiated via Callyzer for ${lead.phone}.` });
      api.getCommunicationLogs({ lead: lead.id }).then(setLogs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Call initiation failed.';
      setResultMsg({
        type: msg.includes('blocker') ? 'blocker' : 'error',
        text: msg,
      });
      api.getCommunicationLogs({ lead: lead.id }).then(setLogs);
    } finally {
      setSubmitting(false);
    }
  };

  const relevantTemplates = templates.filter((t) =>
    channel === 'CALL' ? false : t.channel === channel
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] relative text-[#0F172A] dark:text-[#F8FAFC]">
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#2563EB] via-[#7C3AED] to-[#1E3A8A] opacity-90" />

        {/* Header */}
        <div className="p-4 border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between bg-[#F8FAFC] dark:bg-[#111827] pt-4.5">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
              <span>Lead Communication</span>
              <span className="text-xs font-mono text-[#2563EB] dark:text-blue-400 font-semibold">({lead.contact_name || lead.title})</span>
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Approved channels: Google SMTP, WhatsApp Business Platform, and Callyzer
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Channel Navigation Tabs */}
        <div className="flex border-b border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827] px-4">
          <button
            type="button"
            onClick={() => {
              setChannel('EMAIL');
              setResultMsg(null);
            }}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              channel === 'EMAIL'
                ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Email (Google SMTP)
          </button>

          <button
            type="button"
            onClick={() => {
              setChannel('WHATSAPP');
              setResultMsg(null);
            }}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              channel === 'WHATSAPP'
                ? 'border-[#16A34A] text-[#16A34A] dark:text-emerald-400'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp (Business API)
          </button>

          <button
            type="button"
            onClick={() => {
              setChannel('CALL');
              setResultMsg(null);
            }}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              channel === 'CALL'
                ? 'border-[#7C3AED] text-[#7C3AED] dark:text-purple-400'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            Call (Callyzer)
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto scrollbar-thin">
          {/* Result Alert */}
          {resultMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                resultMsg.type === 'success'
                  ? 'bg-[#DCFCE7] dark:bg-emerald-950/40 border-[#BBF7D0] dark:border-emerald-800 text-[#16A34A] dark:text-emerald-300'
                  : resultMsg.type === 'blocker'
                  ? 'bg-[#FEF3C7] dark:bg-amber-950/40 border-[#FDE68A] dark:border-amber-800 text-[#D97706] dark:text-amber-300'
                  : 'bg-[#FEF2F2] dark:bg-rose-950/40 border-[#FECACA] dark:border-rose-800 text-[#DC2626] dark:text-rose-400'
              }`}
            >
              {resultMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-semibold">
                  {resultMsg.type === 'blocker' ? 'Integration Blocker Identified:' : ''}
                </span>
                <p className="m-0">{resultMsg.text}</p>
              </div>
            </div>
          )}

          {/* Template Selection helper */}
          {relevantTemplates.length > 0 && (
            <div className="p-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
                <span>Pre-load from communication template:</span>
              </div>
              <select
                value={selectedTemplate?.id || ''}
                onChange={(e) => {
                  const tmpl = relevantTemplates.find((t) => t.id === Number(e.target.value));
                  if (tmpl) handleApplyTemplate(tmpl);
                }}
                className="text-xs bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-2.5 py-1 text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] cursor-pointer"
              >
                <option value="">Choose template...</option>
                {relevantTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Active Template & Enclosed Attachments Indicator */}
          {selectedTemplate && (
            <div className="p-3 bg-[#EFF6FF] dark:bg-blue-950/30 border border-[#BFDBFE] dark:border-blue-900/50 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-[#1E40AF] dark:text-blue-300">
                  <span className="font-semibold">Selected Template:</span>
                  <span className="font-medium">{selectedTemplate.name}</span>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">({selectedTemplate.body_format === 'HTML' ? 'HTML' : 'Plain Text'})</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearTemplate}
                  className="text-[11px] text-[#DC2626] dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Clear template
                </button>
              </div>

              {selectedTemplate.attachments && selectedTemplate.attachments.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-[#DBEAFE] dark:border-blue-900/50">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1E40AF] dark:text-blue-300">
                    <Paperclip className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
                    <span>Enclosed Attachments to be Sent ({selectedTemplate.attachments.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTemplate.attachments.map((att) => (
                      <span
                        key={att.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-white dark:bg-[#1E293B] border border-[#BFDBFE] dark:border-blue-900 text-[#1E3A8A] dark:text-blue-300"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
                        <span className="font-medium">{att.original_filename}</span>
                        <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">({att.file_size_display})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Channel 1: Google SMTP Email */}
          {channel === 'EMAIL' && (
            <form onSubmit={handleSendEmail} className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]">
                <span>To: <strong className="text-[#0F172A] dark:text-[#F8FAFC] font-mono">{lead.email || 'No email registered'}</strong></span>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Google SMTP (smtp.gmail.com:587)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1">Subject *</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Subject line..."
                  required
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1">Message Body *</label>
                <textarea
                  rows={4}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Type email body..."
                  required
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] font-sans transition"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !lead.email}
                  className="crm-btn-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Sending via SMTP...' : 'Send Email'}
                </button>
              </div>
            </form>
          )}

          {/* Channel 2: WhatsApp Business Platform */}
          {channel === 'WHATSAPP' && (
            <form onSubmit={handleSendWhatsApp} className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]">
                <span>To: <strong className="text-[#0F172A] dark:text-[#F8FAFC] font-mono">{lead.phone || 'No phone registered'}</strong></span>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">WhatsApp Business Cloud API</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1">WhatsApp Message *</label>
                <textarea
                  rows={4}
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  placeholder="Type WhatsApp message..."
                  required
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#16A34A] font-sans transition"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !lead.phone}
                  className="bg-[#16A34A] hover:bg-[#15803D] flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Sending via WhatsApp...' : 'Send WhatsApp Message'}
                </button>
              </div>
            </form>
          )}

          {/* Channel 3: Callyzer Calling */}
          {channel === 'CALL' && (
            <div className="p-6 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] dark:bg-blue-950/40 border border-[#BFDBFE] dark:border-blue-900/50 flex items-center justify-center mx-auto text-[#2563EB] dark:text-blue-400 shadow-xs">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Callyzer Outbound Calling</h4>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-md mx-auto">
                  Initiate a verified call session to <span className="font-mono text-[#0F172A] dark:text-[#F8FAFC] font-semibold">{lead.phone || 'N/A'}</span>.
                  Per project rules, unverified calls are never simulated.
                </p>
              </div>

              <button
                type="button"
                onClick={handleInitiateCall}
                disabled={submitting || !lead.phone}
                className="crm-btn-primary inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Phone className="w-3.5 h-3.5" />
                {submitting ? 'Connecting with Callyzer...' : 'Initiate Call'}
              </button>
            </div>
          )}

          {/* Lead Communication Logs */}
          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#334155] space-y-2">
            <h4 className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
              Communication Activity Log ({logs.length})
            </h4>

            {logs.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] italic">No communication logged for this lead yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                        [{log.channel}] to {log.recipient}
                      </span>
                      <span
                        className={`crm-pill text-[10px] font-mono ${
                          log.status === 'SUCCESS'
                            ? 'crm-pill-success'
                            : log.status === 'BLOCKED'
                            ? 'crm-pill-warning'
                            : 'crm-pill-error'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    {log.error_message && (
                      <p className="text-[11px] text-[#DC2626] dark:text-rose-400 m-0">{log.error_message}</p>
                    )}
                    <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] flex justify-between pt-1">
                      <span>Initiated by: {log.initiated_by_name}</span>
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="crm-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
