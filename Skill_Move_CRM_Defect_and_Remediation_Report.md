# SKILL MOVE SALES CRM — DEFECT AND REMEDIATION REPORT (REPORT E)

**Document Ref:** SM-AUDIT-2026-REP-E  
**Audit Date:** October 15, 2026  
**Auditor:** Antigravity QA Lead & Senior Full-Stack Engineer  
**Target Codebase:** Skill Move Sales CRM  
**Audit Framework:** IEEE 829 Standard for Software Test Documentation  

---

## 1. Defect Summary & Prioritization Matrix

During the comprehensive audit, seven (7) total software defects and security configuration issues were identified and confirmed with reproducible technical evidence. Zero (0) Critical (P0) defects were identified, allowing the application to achieve a release status of **`READY WITH CONDITIONS`**.

```
+-------------------------------------------------------------------------------------------------------+
| PRIORITY   | SEVERITY | DEFECT ID | MODULE          | TITLE                                           |
+------------+----------+-----------+-----------------+-------------------------------------------------+
| P1 (High)  | High     | DEF-0001  | Communications  | FileResponse NameError in Template Download     |
| P1 (High)  | High     | DEF-0003  | Security / CORS | CORS Wildcard Allowed with Credentials          |
| P2 (Medium)| Medium   | DEF-0002  | Authentication  | Admin Employee Edit Serializer Transfer Fixture |
| P2 (Medium)| Medium   | DEF-0004  | Core Settings   | Hardcoded Development Fallback SECRET_KEY       |
| P2 (Medium)| Medium   | DEF-0007  | Auth / Security | Password Reset Request Lacks Rate Throttling    |
| P3 (Low)   | Low      | DEF-0005  | Leads / UI      | Pipeline Stage Name Casing Consistency          |
| P3 (Low)   | Low      | DEF-0006  | Frontend Build  | Monolithic Lead360Page Bundle Chunk Warning     |
+-------------------------------------------------------------------------------------------------------+
```

---

## 2. Detailed Confirmed Defect Registers

### DEF-0001: `NameError: name 'FileResponse' is not defined` in Template Attachment Download
- **Defect ID:** `DEF-0001`
- **Priority:** **P1 — High (Release Blocker Condition)**
- **Severity:** High
- **Module:** `apps/communications`
- **File & Line:** `backend/apps/communications/views.py:329`
- **Preconditions:** An email template with an uploaded PDF or document attachment exists in the database.
- **Reproduction Steps:**
  1. Authenticate as any CRM user with access to email templates.
  2. Send HTTP request: `GET /api/communications/templates/{id}/download-attachment/`
  3. Inspect server response.
- **Expected Behavior:** The endpoint returns HTTP 200 with `Content-Type: application/octet-stream` or `application/pdf` streaming the file content.
- **Actual Behavior:** The server crashes with HTTP 500 Internal Server Error:
  ```
  NameError: name 'FileResponse' is not defined
  ```
- **Root Cause (Confirmed):** `FileResponse` and `Http404` are referenced on lines 326 and 329 of `views.py` but are missing from the `from django.http import ...` statement.
- **Business Impact:** Sales counselors and administrators are completely unable to download or preview email attachments, preventing verification of brochures sent to prospects.
- **Evidence Reference:** `EVD-0040` (Automated pytest failure in `apps/communications/tests/test_email_templates.py::test_11_unauthorized_attachment_download_prevented`).
- **Recommended Fix:**
  Add the missing imports at the top of `backend/apps/communications/views.py`:
  ```python
  from django.http import FileResponse, Http404
  ```
- **Regression Test:** `TC-COMM-001` (`pytest apps/communications/tests/test_email_templates.py`).

---

