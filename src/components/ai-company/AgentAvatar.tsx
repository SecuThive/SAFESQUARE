'use client';

import { useState } from 'react';
import type { Agent } from './mockData';

interface Props {
  agent: Agent;
  onSelect: (agent: Agent) => void;
  selected: boolean;
  size?: 'sm' | 'md';
}

const statusColors: Record<string, string> = {
  online: 'bg-emerald-400',
  busy: 'bg-amber-400',
  away: 'bg-gray-400',
};

export default function AgentAvatar({ agent, onSelect, selected, size = 'md' }: Props) {
  const [hovered, setHovered] = useState(false);
  const sz = size === 'sm' ? 'w-9 h-9 text-base' : 'w-11 h-11 text-xl';

  return (
    <div className="flex flex-col items-center gap-0.5 cursor-pointer select-none" style={{ position: 'relative' }}>
      {/* speech bubble */}
      {(hovered || selected) && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-white border border-violet-200 rounded-xl px-2.5 py-1 shadow-md z-20 pointer-events-none"
          style={{ fontSize: '10px' }}
        >
          {agent.message}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-violet-200 rotate-45" />
        </div>
      )}

      {/* avatar circle */}
      <button
        onClick={() => onSelect(agent)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`${sz} rounded-full flex items-center justify-center shadow-md transition-all duration-200 border-2 relative
          ${selected ? 'border-violet-500 scale-110 shadow-violet-300' : 'border-white hover:scale-110'}
        `}
        style={{ background: agent.color + '22', borderColor: selected ? '#7C3AED' : agent.color + '66' }}
        title={agent.name}
      >
        <span>{agent.emoji}</span>
        {/* status dot */}
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${statusColors[agent.status]}`}
        />
      </button>

      {/* name label */}
      <span
        className="text-center font-medium leading-none"
        style={{ fontSize: '9px', color: '#374151', maxWidth: '52px', lineHeight: '1.2' }}
      >
        {agent.name.replace(' AI', '')}
      </span>
    </div>
  );
}
