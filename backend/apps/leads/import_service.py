import csv
import io
import os
import re
import uuid
import tempfile
from datetime import datetime
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import Q
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.conf import settings

from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead, PipelineStage, LeadIdSequence, LeadAssignmentHistory, LeadStageHistory, LeadImportBatch
from apps.audit.models import AuditEvent

TEMP_IMPORT_DIR = os.path.join(tempfile.gettempdir(), 'crm_lead_imports')
os.makedirs(TEMP_IMPORT_DIR, exist_ok=True)

CRM_FIELDS = {
    'name': {
        'label': 'Lead Name',
        'required': True,
        'aliases': ['name', 'lead name', 'student name', 'candidate name', 'full name', 'contact name', 'student']
    },
    'email': {
        'label': 'Email',
        'required': True,
        'aliases': ['email', 'email address', 'email id', 'mail', 'mail id', 'candidate email']
    },
    'phone': {
        'label': 'Mobile Phone',
        'required': True,
        'aliases': ['phone', 'mobile', 'mobile phone', 'mobile number', 'phone number', 'contact number', 'contact', 'cell']
    },
    'qualification': {
        'label': 'Degree / Qualification',
        'required': False,
        'aliases': ['qualification', 'degree', 'education', 'highest qualification', 'course']
    },
    'college': {
        'label': 'College / University',
        'required': False,
        'aliases': ['college', 'university', 'institute', 'institution', 'school']
    },
    'yop': {
        'label': 'Year of Passing',
        'required': False,
        'aliases': ['yop', 'year of passing', 'passing year', 'batch', 'graduation year', 'grad year']
    },
    'key_skills': {
        'label': 'Key Skills',
        'required': False,
        'aliases': ['skills', 'key skills', 'technical skills', 'skillset', 'technologies']
    },
    'target_role': {
        'label': 'Target Role',
        'required': False,
        'aliases': ['target role', 'desired role', 'role', 'job role', 'position', 'designation']
    },
    'experience': {
        'label': 'Experience',
        'required': False,
        'aliases': ['experience', 'work experience', 'exp', 'total experience']
    },
    'priority': {
        'label': 'Priority',
        'required': False,
        'aliases': ['priority', 'lead priority']
    },
    'status': {
        'label': 'Status',
        'required': False,
        'aliases': ['status', 'lead status']
    },
    'estimated_revenue': {
        'label': 'Estimated Revenue',
        'required': False,
        'aliases': ['estimated revenue', 'revenue', 'course fee', 'fee', 'expected revenue']
    },
    'placement_fee': {
        'label': 'Placement Fee',
        'required': False,
        'aliases': ['placement fee', 'commission']
    },
    'career_counsellor': {
        'label': 'Career Counsellor',
        'required': False,
        'aliases': ['career counsellor', 'counsellor', 'counselor', 'mentor']
    },
    'city': {
        'label': 'City / Location',
        'required': False,
        'aliases': ['city', 'location', 'town', 'state', 'address', 'native place', 'district']
    },
    'source': {
        'label': 'Lead Source',
        'required': False,
        'aliases': ['source', 'lead source', 'channel', 'campaign', 'origin']
    },
    'next_follow_up': {
        'label': 'Next Follow-up',
        'required': False,
        'aliases': ['next follow up', 'follow up', 'follow-up', 'follow up date', 'next follow-up']
    },
}

# Dangerous formula prefixes to guard against spreadsheet formula injection
FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')


def sanitize_cell_value(val):
    """
    Prevents execution of formulas and formula injection.
    Preserves clean string value.
    """
    if val is None:
        return ''
    if isinstance(val, (int, float, Decimal)):
        return val
    s = str(val).strip()
    if s.startswith(FORMULA_PREFIXES):
        # Prepend single quote or strip formula prefix to prevent injection
        s = s.lstrip('=+-\t\r@').strip()
    return s