### DEF-0002: Admin Employee Update Fails with HTTP 400 on Team Change
- **Defect ID:** `DEF-0002`
- **Priority:** **P2 — Medium**
- **Severity:** Medium
- **Module:** `apps/authentication`
- **File & Line:** `backend/apps/authentication/serializers.py` & `test_user_admin_actions.py:168`
- **Preconditions:** An employee has active assigned leads and an admin attempts to change their team.
- **Reproduction Steps:**
  1. Authenticate as an Admin.
  2. Execute `PATCH /api/auth/users/{employee_id}/` with payload `{"team": 2}`.
  3. Omit the parameter `lead_transfer_action`.
- **Expected Behavior:** The employee's team is updated, applying a default policy (such as `lead_transfer_action: "retain"`) or prompting the user with a clear validation message.
- **Actual Behavior:** DRF raises `HTTP 400 Bad Request` with validation error: `{'lead_transfer_action': ['This field is required when transferring an employee with assigned leads.']}`.
- **Root Cause (Confirmed):** Strict validation logic in `UserAdminUpdateSerializer` enforces `lead_transfer_action` presence whenever `team` changes. The automated test fixture in `test_user_admin_actions.py` omitted this field, causing a test failure.
- **Business Impact:** Admin UI modals that do not explicitly supply this field fail during employee reassignment workflows.
- **Evidence Reference:** `EVD-0005` (Pytest failure output in `apps/authentication/tests/test_user_admin_actions.py`).
- **Recommended Fix:**
  Default `lead_transfer_action = "retain"` in `UserAdminUpdateSerializer.validate()` if not explicitly supplied, or ensure frontend employee edit modals always provide the option.
- **Regression Test:** `TC-AUTH-005` (`pytest apps/authentication/tests/test_user_admin_actions.py`).

---

### DEF-0003: Insecure CORS Wildcard Configured with Credentials Allowed
- **Defect ID:** `DEF-0003` (also documented as `SEC-001`)
- **Priority:** **P1 — High (Release Blocker Condition)**
- **Severity:** High
- **Module:** `crm_project/settings.py`
- **File & Line:** `backend/crm_project/settings.py:157-158`
- **Preconditions:** Server running in staging or production.
- **Reproduction Steps:**
  1. Inspect `settings.py` lines 157-158:
     ```python
     CORS_ALLOW_ALL_ORIGINS = True
     CORS_ALLOW_CREDENTIALS = True
     ```
  2. Send an `OPTIONS` preflight request with `Origin: https://evil-site.com`.
- **Expected Behavior:** Permitted origins should be restricted to explicitly whitelisted domains.
- **Actual Behavior:** Preflight succeeds with wildcard permissions, enabling potential cross-origin credentialed access.
- **Root Cause (Confirmed):** Permissive development settings carried forward into production settings file.
- **Business Impact:** High exposure to CSRF-style authenticated data harvesting if CRM users navigate untrusted web pages while logged in.
- **Evidence Reference:** `EVD-0080`.
- **Recommended Fix:**
  Replace wildcard with explicit origins:
  ```python
  CORS_ALLOW_ALL_ORIGINS = False
  CORS_ALLOWED_ORIGINS = [
      "http://localhost:5173",
      "http://localhost",
      "https://crm.skillmove.com",
  ]
  CORS_ALLOW_CREDENTIALS = True
  ```
- **Regression Test:** `TC-SEC-001`.

---

### DEF-0004: Hardcoded Development Fallback `SECRET_KEY` in Settings
- **Defect ID:** `DEF-0004` (also documented as `SEC-002`)
- **Priority:** **P2 — Medium**
- **Severity:** Medium
- **Module:** `crm_project/settings.py`
- **File & Line:** `backend/crm_project/settings.py:25`
- **Preconditions:** Django starts without `SECRET_KEY` environment variable.
- **Reproduction Steps:**
  1. Unset `SECRET_KEY` in environment.
  2. Start Django server.
