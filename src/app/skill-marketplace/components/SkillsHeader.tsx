'use client';
import React, { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

const filterChips = [
  { id: 'chip-all', label: 'All' },
  { id: 'chip-top', label: '⭐ Top Rated' },
  { id: 'chip-trending', label: '🔥 Trending' },
  { id: 'chip-new', label: '✨ New' },
  { id: 'chip-verified', label: '✓ Verified' },
];

const sortOptions = [
  { id: 'sort-stars', label: 'Stars' },
  { id: 'sort-reviews', label: 'Reviews' },
  { id: 'sort-recent', label: 'Recent' },
  { id: 'sort-relevance', label: 'Relevance' },
];

export default function SkillsHeader() {
  const [activeChip, setActiveChip] = useState('chip-all');
  const [sortBy, setSortBy] = useState('sort-stars');
  const [search, setSearch] = useState('');

  return (
    <div className="border-b border-subtle flex-shrink-0">
      {/* Title row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Skills Marketplace</h1>
            <div className="flex items-center gap-1 text-muted-foreground">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-label="GitHub"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="text-xs">Powered by GitHub</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Search and assign skills to your agents to extend their capabilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">247 skills found</span>
        </div>
      </div>
      {/* Search + Filters */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <div className="relative flex-1 max-w-lg">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e?.target?.value)}
            placeholder="Search skills... (e.g. 'software engineering', 'testing', 'devops')"
            className="w-full bg-input border border-subtle rounded pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-1">
          {filterChips?.map((chip) => (
            <button
              key={chip?.id}
              onClick={() => setActiveChip(chip?.id)}
              className={`px-2.5 py-1 text-xs rounded border transition-all duration-150 ${
                activeChip === chip?.id
                  ? 'bg-primary/10 text-primary border-primary/30 font-medium'
                  : 'text-muted-foreground border-subtle hover:text-foreground hover:bg-hover'
              }`}
            >
              {chip?.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <SlidersHorizontal size={12} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e?.target?.value)}
            className="bg-input border border-subtle rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-ring cursor-pointer"
          >
            {sortOptions?.map((opt) => (
              <option key={opt?.id} value={opt?.id}>
                {opt?.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
