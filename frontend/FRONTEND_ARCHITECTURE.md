# CDAGS AI-Agents Frontend — Architecture & Developer Reference

**Project:** CDAGS AI-Agents: OT-IT Convergence & Cybersecurity  
**Stack:** React 19 · TypeScript · Vite 8 · Vanilla CSS  
**Dev port:** `6173` (strict — fails if occupied)  
**Backend proxy:** `/api/*` → `http://localhost:8000`  
**Last updated:** 2026-06-12

---

## 1. Purpose

This is the Single Page Application (SPA) frontend for the **CDAGS Mixture-of-Experts (MoE) AI-Agent Framework**. It provides a dashboard UI for:

- Authenticating as a framework operator
- Browsing the catalogue of Expert AI Agents deployed in an OT (Operational Technology) environment
- Selecting agents and observing live system log events in a real-time console window
- Toggling between light and dark visual themes

---

## 2. Directory Structure

```
frontend/
├── index.html                      # HTML shell — mounts #root, loads /src/main.tsx
├── package.json                    # NPM dependencies and scripts
├── tsconfig.json                   # Root TypeScript config (includes vite/client types)
├── tsconfig.app.json               # Vite build TypeScript config
├── tsconfig.node.json              # Node/Vite config TypeScript config
├── vite.config.ts                  # Vite dev server — port 6173, /api proxy to :8000
├── eslint.config.js                # ESLint flat config
├── public/
│   ├── favicon.svg                 # Browser tab icon
│   ├── icons.svg                   # SVG sprite sheet
│   └── bg-dark-hex.jpg             # Dark mode hex-mesh texture asset (available, not active)
└── src/
    ├── main.tsx                    # React DOM root — renders <App /> in StrictMode
    ├── App.tsx                     # Root component — context wiring + auth gate
    ├── vite-env.d.ts               # Vite client type reference (enables CSS/asset imports)
    ├── types/
    │   └── index.ts                # All shared TypeScript interfaces
    ├── context/
    │   ├── AuthContext.tsx         # Session state, login, logout
    │   ├── AgentContext.tsx        # Agent list, active selection, log polling
    │   └── ThemeContext.tsx        # Light/dark theme toggle
    ├── components/
    │   ├── Layout/
    │   │   ├── Banner.tsx          # Top header: logo, title, user, clock, theme toggle
    │   │   ├── Sidebar.tsx         # Left panel: agent list with active highlight
    │   │   ├── LogPanel.tsx        # Bottom console: live log stream
    │   │   └── Footer.tsx          # Bottom strip: "Powered by CDAGS © 2026"
    │   ├── Agent/
    │   │   ├── AgentGrid.tsx       # CSS grid container for all agent tiles
    │   │   └── AgentTile.tsx       # Individual agent card with per-agent color border
    │   └── Auth/
    │       └── LoginForm.tsx       # Login overlay card
    └── styles/
        ├── variables.css           # Design tokens + light-theme / dark-theme CSS variables
        ├── global.css              # CSS reset, body baseline, imports all stylesheets
        ├── layouts.css             # Page grid structure (banner/sidebar/main/logs/footer)
        └── components.css          # Component-level classes (tiles, buttons, forms, sidebar)
```

---

## 3. Application Entry & Root Component

### `src/main.tsx`
Mounts the React tree into `<div id="root">` using `ReactDOM.createRoot`. Wraps the app in `React.StrictMode`.

### `src/App.tsx`
The root component. Wires up the three context providers and implements the authentication gate.

```
<ThemeProvider>               ← must be outermost (controls body class)
  <AuthProvider>              ← session state available to all children
    <AuthCheckGate />         ← renders LoginForm or DashboardShell
  </AuthProvider>
</ThemeProvider>
```

**`AuthCheckGate`** — reads `session` from `AuthContext`. If `null`, renders `<LoginForm />`; otherwise renders `<DashboardShell />`.

**`DashboardShell`** — wraps the main layout in `<AgentProvider>` and composes the full page grid:

