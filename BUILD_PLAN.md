# Build Plan

This build plan outlines the architectural decisions, database design, API design, folder structure, testing and deployment strategy, and the phased implementation milestones for the Splitwise Clone application.

---

## 1. Product Research
- **Splitwise Ledger Model:** Expenses are shared records with participants, split ratios/shares, and payers. Balances are calculated dynamically by aggregating lent amounts versus owed amounts.
- **WebSocket Chat:** Real-time messages are stored per expense. WebSockets facilitate immediate screen updates for comments without refreshing.

---

## 2. User Workflows
1. **User Sign Up / Login:** User lands on landing page, registers, receives JWT token, and gets redirected to Dashboard.
2. **Create Group:** User goes to "Create Group", inputs name and description, and searches existing registered users by email to add them.
3. **Log Expense:** User enters "Add Expense" within a group, writes description, amount, selects split type (Equal, Unequal, Percentage, Share), sets the payer, allocates the splits, and saves.
4. **View Balance / Who Owes Whom:** Inside the group page, users see net balances (e.g., "You are owed $50.00" or "You owe $20.00") and a list of optimized settlement instructions (e.g., "Alex owes Sarah $20.00").
5. **Settle Up:** A user records a settlement (e.g., Alex pays Sarah $20.00 cash). The system logs the payment and updates balances.
6. **Chat on Expense:** A user clicks on a specific expense, opening the expense details side drawer or page. They see a list of comments and can send a message. The message appears instantly on screens of all users currently looking at that expense.

---

## 3. Architecture Decisions
- **Monorepo Structure:** We will organize the repository with a `/backend` directory containing the Django app, and a `/frontend` directory containing the Vite/React app.
- **ASGI Server (Daphne):** Necessary to run Django Channels for WebSockets alongside normal DRF HTTP requests.
- **In-Memory Channel Layer:** For local development and simple single-instance deployments (to save cost and setup time on Render), we will use Django Channels' `InMemoryChannelLayer`.
- **Database (PostgreSQL):** We will use Neon PostgreSQL, which is cloud-hosted and serverless, providing a connection string via environment variables.

---

## 4. Database Design
We will define models in Django's ORM under three main apps: `users`, `groups`, and `expenses`.

### `users` app
- **User:** Custom model inheriting from `AbstractUser` using email as the login identifier.

### `groups` app
- **Group:** Group information.
- **GroupMembership:** M2M connection model between User and Group, including `joined_at` timestamp.

### `expenses` app
- **Expense:** Details of the spent amount, description, group link, and payer.
- **ExpenseSplit:** Mapping of how much each member owes for a given expense.
- **Settlement:** Records a transfer of money from debtor to creditor.
- **Comment:** Chat messages associated with a specific expense.

---

## 5. API Design
All endpoints prefixed with `/api/`.

- `POST /api/auth/register/` - Register
- `POST /api/auth/login/` - Login (Access & Refresh tokens)
- `POST /api/auth/logout/` - Logout
- `POST /api/auth/token/refresh/` - Refresh Token
- `GET /api/auth/me/` - Get current user profile
- `GET /api/users/search/?q=<query>` - Search users by email or username
- `GET /api/groups/` - List user's groups
- `POST /api/groups/` - Create a group
- `GET /api/groups/<id>/` - Retrieve group details and member list
- `POST /api/groups/<id>/members/` - Add user to group by email
- `DELETE /api/groups/<id>/members/<user_id>/` - Remove user from group (requires balance to be $0.00)
- `GET /api/groups/<id>/balances/` - Retrieve net balances and settlement instructions
- `GET /api/groups/<id>/expenses/` - List expenses in group
- `POST /api/groups/<id>/expenses/` - Add expense & create splits
- `GET /api/expenses/<id>/` - Specific expense details & splits
- `PUT/PATCH /api/expenses/<id>/` - Edit expense & recalculate splits
- `DELETE /api/expenses/<id>/` - Delete expense
- `GET /api/expenses/<id>/comments/` - Get comment history
- `POST /api/expenses/<id>/comments/` - Save a new comment
- `GET /api/groups/<id>/settlements/` - List settlements
- `POST /api/groups/<id>/settlements/` - Record a settlement

---

## 6. Frontend Structure
Using Vite + React + Tailwind CSS.
```
frontend/
├── public/
├── src/
│   ├── assets/
│   ├── components/       # Reusable components (Navbar, Sidebar, Button, Input, Modal)
│   ├── context/          # AuthContext, ThemeContext
│   ├── hooks/            # UseAuth, UseWebSockets
│   ├── pages/            # Dashboard, Groups, GroupDetails, Login, Register, ExpenseDetails
│   ├── services/         # Axios api instance, authService, groupService, expenseService
│   ├── utils/            # Split calculators, formatters
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## 7. Backend Structure
Using Django, Django REST Framework, Django Channels.
```
backend/
├── backend/              # Project config (settings.py, urls.py, asgi.py, wsgi.py)
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── routing.py
├── users/                # Users app (models.py, views.py, serializers.py)
├── groups/               # Groups app (models.py, views.py, serializers.py)
├── expenses/             # Expenses app (models.py, views.py, serializers.py, consumers.py)
├── manage.py
└── requirements.txt
```

---

## 8. Deployment Plan
- **Database:** Neon PostgreSQL. Get connection string.
- **Backend:** Render. Host as Web Service, configure ASGI (Daphne), set environment variables: `DATABASE_URL`, `SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`.
- **Frontend:** Vercel. Connect GitHub repo, configure build settings, set `VITE_API_URL` and `VITE_WS_URL` to point to the backend on Render.

---

## 9. Testing Plan
- **Unit & Integration Tests (DRF APITestCase):**
  - Verify auth token endpoints.
  - Test validation of unequal splits (errors when sum does not equal total).
  - Test balance engine against mock ledgers (Equal/Unequal/Percentage/Share).
- **WebSocket Testing:** Write ASGI channels tests to check group broadcast delivery.
- **Frontend Verification:** Manual verification using the browser subagent once the full UI is deployed.

---

## 10. Tradeoffs
- **No Redis:** Using `InMemoryChannelLayer` saves hosting complexity but limits the app to a single Render container instance. This is suitable for an MVP.
- **Local Storage Auth:** Storing JWT tokens in Local Storage. Easy to implement, but vulnerable to XSS. We will write clean components and avoid injecting raw HTML (`dangerouslySetInnerHTML`) to mitigate XSS risks.

---

## 11. Milestones (Implementation Checklist)

- [x] **Phase 1:** Project Setup, Folder Structure, Dependency Installation
- [x] **Phase 2:** PostgreSQL Setup, Environment Variables
- [x] **Phase 3:** Django Models
- [x] **Phase 4:** Serializers
- [x] **Phase 5:** Authentication APIs
- [x] **Phase 6:** Group APIs
- [x] **Phase 7:** Expense APIs
- [x] **Phase 8:** Expense Split Logic
- [x] **Phase 9:** Balance Calculation Engine
- [x] **Phase 10:** Settlement APIs
- [x] **Phase 11:** Django Channels WebSocket Chat
- [x] **Phase 12:** React Setup
- [x] **Phase 13:** React Routing
- [x] **Phase 14:** Authentication Screens
- [x] **Phase 15:** Dashboard
- [x] **Phase 16:** Group Screens
- [x] **Phase 17:** Expense Screens
- [x] **Phase 18:** Balance Screens
- [x] **Phase 19:** Chat UI
- [x] **Phase 20:** Testing
- [ ] **Phase 21:** Deployment
