# 🖖 U.S.S. Enterprise: Universal Holodeck Learning Framework

This blueprint outlines how the architecture developed for the **Holodeck Learning Hub** operates as a universal, plug-and-play platform for *any* educational subject. By separating the python ingestion layer from the React presentation layer, we have built a cognitive engine that dynamically shifts themes, models, and tools based on whatever content is fed into it.

---

## 🛰️ 1. The Decoupled Data Model

The core strength of this system is that the frontend React application possesses no hardcoded course metadata. Instead, it acts as a passive consumer of `src/database.json`. 

The JSON database maps to the following standard schema:

```json
{
  "books": [
    { "id": "unique_book_id", "title": "Book Name", "author": "Author", "file": "filename.epub" }
  ],
  "chunks": [
    {
      "id": "chunk_id",
      "book_id": "unique_book_id",
      "book_title": "Book Name",
      "title": "Concept or Subheading Title",
      "chapter": "Chapter Name",
      "content": "Raw text snippet of this concept (max 2000 chars)",
      "code": ["Optional array of code snippets or lists"],
      "difficulty": "Beginner | Intermediate | Advanced",
      "tooling": ["Tags representing matching concepts in the Graph"],
      "raw_html": "Original XHTML markup snippet"
    }
  ],
  "graph": {
    "nodes": [
      { "id": "Node Name", "type": "book | concept", "val": 10, "group": 1 }
    ],
    "links": [
      { "source": "Node A", "target": "Node B", "value": 5 }
    ]
  },
  "quizzes": [
    {
      "id": "quiz_id",
      "chunk_id": "chunk_id",
      "book_id": "unique_book_id",
      "question": "What is...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Why Option A was correct."
    }
  ]
}
```

---

## 🔄 2. How to Ingest a New Subject (Playbook)

To re-route the Holodeck to an entirely different quadrant of knowledge (e.g. *Biology*, *World History*, *Economics*, or *Aeronautics*):

### Step A: Clear the Decks
Remove existing `.epub` files from the `ebooks/` folder and replace them with the files for your new subject.

### Step B: Re-calibrate the Synaptic Scanners
Open `scripts/parse_epubs.py` and modify the concept keywords. The script scans text for these matching elements to draw the links in the visual Knowledge Graph.

*Example configuration for a **Dutch History** course:*
```python
CONCEPT_TAGS = {
    "Tachtigjarige Oorlog": ["willem van oranje", "alva", "geuzen", "1568", "tachtigjarige"],
    "Gouden Eeuw": ["voc", "wic", "rembrandt", "vermeer", "handel", "grachtengordel"],
    "Bataafse Republiek": ["patriotten", "franse tijd", "willem v", "1795"],
    "Monarchie": ["koninkrijk", "willem i", "grondwet", "thorbecke", "1848"]
}
```

### Step C: Trigger Database Ingestion
Load your preferred model in **LM Studio** (ensure the Local Server is running on port `1234`), then run:
```bash
python3 scripts/parse_epubs.py
```
This script will parse the new chapters, extract concepts, check connections, ask LM Studio to generate custom quizzes, and write the new `src/database.json`. 

Once completed, open the Vite app, click **Reload Databank JSON**, and the entire platform (Dashboard, Graph, Reader, and Quiz Deck) is immediately hydrated with the new subject!

---

## 🛠️ 3. Blueprints for Expansion (New Modules)

Since the frontend state receives a unified databank of chunks and quizzes, we can easily plug in additional Starfleet learning sub-modules:

### 🎴 Module A: Synaptic Flashcards (Spaced Repetition)
- **Objective**: Improve memory retention of core definitions.
- **Implementation**:
  - Add a **Flashcard** tab.
  - Gather all concepts associated with active tags.
  - Display them as simple double-sided cards: Front shows the heading title (e.g., *"Model Context Protocol"*), back shows the summary sentence.
  - Implement a **Leitner box scoring system** in `localStorage`. Correct answers push the card to a higher interval box; incorrect answers demote it, showing it more frequently.