```
<AgentProvider>
  <div className="app-container">   ← CSS grid root
    <Banner />
    <Sidebar />
    <main className="main-content">
      <h2>AI-Agents: OT Operational Functions</h2>
      <AgentGrid />
    </main>
    <LogPanel />
    <Footer />
  </div>
</AgentProvider>
```

---

## 4. TypeScript Types (`src/types/index.ts`)

| Interface | Fields | Purpose |
|-----------|--------|---------|
| `UserSession` | `id`, `token`, `username`, `role` | Stored in `localStorage` after login |
| `SubAgent` | `id`, `name`, `description?`, `group_type`, `created_at` | CAG or SAG sub-agent record |
| `ExpertAgent` | `id`, `name`, `description?`, `color_theme`, `is_active`, `created_at`, `specific_sub_agents` | Expert agent with its SAG sub-agents |
| `SystemLog` | `id`, `created_at`, `level`, `source`, `message`, `metadata_json?` | One log entry from the backend |

> `specific_sub_agents` maps to the backend `ExpertAgentResponse.specific_sub_agents` field — SAG sub-agents only. CAG sub-agents are implicit and not embedded.

---

## 5. Context Layer (`src/context/`)

### `AuthContext.tsx`

| Export | Type | Description |
|--------|------|-------------|
| `AuthProvider` | Component | Provides session state to the tree |
| `useAuth()` | Hook | Returns `{ session, login, logout }` |

**Behaviour:**
- On mount, restores session from `localStorage` (key: `session`).
- `login(username, password)` — POSTs to `/api/auth/login`, stores the `UserSession` in state and `localStorage` on success, returns `boolean`.
- `logout()` — clears state and `localStorage`.

> **Note:** The JWT token is stored in `localStorage` but is not yet attached as a `Bearer` header on subsequent API calls. This is a known gap for Iteration 2.

---

### `AgentContext.tsx`

| Export | Type | Description |
|--------|------|-------------|
| `AgentProvider` | Component | Provides agent and log state to the tree |
| `useAgents()` | Hook | Returns `{ agents, agentsLoading, activeAgentId, logs, selectAgent, fetchLogs }` |

**Behaviour:**
- On mount, fetches all active agents from `GET /api/agents/`.
- Polls `GET /api/logs/` every **2 seconds** to keep the log console updated.
- `selectAgent(agentId)` — sets `activeAgentId` locally, POSTs to `/api/agents/{agentId}/select` to write a `USER` event to the backend log, then immediately re-fetches logs.

---

### `ThemeContext.tsx`

| Export | Type | Description |
|--------|------|-------------|
| `ThemeProvider` | Component | Manages light/dark theme |
| `useTheme()` | Hook | Returns `{ theme, toggleTheme }` |

**Behaviour:**
- Persists the selected theme to `localStorage` (key: `theme`).
- Applies `body.light-theme` or `body.dark-theme` class on `document.body`, which activates the corresponding CSS variable block in `variables.css`.

---

## 6. Component Reference

### `Layout/Banner.tsx`
Top header bar spanning full width.

| Element | Detail |
|---------|--------|
| Logo badge | Circular `D` badge in `--active-highlight` blue |
| Title | **"CDAGS AI-Agents: OT-IT Convergence & Cybersecurity"** — `27px`, `fontWeight: 800`; "CDAGS" colored `#00f0ff` (neon blue) |
| User display | Shows `session.username` from `AuthContext` |
| Live clock | Updates every second; format `YYYY-MM-DD HH:mm:ss` |
| Theme toggle | ☀️ / 🌙 button — calls `toggleTheme()` from `ThemeContext` |
| Sign Out | Calls `logout()` from `AuthContext` |

---

### `Layout/Sidebar.tsx`
Left panel listing all Expert Agents fetched from the backend.

- Renders a `<ul>` of agent names.
- Each `<li>` has class `sidebar-item`; adds class `active` when `agent.id === activeAgentId`.
- Clicking an item calls `selectAgent(agent.id)` from `AgentContext`.
- Shows "Loading…" while `agentsLoading` is `true`; "No agents available." if the list is empty.

