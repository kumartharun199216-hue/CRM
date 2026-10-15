import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Lead, PipelineStage, User } from '../types';
import {
  GraduationCap,
  UserCheck,
  Phone,
  Mail,
  MessageSquare,
  History,
  Layers,
  MapPin,
  Settings2,
} from 'lucide-react';

interface KanbanViewProps {
  leads: Lead[];
  stages: PipelineStage[];
  currentUser: User;
  onUpdateLeadStage: (leadId: number, newStageId: number | null) => Promise<void>;
  onOpenLead: (lead: Lead) => void;
  onOpenHistory: (lead: Lead) => void;
  onCommunicate: (lead: Lead, channel: 'EMAIL' | 'WHATSAPP' | 'CALL') => void;
  onOpenStageManager: () => void;
}

interface KanbanCardProps {
  lead: Lead;
  onOpenLead: (lead: Lead) => void;
  onOpenHistory: (lead: Lead) => void;
  onCommunicate: (lead: Lead, channel: 'EMAIL' | 'WHATSAPP' | 'CALL') => void;
}

const getStageAccentColor = (name: string, order?: number): string => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('new lead')) return '#2563EB'; // Blue
  if (lower.includes('contacted')) return '#06B6D4'; // Cyan
  if (lower.includes('interested')) return '#7C3AED'; // Violet
  if (lower.includes('prospect')) return '#6366F1'; // Indigo
  if (lower.includes('followup') || lower.includes('follow-up')) return '#F97316'; // Orange
  if (lower.includes('negot') || lower.includes('negotiation')) return '#D97706'; // Amber
  if (lower.includes('pending closure')) return '#8B5CF6'; // Purple
  if (lower.includes('enrolled') || lower.includes('won')) return '#16A34A'; // Green
  if (lower.includes('lost') || lower.includes('not interested')) return '#DC2626'; // Red
  if (lower.includes('not connected')) return '#64748B'; // Slate
  if (lower.includes('cold calling')) return '#0284C7'; // Sky Blue
  if (order === 10) return '#16A34A';
  if (order === 12) return '#DC2626';
  return '#2563EB';
};

const KanbanCard: React.FC<KanbanCardProps> = ({
  lead,
  onOpenLead,
  onOpenHistory,
  onCommunicate,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lead-${lead.id}`,
    data: { lead },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const displayName = lead.name || lead.title || lead.contact_name || 'Lead';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#172033] hover:border-[#2563EB]/40 dark:hover:border-[#60A5FA]/40 hover:shadow-md transition cursor-grab active:cursor-grabbing space-y-2 select-none relative overflow-hidden font-sans"
    >
      <div className="flex items-start justify-between gap-2">
        <h4
          onClick={() => onOpenLead(lead)}
          className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] hover:text-[#2563EB] dark:hover:text-[#60A5FA] transition cursor-pointer truncate flex-1 leading-snug"
          title={displayName}
        >
          {displayName}
        </h4>
        <span className="text-[10px] font-mono text-[#2563EB] dark:text-[#60A5FA] font-semibold shrink-0">
          {lead.lead_id || `#${lead.id}`}
        </span>
      </div>

      {/* Degree & College if populated */}
      {(lead.qualification || lead.college) && (
        <div className="flex items-center gap-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
          <GraduationCap className="w-3 h-3 text-[#94A3B8] dark:text-[#64748B] shrink-0" />
          <span className="truncate">
            {[lead.qualification, lead.college].filter(Boolean).join(' • ')}
          </span>
        </div>
      )}

      {/* Target role / skills if populated */}
      {lead.target_role && (
        <div className="text-[10px] inline-block px-1.5 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-[#172554] border border-[#BFDBFE] dark:border-[#1E40AF] text-[#2563EB] dark:text-[#60A5FA] font-medium">
          {lead.target_role}
        </div>
      )}

      {/* City if populated */}
      {lead.city && (
        <div className="flex items-center gap-1 text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate">
          <MapPin className="w-2.5 h-2.5 text-[#94A3B8] dark:text-[#64748B] shrink-0" />
          <span className="truncate">{lead.city}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1.5 border-t border-[#E2E8F0] dark:border-[#334155] text-[10px] text-[#64748B] dark:text-[#94A3B8]">
        <div className="flex items-center gap-1">
          <UserCheck className="w-3 h-3 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
          <span className="truncate max-w-[90px]" title={lead.assigned_employee_name || undefined}>
            {lead.assigned_employee_name || 'Unassigned'}
          </span>
        </div>

        {/* Quick Communication & History Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCommunicate(lead, 'CALL');
            }}
            className="p-1 hover:bg-[#EFF6FF] dark:hover:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:text-[#2563EB] dark:hover:text-[#60A5FA] rounded-md transition cursor-pointer"
            title="Log Call"
          >
            <Phone className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCommunicate(lead, 'WHATSAPP');
            }}
            className="p-1 hover:bg-[#F0FDF4] dark:hover:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:text-[#16A34A] dark:hover:text-[#4ADE80] rounded-md transition cursor-pointer"
            title="Send WhatsApp"
          >
            <MessageSquare className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCommunicate(lead, 'EMAIL');
            }}
            className="p-1 hover:bg-[#EFF6FF] dark:hover:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:text-[#2563EB] dark:hover:text-[#60A5FA] rounded-md transition cursor-pointer"
            title="Send Email"
          >
            <Mail className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHistory(lead);
            }}
            className="p-1 hover:bg-[#EFF6FF] dark:hover:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:text-[#7C3AED] dark:hover:text-[#A855F7] rounded-md transition cursor-pointer"
            title="View History"
          >
            <History className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface StageColumnProps {
  id: string;
  stageName: string;
  order?: number;
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onOpenHistory: (lead: Lead) => void;
  onCommunicate: (lead: Lead, channel: 'EMAIL' | 'WHATSAPP' | 'CALL') => void;
}

const StageColumn: React.FC<StageColumnProps> = ({
  id,
  stageName,
  order,
  leads,
  onOpenLead,
  onOpenHistory,
  onCommunicate,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const accentColor = getStageAccentColor(stageName, order);

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 flex flex-col rounded-xl border transition bg-[#F8FAFC] dark:bg-[#0F172A] max-h-[calc(100vh-210px)] shadow-xs relative ${
        isOver
          ? 'border-[#2563EB] dark:border-[#60A5FA] bg-[#EFF6FF]/60 dark:bg-[#172554]/40 ring-2 ring-[#2563EB]/30'
          : 'border-[#E2E8F0] dark:border-[#334155]'
      }`}
    >
      {/* Top Stage Color Accent Bar */}
      <div
        className="h-1 rounded-t-xl w-full"
        style={{ backgroundColor: accentColor }}
      />

      {/* Column Header */}
      <div className="p-3 border-b border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#172033] flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {order && (
            <span
              className="w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {order}
            </span>
          )}
          <h3 className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
            {stageName}
          </h3>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#CBD5E1] font-semibold">
          {leads.length}
        </span>
      </div>

      {/* Cards Scrollable Container */}
      <div className="p-2 space-y-2 overflow-y-auto flex-1 scrollbar-thin">
        {leads.map((lead) => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            onOpenLead={onOpenLead}
            onOpenHistory={onOpenHistory}
            onCommunicate={onCommunicate}
          />
        ))}
        {leads.length === 0 && (
          <div className="py-8 text-center text-[#64748B] dark:text-[#94A3B8] text-xs italic border border-dashed border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#172033] rounded-xl">
            No leads in this stage
          </div>
        )}
      </div>
    </div>
  );
};