def save_temp_import_file(uploaded_file):
    """
    Saves uploaded file to temp directory and returns (file_token, file_path, file_name, file_ext).
    """
    file_name = uploaded_file.name
    _, ext = os.path.splitext(file_name)
    ext = ext.lower().lstrip('.')
    if ext not in ['csv', 'xlsx', 'xls']:
        raise ValueError(f"Unsupported file format '.{ext}'. Supported formats: CSV (.csv), Excel (.xlsx, .xls)")

    # 10MB limit
    if uploaded_file.size > 10 * 1024 * 1024:
        raise ValueError("File size exceeds maximum allowed limit of 10MB.")

    file_token = str(uuid.uuid4())
    temp_path = os.path.join(TEMP_IMPORT_DIR, f"{file_token}.{ext}")

    with open(temp_path, 'wb+') as destination:
        for chunk in uploaded_file.chunks():
            destination.write(chunk)

    return file_token, temp_path, file_name, ext


def get_temp_file_path(file_token):
    for ext in ['csv', 'xlsx', 'xls']:
        path = os.path.join(TEMP_IMPORT_DIR, f"{file_token}.{ext}")
        if os.path.exists(path):
            return path, ext
    return None, None


def cleanup_temp_file(file_token):
    for ext in ['csv', 'xlsx', 'xls']:
        path = os.path.join(TEMP_IMPORT_DIR, f"{file_token}.{ext}")
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


def parse_source_file(file_path, file_ext, sheet_name=None):
    """
    Parses CSV or Excel file.
    Returns: (sheet_names, selected_sheet, headers, rows)
    where rows is a list of lists of strings/values.
    """
    if file_ext == 'csv':
        sheet_names = ['Sheet1']
        selected_sheet = 'Sheet1'
        headers = []
        rows = []

        encodings = ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']
        content = None
        for enc in encodings:
            try:
                with open(file_path, 'r', encoding=enc) as f:
                    content = f.read()
                    break
            except UnicodeDecodeError:
                continue

        if content is None:
            raise ValueError("Unable to read CSV file with supported text encodings.")

        reader = csv.reader(io.StringIO(content))
        all_lines = list(reader)
        if not all_lines:
            raise ValueError("The uploaded CSV file is empty.")

        # Find first non-empty header row
        header_idx = -1
        for idx, line in enumerate(all_lines):
            cleaned = [sanitize_cell_value(c) for c in line if sanitize_cell_value(c)]
            if cleaned:
                headers = [str(c).strip() for c in all_lines[idx]]
                header_idx = idx
                break

        if header_idx == -1 or not headers:
            raise ValueError("No header columns found in uploaded CSV file.")

        for line in all_lines[header_idx + 1:]:
            # Check if row is not completely empty
            row_vals = [sanitize_cell_value(c) for c in line]
            if any(str(c).strip() for c in row_vals):
                rows.append(row_vals)

        return sheet_names, selected_sheet, headers, rows

    elif file_ext in ['xlsx', 'xls']:
        try:
            import openpyxl
        except ImportError:
            raise ValueError("Excel parser openpyxl is not installed.")

        try:
            wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
        except Exception as e:
            raise ValueError(f"Failed to open Excel workbook: {str(e)}")

        sheet_names = wb.sheetnames
        if not sheet_names:
            raise ValueError("Excel workbook contains no worksheets.")

        if sheet_name and sheet_name in sheet_names:
            selected_sheet = sheet_name
        else:
            selected_sheet = sheet_names[0]

        ws = wb[selected_sheet]
        all_rows = list(ws.iter_rows(values_only=True))
        wb.close()

        if not all_rows:
            return sheet_names, selected_sheet, [], []

        headers = []
        rows = []
        header_idx = -1

        for idx, row in enumerate(all_rows):
            cleaned = [sanitize_cell_value(c) for c in row if c is not None and sanitize_cell_value(c)]
            if cleaned:
                headers = [str(c).strip() if c is not None else f"Column_{col_i+1}" for col_i, c in enumerate(row)]
                # trim trailing empty header cells
                while headers and (not headers[-1] or headers[-1].startswith('Column_') and all(r[len(headers)-1] is None for r in all_rows[idx+1:] if len(r) >= len(headers))):
                    headers.pop()
                header_idx = idx
                break

        if header_idx == -1 or not headers:
            return sheet_names, selected_sheet, [], []

        num_headers = len(headers)
        for row in all_rows[header_idx + 1:]:
            row_vals = [sanitize_cell_value(c) for c in row[:num_headers]]
            # Pad if shorter than headers
            while len(row_vals) < num_headers:
                row_vals.append('')
            if any(str(c).strip() for c in row_vals):
                rows.append(row_vals)

        return sheet_names, selected_sheet, headers, rows

    else:
        raise ValueError(f"Unsupported file format: {file_ext}")


