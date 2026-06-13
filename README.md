# 🖖 USS Enterprise Holodeck: Developer Learning Hub & Knowledge Graph

Welcome to the **Starfleet Holodeck Learning Hub**—a decoupled, local-first learning system designed to ingest technical documentation (EPUB ebooks), chunk them into distinct engineering concepts, map their relationships in an interactive 2D Force-Directed Knowledge Graph, and generate context-aware multiple-choice quizzes using local LLMs.

The interface is styled entirely in a premium, responsive **Star Trek LCARS** aesthetic (Library Computer Access and Retrieval System).

---

## 📐 1. System Architecture

The Holodeck is split into a **Python Ingestion & Diagnostic Layer** and a **React & Vite Frontend Presentation Layer**. All data flows through a single unified JSON database file (`src/database.json`).

```mermaid
graph TD
    subgraph Host Machine (Unsandboxed)
        EBOOKS[ebooks/*.epub] -->|1. Parse Chapters| INGESTOR[scripts/parse_epubs.py]
        LM_STUDIO[Local LM Studio / Ollama] <-->|2. Generate Quizzes & Bypass Proxies| INGESTOR
        INGESTOR -->|3. Output Database| DB[src/database.json]
    end

    subgraph Browser Client (Vite Dev Server)
        DB -->|4. Hydrate Components| VITE[Vite Web App]
        VITE -->|5. Render Graph| CANVAS[2D HTML5 Canvas Graph]
        VITE -->|6. Quiz Deck| ENGINE[Quiz Engine]
        VITE -->|7. Subspace Transceiver| PROXY[Vite Proxy /llm-studio]
        PROXY <-->|8. Direct Q&A Chat| LM_STUDIO
        ENGINE -->|9. Streak / Leitner Filter| STORAGE[(Local Storage)]
    end

    subgraph Diagnostics
        TESTS[scripts/test_engine.py] -->|Validate Schema & JSX Integrity| DB
    end
```

---

## 🛰️ 2. Holodeck Subsystems

The learning terminal consists of five primary modules:

1. **01. Holodeck Dashboard**: Track engineering ranks (Cadet to Captain), monitor total Synaptic Points, check study streaks, and check system telemetry.
2. **02. Synaptic Knowledge Graph**: A custom HTML5 Canvas-based 2D force-directed network displaying associations between core concepts (MCP, Ollama, Claude Code, Stripe, Next.js, etc.) and books. Drag nodes, trace linkages, and click nodes to open their corresponding text.
3. **03. Concept Reader**: Browse and read parsed ebook segments with clean code blocks, syntax highlighting, difficulty markers, and automatic keyword tagging.
4. **04. Quiz Deck (Training Simulator)**: Self-test with context-aware, multiple-choice questions. It includes streak progression, nominal/critical state styling, and detailed technical debriefs (explanations).
5. **05. Ingestion Terminal**: Review ingestion logs, verify local LLM server status, and chat directly with your loaded local model using the **Subspace Transceiver** chat terminal.

---

## ⚡ 3. Warp Drive Initialization (Quick Start)

### Step 1: Install Dependencies
Prepare the React app framework and install node modules:
```bash
npm install
```

### Step 2: Spin Up the Local LLM Core
Open **LM Studio** (or **Ollama**) on your host:
- **LM Studio**: Set up the Local HTTP Server on port `1234` and load your model (e.g. `google/gemma-4-26b-a4b` or another lightweight model).
- **Ollama**: Verify the daemon is active on port `11434` (`ollama run gemma2:9b`).

### Step 3: Run the Ingestion Pipeline
To ingest EPUB files in `ebooks/`, parse concepts, query your local LLM for quiz questions, and build the graph:
```bash
python3 scripts/parse_epubs.py
```
> [!TIP]
> **Proxy Bypass Active**: If your terminal shell has proxy environment variables set (`HTTP_PROXY`, `http_proxy`, etc.), the ingestion script automatically installs a custom, proxy-free handler to bypass them for local requests on port `1234` and `11434`.

### Step 4: Run Diagnostic Checks
Validate that the generated database meets structural schemas and no React compiler glitches exist:
```bash
python3 scripts/test_engine.py
```

### Step 5: Launch the Frontend
Start the local server and open the browser client:
```bash
npm run dev
```
Navigate to **[http://localhost:5173/](http://localhost:5173/)**.

---

## 🧠 4. Deep Technical Details

### 🔄 Ingestion & Chunking
The parser (`scripts/parse_epubs.py`):
* Unzips raw EPUB structures, extracts the manifest, and maps chapter structures.
* Splits documents by header nodes (`<h1>`, `<h2>`) to isolate atomic concepts.
* Matches keywords to auto-tag core concepts.
* Prompts the local LLM using a strict JSON schema template to return a multiple-choice question, four distinct options, the correct answer index, and a technical explanation.

### 🛡️ Runtime Quiz Protections
* **Dynamic Option Shuffling**: Programmatic heuristic fallback generators tend to hardcode the correct answer at index `0` (Option A). The React `QuizEngine` dynamically clones the questions, shuffles the options array on-the-fly, and tracks the new index of the correct option to prevent mnemonic memorization.
* **Rolling Spaced Repetition**: The engine tracks the 30 most recently seen question IDs in `localStorage` to filter them out of subsequent 10-question pools, ensuring you don't receive repetitive questions in a row.

### 🛰️ Subspace Transceiver (Vite Proxy)
Browser CORS policies prevent frontend JavaScript from querying `http://localhost:1234` directly. To circumvent this, the Vite server is configured with a proxy routing rule:
```javascript
proxy: {
  '/llm-studio': {
    target: 'http://localhost:1234',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/llm-studio/, '')
  }
}
```
This allows the **Subspace Transceiver** chat console inside the Vite app to communicate directly with LM Studio via `/llm-studio/v1/chat/completions`.

---

## 🖖 5. The Starfleet Mindset (Co-Creation & Protocols)

This repository is governed by the following core instructions (originally compiled in [agents.md](file:///Users/dirkverstraete/Documents/modernaicode/agents.md)):

* **The Prime Directive (HITL)**: Human-In-The-Loop. The human is the captain of the ship. The AI plans and drafts, but the captain approves and executes commands.
* **KISS & Surgical Code**: Minimalist, clean implementations. We prioritize surgical modifications and minimal external dependencies to maintain system integrity.
* **Subspace Humor**: Collaborative creation should be an enjoyable flight. We embrace laughter at bugs, syntax glitches, and model slips.
* **Active Security Protocols**: We analyze local system configurations and maintain local model links to keep development private and secure.

---

*Warp drive active. Diagnostics nominal. Live long and prosper!* 🖖
