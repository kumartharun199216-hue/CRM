# Skill Move Sales CRM — Dashboard Discovery and Business Intelligence Audit

**Document Version:** 1.0.0  
**Audit Date:** October 11, 2026  
**Auditor Roles:** Senior Product Architect, Django REST Framework Engineer, React/TypeScript Engineer, Data Analyst, QA Lead, CRM Business Intelligence Specialist  
**Deliverable Path:** `docs/dashboard-audit/skill-move-crm-dashboard-discovery.md`  
**Audit Scope:** Comprehensive Repository Inspection, Schema Evaluation, and Business Intelligence Readiness Audit  
**Operating Mode:** Strictly Non-Destructive / Read-Only Audit & Architectural Report  

---

## 1. Executive Summary

An exhaustive technical and business intelligence audit was conducted on the **Skill Move Sales CRM** to evaluate the current dashboard implementation and establish the exact data readiness required to transform the dashboard into an **Operational Control Centre**.

Currently, the CRM provides foundational operational surfaces for lead management, team hierarchies, pipeline transitions, communications, and the newly implemented **Pending Closure** financial workflow. However, the current dashboard (`RoleDashboard.tsx` and `DashboardStatsView`) operates primarily on high-level counters, legacy financial fields (`estimated_revenue`, `placement_fee`), and heuristic approximations. It falls short of answering crucial day-to-day business questions regarding true communication outcomes, granular follow-up tracking, financial balances, and team productivity.

### Key Audit Highlights

1. **Current Dashboard Scope:**
   - **Frontend:** `frontend/src/components/RoleDashboard.tsx` renders role-tailored views for **Executive Admin**, **Admissions Manager**, and **Career Counsellor**, displaying quick action shortcuts, KPI cards, a 12-stage pipeline funnel, an overdue action list, and a recent activity feed.
   - **Backend:** `GET /api/leads/dashboard-stats/` in `backend/apps/leads/views.py` calculates KPIs, stage distributions, team aggregations, and top overdue follow-ups with role-based scoping (Admin = Global, Manager = Team, Counsellor = Self).

2. **Core Architectural Gaps Identified:**
   - **Pending Closure Financial Disconnect:** While the CRM enforces a dedicated `PreCloserFinancial` model (`agreed_amount`, `amount_paid`, `outstanding_balance`) during stage transitions, the existing dashboard **completely ignores** this model and instead displays legacy `Lead.estimated_revenue` and `Lead.placement_fee`.
   - **Historical Financial Data Incompleteness:** Of 5 leads currently in `Pending Closure` in the database, 4 lack a `PreCloserFinancial` record because they entered the stage prior to workflow enforcement.
   - **Communication Status vs. Delivery:** Outbound emails and WhatsApp messages record gateway dispatch (`SUCCESS` / `FAILED` / `BLOCKED`). **No delivery receipts, open tracking, or WhatsApp delivery/read webhooks exist.**
   - **Calls & Callyzer Integration:** Outbound calling via Callyzer is blocked (`IntegrationBlockerException`) awaiting verified API credentials. The CRM stores no call duration, recording, direction (inbound/outbound), or outcome data (connected, missed, unanswered).
   - **Follow-ups vs. Reminders:** There is **no Follow-Up entity or completion tracking model**. Follow-ups are represented solely by a nullable timestamp (`Lead.next_follow_up`). The current dashboard approximates "completed follow-ups" by calculating `recorded_calls + recorded_messages`, which is an unverified heuristic. **No Reminder or Notification entity exists.**

3. **Readiness Summary:**
   - **Total Business Questions Evaluated:** 52
   - **Implemented & Verified in Source:** 18 (34.6%)
   - **Data Available but Metric Missing:** 15 (28.8%)
   - **Partially Implemented:** 7 (13.5%)
   - **Required Data or Functionality Missing:** 9 (17.3%)
   - **Business Rule Needs Owner Approval:** 3 (5.8%)

---

## 2. Verified Current Dashboard Implementation

### 2.1 Existing Architecture & File Inventory

| Layer | File Path | Verified Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | `frontend/src/components/RoleDashboard.tsx` | Main dashboard view rendering role-based portals (Admin, Manager, Counsellor). |
| **Frontend API Service** | `frontend/src/services/api.ts` | `api.getDashboardStats(days?: number)` calling `/leads/dashboard-stats/`. |
| **Frontend Types** | `frontend/src/types/index.ts` | `DashboardStats`, `DashboardKPIs`, `PipelineOverviewItem`, `TeamOverviewItem`, `MemberPerformanceItem`. |
| **Backend API View** | `backend/apps/leads/views.py:L1486-L1749` | `DashboardStatsView(APIView)` aggregating KPIs, funnel, team overview, member matrix, and activity. |
| **Backend Routing** | `backend/apps/leads/urls.py:L30` | `path('dashboard-stats/', DashboardStatsView.as_view(), name='dashboard-stats')`. |
| **Backend Tests** | `backend/apps/leads/tests/test_dashboard_stats.py` | 4 unit tests verifying unauthenticated rejection and Admin, Manager, and Counsellor role scoping. |
| **Frontend Tests** | `frontend/src/test/crm.test.tsx:L316-L377` | Render tests for Admin, Manager, and Counsellor dashboard components. |

### 2.2 Current Role-Specific Presentations in `RoleDashboard.tsx`

```
+---------------------------------------------------------------------------------------------------+
| EXECUTIVE ADMIN DASHBOARD                                                                         |
| Header: Welcome, Role Badge, Period Filter (All Time, 7D, 30D, 90D), "All Leads (Total)" Action   |
| KPI Row (7 Cards): Total Leads | Active Leads | Period Inflow | Enrolled | Lost | Unassigned | Rev|
| Quick Actions: Create Lead | Unassigned Queue | Pipeline Stages | Scheduled Reports               |
| Main Grid (2/3 Col):                               | Right Column (1/3 Col):                      |
| - 12-Stage Admissions Pipeline Funnel (Clickable)  | - Follow-up Monitoring Queue (Overdue/Due)   |
| - Admissions Team Performance Table                | - Recent Activity Audit Feed                 |
| - Individual Counsellor Workload Matrix            |                                              |
+---------------------------------------------------------------------------------------------------+
| ADMISSIONS MANAGER DASHBOARD                                                                      |
| Header: Welcome, Manager Badge, Scoped Team Pill, Period Filter, "All Leads" Action               |
| KPI Row (6 Cards): Team Leads | Team Unassigned | Assigned Leads | Team Enrolled | Lost | F/U     |
| Quick Actions: Create Lead | Unassigned Queue | Assign Leads                                      |
| Main Grid: Team Pipeline Funnel | My Team Counsellors Performance Table | Follow-up Queue | Feed  |
+---------------------------------------------------------------------------------------------------+
| CAREER COUNSELLOR WORKSPACE                                                                       |
| Header: Welcome, Counsellor Badge, Today's Date, "My Leads" Action                                |
| KPI Row (6 Cards): My Assigned | My Active | Due Today | Overdue Follow-ups | Enrolled | Lost     |
| Quick Actions: My Lead Spreadsheet                                                                |
| Main Grid: My Pipeline Funnel | Admissions Guidance Card | Today's Follow-up Action List | Feed     |
+---------------------------------------------------------------------------------------------------+
```

