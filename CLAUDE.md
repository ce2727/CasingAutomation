# CLAUDE.md

> This file is continuously maintained. Update it whenever significant architectural changes, new patterns, or important conventions are introduced. Future sessions should read this file first to understand the project before making changes.

## Project Overview

**ProCase** — A professional toolkit for MBA case interview preparation. Two roles:
- **Caser (Host)**: Manages a case library, runs live sessions, controls exhibit reveals and timer
- **Casee (Participant)**: Joins sessions via peer ID, receives real-time exhibit reveals

Runs as both a web app (deployed on Vercel at `https://casingautomation.vercel.app`) and a standalone Electron desktop app.

---

## Strategic Goals

1. **Centralized case library** — Give MBA students a single place to store and organize all their case material.
2. **Search and filter across casebooks** — Support discovery across the wide array of business school casebooks that are updated annually.
3. **Seamless casing experience** — Maximize ease of use for both caser and casee during live sessions.
4. **Progress tracking** — Enable users to track their own case completion and performance over time.

### Stretch Goals
> These are desirable but may be limited by the infrastructure-free architectural constraint (see Technical Goals).

- **Club leadership dashboard** — Allow consulting club leadership to monitor individual member progress.
- **Shared review system** — Let users compare difficulty ratings and case quality across the community.

---

## Technical Goals

1. **Infrastructure-free** — The app must avoid any server-side infrastructure that would impose ongoing costs on users. All processing and storage must remain client-side or peer-to-peer. This constraint exists to ensure: zero ongoing cost, long-term sustainability across leadership transitions, and trivial redeployability by other clubs. Future maintainers should understand this is a deliberate tradeoff — it limits cross-device sync and real-time club dashboards, but keeps the app alive indefinitely without anyone paying a bill or managing a server.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 + TypeScript |
| Build Tool | Vite 8 (beta) |
| Desktop | Electron 40 |
| P2P Networking | PeerJS 1.5.5 (WebRTC DataConnections) |
| PDF Rendering | pdfjs-dist 5.x |
| PDF Manipulation | pdf-lib 1.17.1 |
| Local Storage | Dexie 4 (IndexedDB wrapper) |
| Icons | Lucide React |
| ID Generation | UUID |

---

## Project Structure

```
/
├── electron/
│   └── main.ts               # Electron main process (1200x800 window, no IPC)
├── src/
│   ├── components/
│   │   ├── AppLogo.tsx        # SVG brand logo (customizable size/color)
│   │   ├── CaseSlicer.tsx     # Case creation UI (432 lines, 2 phases: range + config)
│   │   └── PDFViewer.tsx      # Single-page canvas renderer with ResizeObserver
│   ├── services/
│   │   ├── LibraryService.ts  # Dexie-based case CRUD + import/export
│   │   ├── PdfService.ts      # PDF loading (pdfjs), slicing (pdf-lib), rendering
│   │   └── PeerService.ts     # PeerJS P2P connections, message protocol, caching
│   ├── App.tsx                # Main component + all sub-components (832 lines)
│   ├── main.tsx               # React entry point
│   ├── App.css                # All component styles (BEM-inspired, CSS variables)
│   └── index.css              # Global resets
├── public/
│   ├── desktop-icon.png       # Electron dock/taskbar icon
│   ├── monochrome-icon.svg    # Monochrome variant
│   └── casee.html             # (legacy/unused casee entry point)
├── scout_casebook.js          # Standalone Node utility: scan PDFs for case boundaries
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── eslint.config.js           # ESLint 9 flat config
```

---

## NPM Scripts

```bash
npm run dev            # Vite dev server with HMR (http://localhost:5173)
npm run build          # tsc + vite build → dist/ (web) + dist-electron/ (Electron)
npm run lint           # ESLint check
npm run preview        # Preview production build locally
npm run build:packages # Package desktop builds for macOS and Windows (or ./build-packages.sh)
npm run deploy:vercel  # Verify web build and publish to Vercel production (or ./deploy-vercel.sh)
```

No test runner is configured.

---

## Data Models

### `CasePackage`
```typescript
interface CasePackage {
  id: string;                  // UUID
  title: string;
  difficulty: number;          // 1–5
  caseType: CaseType;          // 'M&A' | 'Profitability' | 'Market Entry' |
                               // 'Opportunity Assessment' | 'Industry Analysis' |
                               // 'Growth Strategy' | 'Pricing' | 'Other'
  tags: string[];
  completed: boolean;
  pdfBlob: Blob;               // Raw PDF stored in IndexedDB
  pages: CasePageMetadata[];
  createdAt: number;           // Unix timestamp
  source?: string;             // e.g. "Wharton Consulting Club Casebook"
  sourceYear?: number;         // e.g. 2024
  timesGiven?: number;         // Auto-incremented when a 'given' HistoryEntry is created
  caseeOutcome?: 'completed' | 'observed' | null; // Set when a casee HistoryEntry is created
}

interface CasePageMetadata {
  pageIndex: number;           // 0-indexed
  title: string;               // Display name (e.g. "Exhibit A")
  isExhibit: boolean;          // Whether page is shareable with Casee
}
```

