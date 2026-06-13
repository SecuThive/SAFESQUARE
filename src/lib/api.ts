import type {
  Project, Server, Guide, GuideVersion, ChatSession, ChatMessage, Log,
  GuideType, LogType, User, AuthToken, WorkLog, Incident, ProjectFile, FileGroup,
  Partner, PartnerContact, ProjectPartnerItem, WeeklyReport,
} from './types';

const BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export function saveAuth(token: AuthToken) {
  _loggingOut = false; // 로그인 시 플래그 초기화
  localStorage.setItem('auth_token', token.access_token);
  localStorage.setItem('auth_username', token.username);
  localStorage.setItem('auth_is_admin', String(token.is_admin));
  // 미들웨어용 쿠키 (httpOnly 아님 — 내부 툴이므로 허용)
  document.cookie = `auth_token=${token.access_token}; path=/; max-age=${60 * 60 * 24}`;
}

export function clearAuth() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_username');
  localStorage.removeItem('auth_is_admin');
  document.cookie = 'auth_token=; path=/; max-age=0';
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getAuthMeta(): { username: string; isAdmin: boolean } | null {
  if (typeof window === 'undefined') return null;
  const username = localStorage.getItem('auth_username');
  if (!username) return null;
  return {
    username,
    isAdmin: localStorage.getItem('auth_is_admin') === 'true',
  };
}

// 중복 로그아웃 리다이렉트 방지 플래그
let _loggingOut = false;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader, ...(init?.headers as Record<string, string> | undefined) } as HeadersInit,
    ...init,
  });

  if (res.status === 401) {
    if (!_loggingOut && window.location.pathname !== '/login') {
      _loggingOut = true;
      clearAuth();
      window.location.href = '/login';
    }
    throw new Error('인증이 만료되었습니다');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join(', ')
          : detail != null
            ? JSON.stringify(detail)
            : 'Request failed';
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Projects ──────────────────────────────────────────────────

export const projectsApi = {
  list: () => request<Project[]>('/projects'),

  create: (data: { name: string; description?: string; client_name?: string }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),
};

// ── Servers ───────────────────────────────────────────────────

export const serversApi = {
  list: (projectId: number) =>
    request<Server[]>(`/servers?project_id=${projectId}`),

  create: (data: Omit<Server, 'id' | 'created_at' | 'updated_at'>) =>
    request<Server>('/servers', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<Server>) =>
    request<Server>(`/servers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/servers/${id}`, { method: 'DELETE' }),
};

// ── Guides ────────────────────────────────────────────────────

export const guidesApi = {
  list: (projectId: number, type?: GuideType) =>
    request<Guide[]>(`/guides?project_id=${projectId}${type ? `&type=${type}` : ''}`),

  create: (data: { project_id: number; title: string; content: string; type: GuideType }) =>
    request<Guide>('/guides', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<Pick<Guide, 'title' | 'content' | 'type'>>) =>
    request<Guide>(`/guides/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/guides/${id}`, { method: 'DELETE' }),

  bulkDelete: (ids: number[]) =>
    request<{ deleted: number }>('/guides/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),

  embedAll: (projectId: number) =>
    request<{ embedded: number; total: number }>(`/guides/embed-all?project_id=${projectId}`, { method: 'POST' }),

  listVersions: (guideId: number) =>
    request<GuideVersion[]>(`/guides/${guideId}/versions`),
};

// ── Chat ──────────────────────────────────────────────────────

export const chatApi = {
  listSessions: (projectId: number) =>
    request<ChatSession[]>(`/chat/sessions?project_id=${projectId}`),

  createSession: (projectId: number, title?: string) =>
    request<ChatSession>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, title: title ?? 'New Chat' }),
    }),

  deleteSession: (id: number) =>
    request<void>(`/chat/sessions/${id}`, { method: 'DELETE' }),

  getMessages: (sessionId: number) =>
    request<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`),

  /**
   * Returns an EventSource-compatible URL.
   * Caller should use fetch() with stream reading for SSE.
   */
  streamUrl: () => `${BASE}/chat/stream`,
};

// ── Logs ──────────────────────────────────────────────────────

export const logsApi = {
  list: (projectId: number, type?: LogType, limit = 100) =>
    request<Log[]>(`/logs?project_id=${projectId}${type ? `&type=${type}` : ''}&limit=${limit}`),

  create: (data: { project_id: number; type: LogType; message: string; source?: string; metadata?: object }) =>
    request<Log>('/logs', { method: 'POST', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/logs/${id}`, { method: 'DELETE' }),

  clear: (projectId: number, type?: LogType) =>
    request<void>(`/logs?project_id=${projectId}${type ? `&type=${type}` : ''}`, { method: 'DELETE' }),
};

// ── Work Logs (WSL) ───────────────────────────────────────────

export const worklogsApi = {
  list: (projectId?: number) =>
    request<WorkLog[]>(`/worklogs${projectId ? `?project_id=${projectId}` : ''}`),

  create: (data: Omit<WorkLog, 'id' | 'created_at' | 'updated_at'>) =>
    request<WorkLog>('/worklogs', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<WorkLog>) =>
    request<WorkLog>(`/worklogs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/worklogs/${id}`, { method: 'DELETE' }),
};