def suggest_mapping(headers):
    """
    Given a list of source header strings, automatically suggests mappings to CRM field keys.
    Preserves original header strings in the mapping dictionary.
    """
    mapping = {}
    used_crm_fields = set()

    for header in headers:
        clean_header = re.sub(r'[^a-zA-Z0-9]', ' ', header).lower().strip()
        clean_header = re.sub(r'\s+', ' ', clean_header)
        clean_header_compact = clean_header.replace(' ', '')
        matched_field = None

        # Check exact key
        if clean_header in CRM_FIELDS and clean_header not in used_crm_fields:
            matched_field = clean_header
        else:
            # Check aliases
            for field_key, field_info in CRM_FIELDS.items():
                if field_key in used_crm_fields:
                    continue
                for alias in field_info['aliases']:
                    alias_clean = re.sub(r'[^a-zA-Z0-9]', ' ', alias).lower().strip()
                    alias_clean = re.sub(r'\s+', ' ', alias_clean)
                    alias_compact = alias_clean.replace(' ', '')
                    if clean_header == alias_clean or clean_header_compact == alias_compact:
                        matched_field = field_key
                        break
                if matched_field:
                    break

        if matched_field:
            mapping[header] = matched_field
            used_crm_fields.add(matched_field)

    return mapping


def validate_import_data(headers, rows, column_mapping, requesting_user):
    """
    Validates source rows against column mapping and database constraints.
    Returns:
    {
        'total_rows': int,
        'valid_rows': list of dicts (cleaned row data),
        'invalid_rows': list of dicts with row_number and errors,
        'duplicate_rows': list of dicts with row_number and warnings,
        'row_validations': list of row statuses,
        'mapped_fields': dict
    }
    """
    header_to_crm = {}
    for h, crm_key in column_mapping.items():
        if crm_key:
            normalized_key = str(crm_key).strip().lower()
            # Normalize common aliases to canonical keys
            if normalized_key in ('lead_name', 'leadname', 'student_name', 'studentname', 'candidate_name', 'candidatename', 'full_name', 'fullname'):
                normalized_key = 'name'
            elif normalized_key in ('mobile', 'mobile_phone', 'mobilephone', 'mobile_number', 'mobilenumber', 'phone_number', 'phonenumber', 'contact_number'):
                normalized_key = 'phone'
            elif normalized_key in ('email_address', 'emailaddress', 'mail'):
                normalized_key = 'email'

            if normalized_key in CRM_FIELDS:
                header_to_crm[h] = normalized_key

    # Check for duplicate column mappings
    crm_to_headers = {}
    duplicate_errors = []
    for h, crm_key in header_to_crm.items():
        if crm_key in crm_to_headers:
            crm_to_headers[crm_key].append(h)
        else:
            crm_to_headers[crm_key] = [h]

    for crm_key, mapped_headers in crm_to_headers.items():
        if len(mapped_headers) > 1:
            duplicate_errors.append(f"'{CRM_FIELDS[crm_key]['label']}' is mapped to multiple columns: {', '.join(mapped_headers)}")

    if duplicate_errors:
        raise ValueError(f"Duplicate column mapping detected: {'; '.join(duplicate_errors)}. Each CRM field must be mapped to at most one column.")

    # Check that mandatory fields are mapped
    missing_mandatory = []
    mapped_crm_values = set(header_to_crm.values())
    for req_field in ['name', 'email', 'phone']:
        if req_field not in mapped_crm_values:
            missing_mandatory.append(CRM_FIELDS[req_field]['label'])

    header_index_map = {h: idx for idx, h in enumerate(headers)}

    valid_rows = []
    invalid_rows = []
    duplicate_rows = []
    row_validations = []

    seen_emails_in_file = set()
    seen_phones_in_file = set()

    # Pre-fetch existing emails and phones for fast DB duplicate check
    existing_emails = set(Lead.objects.values_list('email', flat=True))
    existing_phones = set(Lead.objects.values_list('phone', flat=True))

    for idx, row in enumerate(rows):
        row_number = idx + 2  # 1-indexed, row 1 is header
        row_errors = []
        row_warnings = []
        cleaned_data = {}

        # If mandatory fields are not even mapped
        if missing_mandatory:
            for mf in missing_mandatory:
                row_errors.append(f"Column for mandatory field '{mf}' is not mapped.")

        # Extract mapped values
        for header, crm_key in header_to_crm.items():
            col_idx = header_index_map.get(header)
            raw_val = row[col_idx] if col_idx is not None and col_idx < len(row) else ''
            val_str = str(raw_val).strip() if raw_val is not None else ''

            if val_str != '':
                # Specific field validations
                if crm_key == 'email':
                    val_str = val_str.lower()
                    try:
                        validate_email(val_str)
                        cleaned_data['email'] = val_str
                    except ValidationError:
                        row_errors.append(f"Invalid email format: '{val_str}'")
                elif crm_key == 'phone':
                    # Keep phone as string to preserve formatting and leading zeros
                    cleaned_data['phone'] = val_str
                elif crm_key in ['estimated_revenue', 'placement_fee']:
                    try:
                        # strip currency signs or commas
                        num_str = re.sub(r'[^\d.]', '', val_str)
                        cleaned_data[crm_key] = Decimal(num_str)
                    except (InvalidOperation, ValueError):
                        row_errors.append(f"Invalid number for {CRM_FIELDS[crm_key]['label']}: '{val_str}'")
                elif crm_key == 'next_follow_up':
                    try:
                        # Try parsing ISO or common formats
                        dt = None
                        for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
                            try:
                                dt = datetime.strptime(val_str[:19], fmt)
                                break
                            except ValueError:
                                continue
                        if dt:
                            cleaned_data['next_follow_up'] = dt.isoformat()
                        else:
                            cleaned_data['next_follow_up'] = None
                    except Exception:
                        cleaned_data['next_follow_up'] = None
                else:
                    cleaned_data[crm_key] = val_str
            else:
                # Field was present in column mapping but empty in this row
                # CRITICAL: Preserve empty cells as empty string or None - DO NOT INVENT DATA!
                cleaned_data[crm_key] = ''

        # Check required fields presence and non-emptiness
        if not cleaned_data.get('name'):
            row_errors.append(f"Row {row_number}: Missing mandatory field 'Lead Name'")
        if not cleaned_data.get('email'):
            row_errors.append(f"Row {row_number}: Missing mandatory field 'Email'")
        if not cleaned_data.get('phone'):
            row_errors.append(f"Row {row_number}: Missing mandatory field 'Mobile Phone'")

        # Duplicate checks
        email = cleaned_data.get('email')
        phone = cleaned_data.get('phone')

        is_dup = False
        if email:
            if email in seen_emails_in_file:
                row_warnings.append(f"Duplicate email '{email}' already appears earlier in this file.")
                is_dup = True
            elif email in existing_emails:
                row_warnings.append(f"Email '{email}' matches an existing lead in the CRM.")
                is_dup = True
            seen_emails_in_file.add(email)

        if phone:
            if phone in seen_phones_in_file:
                row_warnings.append(f"Duplicate phone '{phone}' already appears earlier in this file.")
                is_dup = True
            elif phone in existing_phones:
                row_warnings.append(f"Phone '{phone}' matches an existing lead in the CRM.")
                is_dup = True
            seen_phones_in_file.add(phone)

        is_valid = (len(row_errors) == 0)

        record_summary = {
            'row_number': row_number,
            'is_valid': is_valid,
            'lead_name': cleaned_data.get('name', ''),
            'email': cleaned_data.get('email', ''),
            'phone': cleaned_data.get('phone', ''),
            'errors': row_errors,
            'warnings': row_warnings,
            'data': cleaned_data
        }

        row_validations.append(record_summary)

        if is_valid:
            valid_rows.append(record_summary)
            if is_dup:
                duplicate_rows.append(record_summary)
        else:
            invalid_rows.append(record_summary)

    return {
        'total_rows': len(rows),
        'valid_rows': valid_rows,
        'invalid_rows': invalid_rows,
        'duplicate_rows': duplicate_rows,
        'row_validations': row_validations,
        'missing_mandatory': missing_mandatory,
    }


