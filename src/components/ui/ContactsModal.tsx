'use client';

import { useState, useEffect } from 'react';
import { X, Phone, Copy, Check, Pencil, Save, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import type { User } from '@/lib/types';
import UserBadge from './UserBadge';

interface ContactsModalProps {
  onClose: () => void;
  isAdmin?: boolean;
}

interface EditState {
  display_name: string;
  phone: string;
}

export default function ContactsModal({ onClose, isAdmin }: ContactsModalProps) {
  const [members, setMembers]   = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ display_name: '', phone: '' });
  const [saving,   setSaving]   = useState(false);
  const [copied,   setCopied]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    authApi.listUsers()
      .then(users => setMembers(users.filter(u => u.is_active)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditState({
      display_name: user.display_name ?? '',
      phone: user.phone ?? '',
    });
  }

  async function saveEdit(userId: number) {
    setSaving(true);
    try {
      const updated = await authApi.updateUserProfile(userId, {
        display_name: editState.display_name || undefined,
        phone: editState.phone || undefined,
      });
      setMembers(prev => prev.map(m => m.id === userId ? updated : m));
      setEditingId(null);
    } catch {}
    setSaving(false);
  }

  async function copyPhone(phone: string) {
    await navigator.clipboard.writeText(phone);
    setCopied(phone);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-100">팀 연락처</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-brand animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-center text-sm text-gray-600 py-10">팀원이 없습니다</p>
          ) : (
            members.map(member => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 bg-gray-800/40 border border-gray-700/50 rounded-xl"
              >
                {/* Avatar */}
                <UserBadge
                  username={member.username}
                  displayName={member.display_name}
                  size="md"
                  showName={false}
                />

                {/* Info / Edit */}
                {editingId === member.id ? (
                  <div className="flex-1 space-y-1.5">
                    <input
                      value={editState.display_name}
                      onChange={e => setEditState(s => ({ ...s, display_name: e.target.value }))}
                      placeholder="표시 이름"
                      className="w-full bg-gray-700/60 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand/60"
                    />
                    <input
                      value={editState.phone}
                      onChange={e => setEditState(s => ({ ...s, phone: e.target.value }))}
                      placeholder="연락처 (010-0000-0000)"
                      type="tel"
                      className="w-full bg-gray-700/60 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand/60"
                    />
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">
                      {member.display_name || member.username}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-xs text-gray-500">@{member.username}</p>
                      {member.is_admin && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-brand/20 text-brand font-semibold">관리자</span>
                      )}
                    </div>
                    {member.phone ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Phone className="w-3 h-3 text-gray-500 flex-shrink-0" />
                        <span className="text-xs text-gray-400">{member.phone}</span>
                        <button
                          onClick={() => copyPhone(member.phone!)}
                          className="p-0.5 rounded text-gray-600 hover:text-gray-300 transition-colors"
                          title="복사"
                        >
                          {copied === member.phone
                            ? <Check className="w-3 h-3 text-emerald-400" />
                            : <Copy className="w-3 h-3" />
                          }
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600 mt-1">연락처 없음</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                {isAdmin && (
                  editingId === member.id ? (
                    <button
                      onClick={() => saveEdit(member.id)}
                      disabled={saving}
                      className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10 transition-colors flex-shrink-0"
                      title="저장"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(member)}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-700 transition-colors flex-shrink-0"
                      title="편집"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