// ── Incidents ─────────────────────────────────────────────────

export const incidentsApi = {
  list: (projectId: number) =>
    request<Incident[]>(`/incidents?project_id=${projectId}`),

  create: (data: Omit<Incident, 'id' | 'created_at' | 'updated_at'>) =>
    request<Incident>('/incidents', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<Incident>) =>
    request<Incident>(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/incidents/${id}`, { method: 'DELETE' }),

  aiAnalyze: (rawText: string, projectId: number): Promise<Response> =>
    fetch(`${BASE}/incidents/ai-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ raw_text: rawText, project_id: projectId }),
    }),
};

// ── Dashboard ─────────────────────────────────────────────────

export interface DashboardData {
  projects:                { total: number; active: number; completed: number; archived: number };
  tasks:                   { pending: number; in_progress: number; completed: number; cancelled: number };
  servers:                 { online: number; offline: number; degraded: number; unknown: number; total: number };
  recent_error_count:      number;
  overdue_count:           number;
  unread_mail_count:       number;
  unassigned_mail_count:   number;
  open_incident_count:     number;
  recent_logs: Array<{
    id: number; project_id: number; project_name: string;
    type: string; message: string; source: string | null; created_at: string;
  }>;
  urgent_tasks: Array<{
    id: number; project_id: number; project_name: string;
    title: string; status: string; priority: string;
    due_date: string | null;
  }>;
  recent_mails: Array<{
    id: number; subject: string | null; from_name: string | null; from_email: string | null;
    is_read: boolean; received_at: string; project_id: number | null; project_name: string | null;
  }>;
  recent_incidents: Array<{
    id: number; project_id: number; project_name: string;
    title: string; severity: string; status: string; occurred_at: string;
  }>;
  project_summaries: Array<{
    id: number; name: string; client_name: string | null; status: string; updated_at: string;
    task_counts:    { pending: number; in_progress: number; completed: number; total: number };
    server_counts:  { online: number; offline: number; total: number };
    recent_errors:  number;
    completion_rate: number;
  }>;
}

export const dashboardApi = {
  get: () => request<DashboardData>('/dashboard'),
};

// ── Reports ───────────────────────────────────────────────────

export interface ReportData {
  project: { id: number; name: string; client_name: string | null; status: string };
  period:  { from: string; to: string };
  task_stats: { total: number; completed_total: number; ongoing: number; pending: number };
  total_work_hours: number;
  completed_tasks: Array<{ id: number; title: string; type: string; priority: string; completed_at: string | null }>;
  ongoing_tasks:   Array<{ id: number; title: string; type: string; priority: string; due_date: string | null; assigned_to: string | null }>;
  upcoming_tasks:  Array<{ id: number; title: string; type: string; priority: string; due_date: string | null; assigned_to: string | null }>;
  work_logs: Array<{ id: number; title: string; work_date: string; work_type: string; engineer: string | null; hours: number | null; issues: string | null }>;
  open_incidents: Array<{ id: number; title: string; severity: string; status: string; occurred_at: string }>;
  servers: Array<{ id: number; hostname: string; role: string | null; status: string }>;
}

export const reportsApi = {
  generate: (projectId: number, periodFrom: string, periodTo: string) =>
    request<ReportData>(`/reports/generate?project_id=${projectId}&period_from=${periodFrom}&period_to=${periodTo}`),
};

// ── Health ────────────────────────────────────────────────────

export const healthApi = {
  check: () =>
    request<{ status: string; ollama: string; model: string; embed: string }>('/health'),
};

// ── Solutions ─────────────────────────────────────────────

export const solutionsApi = {
  list: () => request<any[]>('/solutions'),
  
  listProjectSolutions: (projectId: number) =>
    request<any[]>(`/solutions/project-solutions?project_id=${projectId}`),
  
  addToProject: (projectId: number, solutionId: number) =>
    request<any>('/solutions/project-solutions', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, solution_id: solutionId }),
    }),
  
  removeFromProject: (projectId: number, solutionId: number) =>
    request<void>('/solutions/project-solutions', {
      method: 'DELETE',
      body: JSON.stringify({ project_id: projectId, solution_id: solutionId }),
    }),
};

// ── Tasks ─────────────────────────────────────────────────

export const tasksApi = {
  list: (projectId: number, status?: string) =>
    request<any[]>(`/tasks?project_id=${projectId}${status ? `&status=${status}` : ''}`),

  create: (data: any) =>
    request<any>('/tasks', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: any) =>
    request<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }),
};

// ── Auth ───────────────────────────────────────────────────

export interface Member {
  username:     string;
  display_name: string | null;
  phone:        string | null;
}

