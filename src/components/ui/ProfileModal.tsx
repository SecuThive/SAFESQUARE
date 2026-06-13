'use client';

import { useState, useEffect } from 'react';
import { X, Save, User as UserIcon, Phone, AtSign, Loader2 } from 'lucide-react';
import { authApi, getAuthHeaders } from '@/lib/api';
import type { User } from '@/lib/types';
import UserBadge from './UserBadge';

interface ProfileModalProps {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const [user,        setUser]        = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone,       setPhone]       = useState('');
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    authApi.me()
      .then(u => {
        setUser(u);
        setDisplayName(u.display_name ?? '');
        setPhone(u.phone ?? '');
      })
      .catch(() => setError('프로필을 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await authApi.updateProfile({
        display_name: displayName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message ?? '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-100">내 프로필</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-brand animate-spin" />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* 아바타 + 계정명 */}
            <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
              {user && (
                <UserBadge
                  username={user.display_name || user.username}
                  size="md"
                  showName={false}
                />
              )}
              <div>
                <p className="text-sm font-semibold text-gray-100">
                  {user?.display_name || user?.username}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  @{user?.username}
                  {user?.is_admin && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-brand/20 text-brand font-semibold">
                      관리자
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* 표시 이름 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5" />
                표시 이름
              </label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={user?.username}
                className="w-full bg-gray-800/60 border border-gray-700/80 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand/60 transition-all"
              />
              <p className="text-[11px] text-gray-600">
                할 일 카드, 댓글 등에 표시되는 이름입니다. 비워두면 계정 아이디가 사용됩니다.
              </p>
            </div>

            {/* 연락처 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                연락처
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                type="tel"
                className="w-full bg-gray-800/60 border border-gray-700/80 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand/60 transition-all"
              />
            </div>

            {/* 계정 아이디 (읽기 전용) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5" />
                계정 아이디
              </label>
              <input
                value={user?.username ?? ''}
                readOnly
                className="w-full bg-gray-800/30 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* 저장 버튼 */}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all">
                닫기
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 transition-all">
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중…</>
                  : saved
                  ? <><Save className="w-4 h-4" /> 저장됨 ✓</>
                  : <><Save className="w-4 h-4" /> 저장</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