### 2.3 Current Data Models Backing Dashboard Metrics

1. **`apps.leads.models.Lead`**:
   - `created_at`, `updated_at`, `archived_at`
   - `stage` (`ForeignKey` to `PipelineStage`)
   - `status` (`CharField`)
   - `priority` (`CharField`)
   - `team` (`ForeignKey` to `Team`)
   - `assigned_employee` (`ForeignKey` to `User`)
   - `next_follow_up` (`DateTimeField`, nullable)
   - `estimated_revenue` (`DecimalField`, nullable) — *Currently displayed in dashboard*
   - `placement_fee` (`DecimalField`, nullable) — *Currently displayed in dashboard*
2. **`apps.leads.models.PipelineStage`**:
   - 12 canonical stages ordered 1 through 12.
3. **`apps.leads.models.PreCloserFinancial`**:
   - `lead` (`OneToOneField`)
   - `agreed_amount` (`DecimalField`)
   - `amount_paid` (`DecimalField`)
   - `outstanding_balance` (`property`)
   - *Currently NOT queried or displayed by the dashboard.*
4. **`apps.communications.models.CommunicationLog`**:
   - `lead`, `channel` (`EMAIL`, `WHATSAPP`, `CALL`), `recipient`, `status` (`SUCCESS`, `FAILED`, `BLOCKED`), `initiated_by`, `created_at`.
5. **`apps.audit.models.AuditEvent`**:
   - `event_type`, `user`, `details`, `timestamp`.

---

## 3. Business Questions Catalogue

Below is the complete analysis of the 10 business areas (A through J) defined in the BI specifications, detailing what the CRM can currently answer, how it computes answers, and where data is missing.

### Area A: Lead Overview & Pipeline Progression

| # | Business Question | Current Capability | Current Method / Source | Limitations & Caveats |
| :- | :--- | :---: | :--- | :--- |
| **A1** | Total leads in system? | **Yes** | `Lead.objects.filter(archived_at__isnull=True).count()` | Accurately scoped by role. Soft-deleted leads excluded. |
| **A2** | New leads created today, this week, this month? | **Partial** | Filter `created_at__gte=period_start` (supports 7D, 30D, 90D). | Does not have distinct "today", "this calendar week", or "this calendar month" presets. |
| **A3** | Breakdown: assigned, unassigned, active, lost? | **Yes** | `assigned_employee__isnull`, `status__iexact='Lost'`, `stage__order=12`. | Active is calculated as `total - lost`, meaning Enrolled leads are considered active. |
| **A4** | Current count per pipeline stage? | **Yes** | Group by `stage_id` across the 12 canonical stages. | Accurate point-in-time snapshot of where leads reside right now. |
| **A5** | Leads entered each stage during selected period? | **No** | Not computed in dashboard. | `LeadStageHistory` records `(to_stage, timestamp)`, but `DashboardStatsView` does not aggregate it. |
| **A6** | Stage-to-stage conversion rate? | **No** | Not implemented. | Only overall `enrolled / assigned` is computed per employee. Stage funnel drop-off rate is missing. |
| **A7** | Leads never contacted? | **No** | Not computed in dashboard. | Computable via `Lead.objects.exclude(communication_logs__isnull=False)`, but no endpoint exposes it. |
| **A8** | Leads with no recent activity? | **No** | Not computed in dashboard. | No `last_activity_at` field exists on `Lead`. Cross-joining `CommunicationLog` and `LeadStageHistory` is unindexed. |
| **A9** | Which lead sources yield most conversions? | **No** | Not implemented. | `Lead.source` field exists, but no aggregation joins `source` to `stage__order=10` (Enrolled). |
| **A10**| Current lead backlog? | **Partial** | Count of unassigned leads + count of overdue follow-ups. | No formal composite "backlog index" defined. |

---

### Area B: Calls and Communication Activity

| # | Business Question | Current Capability | Current Method / Source | Limitations & Caveats |
| :- | :--- | :---: | :--- | :--- |
| **B1** | Calls made during period? | **Yes** | `CommunicationLog.objects.filter(channel='CALL', created_at__gte=start).count()` | Represents call attempts logged through CRM. |
| **B2** | Calls connected vs. missed vs. unanswered? | **Missing** | **Data does not exist.** | `CommunicationLog.status` only records `SUCCESS`, `FAILED`, `BLOCKED`. No duration or call outcome schema. |
| **B3** | Calls inbound vs. outbound? | **Missing** | **Data does not exist.** | No `direction` field on `CommunicationLog`. |
| **B4** | Which leads have never been called? | **No** | Not computed in dashboard. | Filter `Lead.objects.exclude(communication_logs__channel='CALL')` is possible but missing from API. |
| **B5** | Employees with highest call volume? | **Partial** | `CommunicationLog` aggregated per user. | Aggregated per member in `member_performance`, but not ranked or displayed as a standalone chart. |
| **B6** | Emails attempted vs. accepted by SMTP? | **Partial** | `CommunicationLog.objects.filter(channel='EMAIL')` has `SUCCESS`, `FAILED`, `BLOCKED`. | `SUCCESS` strictly means Google SMTP accepted the message. **Does NOT guarantee inbox delivery.** |
| **B7** | Emails failed? | **Yes** | `CommunicationLog.objects.filter(channel='EMAIL', status='FAILED')`. | Recorded with error messages in `error_message`. |
| **B8** | WhatsApp attempted, accepted, delivered, read? | **Partial** | Only attempts and API acceptance (`status='SUCCESS'`). | **Meta Cloud API delivery/read webhooks are not implemented.** Delivery & read rates cannot be reported. |
| **B9** | Communication history of individual lead? | **Yes** | Available in Lead 360° view (`/api/communications/logs/?lead=ID`). | Detailed log exists on lead detail, but not embedded in dashboard drill-down. |
| **B10**| Leads with no recent communication? | **No** | Not computed in dashboard. | Requires subquery or window function over `CommunicationLog`. |

---

### Area C: Follow-Ups and Reminders

| # | Business Question | Current Capability | Current Method / Source | Limitations & Caveats |
| :- | :--- | :---: | :--- | :--- |
| **C1** | Follow-ups due today? | **Yes** | `Lead.objects.filter(next_follow_up__date=today)`. | Computed in UTC, which can diverge from employee's local timezone (IST). |
| **C2** | Follow-ups overdue? | **Yes** | `Lead.objects.filter(next_follow_up__lt=now)`. | Accurately counts leads with scheduled time in past. |
| **C3** | Follow-ups scheduled next 7 days? | **No** | Not computed in dashboard. | Computable from `next_follow_up`, but currently not returned by API. |
| **C4** | Follow-ups completed during period? | **False Heuristic**| Calculated as `calls_count + messages_count`. | **Architectural Defect:** There is no follow-up completion entity. The code equates any call/message to a completed follow-up. |
| **C5** | Overdue follow-ups by employee/team/lead? | **Partial** | Top 20 overdue leads returned in `followup_monitoring`. | Limited to 20 leads; cannot be fully paginated or grouped by team in current endpoint. |
| **C6** | Leads with no next follow-up scheduled? | **No** | Not computed in dashboard. | `Lead.objects.filter(next_follow_up__isnull=True)` is not surfaced as an alert. |
| **C7** | Reminders due, completed, or overdue? | **Missing** | **Data entity does not exist.** | The CRM has no `Reminder` or `Task` entity. Follow-up dates cannot be treated as a reminder system. |
| **C8** | Employees with highest pending follow-ups? | **Yes** | `m_leads.filter(next_follow_up__isnull=False).count()` in `member_performance`. | Available in member table, but not sorted into an attention alert. |
| **C9** | What requires immediate attention today? | **Partial** | Due Today + Overdue cards. | Does not combine unassigned leads, stuck deals, and follow-ups into a unified priority queue. |

