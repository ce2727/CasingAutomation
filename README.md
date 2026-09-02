# ProCase

> **A professional, infrastructure-free toolkit for MBA case interview preparation.**

ProCase is designed for consulting clubs and MBA students practicing case interviews in pairs. It streamlines the casing experience by giving hosts full control over case notes, exhibit delivery, and timers while giving participants a clean, distraction-free view of revealed exhibits in real time.

Live Web App: [https://casingautomation.vercel.app](https://casingautomation.vercel.app)

### 📥 Download Desktop App
| Platform | Download Link | Notes |
| :--- | :--- | :--- |
| 🍏 **Mac (Apple Silicon)** | [**Download for Mac (Apple Silicon)**](https://github.com/ce2727/CasingAutomation/releases/latest/download/ProCase-macOS-arm64.dmg) | *For M1, M2, M3, M4 Macs (2020+)* |
| 🍏 **Mac (Intel)** | [**Download for Mac (Intel)**](https://github.com/ce2727/CasingAutomation/releases/latest/download/ProCase-macOS-x64.dmg) | *For older Macs (2019 and earlier)* |
| 🪟 **Windows PC** | [**Download for Windows (.exe)**](https://github.com/ce2727/CasingAutomation/releases/latest/download/ProCase-Windows-Setup.exe) | *Setup installer for Windows 10 & 11* |
| 🌐 **Web Version** | [**Launch Web App**](https://casingautomation.vercel.app) | *Instant browser join for Casees* |

---

## Key Features

### For the Caser (Host)
- **Centralized Case Library**: Organize cases by case type (M&A, Profitability, Market Entry, etc.), difficulty (1–5 stars), source casebook, and custom tags.
- **Built-in PDF Slicer**: Extract individual cases directly from multi-page master casebooks. Mark specific pages as shareable exhibits vs. confidential interviewer notes.
- **Live Session Controls**:
  - Host live sessions using simple 5-character join codes or direct invite links.
  - Reveal exhibits one-by-one to your partner with a single click.
  - Built-in synchronized stopwatch with Begin, Pause, and Reset controls.
- **Session History & Analytics**:
  - Automatically records completed sessions with partner names, duration, and ratings.
  - View per-case statistics (total times given, times received, average duration, fastest completion).
  - Export case progress summaries to CSV for consulting club leadership reporting.

### For the Casee (Participant)
- **Zero-Friction Access**: Join directly via web browser without creating an account or installing software.
- **Real-Time Exhibit Delivery**: Only revealed exhibits are displayed; new exhibits auto-scroll into view as the interviewer reveals them.
- **Screen Wake Lock**: Automatically prevents mobile and laptop screens from sleeping during active interviews.
- **Session Feedback**: Rate case difficulty and record session completion upon finishing.

---

## Architecture & Design Principles

### 100% Infrastructure-Free
ProCase is engineered to require **zero server-side infrastructure** and **zero recurring operational costs**:
- **Peer-to-Peer Networking**: Real-time communication (exhibit reveals, timer synchronization, metadata) is powered by WebRTC DataChannels via **PeerJS** through public STUN servers.
- **Client-Side Storage**: All case documents, sliced PDF binary blobs, and session history are stored locally in the browser's IndexedDB using **Dexie.js**.
- **Client-Side PDF Processing**: PDF parsing, canvas rendering, and page extraction run entirely in the browser using **PDF.js** and **pdf-lib**.
- **Sustainable Long-Term**: Because there are no servers, databases, or API subscriptions to pay for or manage, the application remains fully functional indefinitely across club leadership transitions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Bundler & Dev Server** | [Vite 8](https://vitejs.dev/) |
| **Desktop Shell** | [Electron 40](https://www.electronjs.org/) |
| **P2P Networking** | [PeerJS](https://peerjs.com/) (WebRTC DataConnection) |
| **Local Database** | [Dexie.js 4](https://dexie.org/) (IndexedDB wrapper) |
| **PDF Manipulation** | [pdf-lib](https://pdf-lib.js.org/) (extracting/slicing pages) |
| **PDF Rendering** | [pdfjs-dist](https://mozilla.github.io/pdf.js/) (canvas rendering) |
| **Icons** | [Lucide React](https://lucide.dev/) |

---

## Project Structure

```
.
├── electron/
│   └── main.ts               # Electron desktop main process
├── src/
│   ├── components/
│   │   ├── AppLogo.tsx       # SVG brand logo
│   │   ├── CaseSlicer.tsx    # 2-phase case creation & exhibit configuration UI
│   │   └── PDFViewer.tsx     # Responsive canvas-based PDF renderer
│   ├── services/
│   │   ├── LibraryService.ts # Dexie IndexedDB CRUD, history tracking & import/export
│   │   ├── PdfService.ts     # PDF loading, slicing, and rendering utilities
│   │   └── PeerService.ts    # WebRTC P2P connection handling & message protocol
│   ├── App.tsx               # Primary application coordinator and views
│   ├── App.css               # Main styling and theme variables
│   ├── index.css             # Base resets
│   └── main.tsx              # React application entry point
├── public/                   # Static assets and application icons
├── scout_casebook.js         # Node script for scouting casebook PDF boundaries
├── vite.config.ts            # Vite & Electron plugin configuration
└── package.json
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` (v9+)

### Installation
```bash
git clone <repository-url>
cd CasingAutomation
npm install
```

### Development
Start the Vite development server with Hot Module Replacement (HMR):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building for Production
To typecheck and build the web and desktop bundles:
```bash
npm run build
```
Output files will be generated in `dist/` (web assets) and `dist-electron/` (Electron main process).

### Linting
```bash
npm run lint
```

---

## Data Import & Export

- **Single Case Export/Import**: Export any case as a standalone `.case.json` file containing metadata and base64-encoded PDF data.
- **Full Library Backup**: Export and restore your complete library via a single `.json` backup.
- **Bulk CSV + Master PDF Slicer**: Bulk-slice a master casebook PDF using a CSV format specifying page boundaries, case types, difficulty, and exhibit designations:
  ```csv
  Title, Type, Difficulty, StartPage, EndPage, Tags, PageMetadata
  "Solar Strategy","Profitability",4,1,10,"energy;sustainability","Case Overview|false;Exhibit A|true"
  ```
- **Progress Report Export**: Export all historical casing session metrics into `.csv` for club-wide tracking and member reporting.