export const authApi = {
  login: (username: string, password: string) =>
    request<AuthToken>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<User>('/auth/me'),

  updateProfile: (data: { display_name?: string; phone?: string }) =>
    request<User>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  members: () => request<Member[]>('/auth/members'),

  // 관리자 전용
  listUsers: () => request<User[]>('/auth/users'),

  createUser: (data: { username: string; password: string; is_admin: boolean }) =>
    request<User>('/auth/users', { method: 'POST', body: JSON.stringify(data) }),

  updateUserProfile: (userId: number, data: { display_name?: string; phone?: string }) =>
    request<User>(`/auth/users/${userId}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  changePassword: (userId: number, password: string) =>
    request<{ ok: boolean }>(`/auth/users/${userId}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    }),

  toggleActive: (userId: number) =>
    request<User>(`/auth/users/${userId}/toggle-active`, { method: 'PATCH' }),

  deleteUser: (userId: number) =>
    request<{ ok: boolean }>(`/auth/users/${userId}`, { method: 'DELETE' }),

  getUserProjects: (userId: number) =>
    request<number[]>(`/auth/users/${userId}/projects`),

  setUserProjects: (userId: number, projectIds: number[]) =>
    request<{ ok: boolean }>(`/auth/users/${userId}/projects`, {
      method: 'PUT',
      body: JSON.stringify({ project_ids: projectIds }),
    }),
};