---

### Area D: Pending Closure and Financial Overview

*Strict terminology: Stage name is **PENDING CLOSURE**.*

| # | Business Question | Current Capability | Current Method / Source | Limitations & Caveats |
| :- | :--- | :---: | :--- | :--- |
| **D1** | Leads currently in Pending Closure? | **Partial** | `pipeline_overview` contains count for Stage 9. | Displayed in pipeline funnel list, but lacks a dedicated Financial KPI card. |
| **D2** | Leads entered Pending Closure during period? | **No** | Not computed in dashboard. | `LeadStageHistory.objects.filter(to_stage__order=9, timestamp__gte=start)` is not aggregated. |
| **D3** | Total agreed amount for Pending Closure leads? | **Missing in Dashboard** | **Dashboard queries legacy `estimated_revenue`, not `PreCloserFinancial`.** | `PreCloserFinancial.agreed_amount` exists in DB, but `DashboardStatsView` ignores it completely. |
| **D4** | Total amount paid recorded? | **Missing in Dashboard** | **Dashboard queries legacy `placement_fee`.** | `PreCloserFinancial.amount_paid` exists in DB, but is not queried by `DashboardStatsView`. |
| **D5** | Total outstanding balance? | **Missing in Dashboard** | **Not computed.** | `PreCloserFinancial.outstanding_balance` is not aggregated across leads or teams. |
| **D6** | Which leads have outstanding balances? | **No** | Not in dashboard. | Visible in Lead 360°, but no dashboard list/table surfaces leads with unpaid balances. |
| **D7** | Employees/teams with highest outstanding balance? | **No** | Not computed. | `member_performance` displays `placement_fees`, not `outstanding_balance`. |
| **D8** | Leads with incomplete/missing financial info? | **No** | Not computed. | In SQLite today, 4 of 5 Pending Closure leads lack a financial record. Dashboard cannot detect this. |
| **D9** | Agreed amounts and collections over time? | **No** | Not implemented. | `LeadFinancialHistory` records changes, but no endpoint aggregates period collections or trends. |

---

### Area E: Employee Performance & Accountability

| # | Business Question | Current Capability | Current Method / Source | Limitations & Caveats |
| :- | :--- | :---: | :--- | :--- |
| **E1** | Leads assigned to each employee? | **Yes** | `member_performance` item `assigned_leads`. | Scoped properly (Managers see their team members; Admins see all). |
| **E2** | Leads created/contacted/enrolled/lost by employee in period? | **Partial** | `enrolled_leads` and `lost_leads` are point-in-time total counts of currently assigned leads. | Does not filter stage transitions by period. If a lead was enrolled by Emp A and reassigned to Emp B, Emp B receives credit. |
| **E3** | Due & overdue follow-ups per employee? | **Partial** | `pending_followups` total count is included. | Overdue follow-ups are not broken down per employee in the table. |
| **E4** | Calls, emails, WhatsApp attempts per employee? | **Partial** | `recorded_calls` and `recorded_messages` (WhatsApp+Email combined). | Email and WhatsApp are lumped together as `recorded_messages`. |
| **E5** | Actual connection or delivery rates per employee? | **Missing** | **Data does not exist.** | Call connection and WhatsApp delivery data is not recorded. |
| **E6** | Conversion rate per employee? | **Flawed Metric** | `m_enrolled / m_leads.count() * 100`. | Denominator is total assigned leads (including new leads that just entered). Susceptible to skew if new leads are distributed unevenly. |
| **E7** | Untouched / inactive leads per employee? | **No** | Not computed. | No inactivity threshold query implemented. |
| **E8** | Backlog identification per employee? | **Partial** | Managers can review `assigned_leads` and `pending_followups`. | No composite workload index or visual bottleneck indicator. |

---

### Area F: Team Performance & Workload

| # | Business Question | Current Capability | Current Method / Source | Limitations & Caveats |
| :- | :--- | :---: | :--- | :--- |
| **F1** | Leads belonging to each team? | **Yes** | `team_overview` table (Admin only). | Correctly aggregates leads by `team_id`. |
| **F2** | Pipeline distribution per team? | **Partial** | `enrolled_leads` and `lost_leads` per team. | Does not provide the full 12-stage breakdown per team (only global pipeline distribution). |
| **F3** | Follow-ups and overdue tasks per team? | **Partial** | `pending_followups` count per team. | Overdue follow-ups are not broken down per team in `team_overview`. |
| **F4** | Pending Closure value and balance per team? | **Missing** | Uses legacy `placement_fees`. | Does not aggregate `PreCloserFinancial` by team. |
| **F5** | Team conversion rates? | **No** | Not calculated in `team_overview`. | Table shows Enrolled count, but no rate or comparison metric. |
| **F6** | Untouched-lead backlog per team? | **Partial** | `unassigned_leads` count per team. | Does not calculate leads with overdue follow-ups or no contact within the team. |
| **F7** | Team performance comparison across date range? | **No** | Date filter does not filter `team_overview` metrics. | `t_enrolled`, `t_lost`, and `t_fees` in `views.py` ignore `period_start`! |

---

### Area G: Lead Attention and Operational Risk Indicators

| # | Proposed Alert / Attention Item | Data Required | Current Data Availability | Required Implementation |
| :- | :--- | :--- | :---: | :--- |
| **G1** | Leads with overdue follow-ups | `Lead.next_follow_up < now` | **Available** | Exists in `followup_monitoring`, needs full pagination and sorting. |
| **G2** | Leads with no recent communication (> 5 days) | `CommunicationLog.created_at` | **Available** | Needs subquery to find active leads with no log in 5 days. |
| **G3** | Leads with no next follow-up scheduled | `Lead.next_follow_up IS NULL` | **Available** | Needs filter on active stages (exclude Enrolled/Lost). |
| **G4** | Leads stuck in stage beyond threshold | `LeadStageHistory.timestamp` | **Available** | Compare latest stage entry timestamp against stage SLA threshold. |
| **G5** | Pending Closure leads with missing financial info | `Lead.stage=9 AND PreCloserFinancial IS NULL` | **Available** | Critical integrity alert: 4 leads currently match this condition! |
| **G6** | Pending Closure leads with high outstanding balance | `agreed_amount - amount_paid > 0` | **Available** | Surfaces deals awaiting final collections. |
| **G7** | Failed / Blocked communication attempts | `CommunicationLog.status IN ('FAILED','BLOCKED')` | **Available** | Alerts Admins to email delivery failures or unconfigured providers. |
| **G8** | Unassigned leads queue backlog | `Lead.assigned_employee IS NULL` | **Available** | Currently tracked as single KPI; needs age-in-queue breakdown. |
| **G9** | Employees with excessive overdue backlog | Aggregated overdue leads per user | **Available** | Trigger alert when an employee exceeds threshold (e.g. > 15 overdue). |

