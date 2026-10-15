# SKILL MOVE SALES CRM — SECURITY AUDIT REPORT (REPORT C)

**Document Ref:** SM-AUDIT-2026-REP-C  
**Audit Date:** October 15, 2026  
**Auditor:** Antigravity Senior Application Security Engineer  
**Target Codebase:** Skill Move Sales CRM  
**Scope:** Authentication, RBAC, Data Isolation, Injection Risks, Secrets & Sensitive Information Handling  
**Severity Framework:** OWASP Risk Rating Methodology (Critical, High, Medium, Low, Informational)  

---

## 1. Executive Security Summary

The application security audit of Skill Move Sales CRM evaluated the complete threat surface across API endpoints, data access patterns, authentication mechanisms, and external integrations. 

### Key Security Posture Findings:
- **Tenant & Record Isolation:** Outstanding. Object-level access control (IDOR prevention) is strictly enforced in Django model querysets. Unauthorized access attempts across counselors or managers return HTTP 404.
- **Injection Defenses:** Robust. SQL queries are parameterized via the Django ORM; XSS is mitigated via React’s virtual DOM escaping; CSV exports sanitize formula injection characters (`=`, `+`, `-`, `@`).
- **Cryptographic Storage:** Password hashing utilizes Django’s standard `PBKDF2PasswordHasher` with SHA-256 and 720,000 iterations.
- **Vulnerabilities Requiring Action:** One High-severity CORS configuration flaw (`SEC-001`), one Medium-severity secret key fallback flaw (`SEC-002`), and one Medium-severity rate-limiting omission on password reset (`SEC-003`).

---

## 2. Threat Surface Analysis

```
                      +-------------------------------------------------------------+
                      |                   PUBLIC INTERNET THREATS                    |
                      +------------------------------+------------------------------+
                                                     |
                                                     v
+------------------------------------+   +------------------------------------+   +------------------------------------+
|        ATTACK VECTOR 1             |   |        ATTACK VECTOR 2             |   |        ATTACK VECTOR 3             |
|  Unauthenticated API Endpoints     |   |  Authenticated Lateral Movement    |   |  External Ingestion Webhooks       |
|  - /api/auth/login/                |   |  - Counselor attempts IDOR on peer |   |  - Callyzer webhook signature spoof|
|  - /api/auth/password-reset/       |   |  - Manager probes other team data  |   |  - Malicious CSV import payload    |
+------------------------------------+   +------------------------------------+   +------------------------------------+
```

---

## 3. Findings by Severity

### Summary Table

| Finding ID | Vulnerability / Issue | Severity | Status | Affected Component |
| :---: | :--- | :---: | :---: | :--- |
| **SEC-001** | CORS Wildcard with Credentials Enabled | **High** | Open | `backend/crm_project/settings.py:157` |
| **SEC-002** | Hardcoded Development Fallback `SECRET_KEY` | **Medium** | Open | `backend/crm_project/settings.py:25` |
| **SEC-003** | Missing Rate Limiting on Password Reset Request | **Medium** | Open | `backend/apps/authentication/views.py` |
| **SEC-004** | Insecure Direct Object Reference (IDOR) | **N/A (Pass)** | Mitigated | `backend/apps/leads/views.py` |
| **SEC-005** | SQL Injection in Search & Filter Params | **N/A (Pass)** | Mitigated | `backend/apps/leads/filters.py` |
| **SEC-006** | Stored & Reflected Cross-Site Scripting (XSS) | **N/A (Pass)** | Mitigated | `frontend/src/` & serializers |
| **SEC-007** | Formula Injection in CSV / Excel Exports | **N/A (Pass)** | Mitigated | `backend/apps/leads/views.py` |
| **SEC-008** | Refresh Token Revocation & Blacklisting | **N/A (Pass)** | Mitigated | `backend/apps/authentication/views.py` |

---

## 4. Detailed Vulnerability Analyses

### SEC-001: CORS Wildcard with Credentials Enabled
- **Severity:** **HIGH** (CVSS: 7.5 / CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N)
- **Component:** `backend/crm_project/settings.py` (lines 157-158)
- **Vulnerable Configuration:**
  ```python
  CORS_ALLOW_ALL_ORIGINS = True
  CORS_ALLOW_CREDENTIALS = True
  ```
- **Technical Impact:**
  Modern browsers block wildcard origins (`*`) when credentials (`withCredentials: true`) are present. However, improper reverse proxy headers or permissive CORS configurations can allow third-party web origins visited by an authenticated CRM counselor to read sensitive CRM responses, including customer contact records, financial data, and personal information.
- **Evidence Reference:** `EVD-0080`
- **Recommended Remediation:**
  Disable wildcard origins and enforce an explicit whitelist matching authorized client domains:
  ```python
  CORS_ALLOW_ALL_ORIGINS = False
  CORS_ALLOWED_ORIGINS = [
      "http://localhost:5173",
      "http://localhost",
      "https://crm.skillmove.com",
  ]
  CORS_ALLOW_CREDENTIALS = True
  ```

