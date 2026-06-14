'use client';
import React, { useState } from 'react';
import { X, ChevronDown, Puzzle, Plus } from 'lucide-react';
import { toast } from 'sonner';

const agents = [
  { id: 'agent-sel-fa1', label: 'frontend-app / agent-1' },
  { id: 'agent-sel-fa2', label: 'frontend-app / agent-2' },
  { id: 'agent-sel-api1', label: 'api-service / agent-1' },
  { id: 'agent-sel-api2', label: 'api-service / agent-2' },
  { id: 'agent-sel-ml1', label: 'ml-pipeline / agent-1' },
  { id: 'agent-sel-docs1', label: 'docs-generator / agent-1' },
];

const assignedByAgent: Record<string, { id: string; name: string }[]> = {
  'agent-sel-fa1': [
    { id: 'asgn-sw', name: 'Software Engineering Core' },
    { id: 'asgn-cr', name: 'Code Review Expert' },
    { id: 'asgn-rc', name: 'React Component Builder' },
  ],
  'agent-sel-fa2': [
    { id: 'asgn-tg', name: 'Test Generator Pro' },
    { id: 'asgn-rc2', name: 'React Component Builder' },
  ],
  'agent-sel-api1': [
    { id: 'asgn-dbo', name: 'Database Optimizer' },
    { id: 'asgn-sec', name: 'Security Auditor' },
    { id: 'asgn-api', name: 'API Designer' },
  ],
  'agent-sel-api2': [{ id: 'asgn-do', name: 'DevOps Pipeline' }],
  'agent-sel-ml1': [],
  'agent-sel-docs1': [{ id: 'asgn-dw', name: 'Documentation Writer' }],
};

const MAX_SKILLS = 10;

export default function SkillAssignmentPanel() {
  const [selectedAgent, setSelectedAgent] = useState('agent-sel-fa1');
  const [skills, setSkills] =
    useState<Record<string, { id: string; name: string }[]>>(assignedByAgent);

  const currentSkills = skills[selectedAgent] ?? [];

  const removeSkill = (skillId: string) => {
    setSkills((prev) => ({
      ...prev,
      [selectedAgent]: prev[selectedAgent].filter((s) => s.id !== skillId),
    }));
    toast.info('Skill removed from agent');
  };

  return (
    <div
      className="w-64 flex-shrink-0 border-l border-subtle flex flex-col overflow-hidden"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <Puzzle size={13} className="text-primary" />
          <span className="text-sm font-medium text-foreground">Assign Skills</span>
        </div>
        <p className="text-2xs text-muted-foreground mt-0.5">
          Select an agent to manage its skills
        </p>
      </div>

      {/* Agent Selector */}
      <div className="px-3 py-2.5 border-b border-subtle flex-shrink-0">
        <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
          Target Agent
        </label>
        <div className="relative">
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full bg-input border border-subtle rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-ring appearance-none cursor-pointer pr-7"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={11}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        </div>
      </div>

      {/* Assigned Skills */}
      <div className="flex-1 overflow-y-auto min-h-0 py-2">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
            Installed Skills
          </span>
          <span
            className={`text-2xs font-mono px-1.5 py-0.5 rounded ${
              currentSkills.length >= MAX_SKILLS
                ? 'bg-error/10 text-error'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {currentSkills.length}/{MAX_SKILLS}
          </span>
        </div>

        {currentSkills.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <Puzzle size={24} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No skills installed</p>
            <p className="text-2xs text-muted-foreground/60 mt-1">
              Add skills from the marketplace to extend this agent&apos;s capabilities
            </p>
          </div>
        ) : (
          <div className="px-2 flex flex-col gap-1">
            {currentSkills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-hover group"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-xs text-foreground flex-1 truncate">{skill.name}</span>
                <button
                  onClick={() => removeSkill(skill.id)}
                  className="text-muted-foreground hover:text-error transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  title="Remove skill"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-subtle px-3 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="h-1 flex-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(currentSkills.length / MAX_SKILLS) * 100}%` }}
            />
          </div>
          <span className="text-2xs text-muted-foreground font-mono flex-shrink-0">
            {MAX_SKILLS - currentSkills.length} slots free
          </span>
        </div>
        <button
          className="w-full btn-primary text-xs justify-center"
          onClick={() =>
            toast.success(`Skills saved for ${agents.find((a) => a.id === selectedAgent)?.label}`)
          }
        >
          <Plus size={11} />
          Save Configuration
        </button>
      </div>
    </div>
  );
}