export const filesApi = {
  list: (projectId: number) =>
    request<ProjectFile[]>(`/files?project_id=${projectId}`),

  upload: async (projectId: number, file: File, groupId?: number | null): Promise<ProjectFile> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    const qs = groupId != null ? `&group_id=${groupId}` : '';
    const res = await fetch(`${BASE}/files/upload?project_id=${projectId}${qs}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '업로드 실패' }));
      throw new Error(err.detail ?? '업로드 실패');
    }
    return res.json();
  },

  moveGroup: (fileId: number, groupId: number | null) => {
    const qs = groupId != null ? `?group_id=${groupId}` : '';
    return request<ProjectFile>(`/files/${fileId}/group${qs}`, { method: 'PATCH' });
  },

  download: async (fileId: number, originalName: string): Promise<void> => {
    const token = getToken();
    const res = await fetch(`${BASE}/files/${fileId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('다운로드 실패');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = originalName;
    a.click();
    URL.revokeObjectURL(url);
  },

  delete: (fileId: number) =>
    request<void>(`/files/${fileId}`, { method: 'DELETE' }),

  // 그룹
  listGroups: (projectId: number) =>
    request<FileGroup[]>(`/files/groups?project_id=${projectId}`),

  createGroup: (projectId: number, name: string) =>
    request<FileGroup>(`/files/groups?project_id=${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateGroup: (groupId: number, data: { name?: string; sort_order?: number }) =>
    request<FileGroup>(`/files/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteGroup: (groupId: number) =>
    request<void>(`/files/groups/${groupId}`, { method: 'DELETE' }),
};

// ── Mails ─────────────────────────────────────────────────────

export interface MailAttachment {
  id:            number;
  original_name: string;
  mime_type:     string | null;
  file_size:     number;
}

export interface ProjectMail {
  id:               number;
  project_id:       number | null;
  from_email:       string;
  from_name:        string | null;
  subject:          string;
  body:             string;
  received_at:      string;
  category:         'inquiry' | 'complaint' | 'approval' | 'report' | 'other';
  is_read:          boolean;
  note:             string | null;
  gmail_message_id: string | null;
  gmail_thread_id:  string | null;
  created_at:       string;
  updated_at:       string;
  attachments:      MailAttachment[];
}

export const mailsApi = {
  list: (opts?: { project_id?: number; unassigned?: boolean; category?: string; is_read?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.project_id !== undefined) params.set('project_id', String(opts.project_id));
    if (opts?.unassigned) params.set('unassigned', 'true');
    if (opts?.category) params.set('category', opts.category);
    if (opts?.is_read !== undefined) params.set('is_read', String(opts.is_read));
    return request<ProjectMail[]>(`/mails?${params}`);
  },

  create: (projectId: number, data: {
    from_email: string; from_name?: string; subject: string;
    body?: string; received_at: string; category?: string; note?: string;
  }) =>
    request<ProjectMail>(`/mails?project_id=${projectId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (mailId: number, data: Partial<{
    project_id: number | null; from_email: string; from_name: string; subject: string; body: string;
    received_at: string; category: string; is_read: boolean; note: string;
  }>) =>
    request<ProjectMail>(`/mails/${mailId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (mailId: number) =>
    request<void>(`/mails/${mailId}`, { method: 'DELETE' }),
};

// ── Mail Drafts (보낼 메일 초안) ───────────────────────────────

export interface MailDraftAttachment {
  id:            number;
  original_name: string;
  mime_type:     string | null;
  file_size:     number;
}

export interface MailDraft {
  id:          number;
  project_id:  number | null;
  to_email:    string;
  to_name:     string | null;
  subject:     string;
  body:        string;
  note:        string | null;
  status:      'draft' | 'sent' | 'cancelled';
  priority:    'high' | 'normal' | 'low';
  created_by:  string | null;
  sent_at:     string | null;
  created_at:  string;
  updated_at:  string;
  attachments: MailDraftAttachment[];
}

export const mailDraftsApi = {
  list: (opts?: { status?: string; project_id?: number }) => {
    const p = new URLSearchParams();
    if (opts?.status)     p.set('status', opts.status);
    if (opts?.project_id !== undefined) p.set('project_id', String(opts.project_id));
    return request<MailDraft[]>(`/mail-drafts?${p}`);
  },

  create: (data: {
    to_email: string; to_name?: string; subject: string;
    body?: string; note?: string; project_id?: number | null; priority?: string;
  }) =>
    request<MailDraft>('/mail-drafts', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<{
    to_email: string; to_name: string | null; subject: string; body: string;
    note: string | null; project_id: number | null; priority: string; status: string;
  }>) =>
    request<MailDraft>(`/mail-drafts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/mail-drafts/${id}`, { method: 'DELETE' }),

  uploadAttachment: async (draftId: number, file: File): Promise<MailDraftAttachment> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/mail-drafts/${draftId}/attachments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  deleteAttachment: (draftId: number, attId: number) =>
    request<void>(`/mail-drafts/${draftId}/attachments/${attId}`, { method: 'DELETE' }),

  downloadUrl: (draftId: number, attId: number) =>
    `/api/mail-drafts/${draftId}/attachments/${attId}/download`,
};

// ── Gmail ─────────────────────────────────────────────────────

export interface GmailStatus {
  connected:  boolean;
  email:      string | null;
  last_sync:  string | null;
}

export const gmailApi = {
  getAuthUrl: () =>
    request<{ url: string }>('/gmail/auth-url'),

  status: () =>
    request<GmailStatus>('/gmail/status'),

  sync: (maxResults = 50) =>
    request<{ synced: number; total: number }>(`/gmail/sync?max_results=${maxResults}`, { method: 'POST' }),

  disconnect: () =>
    request<{ ok: boolean }>('/gmail/disconnect', { method: 'DELETE' }),
};

// ── Partners ─────────────────────────────────────────────────

export const partnersApi = {
  list: (opts?: { search?: string; business_type?: string }) => {
    const p = new URLSearchParams();
    if (opts?.search)        p.set('search', opts.search);
    if (opts?.business_type) p.set('business_type', opts.business_type);
    return request<Partner[]>(`/partners?${p}`);
  },

  get: (id: number) =>
    request<Partner>(`/partners/${id}`),

  create: (data: { name: string; business_type?: string; contract_type?: string; website?: string; address?: string; notes?: string }) =>
    request<Partner>('/partners', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<Pick<Partner, 'name' | 'business_type' | 'contract_type' | 'website' | 'address' | 'notes'>>) =>
    request<Partner>(`/partners/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/partners/${id}`, { method: 'DELETE' }),

  createContact: (partnerId: number, data: { name: string; role?: string; phone?: string; email?: string; department?: string; is_primary?: boolean; notes?: string }) =>
    request<PartnerContact>(`/partners/${partnerId}/contacts`, { method: 'POST', body: JSON.stringify(data) }),

  updateContact: (partnerId: number, contactId: number, data: Partial<PartnerContact>) =>
    request<PartnerContact>(`/partners/${partnerId}/contacts/${contactId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteContact: (partnerId: number, contactId: number) =>
    request<void>(`/partners/${partnerId}/contacts/${contactId}`, { method: 'DELETE' }),

  listProjectPartners: (projectId: number) =>
    request<ProjectPartnerItem[]>(`/partners/project-partners?project_id=${projectId}`),

  addToProject: (data: { project_id: number; partner_id: number; role?: string; notes?: string }) =>
    request<ProjectPartnerItem>('/partners/project-partners', { method: 'POST', body: JSON.stringify(data) }),

  removeFromProject: (id: number) =>
    request<void>(`/partners/project-partners/${id}`, { method: 'DELETE' }),

  getMails: (partnerId: number, projectId?: number) => {
    const p = new URLSearchParams();
    if (projectId !== undefined) p.set('project_id', String(projectId));
    return request<{
      id: number; project_id: number | null; from_email: string; from_name: string | null;
      subject: string; received_at: string; category: string; is_read: boolean;
    }[]>(`/partners/${partnerId}/mails?${p}`);
  },
};

// ── Notifications ──────────────────────────────────────────────

export interface NotificationItem {
  id: number;
  title: string;
  meta: string;
  href: string;
  time: string | null;
}

export interface NotificationSection {
  type: string;
  label: string;
  icon: 'mail' | 'alert' | 'clock';
  count: number;
  href: string | null;
  items: NotificationItem[];
}

export interface NotificationSummary {
  total: number;
  sections: NotificationSection[];
}

export const notificationsApi = {
  summary: () => request<NotificationSummary>('/notifications/summary'),
};

// ── Global Search ──────────────────────────────────────────────

export interface SearchResult {
  type: 'project' | 'task' | 'todo' | 'mail' | 'guide' | 'contact' | 'file' | 'worklog';
  id: number;
  title: string;
  meta: string;
  match_field: string;
  href: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
}

export const searchApi = {
  search: (q: string) => request<SearchResponse>(`/search?q=${encodeURIComponent(q)}`),
};

// ── Design Queue ──────────────────────────────────────────────

export interface DesignJob {
  id: number;
  project_id: number;
  action: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  quality_score: number | null;
  result_slug: string | null;
  error_message: string | null;
  log_tail: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TrendStatus {
  cached: boolean;
  age_hours: number | null;
  stale: boolean;
  refreshing: boolean;
  trends: {
    trending_styles?: string[];
    trending_colors?: string[];
    trending_layouts?: string[];
    trending_elements?: string[];
    trending_interactions?: string[];
    avoid_cliche?: string[];
    design_direction?: string;
  } | null;
}

// ── System Stats ───────────────────────────────────────────────────────────────
export interface SystemProcess {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
}

export interface SystemStats {
  cpu_total: number;
  cpu_cores: number[];
  mem_used_gb: number;
  mem_total_gb: number;
  mem_percent: number;
  processes: SystemProcess[];
}

export const systemStatsApi = {
  get: () => request<SystemStats>('/system-stats'),
};

export const designQueueApi = {
  enqueue: (
    project_id: number,
    action: string,
    opts?: { use_trends?: boolean; refresh_trends?: boolean },
  ) =>
    request<DesignJob>('/design-queue', {
      method: 'POST',
      body: JSON.stringify({ project_id, action, ...opts }),
    }),
  list: (limit = 30) => request<DesignJob[]>(`/design-queue?limit=${limit}`),
  activeCount: () => request<{ active: number }>('/design-queue/active-count'),
  get: (jobId: number) => request<DesignJob>(`/design-queue/${jobId}`),
  cancel: (jobId: number) =>
    request<void>(`/design-queue/${jobId}`, { method: 'DELETE' }),
  getTrends: (project_id: number) =>
    request<TrendStatus>(`/design-queue/trends?project_id=${project_id}`),
  refreshTrends: (project_id: number) =>
    request<{ message: string; refreshing: boolean }>('/design-queue/trends/refresh', {
      method: 'POST',
      body: JSON.stringify({ project_id }),
    }),
};

// ── Blog Queue ────────────────────────────────────────────────

export interface BlogStageStatus {
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  elapsed: number | null;
}

export interface BlogJob {
  id:             number;
  project_id:     number;
  created_by:     string;
  status:         'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  current_stage:  string | null;
  stage_statuses: Record<string, BlogStageStatus> | null;
  log_tail:       string | null;
  topic_key:      string | null;
  topic_title:    string | null;
  model_used:     string | null;
  quality_score:  number | null;
  result_slug:    string | null;
  error_message:  string | null;
  queued_at:      string;
  started_at:     string | null;
  completed_at:   string | null;
}

export const blogQueueApi = {
  enqueue: (project_id: number, opts?: { use_trend?: boolean; category?: string }) =>
    request<BlogJob>('/blog-queue', {
      method: 'POST',
      body: JSON.stringify({ project_id, use_trend: opts?.use_trend ?? false, category: opts?.category ?? '' }),
    }),
  list: (project_id: number, limit = 20) =>
    request<BlogJob[]>(`/blog-queue?project_id=${project_id}&limit=${limit}`),
  get: (job_id: number) =>
    request<BlogJob>(`/blog-queue/${job_id}`),
  cancel: (job_id: number) =>
    request<void>(`/blog-queue/${job_id}`, { method: 'DELETE' }),
};

// ── Personal Documents ─────────────────────────────────────

export interface PersonalDocGroup {
  id:         number;
  created_by: string;
  parent_id:  number | null;
  name:       string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PersonalDocument {
  id:            number;
  created_by:    string;
  group_id:      number | null;
  original_name: string;
  mime_type:     string | null;
  file_size:     number;
  is_deleted:    boolean;
  deleted_at:    string | null;
  is_favorite:   boolean;
  created_at:    string;
}

export const personalDocsApi = {
  listDocs: () =>
    request<PersonalDocument[]>('/personal-docs'),

  upload: (file: File, groupId?: number | null, onProgress?: (pct: number) => void): Promise<PersonalDocument> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const qs = groupId != null ? `?group_id=${groupId}` : '';
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/personal-docs/upload${qs}`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          const detail = JSON.parse(xhr.responseText || '{}').detail ?? '업로드 실패';
          reject(new Error(detail));
        }
      };
      xhr.onerror = () => reject(new Error('업로드 실패'));
      xhr.send(formData);
    });
  },

  moveGroup: (docId: number, groupId: number | null) => {
    const qs = groupId != null ? `?group_id=${groupId}` : '';
    return request<PersonalDocument>(`/personal-docs/${docId}/group${qs}`, { method: 'PATCH' });
  },

  download: async (docId: number, originalName: string): Promise<void> => {
    const token = getToken();
    const res = await fetch(`${BASE}/personal-docs/${docId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('다운로드 실패');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = originalName;
    a.click();
    URL.revokeObjectURL(url);
  },

  rename: (docId: number, originalName: string) =>
    request<PersonalDocument>(`/personal-docs/${docId}`, {
      method: 'PATCH',
      body: JSON.stringify({ original_name: originalName }),
    }),

  delete: (docId: number) =>
    request<void>(`/personal-docs/${docId}`, { method: 'DELETE' }),

  listGroups: () =>
    request<PersonalDocGroup[]>('/personal-docs/groups'),

  createGroup: (name: string, parentId?: number | null) =>
    request<PersonalDocGroup>('/personal-docs/groups', {
      method: 'POST',
      body: JSON.stringify({ name, parent_id: parentId ?? null }),
    }),

  updateGroup: (groupId: number, data: { name?: string; sort_order?: number }) =>
    request<PersonalDocGroup>(`/personal-docs/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  reparentGroup: (groupId: number, parentId: number | null) =>
    request<PersonalDocGroup>(`/personal-docs/groups/${groupId}/reparent`, {
      method: 'PATCH',
      body: JSON.stringify({ parent_id: parentId }),
    }),

  deleteGroup: (groupId: number) =>
    request<void>(`/personal-docs/groups/${groupId}`, { method: 'DELETE' }),

  createDownloadLink: (docId: number, maxDownloads: number = 1) =>
    request<{ token: string; expires_at: string; filename: string; max_downloads: number }>(
      `/personal-docs/${docId}/download-link`,
      { method: 'POST', body: JSON.stringify({ max_downloads: maxDownloads }) },
    ),

  listTrash: () =>
    request<PersonalDocument[]>('/personal-docs/trash'),

  restore: (docId: number) =>
    request<PersonalDocument>(`/personal-docs/${docId}/restore`, { method: 'POST' }),

  permanentDelete: (docId: number) =>
    request<void>(`/personal-docs/${docId}/permanent`, { method: 'DELETE' }),

  toggleFavorite: (docId: number) =>
    request<PersonalDocument>(`/personal-docs/${docId}/favorite`, { method: 'PATCH' }),

  bulkTrash: (docIds: number[]) =>
    request<void>('/personal-docs/bulk/trash', { method: 'POST', body: JSON.stringify({ doc_ids: docIds }) }),

  bulkRestore: (docIds: number[]) =>
    request<void>('/personal-docs/bulk/restore', { method: 'POST', body: JSON.stringify({ doc_ids: docIds }) }),

  bulkPermanentDelete: (docIds: number[]) =>
    request<void>('/personal-docs/bulk/permanent', { method: 'POST', body: JSON.stringify({ doc_ids: docIds }) }),

  bulkMove: (docIds: number[], groupId: number | null) =>
    request<void>('/personal-docs/bulk/move', { method: 'POST', body: JSON.stringify({ doc_ids: docIds, group_id: groupId }) }),
};

// ── Document Editor ──────────────────────────────────────────

export interface DocEditorInfo {
  editable:    boolean;
  ext:         string;
  lo_available: boolean;
  needs_lo:    boolean;
  hwp:         boolean;
  save_format: string;
}

export interface DocEditorContent {
  html:          string;
  original_name: string;
  hwp:           boolean;
  save_format:   string;
}

export interface DocSaveResult {
  doc_id:   number;
  message:  string;
  new_file: boolean;
  new_doc?: PersonalDocument;
}

export const docEditorApi = {
  info: (docId: number) =>
    request<DocEditorInfo>(`/doc-editor/${docId}/info`),

  toHtml: (docId: number) =>
    request<DocEditorContent>(`/doc-editor/${docId}/to-html`, { method: 'POST' }),

  save: (docId: number, html: string) =>
    request<DocSaveResult>(`/doc-editor/${docId}/save`, {
      method: 'POST',
      body: JSON.stringify({ html }),
    }),

  exportPdfUrl: (docId: number) => `/api/doc-editor/${docId}/export/pdf`,
};

// ── SSH Servers ─────────────────────────────────────────────

export interface SshServer {
  id:            number;
  name:          string;
  host:          string;
  port:          number;
  username:      string;
  auth_type:     'password' | 'key';
  has_password:  boolean;
  has_key:       boolean;
  tags:          string[];
  notes:         string | null;
  last_tested_at: string | null;
  last_test_ok:  boolean | null;
  created_at:    string;
  updated_at:    string;
}

export interface SshServerSecrets extends SshServer {
  password:    string | null;
  private_key: string | null;
}

export interface SshServerPayload {
  name:        string;
  host:        string;
  port:        number;
  username:    string;
  auth_type:   'password' | 'key';
  password?:   string;
  private_key?: string;
  tags:        string[];
  notes?:      string;
}

export const sshServersApi = {
  list: () =>
    request<SshServer[]>('/ssh-servers'),

  create: (data: SshServerPayload) =>
    request<SshServer>('/ssh-servers', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<SshServerPayload>) =>
    request<SshServer>(`/ssh-servers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/ssh-servers/${id}`, { method: 'DELETE' }),

  getSecrets: (id: number) =>
    request<SshServerSecrets>(`/ssh-servers/${id}/secrets`),

  test: (id: number) =>
    request<{ ok: boolean; message: string }>(`/ssh-servers/${id}/test`, { method: 'POST' }),
};

// ── Weekly Reports ─────────────────────────────────────────────

export const weeklyReportsApi = {
  list: (projectId: number) =>
    request<WeeklyReport[]>(`/weekly-reports?project_id=${projectId}`),

  get: (id: number) =>
    request<WeeklyReport>(`/weekly-reports/${id}`),

  create: (data: {
    project_id: number;
    year: number;
    week_number: number;
    title?: string;
    project_health?: string;
    summary?: string;
    completed_work?: string;
    in_progress_work?: string;
    issues?: string;
    next_week_plan?: string;
    risk_notes?: string;
    written_by?: string;
    reviewed_by?: string;
  }) => request<WeeklyReport>('/weekly-reports', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<Omit<WeeklyReport, 'id' | 'project_id' | 'year' | 'week_number' | 'week_start' | 'week_end' | 'created_at' | 'updated_at'>>) =>
    request<WeeklyReport>(`/weekly-reports/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/weekly-reports/${id}`, { method: 'DELETE' }),
};

// ── Work Weekly Reports ────────────────────────────────────────

export { type WorkWeeklyReport, type WorkWeeklyItem } from './types';

export const workWeeklyApi = {
  list: (params?: { author?: string; year?: number }) => {
    const q = new URLSearchParams();
    if (params?.author) q.set('author', params.author);
    if (params?.year)   q.set('year', String(params.year));
    return request<import('./types').WorkWeeklyReport[]>(`/work-weekly${q.toString() ? '?' + q : ''}`);
  },

  get: (id: number) =>
    request<import('./types').WorkWeeklyReport>(`/work-weekly/${id}`),

  create: (data: { year: number; week_number: number; department?: string; note?: string }) =>
    request<import('./types').WorkWeeklyReport>('/work-weekly', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<{ title: string | null; department: string | null; status: string; summary: string | null; note: string | null }>) =>
    request<import('./types').WorkWeeklyReport>(`/work-weekly/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/work-weekly/${id}`, { method: 'DELETE' }),

  addItem: (reportId: number, data: {
    category?: string; project_name?: string; content: string; sub_items?: string[];
    status?: string; progress?: number; note?: string;
    is_next_week?: boolean; sort_order?: number;
  }) => request<import('./types').WorkWeeklyItem>(`/work-weekly/${reportId}/items`, { method: 'POST', body: JSON.stringify(data) }),

  updateItem: (reportId: number, itemId: number, data: Partial<{
    category: string; project_name: string; content: string; sub_items: string[];
    status: string; progress: number; note: string;
    is_next_week: boolean; sort_order: number;
  }>) => request<import('./types').WorkWeeklyItem>(`/work-weekly/${reportId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteItem: (reportId: number, itemId: number) =>
    request<void>(`/work-weekly/${reportId}/items/${itemId}`, { method: 'DELETE' }),

  aiParse: (reportId: number, text: string) =>
    request<{
      this_week: Array<{ category: string; content: string; status: string; progress: number; project_name: string | null }>;
      next_week:  Array<{ category: string; content: string; project_name: string | null }>;
    }>(`/work-weekly/${reportId}/ai-parse`, { method: 'POST', body: JSON.stringify({ text }) }),
};

export const inquiriesApi = {
  list: (projectId?: number, status?: string) => {
    const params = new URLSearchParams();
    if (projectId !== undefined) params.set('project_id', String(projectId));
    if (status) params.set('status', status);
    return request<import('./types').ClientInquiry[]>(`/client-inquiries?${params}`);
  },

  create: (data: { project_id: number; title: string; question: string; asked_by?: string; asked_at?: string }) =>
    request<import('./types').ClientInquiry>('/client-inquiries', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<{ title: string; question: string; answer: string; status: string; asked_by: string; answered_by: string; asked_at: string }>) =>
    request<import('./types').ClientInquiry>(`/client-inquiries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/client-inquiries/${id}`, { method: 'DELETE' }),

  aiSummarize: (id: number, emailText: string): Promise<Response> =>
    fetch(`${BASE}/client-inquiries/${id}/ai-summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ email_text: emailText }),
    }),

  aiExtract: (projectId: number, emailText: string) =>
    request<import('./types').ClientInquiry>('/client-inquiries/ai-extract', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, email_text: emailText }),
    }),
};