def resolve_unassigned_team(requesting_user, team_id=None):
    """
    Resolves and verifies the authorized team relationship for unassigned lead imports.
    - Manager: Restricted to their authorized managed or member team.
    - Admin: Resolves specified team_id, requesting_user.team, or the primary active team.
    Raises ValueError if team cannot be resolved or if unauthorized.
    """
    if requesting_user.role == UserRole.MANAGER and not requesting_user.is_superuser:
        managed_team = getattr(requesting_user, 'managed_team', None)
        auth_team = managed_team or requesting_user.team
        if auth_team and not auth_team.is_active:
            raise ValueError(f"Manager's authorized team '{auth_team.name}' is inactive.")
        if team_id and int(team_id) != auth_team.id:
            raise ValueError("Managers can only import leads into their authorized team.")
        return auth_team
    elif requesting_user.role == UserRole.ADMIN or requesting_user.is_superuser:
        if team_id:
            team = Team.objects.filter(id=team_id).first()
            if not team:
                raise ValueError(f"Specified team (ID {team_id}) does not exist.")
            if not team.is_active:
                raise ValueError(f"Specified team '{team.name}' is inactive and cannot receive new leads.")
            return team
        if requesting_user.team and requesting_user.team.is_active:
            return requesting_user.team
        team = Team.objects.filter(is_active=True).order_by('id').first()
        if not team:
            raise ValueError("Cannot import unassigned leads because no active teams exist in the system. Please create or activate a team first.")
        return team
    else:
        raise ValueError("User is not authorized to import leads.")


