'use client';
import React, { useState } from 'react';
import { Star, Users, GitFork, Plus, Eye, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Skill {
  id: string;
  name: string;
  author: string;
  description: string;
  stars: string;
  users: string;
  forks: string;
  rating: number;
  tags: string[];
  verified: boolean;
  installed?: boolean;
}

const skills: Skill[] = [
  {
    id: 'skill-sw-eng',
    name: 'Software Engineering Core',
    author: '@anthropics',
    description:
      'Full-stack development skills including code review, refactoring, testing, and documentation. Works with any language or framework.',
    stars: '4.9',
    users: '2.4k',
    forks: '312',
    rating: 4.9,
    tags: ['coding', 'review', 'tests'],
    verified: true,
    installed: true,
  },
  {
    id: 'skill-code-review',
    name: 'Code Review Expert',
    author: '@openai-skills',
    description:
      'Automated code review with security scanning, best practices enforcement, and detailed feedback with inline suggestions.',
    stars: '4.8',
    users: '1.8k',
    forks: '245',
    rating: 4.8,
    tags: ['review', 'security', 'quality'],
    verified: true,
    installed: true,
  },
  {
    id: 'skill-test-gen',
    name: 'Test Generator Pro',
    author: '@testing-guild',
    description:
      'Generate comprehensive unit, integration and end-to-end tests with high coverage. Supports Jest, Pytest, Vitest, and Cypress.',
    stars: '4.7',
    users: '1.2k',
    forks: '189',
    rating: 4.7,
    tags: ['testing', 'jest', 'pytest'],
    verified: true,
  },
  {
    id: 'skill-docs',
    name: 'Documentation Writer',
    author: '@docs-team',
    description:
      'Auto-generate API docs, README files, inline comments, and changelog entries. Supports OpenAPI, JSDoc, and Docstring formats.',
    stars: '4.6',
    users: '987',
    forks: '134',
    rating: 4.6,
    tags: ['docs', 'markdown', 'api'],
    verified: false,
  },
  {
    id: 'skill-devops',
    name: 'DevOps Pipeline',
    author: '@devops-skills',
    description:
      'CI/CD pipeline creation, Docker containerization, Kubernetes config generation, and GitHub Actions workflow setup.',
    stars: '4.8',
    users: '1.5k',
    forks: '201',
    rating: 4.8,
    tags: ['devops', 'docker', 'k8s'],
    verified: true,
  },
  {
    id: 'skill-security',
    name: 'Security Auditor',
    author: '@security-lab',
    description:
      'OWASP Top 10 scanning, vulnerability detection, dependency audit, and automated security fix suggestions for web applications.',
    stars: '4.9',
    users: '3.1k',
    forks: '421',
    rating: 4.9,
    tags: ['security', 'owasp', 'audit'],
    verified: true,
  },
  {
    id: 'skill-db',
    name: 'Database Optimizer',
    author: '@db-experts',
    description:
      'Query optimization, composite index creation, schema design review, and N+1 query detection for PostgreSQL, MySQL, and SQLite.',
    stars: '4.5',
    users: '876',
    forks: '112',
    rating: 4.5,
    tags: ['sql', 'postgres', 'optimization'],
    verified: false,
  },
  {
    id: 'skill-react',
    name: 'React Component Builder',
    author: '@frontend-guild',
    description:
      'Build accessible, performant React components with TypeScript, Storybook stories, and ARIA compliance built in.',
    stars: '4.7',
    users: '1.1k',
    forks: '156',
    rating: 4.7,
    tags: ['react', 'typescript', 'a11y'],
    verified: true,
    installed: true,
  },
  {
    id: 'skill-api',
    name: 'API Designer',
    author: '@api-craft',
    description:
      'RESTful and GraphQL API design with OpenAPI 3.0 spec generation, Postman collection export, and versioning strategy.',
    stars: '4.6',
    users: '743',
    forks: '98',
    rating: 4.6,
    tags: ['api', 'rest', 'graphql'],
    verified: false,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={`star-${i}`}
          size={10}
          className={i <= Math.floor(rating) ? 'text-coded fill-coded' : 'text-muted-foreground'}
        />
      ))}
    </div>
  );
}

export default function SkillsGrid() {
  const [installedSkills, setInstalledSkills] = useState<Set<string>>(
    new Set(skills.filter((s) => s.installed).map((s) => s.id))
  );

  const handleAddSkill = (skill: Skill) => {
    if (installedSkills.has(skill.id)) {
      setInstalledSkills((prev) => {
        const next = new Set(prev);
        next.delete(skill.id);
        return next;
      });
      toast.info(`Removed "${skill.name}" from agent`);
    } else {
      setInstalledSkills((prev) => new Set([...prev, skill.id]));
      toast.success(`Added "${skill.name}" to frontend-app/agent-1`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-3 pt-3">
      {skills.map((skill) => {
        const isInstalled = installedSkills.has(skill.id);
        return (
          <div
            key={skill.id}
            className="card-hover rounded border border-subtle bg-card flex flex-col"
          >
            {/* Card Header */}
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground leading-tight">
                      {skill.name}
                    </h3>
                    {skill.verified && (
                      <CheckCircle2 size={11} className="text-accent flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs font-mono text-accent mt-0.5">{skill.author}</p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-3 border-t border-subtle" />

            {/* Description */}
            <div className="px-3 py-2 flex-1">
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {skill.description}
              </p>
            </div>

            {/* Stats */}
            <div className="px-3 pb-2 flex items-center gap-3">
              <div className="flex items-center gap-1">
                <StarRating rating={skill.rating} />
                <span className="text-xs font-mono text-coded font-semibold">{skill.stars}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users size={10} />
                <span className="text-2xs font-mono">{skill.users}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <GitFork size={10} />
                <span className="text-2xs font-mono">{skill.forks}</span>
              </div>
            </div>

            {/* Tags */}
            <div className="px-3 pb-2 flex flex-wrap gap-1">
              {skill.tags.map((tag) => (
                <span key={`${skill.id}-tag-${tag}`} className="tag-chip">
                  {tag}
                </span>
              ))}
            </div>

            {/* Divider */}
            <div className="mx-3 border-t border-subtle" />

            {/* Actions */}
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                onClick={() => handleAddSkill(skill)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all duration-150 border ${
                  isInstalled
                    ? 'bg-primary/10 text-primary border-primary/30 hover:bg-error/10 hover:text-error hover:border-error/30'
                    : 'bg-transparent text-muted-foreground border-subtle hover:bg-primary/10 hover:text-primary hover:border-primary/30'
                }`}
              >
                {isInstalled ? (
                  <>
                    <CheckCircle2 size={11} />
                    Added
                  </>
                ) : (
                  <>
                    <Plus size={11} />
                    Add to Agent
                  </>
                )}
              </button>
              <button
                className="btn-ghost text-xs px-2 py-1.5"
                onClick={() => toast.info(`Previewing ${skill.name}`)}
              >
                <Eye size={11} />
                Preview
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
