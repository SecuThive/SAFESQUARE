'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, BookOpen } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { confirm } from '@/lib/confirm';

interface Solution {
  id: number;
  name: string;
  description: string | null;
  guide_count: number;
}

export default function SolutionsSettingsPage() {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSolution, setEditingSolution] = useState<Solution | null>(null);

  useEffect(() => {
    loadSolutions();
  }, []);

  const loadSolutions = async () => {
    try {
      const res = await fetch('/api/solutions');
      const data = await res.json();
      setSolutions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSolution = async (id: number) => {
    if (!await confirm('이 솔루션을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/solutions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        alert(error.detail);
        return;
      }
      await loadSolutions();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto bg-surface">
        <div className="max-w-6xl mx-auto p-4 sm:p-8">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-gray-100">Solutions</h1>
              <p className="text-sm text-gray-500 mt-1">Manage solution templates</p>
            </div>
            <button onClick={() => { setEditingSolution(null); setShowModal(true); }} className="btn-primary">
              <Plus className="w-4 h-4" />
              New Solution
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {solutions.map((sol) => (
              <div key={sol.id} className="bg-surface-overlay border border-gray-800 rounded-lg p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-100">{sol.name}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingSolution(sol); setShowModal(true); }} className="p-1.5 text-gray-500 hover:text-brand rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteSolution(sol.id)} className="p-1.5 text-gray-500 hover:text-accent-red rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-4">{sol.description || 'No description'}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <BookOpen className="w-3.5 h-3.5" />
                  {sol.guide_count} guides
                </div>
              </div>
            ))}
          </div>
          {solutions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No solutions yet</p>
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Create First Solution
              </button>
            </div>
          )}
        </div>
      </div>
      {showModal && <SolutionModal solution={editingSolution} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); loadSolutions(); }} />}
    </div>
  );
}

function SolutionModal({ solution, onClose, onSuccess }: { solution: Solution | null; onClose: () => void; onSuccess: () => void; }) {
  const [formData, setFormData] = useState({ name: solution?.name || '', description: solution?.description || '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = solution ? `/api/solutions/${solution.id}` : '/api/solutions';
      const method = solution ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (!res.ok) { const error = await res.json(); alert(error.detail); return; }
      onSuccess();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised border border-gray-800 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">{solution ? 'Edit Solution' : 'New Solution'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input w-full" placeholder="e.g. GrippinTower OTP" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input w-full" rows={3} placeholder="Solution description" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