def resolve_eligible_employees(requesting_user, assignment_mode, selected_employee_ids=None, team_id=None):
    """
    Resolves and verifies eligible assignment targets according to authorization rules:
    - Admin: can assign to active SALES_EMPLOYEE across authorized teams (must belong to a team).
    - Manager: can assign ONLY to active SALES_EMPLOYEE within their authorized team.
    - Sales Employee: cannot import leads (checked at permission level).
    Returns list of User objects with verified team assignments.
    """
    if requesting_user.role == UserRole.ADMIN or requesting_user.is_superuser:
        base_qs = User.objects.filter(role=UserRole.SALES_EMPLOYEE, is_active=True, team__isnull=False)
        if team_id:
            base_qs = base_qs.filter(team_id=team_id)
    elif requesting_user.role == UserRole.MANAGER:
        managed_team = getattr(requesting_user, 'managed_team', None)
        auth_team_id = managed_team.id if managed_team else requesting_user.team_id
        if not auth_team_id:
            return []
        base_qs = User.objects.filter(role=UserRole.SALES_EMPLOYEE, team_id=auth_team_id, is_active=True, team__isnull=False)
    else:
        return []

    eligible_map = {u.id: u for u in base_qs.select_related('team')}

    if assignment_mode in ('UNASSIGNED', 'NONE'):
        return []
    elif assignment_mode == 'ALL_ELIGIBLE':
        return list(eligible_map.values())
    elif assignment_mode == 'SINGLE':
        if not selected_employee_ids or len(selected_employee_ids) == 0:
            raise ValueError("Please select one employee for assignment.")
        target_id = int(selected_employee_ids[0])
        if target_id not in eligible_map:
            user_obj = User.objects.filter(id=target_id).select_related('team').first()
            if not user_obj:
                raise ValueError(f"Selected employee (ID {target_id}) does not exist.")
            if not user_obj.is_active:
                raise ValueError(f"Selected employee '{user_obj.username}' (ID {target_id}) is inactive.")
            if user_obj.role != UserRole.SALES_EMPLOYEE:
                raise ValueError(f"Selected user '{user_obj.username}' is not a sales employee.")
            if not user_obj.team_id or not user_obj.team:
                raise ValueError(f"Selected employee '{user_obj.username}' (ID {target_id}) does not belong to any team. Every assigned employee must have a valid team.")
            if requesting_user.role == UserRole.MANAGER:
                raise ValueError(f"Selected employee '{user_obj.username}' (ID {target_id}) is unauthorized and does not belong to your authorized team.")
            if team_id and user_obj.team_id != int(team_id):
                raise ValueError(f"Selected employee '{user_obj.username}' does not belong to the selected team.")
            raise ValueError(f"Selected employee (ID {target_id}) is unauthorized for assignment.")
        return [eligible_map[target_id]]
    elif assignment_mode in ('SELECTED', 'ROUND_ROBIN'):
        if not selected_employee_ids or len(selected_employee_ids) == 0:
            raise ValueError("Please select one or more eligible employees for distribution, or choose 'Import as Unassigned Leads'.")
        selected = []
        for eid in selected_employee_ids:
            eid = int(eid)
            if eid not in eligible_map:
                user_obj = User.objects.filter(id=eid).select_related('team').first()
                if not user_obj:
                    raise ValueError(f"Selected employee (ID {eid}) does not exist.")
                if not user_obj.is_active:
                    raise ValueError(f"Selected employee '{user_obj.username}' (ID {eid}) is inactive.")
                if user_obj.role != UserRole.SALES_EMPLOYEE:
                    raise ValueError(f"Selected user '{user_obj.username}' is not a sales employee.")
                if not user_obj.team_id or not user_obj.team:
                    raise ValueError(f"Selected employee '{user_obj.username}' (ID {eid}) does not belong to any team. Every assigned employee must have a valid team.")
                if requesting_user.role == UserRole.MANAGER:
                    raise ValueError(f"Selected employee '{user_obj.username}' (ID {eid}) is unauthorized and does not belong to your authorized team.")
                if team_id and user_obj.team_id != int(team_id):
                    raise ValueError(f"Selected employee '{user_obj.username}' does not belong to the selected team.")
                raise ValueError(f"Selected employee (ID {eid}) is unauthorized for assignment.")
            selected.append(eligible_map[eid])
        return selected
    else:
        raise ValueError(f"Invalid assignment mode: '{assignment_mode}'. Must be SINGLE, SELECTED, ALL_ELIGIBLE, or UNASSIGNED.")