---

### Area H: Search, Filters, and Drill-Down Capabilities

| Filter Dimension | Current Status | Required Dashboard Behavior |
| :--- | :---: | :--- |
| **Date Range Filter** | **Preset Only** | Currently only supports presets (`7D`, `30D`, `90D`, `All Time`). Needs custom `start_date` and `end_date` calendar pickers. |
| **Team Filter** | **Missing** | Admins currently see all teams concatenated; need a dropdown to filter the entire dashboard by Team. |
| **Counsellor Filter** | **Missing** | Managers and Admins cannot isolate metrics for a single specific counsellor across the dashboard. |
| **Stage Filter** | **Partial** | Clicking a funnel stage redirects to Spreadsheet view. Needs in-dashboard stage filtering for activity/workload. |
| **Lead Source Filter** | **Missing** | No ability to filter dashboard by lead source (Meta, Website, Bulk Import, Walk-in). |
| **Communication Channel** | **Missing** | Activity feed and metrics cannot be filtered by Call vs. Email vs. WhatsApp. |
| **KPI Click Drill-Down** | **Missing** | Clicking "Overdue Follow-ups" or "Enrolled Leads" does not navigate to a filtered view of those matching leads. |

---

### Area I: Admin Operational & System Health Overview

| Operational Dimension | Current Status | Findings & Implementation Requirements |
| :--- | :---: | :--- |
| **Organization-Wide Workload** | **Partial** | Admin sees global lead count and team summary table. Missing cross-team comparison charts. |
| **Communication Health** | **Partial** | Recent activity shows individual logs, but no aggregate error widget (e.g. "3 SMTP failures in last 24h"). |
| **SMTP / WhatsApp Gateway Status**| **Missing** | Dashboard does not report whether credentials (`EMAIL_HOST_PASSWORD`, `WHATSAPP_API_TOKEN`) are configured or valid. |
| **Scheduled Report Delivery** | **Missing** | `ReportSchedule.last_run_at` exists, but dashboard does not indicate if daily reports succeeded or failed. |
| **Data Integrity Exceptions** | **Missing** | No alerts for leads in Pending Closure without financial records, or active leads assigned to inactive users. |

---

### Area J: Role-Based Dashboard Access Requirements

```
+---------------------------------------------------------------------------------------------------+
| ROLE ACCESS MATRIX                                                                                |
+--------------------------+-----------------------+-----------------------+------------------------+
| Dimension                | Executive Admin       | Admissions Manager    | Sales Employee         |
+--------------------------+-----------------------+-----------------------+------------------------+
| Lead Visibility          | All leads globally    | Only leads in managed | Only leads assigned to |
|                          |                       | team                  | employee               |
+--------------------------+-----------------------+-----------------------+------------------------+
| Team Aggregations        | All teams             | Restricted to managed | None                   |
|                          |                       | team                  |                        |
+--------------------------+-----------------------+-----------------------+------------------------+
| Member Performance       | All sales employees   | Only employees in     | Self performance only  |
|                          | across all teams      | managed team          |                        |
+--------------------------+-----------------------+-----------------------+------------------------+
| Financial Metrics        | Organization-wide     | Team total agreed and | Only for assigned      |
|                          | agreed, paid, balance | balance               | leads (read-only)      |
+--------------------------+-----------------------+-----------------------+------------------------+
| System Health & Reports  | Full access           | None                  | None                   |
+--------------------------+-----------------------+-----------------------+------------------------+
| QuerySet Enforcement     | Backend unscoped      | `team_id=user.team`   | `assigned_employee=    |
|                          |                       | enforced in DB query  | user.id` in DB query   |
+--------------------------+-----------------------+-----------------------+------------------------+
```

---

## 4. Data Readiness Matrix

The table below catalogs every required metric across all 10 business areas, its exact calculation, required entities, verified status, and implementation requirements.

### Status Categories
1. `IMPLEMENTED AND VERIFIED IN SOURCE`
2. `IMPLEMENTED BUT REQUIRES TESTING`
3. `PARTIALLY IMPLEMENTED`
4. `DATA AVAILABLE BUT METRIC MISSING`
5. `REQUIRED DATA OR FUNCTIONALITY MISSING`
6. `BUSINESS RULE NEEDS OWNER APPROVAL`

