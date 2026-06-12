# AI Prompts History

This file tracks the prompts used during the development of the SplitWise clone project.

---

## 1. Initial Prompt / Requirements Discovery
* **Role:** Junior software engineer pair programmer.
* **Goal:** Reverse engineer Splitwise requirements, establish MVP, avoid assumptions, interview the user, update `AI_CONTEXT.md` as the single source of truth, outline a build plan.
* **Action:** Created initial project files (`AI_CONTEXT.md`, `BUILD_PLAN.md`, `README.md`, `PROMPTS.md`) and started the requirement interview.

---

## 2. Requirement Baseline & Design Approvals
* **User Input:** Requested the complete project directly.
* **Action:** Established standard production-ready defaults (single currency USD, dynamic query-time greedy settlement resolver, persistent database chat comments, and in-memory WebSockets).
* **Updates:** Generated `AI_CONTEXT.md` and `BUILD_PLAN.md` detailing the entire project setup, database schema, API designs, split logic mathematical formulations, and phased milestones.
* **Outcome:** User approved the implementation plan.

---

## 3. Incremental Implementation Phase
* **Phases 1-11 (Backend Component Setup):**
  - Configured dependencies (`backend/requirements.txt`).
  - Set up environmental defaults (`backend/.env.example`).
  - Created customized model structure (`User`, `Group`, `GroupMembership`, `Expense`, `ExpenseSplit`, `Settlement`, `Comment`).
  - Written DRF serializers including split verification math for EQUAL, UNEQUAL, PERCENTAGE, and SHARE splits.
  - Implemented ASGI Daphne Channels WebSocket server consumer for real-time discussion chats (`backend/expenses/consumers.py`), secured with a custom channels JWT query-string token authentication middleware stack.
  - Applied migrations and successfully ran automated API validation test cases verifying that split mathematics, settlements, and graph-balance calculations are correct.
* **Phases 12-19 (Frontend Component Setup):**
  - Created React/Vite/Tailwind boilerplate (`package.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/index.css`).
  - Set up global authorization context and Axios client interceptor to handle token injection and automated token refreshes.
  - Developed pages:
    - `Login.jsx` & `Register.jsx` (Form fields with validation and toast alerts).
    - `Dashboard.jsx` (Total Balance aggregator card summaries, Group ledger listings, User searches, and Group creation modal).
    - `GroupDetails.jsx` (Action logs, member management, tabular listings for expenses, balances, optimized settlement recommendations, and real-time expense discussion chat panes powered by WebSockets).
* **Phases 20-21 (Testing & Deployment Prep):**
  - Formulated full testing specifications and verified database ledgers using automated tests.
  - Outlined detailed Vercel, Neon, and Render configurations in `README.md`.