### `HistoryEntry`
Unified session log for both caserss and casees. Stored in a separate `history` Dexie table (not on `CasePackage`).
```typescript
type HistoryOutcome = 'given' | 'completed' | 'observed';

interface HistoryEntry {
  id: string;                  // UUID
  role: 'caser' | 'casee';
  date: number;                // Unix timestamp (ms)
  caseId?: string;             // Links to local CasePackage if it exists in library
  caseTitle: string;           // Always stored as fallback display value
  casebook?: string;           // Source casebook name, if known
  partnerName?: string;        // Who you were paired with
  durationSeconds: number;
  notes?: string;              // Caser only
  selfRating?: number;         // 1–5, caser's self-assessment of their delivery
  rating?: number;             // 1–5, casee's rating of their experience
  outcome: HistoryOutcome;     // 'given' for caser, 'completed'|'observed' for casee
}
```

### Dexie Schema
Current version: **v7**. Cases table indexed fields: `id`, `title`, `caseType`, `difficulty`, `completed`, `*tags`, `createdAt`. History table indexed fields: `id`, `role`, `date`, `caseId`, `outcome`.

Version history:
- v4: base schema
- v5: added `source`, `sourceYear`, `sessions` to `CasePackage`
- v6: added `timesGiven`, `caseeOutcome` to `CasePackage`
- v7: replaced `sessions[]` on `CasePackage` with a separate `history` table (`HistoryEntry`); existing sessions migrated automatically on upgrade

---

## Service Layer

### `LibraryService` (`src/services/LibraryService.ts`)
Singleton. All methods are async.

Key methods:
- `saveCase(pkg)` — Create/update case in IndexedDB
- `getCaseById(id)` — Fetch single case
- `getAllCases()` — Automatically cleans up duplicate case names via `deduplicateLibrary()`, returns all cases reverse-chronological
- `deduplicateLibrary()` — Prunes duplicate cases by normalized title, re-links orphaned history entries to surviving case
- `deleteCase(id)` / `clearLibrary()`
- `addHistoryEntry(entry)` — Write a `HistoryEntry`; also updates `timesGiven`/`caseeOutcome` on the linked `CasePackage` if `caseId` is set
- `getAllHistory()` — Fetch all history entries, newest first
- `getHistoryByCaseId(caseId)` — Fetch history for a specific case (used by per-case View History modal)
- `deleteHistoryEntry(id)` — Delete a single entry
- `exportCasePackage(id)` — Export as JSON (PDF → base64)
- `exportLibrary()` — Bulk JSON export
- `exportProgressCsv()` — Export per-case progress summary as CSV (for club reporting)
- `importData(jsonStr)` — Single or bulk JSON import (matches duplicates by case name and stomps existing cases in the library with new content)
- `importFromCsv(csvText, pdfBlob, onProgress)` — CSV + master PDF bulk import (matches duplicates by case name and stomps existing cases in the library with new content)

**CSV import format:**
```
Title, Type, Difficulty, StartPage, EndPage, Tags, PageMetadata
"Solar Strategy","Profitability",4,1,10,"energy;sustainability","Case Overview|false;Exhibit A|true"
```

---

### `PdfService` (`src/services/PdfService.ts`)
Singleton. Caches parsed documents by Blob size.

Key methods:
- `loadDocument(blob, cacheKey?)` — Parse PDF via pdfjs, returns `PDFDocumentProxy`
- `slicePdf(sourceBlob, startPage, endPage)` — Extract page range via pdf-lib (1-indexed), returns `Blob`
- `renderPage(pdfDoc, pageNumber, canvas, scale)` — Render to canvas (scale default: 1.5)
- `clearCache()` — Wipe document cache

---

### `PeerService` (`src/services/PeerService.ts`)
Singleton. Manages PeerJS connections. Max 5 simultaneous connections.

**Message protocol:**
```typescript
type MessageType = 'SESSION_INIT' | 'REVEAL_PAGE' | 'SYNC_STATE' | 'TIMER_SYNC' | 'SESSION_END' | 'PEER_INFO';

interface PeerMessage { type: MessageType; payload: any; }
```

| Message | Direction | Payload |
|---------|-----------|---------|
| `SESSION_INIT` | Host → Guests | `{ metadata: CasePackage, pdfBuffer: ArrayBuffer, revealedExhibits: [], caserName: string }` |
| `REVEAL_PAGE` | Host → Guests | `{ pageNumber: number, title: string, isRevealed: boolean }` |
| `TIMER_SYNC` | Host → Guests | `{ seconds: number, isActive: boolean }` |
| `SYNC_STATE` | — | Reserved/unused |
| `SESSION_END` | Host → Guests | `{}` | Signals session is ending; triggers casee post-session modal |
| `PEER_INFO` | Guest → Host | `{ name: string }` | Sent by Electron casee on connect to identify themselves |