---

### `Agent/AgentGrid.tsx`
CSS grid container in the main content area.

- Renders one `<AgentTile>` per agent from `AgentContext`.
- Grid layout: `repeat(auto-fit, minmax(280px, 1fr))` with `20px` gap — defined in `components.css`.
- Passes `isActive` and `onClick` down to each tile.

---

### `Agent/AgentTile.tsx`
Individual agent card.

| Visual property | Source |
|-----------------|--------|
| Border color | `agent.color_theme` (per-agent hex from DB) — inline style |
| Active glow | `box-shadow: 0 0 16px <agent.color_theme>` when `isActive` |
| Active scale | `transform: scale(1.02)` when `isActive` |
| Opacity | `0.85` when inactive, `1.0` when active |
| Sub-agent count | Displays count of `agent.specific_sub_agents` |

Clicking calls the `onClick` prop → `selectAgent(agent.id)` in `AgentContext`.

---

### `Layout/LogPanel.tsx`
Bottom console window, fixed at `20vh` height.

- Reads `logs` from `AgentContext` (polled every 2 seconds from `GET /api/logs/`).
- API returns logs **newest-first**; the component reverses to **oldest-first** for display so the newest entry is always at the bottom.
- Auto-scrolls to the bottom ref on every log update so the most recent entry is always visible.
- Log level color mapping:

| Level | Color |
|-------|-------|
| `SUCCESS` | `var(--log-info)` (green) |
| `INFO` | `var(--log-text)` (white/grey) |
| `DEBUG` | `var(--text-tertiary)` (muted) |
| `WARNING` | `#fbbf24` (amber) |
| `ERROR` | `#f87171` (red) |

---

### `Auth/LoginForm.tsx`
Full-screen centered login card rendered when `session` is `null`.

- Submits `username` + `password` to `login()` from `AuthContext`.
- Displays inline error "Invalid username or password." on failure.
- Default credentials for Iteration 1: `admin` / `admin`.

---

### `Layout/Footer.tsx`
Thin strip at the very bottom: `"Powered by CDAGS © 2026"`.

---

## 7. Styling System (`src/styles/`)

All styles are **Vanilla CSS** — no CSS-in-JS, no Tailwind.

### Import chain (`global.css`)
```
global.css
  └── variables.css     ← design tokens (always loaded first)
  └── layouts.css       ← page grid structure
  └── components.css    ← component classes
```

---

### `variables.css` — Design Tokens

All tokens are scoped to `body.light-theme` or `body.dark-theme` to enable instant theme switching via the body class. Structural/layout tokens live in `:root`.

**`:root` tokens (theme-independent)**

| Token | Value | Used for |
|-------|-------|----------|
| `--font-family` | `'Inter', system-ui` | Body font |
| `--border-radius-lg` | `12px` | Cards, login form |
| `--border-radius-md` | `8px` | Inputs, sidebar items |
| `--border-radius-sm` | `4px` | Small elements |
| `--border-width-thick` | `3px` | Agent tile borders |
| `--transition-speed` | `0.25s` | All transitions |
| `--banner-height` | `70px` | Grid row 1 |
| `--footer-height` | `30px` | Grid row 4 |
| `--log-panel-height` | `20vh` | Grid row 3 |

**Theme-scoped tokens (light / dark)**

| Token | Light | Dark |
|-------|-------|------|
| `--bg-primary` | `#f8fafc` | `#0b0f19` |
| `--bg-secondary` | `#ffffff` | `#121824` |
| `--bg-tertiary` | `#f1f5f9` | `#1e293b` |
| `--text-primary` | `#0f172a` | `#f8fafc` |
| `--text-secondary` | `#475569` | `#cbd5e1` |
| `--text-tertiary` | `#64748b` | `#94a3b8` |
| `--border-color` | `#cbd5e1` | `#334155` |
| `--active-highlight` | `#3b82f6` | `#3b82f6` |
| `--active-highlight-bg` | `#eff6ff` | `rgba(59,130,246,0.15)` |
| `--log-bg` | `#0f172a` | `#05070a` |
| `--log-time` | `#38bdf8` | `#7dd3fc` |
| `--log-info` | `#34d399` | `#4ade80` |