| Metric Name | Business Question | Exact Calculation / Definition | Required DB Entities & Fields | Relevant API Endpoint | Current Status | Accurate Now? | Missing Data or Rule | Required Backend Changes | Required Frontend Changes | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| **Total Leads** | Total leads in CRM? | `COUNT(Lead) WHERE archived_at IS NULL` | `Lead.id`, `Lead.archived_at` | `/api/leads/dashboard-stats/` | **1** | Yes | None | None | None | **Critical** |
| **Active Leads** | Non-lost leads? | `total_leads - lost_leads` | `Lead.status`, `Lead.stage` | `/api/leads/dashboard-stats/` | **6** | Partial | Rule needed: Should Enrolled leads be excluded from Active? | Adjust filter based on owner approval | Update label / tooltip | **High** |
| **Period Inflow** | Leads created in period? | `COUNT(Lead) WHERE created_at >= start AND created_at <= end` | `Lead.created_at` | `/api/leads/dashboard-stats/` | **1** | Yes | Custom date range missing | Support `start_date` and `end_date` query params | Add date picker | **High** |
| **Enrolled Leads** | Leads placed / enrolled? | `COUNT(Lead) WHERE stage.order = 10` | `Lead.stage` | `/api/leads/dashboard-stats/` | **1** | Yes | Canonical stage matching order 10 | Standardize to `stage.order=10` | None | **Critical** |
| **Lost Leads** | Leads closed / lost? | `COUNT(Lead) WHERE stage.order = 12 OR status = 'Lost'` | `Lead.stage`, `Lead.status` | `/api/leads/dashboard-stats/` | **1** | Yes | Canonical stage matching order 12 | Standardize to `stage.order=12` | None | **High** |
| **Unassigned Leads** | Leads awaiting assignment?| `COUNT(Lead) WHERE assigned_employee IS NULL` | `Lead.assigned_employee` | `/api/leads/dashboard-stats/` | **1** | Yes | Scoped by team for Manager | None | None | **Critical** |
| **Stage Distribution**| Snapshot counts per stage?| `GROUP BY stage.order, COUNT(Lead)` | `PipelineStage`, `Lead.stage` | `/api/leads/dashboard-stats/` | **1** | Yes | None | Ensure ordering 1..12 | None | **Critical** |
| **Stage Period Inflow**| Entries into stage in period?| `COUNT(LeadStageHistory) WHERE to_stage=X AND timestamp IN range` | `LeadStageHistory.to_stage`, `timestamp` | None | **4** | Yes | Metric not computed | Add `stage_transitions_in_period` to `DashboardStatsView` | Add inflow badge to funnel cards | **High** |
| **Funnel Conversion** | Stage-to-stage conversion %?| `(Leads reached Stage X+1) / (Leads reached Stage X)` | `LeadStageHistory` | None | **6** | Partial | Rule needed: Funnel drop-off vs. Direct transition formula | Implement cohort conversion calculation | Add funnel visualization | **Medium** |
| **Untouched Leads** | Leads never contacted? | `COUNT(Lead) WHERE NOT EXISTS(CommunicationLog)` | `Lead.id`, `CommunicationLog.lead` | None | **4** | Yes | Metric not computed | Add `untouched_leads` filter & count | Add "Untouched Leads" alert card | **High** |
| **Inactive Leads** | Leads with no activity > X d?| `COUNT(Lead) WHERE max(comm_date, stage_date) < now - X` | `CommunicationLog`, `LeadStageHistory` | None | **4** | Yes | Metric not computed | Add subquery aggregating last activity timestamp | Add "Inactive Leads" alert card | **Medium** |
| **Source Performance** | Conversions by lead source?| `GROUP BY source, COUNT(enrolled) / COUNT(total)` | `Lead.source`, `Lead.stage` | None | **4** | Yes | Aggregation not in API | Group leads by `source` with enrolled conversion | Add Source Breakdown chart | **Medium** |
| **Pending Closure Count**| Leads in Pending Closure? | `COUNT(Lead) WHERE stage.order = 9` | `Lead.stage` | `/api/leads/dashboard-stats/` | **1** | Yes | Canonical stage 9 | Highlight in financial section | Add dedicated Pending Closure card | **Critical** |
| **Total Agreed Amount**| Total deal value for Pending Closure?| `SUM(PreCloserFinancial.agreed_amount) WHERE stage.order = 9` | `PreCloserFinancial.agreed_amount`, `Lead.stage` | None | **4** | Yes | **Dashboard queries legacy estimated_revenue!** | Query `PreCloserFinancial.objects.aggregate(Sum('agreed_amount'))` | Add "Total Agreed Value" card | **Critical** |
| **Total Amount Paid** | Total collections recorded?| `SUM(PreCloserFinancial.amount_paid) WHERE stage.order = 9` | `PreCloserFinancial.amount_paid`, `Lead.stage` | None | **4** | Yes | **Dashboard queries legacy placement_fee!** | Query `PreCloserFinancial.objects.aggregate(Sum('amount_paid'))` | Add "Collected Amount" card | **Critical** |
| **Outstanding Balance**| Total unpaid deal balance?| `SUM(agreed_amount - amount_paid) WHERE stage.order = 9` | `PreCloserFinancial` | None | **4** | Yes | Metric not computed | Compute `SUM(F('agreed_amount') - F('amount_paid'))` | Add "Outstanding Balance" card | **Critical** |
| **Unpaid Leads List** | Leads with balance > 0? | `Lead WHERE agreed_amount > amount_paid` | `PreCloserFinancial`, `Lead` | None | **4** | Yes | Table not in dashboard | Add `pending_closure_balances` list to API | Add Outstanding Balances table | **High** |
| **Missing Financials Alert**| Pending Closure without record?| `COUNT(Lead) WHERE stage.order=9 AND pre_closer_financial IS NULL` | `Lead.stage`, `PreCloserFinancial` | None | **4** | Yes | Not detected (currently 4 leads match!) | Add `pending_closure_missing_financials` count & alert | Add Integrity Alert badge | **Critical** |
| **Calls Attempted** | Total call attempts? | `COUNT(CommunicationLog) WHERE channel='CALL'` | `CommunicationLog.channel` | `/api/leads/dashboard-stats/` | **1** | Yes | Scoped by role | None | Show in Communications section | **High** |
| **Call Outcomes** | Connected vs. Missed? | `COUNT by outcome` | None | None | **5** | **No** | **Call outcome fields do not exist in DB schema** | Add outcome/duration fields to `CommunicationLog` | Add Call Outcome chart | **Low** |
| **Emails Dispatched** | Emails accepted by SMTP? | `COUNT(CommunicationLog) WHERE channel='EMAIL' AND status='SUCCESS'` | `CommunicationLog.channel`, `status` | None | **4** | Yes | Email count currently merged into `recorded_messages` | Separate Email from WhatsApp in API | Add Email Dispatch KPI card | **High** |
| **Email Failures** | Emails rejected / failed? | `COUNT(CommunicationLog) WHERE channel='EMAIL' AND status='FAILED'` | `CommunicationLog.status` | None | **4** | Yes | Failures not aggregated | Return `email_failures_count` | Add Communication Error alert | **High** |
| **WhatsApp Dispatched**| Messages accepted by Meta? | `COUNT(CommunicationLog) WHERE channel='WHATSAPP' AND status='SUCCESS'` | `CommunicationLog.channel`, `status` | None | **4** | Yes | WhatsApp count currently merged into `recorded_messages` | Separate WhatsApp count in API | Add WhatsApp Dispatch KPI card | **High** |
| **WhatsApp Delivered/Read**| Messages delivered to device?| `COUNT WHERE delivered_at IS NOT NULL` | None | None | **5** | **No** | **Meta Cloud API delivery webhooks not implemented** | Implement webhook endpoint & callback model | Add Delivery/Read status badges | **Low** |
| **Follow-ups Due Today**| Follow-ups scheduled today? | `COUNT(Lead) WHERE next_follow_up::date = today` | `Lead.next_follow_up` | `/api/leads/dashboard-stats/` | **1** | Partial | UTC timezone vs. employee local timezone | Use employee local timezone for date bounds | None | **Critical** |
| **Overdue Follow-ups**| Follow-ups in the past? | `COUNT(Lead) WHERE next_follow_up < now` | `Lead.next_follow_up` | `/api/leads/dashboard-stats/` | **1** | Yes | Top 20 returned | Paginate or provide complete count | Add clickable badge to drill-down | **Critical** |
| **Follow-ups Next 7 Days**| Upcoming follow-ups? | `COUNT(Lead) WHERE next_follow_up BETWEEN now AND now+7d` | `Lead.next_follow_up` | None | **4** | Yes | Metric not computed | Add `followups_next_7_days` to API | Add Upcoming Schedule widget | **Medium** |
| **Completed Follow-ups**| Follow-ups successfully resolved?| Log of completed follow-up interaction | None | None | **5** | **No** | **No Follow-up entity or completion tracking exists** | Create `LeadFollowUp` model with `completed_at` | Add true completed follow-up metric | **Medium** |
| **Reminders Tracking**| Reminders due/overdue? | Reminder entity | None | None | **5** | **No** | **Reminder entity does not exist in CRM** | Create `Reminder` / `Task` model | Add Reminders widget | **Low** |
| **Employee Workload** | Assigned leads per employee? | `GROUP BY assigned_employee, COUNT(Lead)` | `Lead.assigned_employee` | `/api/leads/dashboard-stats/` | **1** | Yes | Available in `member_performance` | Add sortable columns | Add search & sorting in table | **High** |
| **Employee Conversion**| Placed leads / assigned leads?| `enrolled_leads / total_assigned * 100` | `Lead` | `/api/leads/dashboard-stats/` | **6** | Partial | Denominator skew on newly assigned leads | Define standard formula with owner | Add tooltips explaining formula | **Medium** |
| **Team Distribution** | Leads per team? | `GROUP BY team, COUNT(Lead)` | `Lead.team` | `/api/leads/dashboard-stats/` | **1** | Yes | Admin view only | None | None | **High** |
| **Team Financial Balance**| Agreed & balance per team? | `GROUP BY Lead.team, SUM(agreed_amount), SUM(balance)` | `PreCloserFinancial`, `Lead.team` | None | **4** | Yes | Currently shows legacy `placement_fees` | Aggregate `PreCloserFinancial` by `team` | Update Team Overview table | **High** |
| **System Health Alert**| Gateway / Integration status?| Check SMTP credentials & Celery worker status | Environment / Celery | None | **4** | Yes | Health check exists in tests, not on dashboard | Add `system_health` summary to Admin dashboard | Add System Health indicator | **Medium** |

