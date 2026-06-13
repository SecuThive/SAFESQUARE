'use client';

import { useEffect, useState, FormEvent } from 'react';
import { authApi, projectsApi } from '@/lib/api';
import type { User, Project } from '@/lib/types';
import {
  X, UserPlus, Trash2, KeyRound, Power, Shield,
  ChevronRight, FolderOpen, Check, Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import { confirm } from '@/lib/confirm';

interface Props { onClose: () => void; }

export default function UserManagementModal({ onClose }: Props) {
  const [users, setUsers]               = useState<User[]>([]);
  const [projects, setProjects]         = useState<Project[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    Promise.all([authApi.listUsers(), projectsApi.list()])
      .then(([u, p]) => { setUsers(u); setProjects(p); })
      .finally(() => setLoading(false));
  }, []);

  function handleUserUpdated(updated: User) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    if (selectedUser?.id === updated.id) setSelectedUser(updated);
  }

  function handleUserDeleted(userId: number) {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    if (selectedUser?.id === userId) setSelectedUser(null);
  }

  function handleUserCreated(user: User) {
    setUsers((prev) => [...prev, user]);
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-raised border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">사용자 관리</h2>
            <p className="text-xs text-gray-500 mt-0.5">계정 생성 및 프로젝트 접근 권한 설정</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: 2-panel */}
        <div className="flex flex-1 min-h-0">
          {/* Left: 사용자 목록 */}
          <div className="w-72 flex-shrink-0 border-r border-gray-800 flex flex-col">
            <UserList
              users={users}
              loading={loading}
              selectedUser={selectedUser}
              onSelect={setSelectedUser}
              onCreated={handleUserCreated}
              onUpdated={handleUserUpdated}
              onDeleted={handleUserDeleted}
            />
          </div>

          {/* Right: 프로젝트 권한 */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {selectedUser ? (
              <ProjectAccessPanel
                key={selectedUser.id}
                user={selectedUser}
                projects={projects}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <FolderOpen className="w-10 h-10 text-gray-700 mb-3" />
                <p className="text-sm text-gray-500">사용자를 선택하면</p>
                <p className="text-sm text-gray-500">프로젝트 접근 권한을 설정할 수 있습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 사용자 목록 패널 ─────────────────────────────────────────── */
function UserList({
  users, loading, selectedUser, onSelect, onCreated, onUpdated, onDeleted,
}: {
  users: User[];
  loading: boolean;
  selectedUser: User | null;
  onSelect: (u: User) => void;
  onCreated: (u: User) => void;
  onUpdated: (u: User) => void;
  onDeleted: (id: number) => void;
}) {
  const [showCreate, setShowCreate]   = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin]   = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating]       = useState(false);

  const [pwUserId, setPwUserId] = useState<number | null>(null);
  const [newPw, setNewPw]       = useState('');
  const [pwError, setPwError]   = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const user = await authApi.createUser({ username: newUsername, password: newPassword, is_admin: newIsAdmin });
      onCreated(user);
      setNewUsername(''); setNewPassword(''); setNewIsAdmin(false);
      setShowCreate(false);
    } catch (err: any) {
      setCreateError(err.message ?? '계정 생성 실패');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(user: User) {
    try {
      const updated = await authApi.toggleActive(user.id);
      onUpdated(updated);
    } catch (err: any) { alert(err.message); }
  }

  async function handleDelete(user: User) {
    if (!await confirm(`'${user.username}' 계정을 삭제하시겠습니까?`)) return;
    try {
      await authApi.deleteUser(user.id);
      onDeleted(user.id);
    } catch (err: any) { alert(err.message); }
  }

  async function handleChangePw(e: FormEvent) {
    e.preventDefault();
    if (!pwUserId) return;
    setPwError('');
    setPwLoading(true);
    try {
      await authApi.changePassword(pwUserId, newPw);
      setPwUserId(null); setNewPw('');
    } catch (err: any) {
      setPwError(err.message ?? '비밀번호 변경 실패');
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <>
      {/* 목록 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          사용자 {users.length}명
        </span>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          계정 생성
        </button>
      </div>

      {/* 생성 인라인 폼 */}
      {showCreate && (
        <form onSubmit={handleCreate} className="border-b border-gray-800/60 p-3 space-y-2 bg-gray-900/60">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="아이디"
            required
            minLength={2}
            autoFocus
            className="input w-full text-xs"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="비밀번호 (4자 이상)"
            required
            minLength={4}
            className="input w-full text-xs"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-emerald-500"
            />
            <span className="text-xs text-gray-400">관리자 권한</span>
          </label>
          {createError && <p className="text-xs text-red-400">{createError}</p>}
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 btn-primary text-xs py-1.5"
            >
              {creating ? '생성 중...' : '생성'}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setCreateError(''); }}
              className="flex-1 btn-ghost text-xs py-1.5"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* 사용자 목록 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <div>
            {users.map((user) => (
              <div
                key={user.id}
                onClick={() => onSelect(user)}
                className={clsx(
                  'group flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors border-b border-gray-800/40 last:border-0',
                  selectedUser?.id === user.id
                    ? 'bg-brand/10 border-l-2 border-l-brand'
                    : 'hover:bg-gray-800/40'
                )}
              >
                {/* 사용자 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-200 truncate">{user.username}</span>
                    {user.is_admin && (
                      <Shield className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    )}
                  </div>
                  <span className={clsx(
                    'text-[10px] font-medium',
                    user.is_active ? 'text-green-500' : 'text-gray-600'
                  )}>
                    {user.is_active ? '활성' : '비활성'}
                  </span>
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPwUserId(user.id); setNewPw(''); setPwError(''); }}
                    className="p-1 rounded text-gray-600 hover:text-blue-400 transition-colors"
                    title="비밀번호 변경"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  {!user.is_admin && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggle(user); }}
                        className={clsx(
                          'p-1 rounded transition-colors',
                          user.is_active
                            ? 'text-gray-600 hover:text-yellow-400'
                            : 'text-gray-600 hover:text-green-400'
                        )}
                        title={user.is_active ? '비활성화' : '활성화'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(user); }}
                        className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-gray-700" />
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-8">사용자 없음</p>
            )}
          </div>
        )}
      </div>

      {/* 비밀번호 변경 서브모달 */}
      {pwUserId !== null && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
          onClick={() => { setPwUserId(null); setNewPw(''); }}
        >
          <div
            className="bg-surface-raised border border-gray-800 rounded-xl p-6 w-full max-w-xs shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-300 mb-4">
              비밀번호 변경 — {users.find((u) => u.id === pwUserId)?.username}
            </h3>
            <form onSubmit={handleChangePw} className="space-y-3">
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="새 비밀번호 (4자 이상)"
                required
                minLength={4}
                autoFocus
                className="input w-full text-sm"
              />
              {pwError && <p className="text-xs text-red-400">{pwError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={pwLoading} className="btn-primary flex-1 text-sm">
                  {pwLoading ? '변경 중...' : '변경'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPwUserId(null); setNewPw(''); setPwError(''); }}
                  className="btn-ghost flex-1 text-sm"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/* ── 프로젝트 권한 패널 ───────────────────────────────────────── */
function ProjectAccessPanel({ user, projects }: { user: User; projects: Project[] }) {
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  useEffect(() => {
    if (user.is_admin) { setLoading(false); return; }
    authApi.getUserProjects(user.id)
      .then((ids) => setCheckedIds(new Set(ids)))
      .finally(() => setLoading(false));
  }, [user.id, user.is_admin]);

  function toggle(projectId: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
    setSaved(false);
  }

  function selectAll() {
    setCheckedIds(new Set(projects.map((p) => p.id)));
    setSaved(false);
  }

  function clearAll() {
    setCheckedIds(new Set());
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await authApi.setUserProjects(user.id, Array.from(checkedIds));
      setSaved(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/60 flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-gray-200">
            {user.username}
            {user.is_admin && (
              <span className="ml-2 text-xs font-normal text-emerald-400 inline-flex items-center gap-1">
                <Shield className="w-3 h-3" /> 관리자
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">접근 가능한 프로젝트 선택</p>
        </div>
        {!user.is_admin && (
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              전체 선택
            </button>
            <span className="text-gray-700">·</span>
            <button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              전체 해제
            </button>
          </div>
        )}
      </div>

      {/* 프로젝트 목록 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : user.is_admin ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="w-8 h-8 text-emerald-700 mb-3" />
            <p className="text-sm text-gray-400">관리자는 모든 프로젝트에 자동으로 접근할 수 있습니다</p>
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-10">등록된 프로젝트가 없습니다</p>
        ) : (
          <div className="space-y-1.5">
            {projects.map((project) => {
              const checked = checkedIds.has(project.id);
              return (
                <button
                  key={project.id}
                  onClick={() => toggle(project.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left',
                    checked
                      ? 'border-emerald-600/50 bg-emerald-900/20'
                      : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/40'
                  )}
                >
                  {/* 체크박스 */}
                  <div className={clsx(
                    'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                    checked ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600 bg-transparent'
                  )}>
                    {checked && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>

                  <FolderOpen className={clsx(
                    'w-4 h-4 flex-shrink-0',
                    checked ? 'text-emerald-400' : 'text-gray-600'
                  )} />

                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm font-medium truncate', checked ? 'text-gray-200' : 'text-gray-400')}>
                      {project.name}
                    </p>
                    {project.client_name && (
                      <p className="text-xs text-gray-600 truncate">{project.client_name}</p>
                    )}
                  </div>

                  <span className={clsx(
                    'text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                    project.status === 'active'
                      ? 'text-green-400 bg-green-900/30'
                      : 'text-gray-600 bg-gray-800'
                  )}>
                    {project.status === 'active' ? '진행' : project.status === 'completed' ? '완료' : '보관'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 저장 버튼 */}
      {!user.is_admin && (
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-800/60">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm px-6 py-2"
            >
              {saving ? (
                <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> 저장 중...</span>
              ) : '권한 저장'}
            </button>
            {saved && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> 저장됨
              </span>
            )}
            <span className="ml-auto text-xs text-gray-600">
              {checkedIds.size}개 프로젝트 선택됨
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
