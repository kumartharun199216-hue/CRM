import re

SUPPORTED_PLACEHOLDERS = {
    '{{lead_name}}': 'Lead / Contact Full Name',
    '{{lead_email}}': 'Lead Email Address',
    '{{lead_phone}}': 'Lead Phone Number',
    '{{employee_name}}': 'Assigned Counsellor / Employee Name',
    '{{company_name}}': 'Organization Name (Skill Move)',
    # Common aliases
    '{{name}}': 'Lead Name (alias for {{lead_name}})',
    '{{email}}': 'Lead Email (alias for {{lead_email}})',
    '{{phone}}': 'Lead Phone (alias for {{lead_phone}})',
}

SAMPLE_PREVIEW_DATA = {
    '{{lead_name}}': 'Rahul Sharma',
    '{{lead_email}}': 'rahul.sharma@example.com',
    '{{lead_phone}}': '+91 98765 43210',
    '{{employee_name}}': 'Priya Patel',
    '{{company_name}}': 'Skill Move Sales CRM',
    '{{name}}': 'Rahul Sharma',
    '{{email}}': 'rahul.sharma@example.com',
    '{{phone}}': '+91 98765 43210',
}

ALLOWED_ATTACHMENT_EXTENSIONS = {
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg', '.txt'
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB per attachment
MAX_ATTACHMENTS_PER_TEMPLATE = 10
MAX_TOTAL_ATTACHMENTS_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB total per template
MAX_TOTAL_ATTACHMENT_BYTES = MAX_TOTAL_ATTACHMENTS_SIZE_BYTES

PLACEHOLDER_REGEX = re.compile(r'\{\{[a-zA-Z0-9_]+\}\}')
ANY_BRACES_REGEX = re.compile(r'\{\{[^}]*\}\}')

def extract_placeholders(text: str) -> list[str]:
    if not text:
        return []
    return ANY_BRACES_REGEX.findall(text)

def validate_placeholders(text: str) -> list[str]:
    """
    Returns list of unsupported placeholder strings found in text.
    """
    found = extract_placeholders(text)
    invalid = [p for p in found if p not in SUPPORTED_PLACEHOLDERS]
    return invalid

def render_text(text: str, custom_data: dict = None) -> tuple[str, list[str]]:
    """
    Renders a single string with sample or custom data.
    Returns (rendered_text, unresolved_placeholders).
    """
    if not text:
        return '', []

    data = {**SAMPLE_PREVIEW_DATA, **(custom_data or {})}
    found = extract_placeholders(text)
    rendered = text
    unresolved = []

    for p in found:
        if p in data and data[p]:
            rendered = rendered.replace(p, str(data[p]))
        else:
            unresolved.append(p)

    return rendered, unresolved

def build_lead_context(lead, user=None, escape_html: bool = False) -> dict:
    """
    Builds placeholder dictionary from an actual Lead and User instance.
    """
    lead_name = (getattr(lead, 'name', None) or getattr(lead, 'contact_name', None) or getattr(lead, 'title', None) or '').strip()
    lead_email = (getattr(lead, 'email', None) or '').strip()
    lead_phone = (getattr(lead, 'phone', None) or '').strip()

    employee_name = ''
    assigned = getattr(lead, 'assigned_employee', None)
    if assigned:
        full = assigned.get_full_name().strip() if hasattr(assigned, 'get_full_name') else ''
        employee_name = full or getattr(assigned, 'username', '')
    elif user:
        full = user.get_full_name().strip() if hasattr(user, 'get_full_name') else ''
        employee_name = full or getattr(user, 'username', '')
    employee_name = employee_name.strip()

    from django.conf import settings
    company_name = getattr(settings, 'CRM_COMPANY_NAME', 'Skill Move Sales CRM').strip()

    from django.utils.html import escape
    def fmt(val: str) -> str:
        return escape(val) if escape_html else val

    return {
        '{{lead_name}}': fmt(lead_name),
        '{{lead_email}}': fmt(lead_email),
        '{{lead_phone}}': fmt(lead_phone),
        '{{employee_name}}': fmt(employee_name),
        '{{company_name}}': fmt(company_name),
        '{{name}}': fmt(lead_name),
        '{{email}}': fmt(lead_email),
        '{{phone}}': fmt(lead_phone),
    }

def render_email_for_lead(subject: str, body: str, lead, user=None, body_format: str = 'PLAIN') -> tuple[str, str]:
    """
    Unified rendering engine for real lead email dispatch.
    Validates all placeholders and ensures required data is present.
    Escapes HTML entities if body_format is HTML.
    Returns (rendered_subject, rendered_body).
    """
    from rest_framework.exceptions import ValidationError

    subj = subject or ''
    bdy = body or ''

    # Check for invalid placeholders
    invalid_subj = validate_placeholders(subj)
    if invalid_subj:
        raise ValidationError(f"Cannot send email: Unsupported placeholder(s) in subject: {', '.join(sorted(invalid_subj))}. Supported: {', '.join(sorted(SUPPORTED_PLACEHOLDERS.keys()))}")

    invalid_body = validate_placeholders(bdy)
    if invalid_body:
        raise ValidationError(f"Cannot send email: Unsupported placeholder(s) in body: {', '.join(sorted(invalid_body))}. Supported: {', '.join(sorted(SUPPORTED_PLACEHOLDERS.keys()))}")

    all_found = set(extract_placeholders(subj) + extract_placeholders(bdy))

    # Context values validation (check that required values are present)
    lead_name = (getattr(lead, 'name', None) or getattr(lead, 'contact_name', None) or getattr(lead, 'title', None) or '').strip()
    lead_email = (getattr(lead, 'email', None) or '').strip()
    lead_phone = (getattr(lead, 'phone', None) or '').strip()

    assigned = getattr(lead, 'assigned_employee', None)
    employee_name = ''
    if assigned:
        full = assigned.get_full_name().strip() if hasattr(assigned, 'get_full_name') else ''
        employee_name = full or getattr(assigned, 'username', '')
    elif user:
        full = user.get_full_name().strip() if hasattr(user, 'get_full_name') else ''
        employee_name = full or getattr(user, 'username', '')
    employee_name = employee_name.strip()

    from django.conf import settings
    company_name = getattr(settings, 'CRM_COMPANY_NAME', 'Skill Move Sales CRM').strip()

    if ('{{lead_name}}' in all_found or '{{name}}' in all_found) and not lead_name:
        raise ValidationError(f"Cannot send email: Placeholder '{{{{lead_name}}}}' cannot be resolved because lead #{lead.id} has no name or title.")

    if ('{{lead_email}}' in all_found or '{{email}}' in all_found) and not lead_email:
        raise ValidationError(f"Cannot send email: Placeholder '{{{{lead_email}}}}' cannot be resolved because lead #{lead.id} has no email address.")

    if ('{{lead_phone}}' in all_found or '{{phone}}' in all_found) and not lead_phone:
        raise ValidationError(f"Cannot send email: Placeholder '{{{{lead_phone}}}}' cannot be resolved because lead #{lead.id} has no phone number.")

    if '{{employee_name}}' in all_found and not employee_name:
        raise ValidationError("Cannot send email: Placeholder '{{employee_name}}' cannot be resolved because no assigned employee or sender could be identified.")

    if '{{company_name}}' in all_found and not company_name:
        raise ValidationError("Cannot send email: Placeholder '{{company_name}}' cannot be resolved because organization name is not configured.")

    # Render subject (always plain text, no HTML escaping)
    ctx_plain = build_lead_context(lead, user, escape_html=False)
    rendered_subject = subj
    for ph, val in ctx_plain.items():
        if ph in rendered_subject:
            rendered_subject = rendered_subject.replace(ph, str(val))

    # Render body
    is_html = (body_format.upper() == 'HTML')
    ctx_body = build_lead_context(lead, user, escape_html=is_html)
    rendered_body = bdy
    for ph, val in ctx_body.items():
        if ph in rendered_body:
            rendered_body = rendered_body.replace(ph, str(val))

    # Ensure no unresolved placeholders remain
    rem_subj = extract_placeholders(rendered_subject)
    rem_body = extract_placeholders(rendered_body)
    remaining = list(dict.fromkeys(rem_subj + rem_body))
    if remaining:
        raise ValidationError(f"Cannot send email: Unresolved placeholder(s) remain in message: {', '.join(remaining)}")

    return rendered_subject, rendered_body

def render_preview(subject_or_text: str, body: str = None, custom_data: dict = None, lead=None, user=None, body_format: str = 'PLAIN'):
    """
    If called with (text, custom_data) -> returns (rendered_text, unresolved)
    If called with (subject, body, custom_data, ...) -> returns dict with subject, body, unresolved_placeholders
    """
    if body is None and (custom_data is None or isinstance(custom_data, dict)):
        # Single argument usage
        return render_text(subject_or_text, custom_data)

    subj = subject_or_text or ''
    bdy = body or ''

    if lead:
        data_plain = build_lead_context(lead, user, escape_html=False)
        is_html = (body_format.upper() == 'HTML')
        data_body = build_lead_context(lead, user, escape_html=is_html)
    else:
        base_sample = dict(SAMPLE_PREVIEW_DATA)
        if custom_data:
            base_sample.update(custom_data)
        data_plain = base_sample
        data_body = base_sample

    rendered_subject = subj
    unres_subject = []
    for p in extract_placeholders(subj):
        if p in data_plain and data_plain[p]:
            rendered_subject = rendered_subject.replace(p, str(data_plain[p]))
        else:
            unres_subject.append(p)

    rendered_body = bdy
    unres_body = []
    for p in extract_placeholders(bdy):
        if p in data_body and data_body[p]:
            rendered_body = rendered_body.replace(p, str(data_body[p]))
        else:
            unres_body.append(p)

    all_unresolved = list(dict.fromkeys(unres_subject + unres_body))

    return {
        'subject': rendered_subject,
        'body': rendered_body,
        'unresolved_placeholders': all_unresolved,
        'context_used': data_plain
    }