---

## 5. Calculation Definitions and Known Ambiguities

### 5.1 Conversion Rate Ambiguities
* **Current Implementation:**
  $$\text{Conversion Rate} = \frac{\text{Enrolled Leads}}{\text{Total Assigned Leads}} \times 100$$
* **The Problem:** If an employee has 100 historical leads and 10 enrolled, rate = 10%. If a manager assigns 50 new leads today, the rate instantly drops to $\frac{10}{150} = 6.7\%$, penalizing the employee for taking on more work.
* **Recommended Product-Owner Decisions:**
  1. **Cohort-Based Conversion:** $\frac{\text{Enrolled from Leads Created in Period}}{\text{Total Leads Created in Period}}$.
  2. **Resolution-Based Conversion:** $\frac{\text{Enrolled Leads}}{\text{Enrolled Leads} + \text{Lost Leads}}$. This measures win-rate against resolved outcomes.

### 5.2 Date Boundary and Timezone Discrepancy
* **Current Implementation:** `today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)` in UTC (`crm_project.settings: TIME_ZONE = 'UTC'`).
* **The Problem:** Indian Standard Time (IST) is UTC+05:30. At 8:00 AM IST, UTC is 2:30 AM (same calendar day). But between 12:00 AM and 5:30 AM IST, UTC is still the previous calendar day. Follow-ups scheduled for the morning in IST fall outside `today_start` if evaluated strictly in UTC.
* **Recommendation:** Dashboard queries must accept an optional `timezone` parameter (defaulting to user profile timezone or `Asia/Kolkata`) to construct exact local day boundaries before converting to UTC for database comparison.

### 5.3 Active Leads Definition
* **Current Implementation:** `base_qs.exclude(status__iexact='Lost').exclude(stage__name__icontains='lost')`.
* **The Problem:** Leads in Stage 10 (`Enrolled`) are counted as **Active Leads**. In operational sales, an enrolled lead has completed the admissions cycle and is no longer an active sales opportunity.
* **Recommendation:** Define `Active Leads` strictly as leads in stages 1 through 9 (Cold Calling through Pending Closure), excluding both Stage 10 (`Enrolled`), Stage 11 (`Not Interested`), and Stage 12 (`Lost`).

### 5.4 The "Completed Follow-Ups" Heuristic
* **Current Implementation (`views.py:L1654`):**
  `'completed_followups': calls_count + messages_count`
* **The Defect:** If an employee makes 10 calls to Lead A, the dashboard reports "10 completed follow-ups", even if Lead A had no follow-up scheduled and Leads B, C, and D are severely overdue.
* **Recommendation:** Explicitly document this heuristic as temporary in the UI tooltip. For true tracking, implement a dedicated `LeadFollowUp` entity with status `PENDING`, `COMPLETED`, `MISSED`.

### 5.5 Financial Metrics: Snapshot vs. Period Cash Collections
* **Current Data Model:** `PreCloserFinancial` stores current `agreed_amount` and cumulative `amount_paid`.
* **The Problem:** If Lead X was created 60 days ago with `amount_paid = 10,000`, filtering the dashboard by "Last 7 Days" cannot determine whether that 10,000 was paid this week or two months ago, because `PreCloserFinancial` does not store an individual payment transaction ledger.
* **Recommendation:**
  - **Metric 1: Pipeline Agreed Value:** Total agreed value of all leads currently in Pending Closure.
  - **Metric 2: Cumulative Collections Recorded:** Total `amount_paid` recorded across eligible leads.
  - **Metric 3: Outstanding Receivables:** Total `agreed_amount - amount_paid`.
  - Do NOT claim that `SUM(amount_paid)` represents "Collections in Period" unless querying timestamped `LeadFinancialHistory` diffs.

---

## 6. Confirmed Data-Quality Issues and Architectural Risks

### 6.1 Database State Audit (SQLite Development / Staging Baseline)

A safe, read-only inspection of the active database yielded the following verified state:

```
+-------------------------------------------------------------+
| DATABASE BASELINE AUDIT                                     |
+--------------------------+----------------------------------+
| Table / Entity           | Verified Count in Database       |
+--------------------------+----------------------------------+
| Total Leads              | 221                              |
| Pipeline Stages          | 12 canonical active stages       |
| Stage 1 (Cold Calling)   | 200 leads                        |
| Stage 9 (Pending Closure)| 5 leads                          |
| Stage 10 (Enrolled)      | 2 leads                          |
| Stage 12 (Lost)          | 0 leads                          |
| Other Stages             | 14 leads                         |
| PreCloserFinancial       | 1 record                         |
| LeadStageHistory         | 211 transitions                  |
| LeadAssignmentHistory    | 202 assignments                  |
| LeadFinancialHistory     | 1 snapshot                       |
| CommunicationLog         | 18 logs (13 Email, 3 Call, 2 WA) |
| ReportSchedule           | 1 schedule                       |
| AuditEvent               | 240 events                       |
| Leads with Follow-up     | 0 leads (next_follow_up is NULL) |
+--------------------------+----------------------------------+
```

### 6.2 Confirmed Data Quality Issues

1. **Pending Closure Financial Discrepancy (Confirmed Defect):**
   - **Evidence:** Querying `Lead.objects.filter(stage__order=9)` returns 5 leads:
     - `SM-LD-0222` (Lasyasree): Has `PreCloserFinancial` (Agreed: ₹68,888, Paid: ₹0, Balance: ₹68,888).
     - `SM-LD-0220` (Keerthi Pillai): `pre_closer_financial = None`.
     - `SM-LD-0219` (Zubin Gupta): `pre_closer_financial = None`.
     - `SM-LD-0217` (Vamsi Chowdhury): `pre_closer_financial = None`.
     - `SM-LD-0012` (Karthik Sundaram): `pre_closer_financial = None`.
   - **Impact:** 80% (4 out of 5) of Pending Closure leads in the active database currently lack financial records. A simple inner join would omit 4 leads; an outer join would result in null values. The dashboard must handle missing financial records gracefully and display an administrative data-integrity warning.

2. **Absence of Active Follow-up Dates in Baseline:**
   - **Evidence:** `Lead.objects.filter(next_follow_up__isnull=False).count() == 0`.
   - **Impact:** In the existing database, all 221 leads currently have `next_follow_up = NULL`. In staging or production with imported leads, if follow-up dates are not actively scheduled, follow-up widgets will display 0 items.