---

### `layouts.css` — Page Grid

The entire viewport is a single CSS grid:

```
grid-template-rows:    70px  1fr  20vh  30px
grid-template-columns: 280px 1fr
grid-template-areas:
  "banner  banner"
  "sidebar main"
  "logs    logs"
  "footer  footer"
```

| Area | Class | Notes |
|------|-------|-------|
| `banner` | `.banner` | Full-width top bar |
| `sidebar` | `.sidebar` | Fixed 280px left panel, scrollable |
| `main` | `.main-content` | Flexible main area, scrollable |
| `logs` | `.log-panel` | Full-width bottom console, monospace font |
| `footer` | `.footer` | Full-width thin strip |

---

### `components.css` — Component Classes

Key classes:

| Class | Purpose |
|-------|---------|
| `.login-overlay` | Full-screen flex centred container |
| `.login-card` | 380px centered form card |
| `.form-input` | Styled text/password input |
| `.login-btn` | Blue submit button |
| `.sidebar-list` | Flex column list, no bullets |
| `.sidebar-item` | Clickable agent list row |
| `.sidebar-item.active` | Active highlight: `--active-highlight` color + `--active-highlight-bg` background |
| `.agent-grid` | `auto-fit minmax(280px,1fr)` grid |
| `.agent-tile` | Agent card — 120px height, centered flex, transitions |
| `.agent-tile:hover` | Lifts tile `translateY(-4px)` |
| `.agent-tile-title` | `16px`, `fontWeight: 700` |
| `.theme-toggle` | Circular icon button |

---

## 8. API Integration

All API calls are relative paths proxied by Vite to `http://localhost:8000`.

| Endpoint | Method | Called from | Purpose |
|----------|--------|-------------|---------|
| `/api/auth/login` | `POST` | `AuthContext.login()` | Authenticate user, receive JWT |
| `/api/agents/` | `GET` | `AgentContext` (on mount) | Fetch all active Expert Agents |
| `/api/agents/{id}/select` | `POST` | `AgentContext.selectAgent()` | Register agent selection, write USER log |
| `/api/logs/` | `GET` | `AgentContext` (every 2s) | Fetch recent system logs |

> **Known gap:** The JWT token is not yet sent as `Authorization: Bearer <token>` on `GET /api/agents/` or `GET /api/logs/`. Backend endpoints are currently unauthenticated. This must be addressed in Iteration 2.

---

## 9. Build & Development

### Prerequisites
- Node.js 18+
- Backend running on `http://localhost:8000`

### Commands

```bash
# Install dependencies
cd frontend
npm install

# Start development server (port 6173)
npm run dev

# Type-check without emitting
npx tsc --noEmit

# Production build
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

### Port Policy
Port `6173` is hardcoded and `strictPort: true` — the dev server will **fail to start** if the port is occupied. This is intentional for Zero Trust / AI-Security environments where a fixed port is required.

---

## 10. Known Gaps & Iteration 2 Targets

| # | Gap | Impact |
|---|-----|--------|
| 1 | JWT not attached to API requests | All agent/log endpoints are effectively unauthenticated |
| 2 | No agent execution interface | Agents are a display catalogue only — no dispatch or run capability |
| 3 | No `services/agent_engine` | CAG/SAG routing logic exists in the DB schema but is never enforced |
| 4 | Sub-agents not seeded | `expert_sub_agent_mapping` table is empty; sub-agent counts will show 0 |
| 5 | No test suite | No unit or integration tests for any frontend component |
| 6 | No error boundary | Unhandled render errors will crash the entire app silently |
| 7 | Log polling is unconditional | 2s polling runs even when the tab is backgrounded; use `visibilitychange` to pause |
