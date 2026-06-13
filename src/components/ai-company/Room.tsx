'use client';

import AgentAvatar from './AgentAvatar';
import type { Agent } from './mockData';

interface Props {
  id: string;
  label: string;
  icon: string;
  color: string;
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (agent: Agent) => void;
  furniture?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function Room({
  label, icon, color, agents, selectedAgentId, onSelectAgent,
  furniture, children, className = '', style,
}: Props) {
  return (
    <div
      className={`relative rounded-xl border-2 p-2 flex flex-col gap-1 overflow-visible ${className}`}
      style={{
        background: color + '08',
        borderColor: color + '40',
        ...style,
      }}
    >
      {/* room label */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-sm">{icon}</span>
        <span
          className="font-semibold tracking-tight"
          style={{ fontSize: '10px', color: color }}
        >
          {label}
        </span>
      </div>

      {/* furniture layer */}
      {furniture && (
        <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden opacity-60">
          {furniture}
        </div>
      )}

      {/* agents */}
      <div className="flex flex-wrap gap-2 items-end justify-start z-10 relative pt-1">
        {agents.map((agent) => (
          <AgentAvatar
            key={agent.id}
            agent={agent}
            onSelect={onSelectAgent}
            selected={selectedAgentId === agent.id}
          />
        ))}
      </div>

      {/* extra children (e.g. status badges) */}
      {children}
    </div>
  );
}
