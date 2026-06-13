export type AgentStatus = 'online' | 'busy' | 'away';
export type AgentMood = 'happy' | 'focused' | 'excited' | 'neutral';

export interface Agent {
  id: string;
  name: string;
  role: string;
  department: string;
  status: AgentStatus;
  mood: AgentMood;
  currentTask: string;
  message: string;
  emoji: string;
  color: string;
  room: string;
}

export interface Department {
  id: string;
  name: string;
  performance: number;
  color: string;
  agents: number;
}

export interface WorkflowItem {
  id: string;
  title: string;
  owner: string;
  department: string;
  status: 'in-progress' | 'in-review' | 'pending' | 'done';
}

export interface FeedMessage {
  id: string;
  agent: string;
  agentEmoji: string;
  agentColor: string;
  message: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  icon: string;
  message: string;
  time: string;
  type: 'info' | 'success' | 'warning';
}

export const mockAgents: Agent[] = [
  {
    id: 'ceo',
    name: 'CEO AI',
    role: 'Chief Executive Officer',
    department: 'Executive',
    status: 'online',
    mood: 'happy',
    currentTask: '팀 전략 수립 및 사이클 관리',
    message: '다음 사이클 전략 수립 중 ✨',
    emoji: '👑',
    color: '#7C3AED',
    room: 'ceo',
  },
  {
    id: 'content_planner',
    name: 'Content Planner',
    role: 'Content Strategist',
    department: 'Content',
    status: 'busy',
    mood: 'focused',
    currentTask: '블로그 주제 기획서 작성',
    message: '🧠 기획 진행 중...',
    emoji: '🧠',
    color: '#2563EB',
    room: 'content',
  },
  {
    id: 'content_writer',
    name: 'Content Writer',
    role: 'Blog Writer',
    department: 'Content',
    status: 'online',
    mood: 'focused',
    currentTask: '기획서 바탕 초안 작성',
    message: '✍️ 초안 작성 중',
    emoji: '✍️',
    color: '#059669',
    room: 'content',
  },
  {
    id: 'content_reviewer',
    name: 'Content Reviewer',
    role: 'Editor & QA',
    department: 'Content',
    status: 'online',
    mood: 'neutral',
    currentTask: '콘텐츠 품질 검토',
    message: '🔍 검토 대기 중',
    emoji: '🔍',
    color: '#9333EA',
    room: 'content',
  },
  {
    id: 'developer',
    name: 'Developer AI',
    role: 'Lead Engineer',
    department: 'Development',
    status: 'busy',
    mood: 'focused',
    currentTask: '자동화 스크립트 개발',
    message: '⚡ 배포 준비 중',
    emoji: '⚡',
    color: '#DC2626',
    room: 'dev',
  },
  {
    id: 'site_operator',
    name: 'Site Operator',
    role: 'SEO & Ops',
    department: 'Operations',
    status: 'online',
    mood: 'neutral',
    currentTask: 'SEO 태그 최적화',
    message: '🌐 트래픽 분석 중',
    emoji: '🌐',
    color: '#D97706',
    room: 'ops',
  },
  {
    id: 'revenue_manager',
    name: 'Revenue Manager',
    role: 'Revenue & Growth',
    department: 'Revenue',
    status: 'online',
    mood: 'excited',
    currentTask: 'AdSense ROI 분석',
    message: '💰 수익 최적화 전략 검토',
    emoji: '💰',
    color: '#0891B2',
    room: 'ops',
  },
];

export const mockDepartments: Department[] = [
  { id: 'content', name: 'Content', performance: 88, color: '#2563EB', agents: 3 },
  { id: 'dev', name: 'Development', performance: 92, color: '#DC2626', agents: 1 },
  { id: 'ops', name: 'Operations', performance: 80, color: '#D97706', agents: 1 },
  { id: 'revenue', name: 'Revenue', performance: 85, color: '#0891B2', agents: 1 },
];

export const mockWorkflow: WorkflowItem[] = [
  { id: '1', title: 'Q2 Campaign Plan', owner: 'Marketing AI', department: 'Marketing', status: 'in-progress' },
  { id: '2', title: 'Website Redesign', owner: 'Developer AI', department: 'Development', status: 'in-review' },
  { id: '3', title: 'Budget Forecast', owner: 'Finance AI', department: 'Finance', status: 'pending' },
  { id: '4', title: 'Onboarding Docs', owner: 'HR AI', department: 'HR', status: 'done' },
  { id: '5', title: 'API v2.4 Release', owner: 'Backend AI', department: 'Development', status: 'in-progress' },
];

export const mockFeed: FeedMessage[] = [
  {
    id: '1',
    agent: 'Marketing AI',
    agentEmoji: '📣',
    agentColor: '#059669',
    message: 'Sharing market research insights for Q2 campaign 📊',
    timestamp: '2m ago',
  },
  {
    id: '2',
    agent: 'Developer AI',
    agentEmoji: '⚡',
    agentColor: '#2563EB',
    message: 'On it! Will integrate the new landing page data.',
    timestamp: '3m ago',
  },
  {
    id: '3',
    agent: 'Finance AI',
    agentEmoji: '💰',
    agentColor: '#D97706',
    message: 'Budget allocation updated for the campaign. ✅',
    timestamp: '5m ago',
  },
  {
    id: '4',
    agent: 'CEO AI',
    agentEmoji: '👑',
    agentColor: '#7C3AED',
    message: 'Great progress team! Keep the momentum going 🚀',
    timestamp: '8m ago',
  },
  {
    id: '5',
    agent: 'HR AI',
    agentEmoji: '🤝',
    agentColor: '#7C3AED',
    message: 'New candidate shortlisted for Dev Lead position.',
    timestamp: '12m ago',
  },
];

export const mockNotifications: Notification[] = [
  { id: '1', icon: '📋', message: 'New task assigned by Strategy AI', time: '2m ago', type: 'info' },
  { id: '2', icon: '📊', message: 'Report ready: Q1 Financial Summary', time: '15m ago', type: 'success' },
  { id: '3', icon: '📅', message: 'Team standup in 10 minutes', time: '20m ago', type: 'warning' },
  { id: '4', icon: '✅', message: 'Website Redesign moved to In Review', time: '1h ago', type: 'success' },
];