def compute_distribution_counts(total_valid_leads, employees):
    """
    Computes deterministic distribution counts among selected employees.
    E.g., 101 leads among 4 employees -> 26 to first, 25 to each of the other three.
    If no employees (unassigned), reports count for Unassigned.
    """
    if not employees:
        return {'Unassigned Queue': total_valid_leads} if total_valid_leads > 0 else {}
    k = len(employees)
    base = total_valid_leads // k
    remainder = total_valid_leads % k

    dist = {}
    for i, emp in enumerate(employees):
        count = base + (1 if i < remainder else 0)
        dist[emp.username] = count
    return dist


def compute_distribution_list(total_valid_leads, employees, unassigned_team=None):
    """
    Returns structured list of distribution items for frontend validation preview:
    [
        {
            'employee_id': emp.id,
            'employee_name': emp.get_full_name() or emp.username,
            'username': emp.username,
            'team_id': emp.team_id,
            'team_name': emp.team.name if emp.team else '',
            'count': count
        },
        ...
    ]
    """
    if not employees:
        team_id = unassigned_team.id if unassigned_team else 0
        team_name = unassigned_team.name if unassigned_team else 'Unassigned'
        return [{
            'employee_id': 0,
            'employee_name': 'Unassigned Leads Queue',
            'username': 'unassigned',
            'team_id': team_id,
            'team_name': team_name,
            'count': total_valid_leads
        }] if total_valid_leads > 0 else []
    k = len(employees)
    base = total_valid_leads // k
    remainder = total_valid_leads % k

    result = []
    for i, emp in enumerate(employees):
        count = base + (1 if i < remainder else 0)
        team_name = ''
        team_id = 0
        if hasattr(emp, 'team') and emp.team:
            team_name = emp.team.name
            team_id = emp.team.id
        elif hasattr(emp, 'team_id') and emp.team_id:
            team_id = emp.team_id

        full_name = ''
        if hasattr(emp, 'get_full_name'):
            full_name = emp.get_full_name().strip()
        if not full_name and hasattr(emp, 'first_name') and hasattr(emp, 'last_name'):
            full_name = f"{emp.first_name} {emp.last_name}".strip()

        result.append({
            'employee_id': emp.id,
            'employee_name': full_name or emp.username,
            'username': emp.username,
            'team_id': team_id,
            'team_name': team_name,
            'count': count
        })
    return result