// ── Work Methods ────────────────────────────────────────────

export interface WorkMethodStep {
  order: number;
  content: string;
  script?: string;
}

export interface WorkMethod {
  id: number;
  created_by: string;
  title: string;
  category: string | null;
  description: string;
  steps: WorkMethodStep[];
  tags: string[];
  sort_order: number;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkMethodPayload {
  title: string;
  category?: string | null;
  description?: string;
  steps?: WorkMethodStep[];
  tags?: string | null;
  sort_order?: number;
}

export const workMethodsApi = {
  list: (params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.search)   qs.set('search',   params.search);
    const q = qs.toString();
    return request<WorkMethod[]>(`/work-methods${q ? `?${q}` : ''}`);
  },

  categories: () =>
    request<string[]>('/work-methods/categories'),

  create: (data: WorkMethodPayload) =>
    request<WorkMethod>('/work-methods', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<WorkMethodPayload>) =>
    request<WorkMethod>(`/work-methods/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<void>(`/work-methods/${id}`, { method: 'DELETE' }),

  aiGenerate: (request: string, category?: string): Promise<Response> =>
    fetch(`${BASE}/work-methods/ai-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ request, category }),
    }),

  createShare: (id: number) =>
    request<{ share_token: string }>(`/work-methods/${id}/share`, { method: 'POST' }),

  revokeShare: (id: number) =>
    request<void>(`/work-methods/${id}/share`, { method: 'DELETE' }),

  getShared: (token: string) =>
    request<WorkMethod>(`/work-methods/public/${token}`),
};