---

### SEC-002: Hardcoded Development Fallback `SECRET_KEY`
- **Severity:** **MEDIUM** (CVSS: 5.9 / CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N)
- **Component:** `backend/crm_project/settings.py` (line 25)
- **Vulnerable Configuration:**
  ```python
  SECRET_KEY = os.environ.get('SECRET_KEY', 'crm-insecure-secret-key-for-dev-change-in-production')
  ```
- **Technical Impact:**
  If the `SECRET_KEY` environment variable is accidentally omitted or set to an empty string during container deployment, Django will silently fall back to a known, publicly visible secret key. An attacker with knowledge of this key could forge cryptographic session cookies, password reset tokens, and cryptographic signatures.
- **Evidence Reference:** `EVD-0081`
- **Recommended Remediation:**
  Enforce a strict runtime check that halts server boot if `SECRET_KEY` is missing in production:
  ```python
  SECRET_KEY = os.environ.get('SECRET_KEY')
  if not SECRET_KEY:
      if DEBUG:
          SECRET_KEY = 'crm-dev-fallback-key-only-allowed-when-debug-is-true'
      else:
          from django.core.exceptions import ImproperlyConfigured
          raise ImproperlyConfigured("SECRET_KEY environment variable must be set in production!")
  ```

---

### SEC-003: Missing Rate Limiting on Password Reset Request
- **Severity:** **MEDIUM** (CVSS: 5.3 / CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L)
- **Component:** `backend/apps/authentication/views.py` (`PasswordResetRequestView`)
- **Vulnerable Code:**
  The `PasswordResetRequestView` does not specify `throttle_classes`.
- **Technical Impact:**
  An unauthenticated attacker can submit hundreds of password reset requests in rapid succession for a targeted user. This can result in:
  1. Flooding the victim's email inbox with unwanted reset notifications.
  2. Rapid exhaustion of the organization's outbound SMTP rate limits or API quotas.
- **Evidence Reference:** `EVD-0082`
- **Recommended Remediation:**
  Add Django REST Framework's `ScopedRateThrottle`:
  ```python
  class PasswordResetRequestView(APIView):
      permission_classes = [AllowAny]
      throttle_classes = [ScopedRateThrottle]
      throttle_scope = 'password_reset'
  ```
  In `settings.py`:
  ```python
  REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['password_reset'] = '5/hour'
  ```

---

## 5. Verified Security Controls & Defenses

### 1. Insecure Direct Object Reference (IDOR) & Scoping
- **Test:** A counselor authenticated as `counsellor_1` attempted to read and modify `GET /api/leads/leads/{peer_lead_id}/` (a lead belonging to `counsellor_2`).
- **Observed Result:** Clean `HTTP 404 Not Found`. DRF's `get_queryset()` strictly filters leads to `Lead.objects.filter(counsellor=request.user)`. No data leakage occurred (`EVD-0014`).

### 2. Team Isolation
- **Test:** A manager for Team Alpha attempted to fetch leads belonging to Team Beta.
- **Observed Result:** The API returned only Team Alpha leads. Direct access to Team Beta lead IDs yielded `HTTP 404 Not Found` (`EVD-0012`).

### 3. SQL Injection Resistance
- **Test:** Injected `' OR '1'='1` and `UNION SELECT` payloads into search and filtering query parameters (`?search=`, `?stage=`).
- **Observed Result:** Queries were safely handled as literal strings by Django's ORM parameterization. Zero database syntax errors or data dumps were generated (`EVD-0085`).

### 4. Cross-Site Scripting (XSS) Resistance
- **Test:** Injected `<script>alert(document.cookie)</script>` and `<img src=x onerror=alert(1)>` into lead notes and contact name fields.
- **Observed Result:** The content was stored safely as raw text in PostgreSQL and rendered as escaped HTML entities by React's virtual DOM. No script execution occurred (`EVD-0086`).

### 5. Formula Injection Defense in Exports
- **Test:** Exported lead records where names began with formula triggers: `=SUM(A1:A10)`, `@cmd`, `-1+1`.
- **Observed Result:** `ExportLeadsView` prepends a single quotation mark (`'`) to any cell starting with dangerous characters, ensuring Excel and LibreOffice treat them strictly as string literals (`EVD-0087`).

---

## 6. Unverified Areas & Testing Limitations

Due to the strict non-destructive, read-only audit protocol:
1. **Live External Telephony:** Physical SIM voice calling via the Callyzer mobile application was verified via webhook simulation; physical call interception on cellular carrier networks was not performed.
2. **Third-Party WhatsApp Cloud Delivery:** Meta WhatsApp Cloud API credentials were not exercised against live external phone numbers.
3. **High-Concurrency DDoS Stress Testing:** Network-level flood tests were not executed to avoid degrading local host or container network interfaces.

---
*Report certified by Antigravity Senior Application Security Engineer.*
