# Rocket Frontend Inventory

The original Rocket-generated frontend was a Next 15 React app named AgentFlow.

## Structure Found

- `src/app/page.tsx`: workspace dashboard composed from KPI, header, agent grid, and activity feed.
- `src/app/pipeline-view`: static pipeline overview with stats, table, and detail panel.
- `src/app/skill-marketplace`: static skill marketplace and assignment panel.
- `src/components/AppLayout.tsx`: two-pane shell with collapsible left sidebar and topbar.
- `src/components/Sidebar.tsx`: IDE-style navigation, workspace tree, agent status dots, collapse affordance.
- `src/components/Topbar.tsx`: breadcrumb, search field, notifications, run-all button, user menu.
- `src/styles/tailwind.css`: main design tokens and microinteraction utilities.

## Preserved Visual Direction

- Dark app shell: `#141414`, `#111111`, `#1a1a1a`.
- Thin borders: `#2a2a2a`.
- Primary green: `#4ade80`.
- Accent blue: `#60a5fa`.
- Error red: `#ef4444`.
- Coded amber: `#f59e0b`.
- 6px radius, compact 11-14px type, mono tags, dense dashboard cards.
- Hover states, selected left border, subtle glows, pulse indicators, focus rings, and pressed-button scale.

## Rebuild Decision

The old app was static browser UI with hardcoded demo workspaces, pipelines, skills, and toasts. AgentBoard keeps the visual language but uses a new Vite/Tauri entrypoint:

- `src/main.tsx`
- `src/App.tsx`
- `src/lib/*`
- `src-tauri/*`

The old Next files are left as visual reference but are not part of the desktop TypeScript build.