// ── AI Company ──────────────────────────────────────────────────────

export interface AICompany {
  id: number;
  name: string;
  goal: string;
  focus: string;
  status: 'idle' | 'running' | 'paused';
  strategy: string | null;
  cycle_count: number;
  last_cycle: string | null;
  cycle_interval_min: number;
  created_at: string;
  task_counts?: { pending: number; running: number; done: number; failed?: number };
  total_revenue_krw?: number;
}

export interface AICompanyTask {
  id: number;
  company_id: number;
  agent_role: string;
  agent_name: string;
  agent_emoji: string;
  agent_color: string;
  department: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  priority: number;
  result: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AICompanyLog {
  id: number;
  company_id: number;
  task_id: number | null;
  agent_role: string;
  agent_name: string;
  agent_emoji: string;
  agent_color: string;
  log_type: 'think' | 'action' | 'result' | 'error' | 'system';
  content: string;
  created_at: string;
}

export interface AICompanyRevenue {
  id: number;
  channel: string;
  amount: number;
  currency: string;
  description: string | null;
  date: string;
  created_at: string;
}

export const aiCompanyApi = {
  list: () => request<AICompany[]>('/ai-company'),

  create: (data: { name: string; goal: string; focus: string; cycle_interval_min: number }) =>
    request<AICompany>('/ai-company', { method: 'POST', body: JSON.stringify(data) }),

  get: (id: number) => request<AICompany>(`/ai-company/${id}`),

  update: (id: number, data: Partial<{ name: string; goal: string; focus: string; cycle_interval_min: number }>) =>
    request<AICompany>(`/ai-company/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: number) => request<void>(`/ai-company/${id}`, { method: 'DELETE' }),

  start: (id: number) => request<{ status: string }>(`/ai-company/${id}/start`, { method: 'POST' }),

  pause: (id: number) => request<{ status: string }>(`/ai-company/${id}/pause`, { method: 'POST' }),

  runCycle: (id: number) => request<{ ok: boolean }>(`/ai-company/${id}/run-cycle`, { method: 'POST' }),

  tasks: (id: number, status?: string) =>
    request<AICompanyTask[]>(`/ai-company/${id}/tasks${status ? `?status=${status}` : ''}`),

  logs: (id: number, limit = 100, offset = 0) =>
    request<AICompanyLog[]>(`/ai-company/${id}/logs?limit=${limit}&offset=${offset}`),

  revenue: (id: number) => request<AICompanyRevenue[]>(`/ai-company/${id}/revenue`),

  addRevenue: (id: number, data: { channel: string; amount: number; currency: string; description?: string; date: string }) =>
    request<{ id: number }>(`/ai-company/${id}/revenue`, { method: 'POST', body: JSON.stringify(data) }),

  stats: (id: number) => request<AICompanyStats>(`/ai-company/${id}/stats`),

  sendMessage: (id: number, message: string, action = 'message') =>
    request<{ ok: boolean }>(`/ai-company/${id}/message`, {
      method: 'POST',
      body: JSON.stringify({ message, action }),
    }),

  getBlogSettings: () =>
    request<{
      blog_api_url: string;
      supabase_url: string;
      site_url: string;
      blog_api_key_set: boolean; blog_api_key_preview: string;
      supabase_anon_key_set: boolean; supabase_anon_key_preview: string;
      supabase_service_role_key_set: boolean; supabase_service_role_key_preview: string;
    }>('/ai-company/blog-settings'),

  updateBlogSettings: (data: {
    blog_api_url?: string; blog_api_key?: string;
    supabase_url?: string; supabase_anon_key?: string; supabase_service_role_key?: string;
    site_url?: string;
  }) =>
    request<{ ok: boolean }>('/ai-company/blog-settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  testBlogConnection: () =>
    request<{ ok: boolean; message: string; status?: number }>('/ai-company/blog-settings/test', {
      method: 'POST',
    }),

  getBlogPosts: (companyId: number, limit = 50) =>
    request<Array<{
      id: number;
      title: string;
      slug: string;
      category: string;
      tags: string[];
      excerpt: string;
      published_at: string;
      url: string;
    }>>(`/ai-company/${companyId}/blog-posts?limit=${limit}`),
};

export interface AICompanyStats {
  revenue_mtd: number;
  task_counts: { pending: number; running: number; done: number; failed: number };
  dept_stats: Record<string, { done: number; total: number; performance: number }>;
  busy_roles: string[];
  pending_roles: string[];
  running_task_titles: Record<string, string>;
  notifications: Array<{ id: string; icon: string; message: string; time: string; type: string; agent_color: string }>;
  cycle_count: number;
  success_rate: number;
}
