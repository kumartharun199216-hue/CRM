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
  MapPin
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
      className="p-3 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#2563EB]/40 hover:shadow-md transition cursor-grab active:cursor-grabbing space-y-2 select-none relative overflow-hidden font-sans"
    >
      <div className="flex items-start justify-between gap-2">
        <h4
          onClick={() => onOpenLead(lead)}
          className="text-xs font-semibold text-[#0F172A] hover:text-[#2563EB] transition cursor-pointer truncate flex-1 leading-snug"
          title={displayName}
        >
          {displayName}
        </h4>
        <span className="text-[10px] font-mono text-[#2563EB] font-semibold shrink-0">
          {lead.lead_id || `#${lead.id}`}
        </span>
      </div>

      {/* Degree & College if populated */}
      {(lead.qualification || lead.college) && (
        <div className="flex items-center gap-1 text-[11px] text-[#64748B] truncate">
          <GraduationCap className="w-3 h-3 text-[#94A3B8] shrink-0" />
          <span className="truncate">
            {[lead.qualification, lead.college].filter(Boolean).join(' • ')}
          </span>
        </div>
      )}

      {/* Target role / skills if populated */}
      {lead.target_role && (
        <div className="text-[10px] inline-block px-1.5 py-0.5 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] font-medium">
          {lead.target_role}
        </div>
      )}

      {/* City if populated */}
      {lead.city && (
        <div className="flex items-center gap-1 text-[10px] text-[#64748B] truncate">
          <MapPin className="w-2.5 h-2.5 text-[#94A3B8] shrink-0" />
          <span className="truncate">{lead.city}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1.5 border-t border-[#E2E8F0] text-[10px] text-[#64748B]">
        <div className="flex items-center gap-1">
          <UserCheck className="w-3 h-3 text-[#2563EB] shrink-0" />
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
            className="p-1 hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#16A34A] rounded-md transition cursor-pointer"
            title="Callyzer Call"
          >
            <Phone className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCommunicate(lead, 'WHATSAPP');
            }}
            className="p-1 hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#16A34A] rounded-md transition cursor-pointer"
            title="WhatsApp"
          >
            <MessageSquare className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCommunicate(lead, 'EMAIL');
            }}
            className="p-1 hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#2563EB] rounded-md transition cursor-pointer"
            title="Google SMTP Email"
          >
            <Mail className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHistory(lead);
            }}
            className="p-1 hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#7C3AED] rounded-md transition cursor-pointer"
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

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 flex flex-col rounded-xl border transition bg-[#F8FAFC] max-h-[calc(100vh-210px)] shadow-xs ${
        isOver ? 'border-[#2563EB] bg-[#EFF6FF]/60 ring-2 ring-[#2563EB]/30' : 'border-[#E2E8F0]'
      }`}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-[#E2E8F0] bg-white flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-1.5 min-w-0">
          {order && (
            <span className="w-4 h-4 rounded-full bg-[#EFF6FF] text-[10px] font-bold text-[#2563EB] flex items-center justify-center shrink-0">
              {order}
            </span>
          )}
          <h3 className="text-xs font-semibold text-[#0F172A] truncate">{stageName}</h3>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] font-semibold">
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
          <div className="py-8 text-center text-[#64748B] text-xs italic border border-dashed border-[#CBD5E1] bg-white rounded-xl">
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

    const lead = active.data.current?.lead as Lead;
    if (!lead) return;

    const overId = over.id as string;
    let targetStageId: number | null = null;

    if (overId.startsWith('stage-')) {
      targetStageId = parseInt(overId.replace('stage-', ''), 10);
    } else if (overId === 'stage-unassigned') {
      targetStageId = null;
    }

    if (lead.stage !== targetStageId) {
      await onUpdateLeadStage(lead.id, targetStageId);
    }
  };

  // Group leads by stage
  const unassignedLeads = leads.filter((l) => !l.stage);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4 font-sans">
        {stages.length === 0 && (
          <div className="p-4 crm-card rounded-xl border border-[#E2E8F0] bg-white flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-[#2563EB]" />
              <div>
                <h4 className="text-xs font-semibold text-[#0F172A]">Pipeline Stages</h4>
                <p className="text-xs text-[#64748B]">
                  Loading pipeline stages...
                </p>
              </div>
            </div>
            {currentUser.role === 'ADMIN' && (
              <button
                type="button"
                onClick={onOpenStageManager}
                className="crm-btn-primary px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Configure Stages
              </button>
            )}
          </div>
        )}

        {/* Horizontal Scroll Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-4 pt-1 max-w-full scrollbar-thin">
          {/* Unassigned stage column if any exist */}
          {unassignedLeads.length > 0 && (
            <StageColumn
              id="stage-unassigned"
              stageName="Unassigned Stage"
              leads={unassignedLeads}
              onOpenLead={onOpenLead}
              onOpenHistory={onOpenHistory}
              onCommunicate={onCommunicate}
            />
          )}

          {/* Configured stages (the 12 stages in configured order) */}
          {stages.map((st) => (
            <StageColumn
              key={st.id}
              id={`stage-${st.id}`}
              stageName={st.name}
              order={st.order}
              leads={leads.filter((l) => l.stage === st.id)}
              onOpenLead={onOpenLead}
              onOpenHistory={onOpenHistory}
              onCommunicate={onCommunicate}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="p-3 bg-white border-2 border-[#2563EB] rounded-xl shadow-2xl w-72 space-y-2 opacity-95 ring-4 ring-[#2563EB]/20">
            <h4 className="text-xs font-semibold text-[#0F172A]">{activeLead.name || activeLead.title}</h4>
            <div className="text-[11px] text-[#2563EB] font-mono font-semibold">{activeLead.lead_id}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