- **Expected Behavior:** Django refuses to boot in production with `ImproperlyConfigured`.
- **Actual Behavior:** Server silently boots with known dev fallback key.
- **Root Cause (Confirmed):** `os.environ.get('SECRET_KEY', 'crm-insecure-secret-key-for-dev-change-in-production')`.
- **Business Impact:** Weak cryptographic signing of sessions and tokens if environment variable is omitted in production.
- **Evidence Reference:** `EVD-0081`.
- **Recommended Fix:** Require `SECRET_KEY` when `DEBUG=False`.
- **Regression Test:** `TC-SEC-002`.

---

### DEF-0005: Pipeline Stage Naming Inconsistency (`Pending Closure` vs `pendingClosure`)
- **Defect ID:** `DEF-0005`
- **Priority:** **P3 — Low**
- **Severity:** Low
- **Module:** `apps/leads` & `frontend/src/`
- **Preconditions:** Inspecting stage constants across frontend and backend.
- **Observed Behavior:** Database stores `Pending Closure` (title case with space). Frontend constants occasionally check camelCase `pendingClosure`.
- **Root Cause (Confirmed):** Minor discrepancy between initial specification documents and database migration fixtures.
- **Business Impact:** Low; potential stage filter mismatch if frontend does not apply normalized string comparisons.
- **Evidence Reference:** `EVD-0025`.
- **Recommended Fix:** Normalize stage matching using slugified strings (`stage.toLowerCase().replace(/\s+/g, '')`).
- **Regression Test:** `TC-LEAD-006`.

---

### DEF-0006: Monolithic Bundle Chunk Warning in `Lead360Page.tsx`
- **Defect ID:** `DEF-0006`
- **Priority:** **P3 — Low**
- **Severity:** Low
- **Module:** `frontend`
- **File & Line:** `frontend/src/components/Lead360Page.tsx` (2,557 lines)
- **Preconditions:** Running `npm run build`.
- **Observed Behavior:** Vite emits warning: `Some chunks are larger than 500 kB after minification (dist/assets/Lead360Page-xxx.js: 141.24 kB gzip / 520 kB uncompressed)`.
- **Business Impact:** Slightly slower initial route loading (~450ms) on slow mobile connections.
- **Evidence Reference:** `EVD-0301`.
- **Recommended Fix:** Split sub-tabs into separate components loaded via `React.lazy()` and `Suspense`.
- **Regression Test:** `PERF-001`.

---

### DEF-0007: Unauthenticated Password Reset Request Lacks Rate Limiting
- **Defect ID:** `DEF-0007` (also documented as `SEC-003`)
- **Priority:** **P2 — Medium**
- **Severity:** Medium
- **Module:** `apps/authentication`
- **File & Line:** `backend/apps/authentication/views.py` (`PasswordResetRequestView`)
- **Observed Behavior:** Endpoint accepts unlimited requests without throttling.
- **Business Impact:** Malicious actors can flood inboxes and exhaust outbound email server quotas.
- **Evidence Reference:** `EVD-0082`.
- **Recommended Fix:** Apply DRF `ScopedRateThrottle` (`password_reset: 5/hour`).
- **Regression Test:** `TC-AUTH-006`.

---

## 3. Prioritized Remediation Roadmap

```
Phase 1: Pre-Release Immediate Containment (SLA: < 2 Hours)
├── [COND-01] DEF-0001: Add FileResponse, Http404 to apps/communications/views.py
└── [COND-02] DEF-0003: Restrict CORS origins in crm_project/settings.py

Phase 2: Post-Release Fast Follow (SLA: < 48 Hours)
├── [COND-03] DEF-0004: Enforce strict SECRET_KEY check in settings.py
├── [COND-04] DEF-0007: Add rate throttling to PasswordResetRequestView
└── DEF-0002: Default lead_transfer_action in UserAdminUpdateSerializer

Phase 3: Routine Architecture Sprint (SLA: < 2 Weeks)
├── DEF-0005: Unify pipeline stage slugification constants
└── DEF-0006: Modularize Lead360Page.tsx with React.lazy code splitting
```

---
*Report certified by Antigravity QA Lead & Full-Stack Engineering Team.*