**Key behaviors:**
- Late-joiner replay: caches `lastSessionInit`, `currentRevealedPages`, `lastTimerSync`
- Auto-reconnect on network drop (`peer.reconnect()`)
- Cleans up on tab close

Key methods: `init()`, `host()`, `join(hostId)`, `send(type, payload)`, `destroy()`, plus `onOpen`, `onError`, `onMessage`, `onConnectionCountChange` callbacks.

---

## Component Architecture

All components are in `App.tsx` (no external router). Navigation is state-driven via a `role` variable.

**State-driven navigation:**
```
role === null      → LandingPage (or NameSetupModal on first Electron launch)
role === 'caser'   → Library Dashboard or CaserSession (or HistoryPage)
role === 'casee'   → CaseeSession
```

URL param `?id=<peerId>` auto-populates the join field on LandingPage.

**User profile:**
- Name stored in `localStorage` under key `procase_user_name`
- Electron only: first launch shows `NameSetupModal`; name editable via User button in library header
- Web (casee guest): no name prompt; caser can type casee name manually in post-session modal
- Caser name sent in `SESSION_INIT` payload; casee name sent back via `PEER_INFO` message if on Electron

### Sub-components inside `App.tsx`
- **LandingPage** — Role selection; validates UUID from URL param
- **CaserSession** — Host view: all pages visible, reveal toggles, timer (Begin/Pause/Reset), peer ID sharing, connection count
- **CaseeSession** — Guest view: only revealed exhibits, auto-scroll to new reveals, wake lock, 20s connection timeout
- **Library Dashboard** — Case grid with filter/sort, bulk import/export

### `CaseSlicer.tsx` (432 lines)
Two-phase component:
1. **Range selection** — Choose start/end pages from master PDF
2. **Configuration** — Title, type, difficulty, tags; per-page title + exhibit toggle

### `PDFViewer.tsx` (90 lines)
- Renders one PDF page to `<canvas>`
- ResizeObserver (100ms debounce) auto-scales to container width
- Cancels stale render tasks on page change

---

## Styling Conventions

- **CSS variables** for theming (defined in `App.css`):
  ```css
  --primary: #2563eb
  --primary-light: #eff6ff
  --secondary: #10b981
  --bg-light: #f8fafc
  --text-dark: #1e293b
  --text-muted: #64748b
  --border: #e2e8f0
  ```
- **BEM-inspired** class names: `.session-layout`, `.btn-primary`, `.page-item-compact`
- **Layout**: 64px fixed header, 300px fixed sidebar, flex-1 main content
- **Case type badges**: 8 types, each color-coded (M&A=purple, Profitability=green, etc.)
- **Difficulty scale**: 1-star green → 5-star red

---

## Coding Conventions

- **Functional components only** — no class components
- **No global state library** — pure `useState` + `useEffect` + prop callbacks
- **Refs** for timer intervals and DOM elements that shouldn't trigger re-renders
- **Services are singletons** — exported as instances, not classes
- **Components**: PascalCase; **Services**: camelCase exports; **CSS**: kebab-case; **Types/Interfaces**: PascalCase
- **Error handling**: try/catch in services, `console.error` logging, `window.alert` for user-facing errors
- **No test files** — do not add a test framework without discussion

---

## Electron Integration

- `electron/main.ts`: Creates 1200×800 BrowserWindow, no IPC
- Dev: loads from Vite dev server URL (`process.env.VITE_DEV_SERVER_URL`)
- Prod: loads `dist/index.html`
- `nodeIntegration: true`, `contextIsolation: false` — app is browser-based
- Electron presence detected via `navigator.userAgent` check for `/electron/i`

---

## Known Limitations

- No backend — cases stored only in local IndexedDB (not synced between devices)
- No authentication — peer IDs are public
- Data-only P2P — no video/audio
- No tests
- Electron has no file menu, keyboard shortcuts, or IPC bridges
- Mobile UI works but is optimized for desktop
- Pre-existing TypeScript errors in `CaseSlicer.tsx`, `PDFViewer.tsx`, `PdfService.ts` (pdfjs-dist type incompatibilities with the TS version in use) — do not regress these, but they pre-date session tracking work

---

## Environment & Setup

**Requirements:** Node.js 18+, modern browser (WebRTC, IndexedDB, Canvas, Blob API)

```bash
npm install
npm run dev
```

**Environment variables:**
- `VITE_DEV_SERVER_URL` — Auto-set by Vite; used by Electron in dev mode
- Vercel URL is hardcoded in `App.tsx` as `'https://casingautomation.vercel.app'`