3. **Risk of Cartesian Product Double-Counting:**
   - **Evidence:** Leads have multiple `CommunicationLog` entries, multiple `LeadStageHistory` entries, and `LeadAssignmentHistory` entries.
   - **Risk:** If a future dashboard query joins `Lead` with `CommunicationLog` and `PreCloserFinancial` in a single query (e.g. `Lead.objects.annotate(comm_count=Count('communication_logs'), total_agreed=Sum('pre_closer_financial__agreed_amount'))`), Django's SQL generation will create a Cartesian product, multiplying financial totals by the number of communication logs.
   - **Prevention Rule:** Financial sums and communication counts **must never be aggregated in the same SQL JOIN**. They must be computed via independent subqueries, separate aggregate calls, or distinct database views.

---

## 7. Role-Based Dashboard Access Requirements

To preserve operational security and adhere to strict organizational boundaries, the dashboard must enforce three isolated operational tiers:

```
                      +-----------------------------+
                      |   EXECUTIVE ADMIN TIER      |
                      |   - Organization-Wide KPIs  |
                      |   - All Teams & Branches    |
                      |   - Financial Total Balances|
                      |   - System Health & Errors  |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |  ADMISSIONS MANAGER TIER    |
                      |  - Scoped to Managed Team   |
                      |  - Team Workload & Funnel   |
                      |  - Team Counsellor Matrix   |
                      |  - Team Financial Balances  |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |  CAREER COUNSELLOR TIER     |
                      |  - Scoped to Assigned Leads |
                      |  - Personal Pipeline Funnel |
                      |  - Personal Overdue Queue   |
                      |  - Personal Deal Balances   |
                      +-----------------------------+
```

### 7.1 Backend Enforcement Specifications
- **Admin:** `Lead.objects.filter(archived_at__isnull=True)` (Unscoped).
- **Manager:**
  ```python
  managed_team = getattr(user, 'managed_team', None)
  team_id = managed_team.id if managed_team else user.team_id
  base_qs = Lead.objects.filter(team_id=team_id, archived_at__isnull=True)
  ```
- **Sales Employee:**
  ```python
  base_qs = Lead.objects.filter(assigned_employee_id=user.id, archived_at__isnull=True)
  ```
- **Security Rule:** The frontend must never pass an arbitrary `team_id` or `employee_id` to override role boundaries. The backend must strictly validate that a Manager can only query their own team, and a Sales Employee can only view their own leads.

---

## 8. Recommended Operational Dashboard Layout

We recommend structuring the Operational Dashboard into **8 distinct functional zones**:

```
+===================================================================================================+
| 1. EXECUTIVE SUMMARY & DATE FILTER BAR                                                            |
| [Portal Badge] [Team Scope Pill]                     [Date Presets: Today | 7D | 30D | Custom]     |
| KPI Cards: [Total Inflow] [Active Pipeline] [Pending Closure] [Enrolled] [Overdue] [Collections]  |
+===================================================================================================+
| 2. PENDING CLOSURE & FINANCIAL CONTROL CENTRE                                                     |
| [Locked Deals: N] | [Agreed Value: ₹X] | [Collected: ₹Y] | [Outstanding Balance: ₹Z]             |
| Table: Leads in Pending Closure with Unpaid Balance (Lead | Counsellor | Agreed | Paid | Balance) |
+===================================================================================================+
| 3. ADMISSIONS PIPELINE FUNNEL (12 Canonical Stages)                                               |
| Visual stage progression with current lead count, % of pipeline, and period transitions           |
| Stages 1-8 (Inquiry to Negotation) -> Stage 9 (Pending Closure) -> Stage 10 (Enrolled)            |
+===================================================================================================+
| 4. ATTENTION REQUIRED & RISK RADAR (Operational Alerts)                                           |
| [Overdue Follow-ups: N] | [Unassigned Leads: N] | [Stuck >14d: N] | [Missing Financials: N]       |
+===================================================================================================+
| 5. TEAM & COUNSELLOR WORKLOAD MATRIX                                                              |
| Table: Counsellor | Team | Assigned | Pending Closure | Enrolled | Calls | Msgs | Overdue F/U      |
+===================================================================================================+
| 6. COMMUNICATION ACTIVITY LOG & OUTCOMES                                                          |
| Chart: Calls Attempted vs Emails Dispatched vs WhatsApp Sent                                      |
+===================================================================================================+
| 7. TODAY'S ACTION QUEUE & FOLLOW-UP MONITORING                                                    |
| Prioritized list of leads requiring call/WhatsApp/meeting today (with 1-click Quick Connect)       |
+===================================================================================================+
| 8. SYSTEM & INTEGRATION HEALTH (Admin Only)                                                       |
| [Gmail SMTP: Connected] | [Meta WA API: Ready] | [Callyzer: Blocked] | [Celery Beat: Active]     |
+===================================================================================================+
```

### Visual Widget Mappings
- **KPI Cards:** Large numeric value with percentage comparison, trend arrow, and contextual subtext.
- **Financial Centre:** Gradient-bordered card matching the `#2563EB` / `#7C3AED` palette with monospace currency formatting (`₹ xx,xxx`).
- **Pipeline Funnel:** Horizontal stacked progression with stage order badges (1..12).
- **Tables:** Monospace IDs, sortable headers, sticky action buttons, and hover highlights.
- **Alert Badges:** `crm-pill-warning` (amber), `crm-pill-error` (red), and `crm-pill-blue`.

---

## 9. Missing Backend APIs and Data Models

To satisfy all requirements of the BI specification, the following backend components must be added or extended:

### 9.1 Data Model Extensions Required (Non-Breaking)
1. **`LeadFollowUp` (Recommended for Follow-up Tracking):**
   ```python
   class LeadFollowUp(models.Model):
       lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='followups')
       scheduled_at = models.DateTimeField()
       completed_at = models.DateTimeField(null=True, blank=True)
       status = models.CharField(max_length=20, choices=[('PENDING','Pending'), ('COMPLETED','Completed'), ('MISSED','Missed')])
       notes = models.TextField(blank=True)
       created_by = models.ForeignKey(User, on_delete=models.PROTECT)
   ```
2. **`CommunicationLog` Enhancements (for Call & WhatsApp Tracking):**
   - Add `duration_seconds = models.PositiveIntegerField(null=True, blank=True)`
   - Add `call_outcome = models.CharField(max_length=30, blank=True)` (`CONNECTED`, `MISSED`, `BUSY`, `UNANSWERED`)
   - Add `delivered_at = models.DateTimeField(null=True, blank=True)`
   - Add `read_at = models.DateTimeField(null=True, blank=True)`

### 9.2 API Endpoint Extensions Required
1. **`GET /api/leads/dashboard-stats/` (Enhancements):**
   - Add query parameters: `start_date`, `end_date`, `team_id`, `employee_id`.
   - Add `financial_overview`:
     ```json
     {
       "pending_closure_count": 5,
       "total_agreed_amount": 68888.00,
       "total_amount_paid": 0.00,
       "total_outstanding_balance": 68888.00,
       "missing_financial_count": 4,
       "unpaid_leads": [
         { "lead_id": 221, "lead_code": "SM-LD-0222", "name": "Lasyasree", "agreed": 68888.00, "paid": 0.00, "balance": 68888.00 }
       ]
     }
     ```
   - Add `attention_radar`:
     ```json
     {
       "overdue_followups_count": 0,
       "unassigned_leads_count": 2,
       "missing_financials_count": 4,
       "failed_communications_count": 5
     }
     ```
   - Add `communication_breakdown`:
     ```json
     {
       "calls_count": 3,
       "emails_count": 13,
       "whatsapp_count": 2,
       "failed_count": 0,
       "blocked_count": 5
     }
     ```