export const KanbanView: React.FC<KanbanViewProps> = ({
  leads,
  stages,
  currentUser,
  onUpdateLeadStage,
  onOpenLead,
  onOpenHistory,
  onCommunicate,
  onOpenStageManager,
}) => {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  const handleDragStart = (event: DragStartEvent) => {
    const lead = event.active.data.current?.lead as Lead;
    if (lead) {
      setActiveLead(lead);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const leadIdStr = active.id.toString().replace('lead-', '');
    const leadId = Number(leadIdStr);

    const overIdStr = over.id.toString();
    const targetStageId = overIdStr === 'stage-unassigned' ? null : Number(overIdStr.replace('stage-', ''));

    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.stage !== targetStageId) {
      await onUpdateLeadStage(leadId, targetStageId);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4 font-sans">
        {/* Kanban Board Container with Horizontal Scroll */}
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 max-w-full">
          {sortedStages.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage.id);
            return (
              <StageColumn
                key={stage.id}
                id={`stage-${stage.id}`}
                stageName={stage.name}
                order={stage.order}
                leads={stageLeads}
                onOpenLead={onOpenLead}
                onOpenHistory={onOpenHistory}
                onCommunicate={onCommunicate}
              />
            );
          })}

          {/* Unassigned Stage Column */}
          {leads.some((l) => !l.stage) && (
            <StageColumn
              id="stage-unassigned"
              stageName="Unassigned Stage"
              leads={leads.filter((l) => !l.stage)}
              onOpenLead={onOpenLead}
              onOpenHistory={onOpenHistory}
              onCommunicate={onCommunicate}
            />
          )}
        </div>
      </div>

      {/* Drag Overlay for Smooth Native Drag Visual */}
      <DragOverlay>
        {activeLead ? (
          <div className="p-3 rounded-xl border-2 border-[#2563EB] bg-white dark:bg-[#172033] shadow-2xl scale-105 opacity-90 w-72 pointer-events-none">
            <h4 className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
              {activeLead.name || activeLead.title || activeLead.contact_name}
            </h4>
            <span className="text-[10px] font-mono text-[#2563EB] dark:text-[#60A5FA]">
              {activeLead.lead_id || `#${activeLead.id}`}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