def execute_import_transaction(
    batch_id,
    file_name,
    file_ext,
    valid_records,
    invalid_records,
    duplicate_records,
    stage_id,
    employees,
    assignment_mode,
    requesting_user,
    team_id=None,
    source='',
    default_priority='Medium',
    batch_note=''
):
    """
    Executes database creation in an atomic transaction:
    - Pre-validates stage, batch idempotency, and team resolution.
    - Creates Lead records with generated Lead ID and verified team_id.
    - Creates LeadAssignmentHistory (for assigned leads) and LeadStageHistory records.
    - Creates AuditEvent.
    - Creates LeadImportBatch record.
    - Returns final summary.
    """
    # 1. Verify stage
    stage = PipelineStage.objects.filter(id=stage_id, is_active=True).first()
    if not stage:
        raise ValueError("Selected pipeline stage does not exist or is inactive.")

    is_unassigned = (assignment_mode == 'UNASSIGNED') or (not employees)
    if not is_unassigned and not employees:
        raise ValueError("Cannot import leads: zero eligible employees available for assignment.")

    # 2. Idempotency check
    if LeadImportBatch.objects.filter(batch_id=batch_id).exists():
        raise ValueError(f"Import request with batch ID '{batch_id}' has already been processed.")

    # 3. Pre-validate team resolution BEFORE opening database transaction
    unassigned_team = None
    if is_unassigned:
        unassigned_team = resolve_unassigned_team(requesting_user, team_id=team_id)
        if not unassigned_team:
            raise ValueError("Could not resolve an authorized team for unassigned leads.")
    else:
        for emp in employees:
            if not getattr(emp, 'team', None) or not getattr(emp, 'team_id', None):
                raise ValueError(f"Selected employee '{emp.username}' (ID {emp.id}) does not belong to any team. Every assigned employee must have a valid team.")
            if requesting_user.role == UserRole.MANAGER and not requesting_user.is_superuser:
                managed_team = getattr(requesting_user, 'managed_team', None)
                auth_team_id = managed_team.id if managed_team else requesting_user.team_id
                if emp.team_id != auth_team_id:
                    raise ValueError(f"Selected employee '{emp.username}' (ID {emp.id}) does not belong to your authorized team.")

    dist_counts = compute_distribution_counts(len(valid_records), employees)
    created_leads = []
    num_employees = len(employees) if employees else 0

    with transaction.atomic():
        for i, rec in enumerate(valid_records):
            lead_data = rec['data']
            if is_unassigned:
                assigned_emp = None
                lead_team = unassigned_team
            else:
                assigned_emp = employees[i % num_employees]
                lead_team = assigned_emp.team

            if not lead_team:
                raise ValueError("Could not resolve a valid team for lead.")

            # Generate unique lead ID
            new_lead_id = LeadIdSequence.get_next_lead_id()

            counsellor_str = lead_data.get('career_counsellor', '')
            if not counsellor_str and assigned_emp:
                counsellor_str = assigned_emp.get_full_name().strip() if hasattr(assigned_emp, 'get_full_name') and assigned_emp.get_full_name() else assigned_emp.username

            # Clean and populate actual values - NO DUMMY VALUES!
            lead = Lead(
                lead_id=new_lead_id,
                name=lead_data.get('name', ''),
                title=lead_data.get('name', ''),
                contact_name=lead_data.get('name', ''),
                email=lead_data.get('email', ''),
                phone=lead_data.get('phone', ''),
                qualification=lead_data.get('qualification', ''),
                college=lead_data.get('college', ''),
                yop=lead_data.get('yop', ''),
                key_skills=lead_data.get('key_skills', ''),
                target_role=lead_data.get('target_role', ''),
                experience=lead_data.get('experience', ''),
                priority=lead_data.get('priority') or default_priority or 'Medium',
                source=lead_data.get('source') or source or 'Bulk Import',
                batch_tag=batch_note or '',
                status=lead_data.get('status', 'New Lead'),
                estimated_revenue=lead_data.get('estimated_revenue'),
                placement_fee=lead_data.get('placement_fee'),
                career_counsellor=counsellor_str,
                city=lead_data.get('city', ''),
                next_follow_up=lead_data.get('next_follow_up'),
                stage=stage,
                assigned_employee=assigned_emp,
                team=lead_team,
                created_by=requesting_user
            )
            lead.save()

            # Record initial assignment history if assigned
            if assigned_emp:
                LeadAssignmentHistory.objects.create(
                    lead=lead,
                    from_team=None,
                    to_team=lead_team,
                    from_employee=None,
                    to_employee=assigned_emp,
                    changed_by=requesting_user
                )

            # Record initial stage history
            LeadStageHistory.objects.create(
                lead=lead,
                from_stage=None,
                to_stage=stage,
                changed_by=requesting_user,
                note=f"Initial bulk import assignment to {stage.name} (Batch {batch_id})" if assigned_emp else f"Initial bulk import to {stage.name} as unassigned (Batch {batch_id})"
            )

            # Audit event
            AuditEvent.objects.create(
                event_type='LEAD_CREATED',
                user=requesting_user,
                details={
                    'lead_id': lead.id,
                    'lead_code': lead.lead_id,
                    'import_batch_id': batch_id,
                    'file_name': file_name,
                    'assigned_to': assigned_emp.username if assigned_emp else None,
                    'team_id': lead_team.id,
                    'team_name': lead_team.name,
                    'is_unassigned': assigned_emp is None,
                    'stage': stage.name,
                    'source': lead.source,
                    'priority': lead.priority,
                    'batch_note': batch_note
                }
            )

            created_leads.append(lead)

        error_summaries = []
        for inv in invalid_records:
            error_summaries.append({
                'row_number': inv['row_number'],
                'errors': inv['errors']
            })

        batch_record = LeadImportBatch.objects.create(
            batch_id=batch_id,
            file_name=file_name,
            file_type=file_ext,
            total_rows=len(valid_records) + len(invalid_records),
            valid_rows=len(valid_records),
            imported_rows=len(created_leads),
            rejected_rows=len(invalid_records),
            duplicate_rows=len(duplicate_records),
            stage=stage,
            assignment_mode=assignment_mode,
            source=source or 'Bulk Import',
            priority=default_priority or 'Medium',
            batch_note=batch_note or '',
            distribution=dist_counts,
            errors=error_summaries,
            imported_by=requesting_user,
            status='COMPLETED'
        )

    return {
        'batch_id': batch_id,
        'file_name': file_name,
        'imported_count': len(created_leads),
        'rejected_count': len(invalid_records),
        'duplicate_count': len(duplicate_records),
        'stage': {'id': stage.id, 'name': stage.name},
        'assignment_mode': assignment_mode,
        'source': source or 'Bulk Import',
        'priority': default_priority or 'Medium',
        'batch_note': batch_note or '',
        'distribution': dist_counts,
        'errors': error_summaries,
        'detail': f"Successfully imported {len(created_leads)} leads into '{stage.name}'. {len(invalid_records)} invalid rows rejected."
    }

