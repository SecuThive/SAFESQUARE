export type ProjectStatus = 'active' | 'archived' | 'completed';
export type ServerRole = 'auth' | 'gateway' | 'db' | 'web' | 'cache' | 'worker' | 'monitor' | 'other';
export type ServerStatus = 'online' | 'offline' | 'degraded' | 'unknown';
export type GuideType = 'install' | 'troubleshooting' | 'operation';
export type LogType = 'auth' | 'error' | 'system' | 'info' | 'warning';

export interface Project {
  id: number;
  name: string;
  description: string | null;
  client_name: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Server {
  id: number;
  project_id: number;
  ip: string;
  hostname: string | null;
  role: ServerRole | null;
  os: string | null;
  status: ServerStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Guide {
  id: number;
  project_id: number;
  title: string;
  content: string;
  type: GuideType;
  created_at: string;
  updated_at: string;
}

export interface GuideVersion {
  id: number;
  guide_id: number;
  version: number;
  title: string;
  content: string;
  type: GuideType;
  created_at: string;
}

export interface ChatSession {
  id: number;
  project_id: number;
  title: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  project_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  context_guides: { id: number; title: string; type: string }[] | null;
  created_at: string;
}

export interface Log {
  id: number;
  project_id: number;
  type: LogType;
  message: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type ActiveTab = 'guides' | 'chat' | 'servers' | 'logs' | 'solutions' | 'tasks' | 'docs' | 'inspections' | 'incidents' | 'files' | 'mails' | 'partners' | 'weekly_reports' | 'wbs' | 'inquiries';

// ── 고객사 문의 ────────────────────────────────────────────────
export type InquiryStatus = 'pending' | 'answered' | 'closed';

export interface ClientInquiry {
  id:           number;
  project_id:   number;
  project_name: string | null;
  title:        string;
  question:    string;
  answer:      string | null;
  email_raw:   string | null;
  status:      InquiryStatus;
  asked_by:    string | null;
  answered_by: string | null;
  asked_at:    string;
  answered_at: string | null;
  created_at:  string;
  updated_at:  string;
}

// ── 주간업무 ──────────────────────────────────────────────────
export type WorkWeeklyStatus   = 'draft' | 'submitted';
export type WorkItemStatus     = 'completed' | 'in_progress' | 'planned' | 'cancelled';
export type WorkItemCategory   = 'project' | 'operation' | 'support' | 'education' | 'meeting' | 'other';

export interface WorkWeeklyItem {
  id:           number;
  report_id:    number;
  sort_order:   number;
  category:     WorkItemCategory;
  project_name: string | null;
  content:      string;
  sub_items:    string[];
  status:       WorkItemStatus;
  progress:     number;
  note:         string | null;
  is_next_week: boolean;
  created_at:   string;
}

export interface WorkWeeklyReport {
  id:          number;
  year:        number;
  week_number: number;
  week_start:  string;
  week_end:    string;
  author:      string;
  author_name: string | null;
  department:  string | null;
  status:      WorkWeeklyStatus;
  title:       string | null;
  summary:     string | null;
  note:        string | null;
  items:       WorkWeeklyItem[];
  created_at:  string;
  updated_at:  string;
}

export type WeeklyReportStatus  = 'draft' | 'published';
export type WeeklyReportHealth  = 'good' | 'caution' | 'critical';

export interface WeeklyReport {
  id:               number;
  project_id:       number;
  year:             number;
  week_number:      number;
  week_start:       string;
  week_end:         string;
  title:            string | null;
  status:           WeeklyReportStatus;
  project_health:   WeeklyReportHealth;
  summary:          string | null;
  completed_work:   string | null;
  in_progress_work: string | null;
  issues:           string | null;
  next_week_plan:   string | null;
  risk_notes:       string | null;
  written_by:       string | null;
  reviewed_by:      string | null;
  created_at:       string;
  updated_at:       string;
}

export interface FileGroup {
  id: number;
  project_id: number;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface ProjectFile {
  id: number;
  project_id: number;
  group_id: number | null;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export type WorkLogType = 'regular' | 'emergency' | 'maintenance' | 'training' | 'other';
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface WorkLog {
  id: number;
  project_id: number;
  title: string;
  work_date: string;
  work_type: WorkLogType;
  content: string;
  issues: string | null;
  next_actions: string | null;
  engineer: string | null;
  hours: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: number;
  project_id: number;
  title: string;
  occurred_at: string;
  resolved_at: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  root_cause: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id:           number;
  username:     string;
  display_name: string | null;
  phone:        string | null;
  is_admin:     boolean;
  is_active:    boolean;
  created_at:   string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  is_admin: boolean;
  username: string;
}

// Tasks
export type TaskType = 'deployment' | 'maintenance' | 'support' | 'training' | 'meeting' | 'other';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Solution {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectSolution {
  id: number;
  project_id: number;
  solution_id: number;
}

// ── 파트너사 ──────────────────────────────────────────────────

export type PartnerBusinessType = 'security' | 'network' | 'hardware' | 'software' | 'cloud' | 'consulting' | 'other';
export type PartnerContractType = 'reseller' | 'oem' | 'msp' | 'subcontractor' | 'vendor' | 'other';
export type ProjectPartnerRole  = 'prime' | 'sub' | 'vendor' | 'support' | 'other';

export interface PartnerContact {
  id:         number;
  partner_id: number;
  name:       string;
  role:       string | null;
  phone:      string | null;
  email:      string | null;
  department: string | null;
  is_primary: boolean;
  notes:      string | null;
  created_at: string;
  updated_at: string;
}

export interface Partner {
  id:              number;
  name:            string;
  business_type:   PartnerBusinessType | null;
  contract_type:   PartnerContractType | null;
  website:         string | null;
  address:         string | null;
  notes:           string | null;
  contacts:        PartnerContact[];
  primary_contact: PartnerContact | null;
  contact_count:   number;
  created_at:      string;
  updated_at:      string;
}

export interface ProjectPartnerItem {
  id:         number;
  project_id: number;
  partner_id: number;
  role:       ProjectPartnerRole | null;
  notes:      string | null;
  partner:    Partner;
  created_at: string;
}