### 📝 Module B: Starfleet Board Certification (Exam Mode)
- **Objective**: High-stakes testing for system qualification.
- **Implementation**:
  - Add an **Exams** tab.
  - Extract exactly 30 questions from `db.quizzes`.
  - Impose a 20-minute countdown timer.
  - If accuracy is $\ge 85\%$, render an official SVG Starfleet certificate:
    ```
    =======================================================
               STARFLEET TRAINING COMMAND
       Hereby certifies that Officer Dirk Verstraete
       has mastered the course: ADVANCED AGENTIC CODING
    =======================================================
    ```

### 🤖 Module C: Subspace Holo-Tutor (AI Study Buddy)
- **Objective**: Real-time Q&A with your loaded local model regarding specific chapters.
- **Implementation**:
  - Leveraging our **Vite proxy** `/llm-studio/v1/chat/completions`, we can query LM Studio directly from the browser.
  - In `ConceptReader.jsx`, append a chat panel to the right side.
  - When the user clicks *"Explain this segment"*, the app automatically builds a payload containing the text chunk as context, the user's question, and beams it to the active model:
    ```json
    {
      "model": "active_model",
      "messages": [
        { "role": "system", "content": "You are a Starfleet Holo-Tutor. Answer the user's question using the provided context." },
        { "role": "user", "content": "Context: [text chunk]\n\nQuestion: Explain the code snippet." }
      ]
    }
    ```
  - The model's analysis is rendered right alongside the reading page, creating an interactive, private learning companion.

---

## ⚡ 4. Runtime Quiz Protection (Anti-Cheat & Replayability)

To guarantee a highly valuable, replayable learning experience, the React `QuizEngine` implements two critical runtime protections:

### 1. Dynamic Option Shuffling (Bypassing "Option A" Shortcuts)
* **Problem**: Programmatic heuristic fallback generators or static seed templates tend to hardcode the correct answer at index `0` (Option A). If left static, the user immediately realizes that A is always correct.
* **Solution**: Upon loading a quiz session, the `QuizEngine` clones the question object, shuffles the `options` array randomly, and finds the new index of the correct option text to reassign the `answer` index. Option placements are fully randomized every time the deck is loaded.

### 2. Rolling Spaced Repetition (Preventing Immediate Repeats)
* **Problem**: In small pools (e.g., when testing a specific single concept), picking questions purely randomly often leads to the same question appearing multiple times in consecutive sessions.
* **Solution**: The engine maintains a rolling list of the 30 most recently played question IDs in `localStorage` (`holodeck_recent_quizzes`). When selecting a new set of 10 questions, it filters out these active IDs from the pool (unless the remaining pool is too small, in which case it falls back to protect game loop continuity).

---

## 🧪 5. Automated Verification & Diagnostic Testing

To prevent regressions, bad EPUB parses, or JSX format glitches from reaching production, we have integrated a lightweight, zero-dependency validation suite:

### The Diagnostic Scanner (`scripts/test_engine.py`)
This Python test suite runs two core validation sweeps:
1. **Database Schema Validator**:
   * Inspects `src/database.json` to ensure the structure strictly complies with the frontend expectancies.
   * Assures that all 911 quiz modules contain **exactly 4 choices** (detecting and failing on 3-choice questions that cause UI rendering issues).
   * Validates that `answer` is an integer index (0-3) and checks for duplicate quiz IDs.
   * Assures that Knowledge Graph links map to existing nodes.
2. **JSX Code Integrity Sweeper**:
   * Scans all React `.jsx` components in the `src/` directory for unescaped `>` characters in text nodes that trigger Babel compiler warnings.

### How to Run:
Run this check in your terminal before deploying:
```bash
python3 scripts/test_engine.py
```
If successful, it returns:
`🎉 ALL DIAGNOSTIC CHECKS PASSED. WARP DRIVE CLEARED FOR LAUNCH!`