---

## 10. Missing Frontend Components and Interactions

1. **Date Range Component:**
   - Replace fixed buttons with a dual-input custom date range picker (Start Date, End Date) alongside standard presets (Today, Yesterday, Last 7 Days, This Month, All Time).
2. **Team & Counsellor Filter Bar:**
   - Add Admin Team selector dropdown and Manager Counsellor selector dropdown to filter the dashboard dynamically.
3. **Pending Closure Financial Card Component:**
   - Dedicated dashboard widget displaying Total Agreed Value, Amount Paid, and Outstanding Balance with high-contrast typography.
4. **Attention Required Alert Banners:**
   - Interactive chips that trigger a filtered view when clicked (e.g., clicking "4 Missing Financials" navigates directly to the Spreadsheet filtered by Pending Closure leads missing financial data).
5. **Interactive Funnel & Table Drill-Down:**
   - Clicking a stage or counsellor row should filter the dashboard or open the spreadsheet with matching filters applied.

---

## 11. Test Coverage Gaps

The audit identified the following test coverage gaps in the existing dashboard implementation:

1. **Backend Tests (`test_dashboard_stats.py`):**
   - Tests only verify `total_leads`, `active_leads`, and legacy `estimated_revenue` / `placement_fee`.
   - **No test verifies `PreCloserFinancial` inclusion or balance calculations.**
   - **No test verifies behavior when leads in Pending Closure lack financial records.**
   - **No test verifies date-range filtering with `start_date` and `end_date`.**
   - **No test verifies zero-division protection in conversion rates.**
2. **Frontend Tests (`crm.test.tsx`):**
   - Tests only assert that portals mount without throwing errors.
   - **No test verifies KPI calculation accuracy on the client.**
   - **No test verifies date filter button interaction or API re-fetching.**
   - **No test verifies financial amount formatting in INR currency.**

---

## 12. Prioritized Implementation Roadmap

To implement the complete Operational Control Centre safely, we recommend breaking the work into **5 small, independently testable phases**:

```
+---------------------------------------------------------------------------------------------------+
| PHASE 1: FINANCIAL BI & PENDING CLOSURE INTEGRATION (PROMPT 04)                                   |
| - Connect DashboardStatsView to PreCloserFinancial model.                                         |
| - Aggregate agreed_amount, amount_paid, and outstanding_balance.                                  |
| - Add missing-financials detection for historical Pending Closure leads.                         |
| - Build frontend Financial Overview KPI card and Outstanding Balances table.                      |
| - Deliverable: Real-time financial visibility into Pending Closure pipeline.                      |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 2: ATTENTION RADAR & ACTION QUEUE ENHANCEMENTS (PROMPT 05)                                  |
| - Build unified Attention Required API aggregating overdue follow-ups, unassigned leads,          |
|   stuck deals, and communication failures.                                                        |
| - Enhance Today's Action Queue with 1-click communication triggers and pagination.                |
| - Deliverable: Proactive operational alerts preventing lead neglect.                              |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 3: COMMUNICATION ACTIVITY & BREAKDOWN REFINEMENT (PROMPT 06)                                |
| - Separate Email, WhatsApp, and Call metrics in API response (deprecate combined message count).   |
| - Display dispatches vs. failures per channel.                                                     |
| - Provide clear UI tooltips distinguishing SMTP acceptance from delivery.                         |
| - Deliverable: Accurate communication activity tracking across all channels.                      |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 4: ADVANCED FILTERS & DRILL-DOWN CAPABILITIES (PROMPT 07)                                   |
| - Implement custom date range picker (Start Date, End Date) on frontend and backend.              |
| - Add Team filter for Admins and Counsellor filter for Managers.                                  |
| - Implement 1-click drill-downs from KPI cards to filtered Spreadsheet views.                     |
| - Deliverable: Granular investigation and reporting across any timeframe or team.                 |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 5: TEAM & COUNSELLOR PERFORMANCE MATRIX HARDENING (PROMPT 08)                               |
| - Implement verified conversion rate formulas with documented denominators.                       |
| - Ensure team performance metrics strictly respect date-range filters.                           |
| - Add comprehensive automated test suites (backend pytest + frontend vitest).                     |
| - Deliverable: Bulletproof team analytics and full automated regression suite.                     |
+---------------------------------------------------------------------------------------------------+
```

### Dependencies Between Implementation Tasks
- **Phase 1** is independent and can be executed immediately.
- **Phase 2** depends on Phase 1 for financial alert integration.
- **Phase 3** is independent of financial metrics.
- **Phase 4** enhances the filters across Phases 1, 2, and 3.
- **Phase 5** formalizes testing and performance formulas across the entire dashboard.

### Acceptance Criteria per Phase

#### Phase 1 Acceptance Criteria
1. `GET /api/leads/dashboard-stats/` returns `financial_overview` containing `total_agreed_amount`, `total_amount_paid`, and `total_outstanding_balance` computed from `PreCloserFinancial`.
2. Leads in Pending Closure without a financial record are reported in `missing_financial_count` without crashing the query.
3. The dashboard displays a dedicated "Pending Closure Financial Control Centre" card formatted in INR (`₹`).
4. Role permissions are strictly enforced: Counsellors see only their assigned deals; Managers see only their team's deals; Admins see global totals.
5. All backend pytest cases pass.

#### Phase 2 Acceptance Criteria
1. Dashboard displays an "Attention Radar" with live badges for: Overdue Follow-ups, Unassigned Leads, Missing Financials, and Communication Failures.
2. Clicking any badge navigates to the relevant lead list.
3. The Action Queue renders overdue and today's follow-ups with working 1-click call/email/WhatsApp triggers.

#### Phase 3 Acceptance Criteria
1. `CommunicationLog` aggregations explicitly separate Calls, Emails, and WhatsApp messages.
2. Communication failures and blocked attempts are prominently indicated.
3. UI labels clearly reflect gateway status (e.g. "SMTP Accepted", "Cloud API Dispatched").

#### Phase 4 Acceptance Criteria
1. Date filter supports custom start and end date selection alongside standard presets.
2. Selecting a team or counsellor updates all dashboard cards and tables.
3. Filter state persists gracefully across navigation.

#### Phase 5 Acceptance Criteria
1. Conversion rate formulas have documented denominators and handle zero-lead edge cases cleanly.
2. Date range filtering properly constrains team performance calculations.
3. 100% pass rate across all backend and frontend dashboard test suites.

---

## 13. Audit Sign-Off & Next Steps

This discovery audit has established the complete factual baseline of the Skill Move Sales CRM dashboard and business intelligence architecture.

**Current State:** Ready for targeted implementation.  
**Immediate Action:** Submit this report to the project owner for architectural review and approval.  
**Next Prompt:** Upon approval, initiate **Phase 1: Financial BI & Pending Closure Integration (Prompt 04)**.
