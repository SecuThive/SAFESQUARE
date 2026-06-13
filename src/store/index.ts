import { create } from 'zustand';
import type { Project, ChatSession, ActiveTab } from '@/lib/types';

interface AppState {
  // Projects
  projects: Project[];
  selectedProjectId: number | null;
  setProjects: (p: Project[]) => void;
  setSelectedProject: (id: number | null) => void;
  addProject: (p: Project) => void;
  updateProject: (p: Project) => void;
  removeProject: (id: number) => void;

  // Active tab per project
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Chat sessions
  activeChatSession: ChatSession | null;
  setActiveChatSession: (s: ChatSession | null) => void;

  // Sidebar collapsed
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Mobile sidebar open
  sidebarMobileOpen: boolean;
  setSidebarMobileOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  projects: [],
  selectedProjectId: null,
  setProjects: (projects) => set({ projects }),
  setSelectedProject: (id) => set({ selectedProjectId: id, activeTab: 'tasks', activeChatSession: null }),
  addProject: (p) => set((s) => ({ projects: [p, ...s.projects] })),
  updateProject: (p) => set((s) => ({ projects: s.projects.map((x) => (x.id === p.id ? p : x)) })),
  removeProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((x) => x.id !== id),
      selectedProjectId: s.selectedProjectId === id ? null : s.selectedProjectId,
    })),

  activeTab: 'tasks',
  setActiveTab: (tab) => set({ activeTab: tab }),

  activeChatSession: null,
  setActiveChatSession: (s) => set({ activeChatSession: s }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  sidebarMobileOpen: false,
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
}));
