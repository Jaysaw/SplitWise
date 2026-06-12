# Product Understanding

The application is a Splitwise-inspired expense-sharing platform. It allows users to register, create groups, invite members, log expenses with various splitting methods, calculate balances (who owes whom), record settlements (settling up), and chat in real-time about specific expenses.

# Product Research

Splitwise is a popular mobile and web application that helps users share bills and track balances with friends, roommates, and travel groups.
Key mechanisms researched:
- **Shared Ledger:** A centralized ledger where expenses are added and balances are continuously calculated.
- **Simplifying Debts (Debt Simplification):** Reducing the number of transactions required to settle up within a group using graph algorithms (e.g., maximum flow or greedy balance matching).
- **Split Methods:** Supporting various ways to divide an expense (Equal, Unequal, Percentages, and Shares).

# Splitwise Features Studied

1. **Expense Splitting:** Equal splits, exact amounts (unequal), percentages, and shares.
2. **Group Ledger:** A dashboard displaying group expenses, members, and net balances.
3. **Settling Up:** Recording cash or online payments to resolve balances.
4. **Activity Logs & Comments:** Discussing specific transactions or expense details.
5. **Debt Simplification:** Minimizing transactions.

# MVP Scope

For this Splitwise Clone MVP, the scope covers:
- **User Authentication:** Sign up, login, logout, and token refresh using Simple JWT.
- **Group Management:** Create, view, update, delete groups, and manage members.
- **Expense Management:** Create, update, delete expenses, and view history.
- **Splitting Methods:**
  - *Equal:* Divide total amount equally among all selected participants.
  - *Unequal:* Specify exact decimal amounts for each participant (must sum to total).
  - *Percentage:* Specify percentages for each participant (must sum to 100%).
  - *Share:* Specify parts/shares for each participant (divided proportionally).
- **Balances & Settlements:**
  - Net group balances (who owes whom).
  - Individual user dashboard summarizing balances across all groups.
  - Record payments (settlements) between users inside a group.
- **Expense Chat:**
  - Real-time expense-level chat comments via Django Channels WebSockets.
  - Persistent comment history stored in PostgreSQL.

# Out Of Scope Features

- **Multi-currency Support:** All transactions are in USD ($) for simplicity.
- **Debt Simplification Algorithm:** For this version, we calculate direct balances based on expense transactions and settlement logs within each group without global path simplification.
- **Email Notifications:** Notifications of new expenses or settlements will not be sent via email.
- **Payment Gateway Integration:** No actual Stripe/PayPal integrations. Settlements are recorded manually as "cash/external transfer" payments.
- **Recurring Expenses:** Automatic weekly/monthly bill generation is excluded.

# User Personas

1. **Alex (Roommate):** Needs to split monthly rent, electricity, and internet bills with 2 roommates. Wants to see exactly who owes what and record settlements when they pay.
2. **Sarah (Traveler):** Going on a group trip with 5 friends. Wants to log group dinners, taxi rides, and activities, and see the final balance summaries at the end of the trip.

# User Stories

1. **As a User**, I want to register and log in securely so that my personal expenses and groups are private to me.
2. **As a Group Member**, I want to create a group and add friends using their email or phone number.
3. **As a Group Member**, I want to log an expense (e.g., "Dinner"), specify who paid, and divide the cost equally or unequally among group members.
4. **As a Group Member**, I want to see my net balance in the group (whether I owe money or am owed money).
5. **As a Debtor**, I want to record a settlement payment to a creditor to reduce or clear my balance.
6. **As a Group Member**, I want to comment on a specific expense in real-time to discuss details (e.g., "Why is this so expensive?").

# Functional Requirements

1. **Authentication:**
   - JWT-based login and signup.
   - Profile management (Full Name, Phone Number, Email, Password).
2. **Group Management:**
   - Create group with name, description, and initial members.
   - List groups the user belongs to.
   - Add/Remove members (only if the user is a group member).
3. **Expense Management:**
   - Add expense with Description, Amount, Paid By (Payer), Split Type, and List of Splits.
   - Update and delete expenses (only group members can do this).
   - View expense history logs.
4. **Splitting & Balance Calculation:**
   - Auto-calculate splits depending on type (Equal, Unequal, Percentage, Share).
   - Calculate user balances: `Owed Amount - Owing Amount`.
   - Calculate "Who owes Whom" lists dynamically within groups.
5. **Settlements:**
   - Record payment from Payer to Payee for a specific amount.
   - Instant balance deduction upon settlement submission.
6. **Expense Chat:**
   - Establish a WebSocket connection per expense.
   - Broadcast new comments to all connected clients viewing that expense.

# Non Functional Requirements

1. **Performance:** Under 200ms API response time for ledger calculations.
2. **Security:** Secure password hashing (Argon2/BCrypt via Django), JWT tokens stored in frontend local storage (or secure HTTP-only cookies if required, local storage is default for Vite/React templates).
3. **Real-time Synchronization:** WebSocket connection latency under 50ms.
4. **Aesthetics:** Stunning user interface with a dark mode option, utilizing custom Tailwind CSS variables, sleek glassmorphism, and smooth transitions.

# Tech Stack

- **Frontend:** React, Vite, React Router, Tailwind CSS, Axios, React Icons, React Hot Toast
- **Backend:** Django, Django REST Framework, Simple JWT, Django Channels, Daphne (ASGI server)
- **Database:** PostgreSQL (Neon PostgreSQL)
- **Deployment:** Vercel (Frontend), Render (Backend), Neon (Database)

# Frontend Architecture

- **State Management:** React Context API for Auth and Theme state; local state for components.
- **Routing:** React Router v6 with Private Routes for authenticated dashboards.
- **HTTP Client:** Axios instance with request/response interceptors to automatically attach JWT tokens and handle token refresh (`/api/auth/token/refresh/`).
- **Styling:** Tailwind CSS with a dark/light custom theme palette.

# Backend Architecture

- **WSGI/ASGI:** ASGI setup using `daphne` and `channels` to support HTTP and WebSockets.
- **Authentication:** DRF Simple JWT middleware.
- **Real-time Layer:** Django Channels `InMemoryChannelLayer` for development and deployment to avoid the need for external Redis infrastructure.

# Database Schema

### `users_user` (Custom User Model)
* `id`: UUID (Primary Key)
* `email`: String (Unique)
* `username`: String (Unique)
* `full_name`: String
* `phone_number`: String (Optional)
* `avatar_url`: String (Optional)
* `password`: String (Hashed)
* `date_joined`: DateTime
* `is_active`: Boolean

### `groups_group`
* `id`: UUID (Primary Key)
* `name`: String
* `description`: Text (Optional)
* `created_by_id`: UUID (FK -> users_user)
* `created_at`: DateTime
* `updated_at`: DateTime

### `groups_groupmembership`
* `id`: UUID (Primary Key)
* `group_id`: UUID (FK -> groups_group)
* `user_id`: UUID (FK -> users_user)
* `joined_at`: DateTime
* Unique Constraint on `(group_id, user_id)`

### `expenses_expense`
* `id`: UUID (Primary Key)
* `group_id`: UUID (FK -> groups_group)
* `description`: String
* `amount`: Decimal(10, 2)
* `paid_by_id`: UUID (FK -> users_user, the payer)
* `split_type`: Enum ('EQUAL', 'UNEQUAL', 'PERCENTAGE', 'SHARE')
* `created_at`: DateTime
* `updated_at`: DateTime

### `expenses_expensesplit`
* `id`: UUID (Primary Key)
* `expense_id`: UUID (FK -> expenses_expense)
* `user_id`: UUID (FK -> users_user)
* `amount`: Decimal(10, 2) (The amount this user owes)
* `percentage`: Decimal(5, 2) (Optional, for percentage splits)
* `share`: Decimal(5, 2) (Optional, for share splits)
* Unique Constraint on `(expense_id, user_id)`

### `expenses_settlement`
* `id`: UUID (Primary Key)
* `group_id`: UUID (FK -> groups_group)
* `payer_id`: UUID (FK -> users_user, the debtor paying)
* `payee_id`: UUID (FK -> users_user, the creditor receiving)
* `amount`: Decimal(10, 2)
* `created_at`: DateTime

### `expenses_comment`
* `id`: UUID (Primary Key)
* `expense_id`: UUID (FK -> expenses_expense)
* `user_id`: UUID (FK -> users_user)
* `content`: Text
* `created_at`: DateTime

# API Design

### Authentication
* `POST /api/auth/register/` - Register a new user
* `POST /api/auth/login/` - Obtain JWT Access & Refresh tokens
* `POST /api/auth/logout/` - Blacklist refresh token
* `POST /api/auth/token/refresh/` - Refresh access token
* `GET /api/auth/me/` - Retrieve current user profile details

### Users
* `GET /api/users/search/?q=<query>` - Search users by email or username to invite to groups

### Groups
* `GET /api/groups/` - List user's groups
* `POST /api/groups/` - Create a group
* `GET /api/groups/<group_id>/` - Group details (including members)
* `PUT/PATCH /api/groups/<group_id>/` - Update group details
* `DELETE /api/groups/<group_id>/` - Delete group
* `POST /api/groups/<group_id>/members/` - Add member (body: `{email: "user@example.com"}`)
* `DELETE /api/groups/<group_id>/members/<user_id>/` - Remove member
* `GET /api/groups/<group_id>/balances/` - Retrieve net balance summary for each user in the group and a list of "Who owes whom"

### Expenses
* `GET /api/groups/<group_id>/expenses/` - List expenses in group
* `POST /api/groups/<group_id>/expenses/` - Create a new expense (includes split details)
* `GET /api/expenses/<expense_id>/` - Get specific expense detail
* `PUT/PATCH /api/expenses/<expense_id>/` - Update expense & splits
* `DELETE /api/expenses/<expense_id>/` - Delete expense
* `GET /api/expenses/<expense_id>/comments/` - Get comments for an expense
* `POST /api/expenses/<expense_id>/comments/` - Post a comment

### Settlements
* `GET /api/groups/<group_id>/settlements/` - List settlement payments in a group
* `POST /api/groups/<group_id>/settlements/` - Record a new settlement payment (body: `{payer: "uuid", payee: "uuid", amount: X}`)

# Authentication Design

Authentication uses **Django REST Framework Simple JWT**:
- Access Token lifespan: 30 minutes
- Refresh Token lifespan: 7 days
- Saved in frontend local storage. Interceptors automatically refresh access token when API calls return a 401 Unauthorized error.

# Group Management Design

- Any member of the group can view the list of expenses and members.
- Members are added via email search. If the user doesn't exist, we return a 404 (user must be registered).
- Members can only be removed from a group if they have a net balance of $0.00.

# Expense Management Design

- When an expense is created, the system stores the payer and the split list.
- An expense object records `paid_by` (payer) and a list of `ExpenseSplit` records.
- If an expense is modified, previous splits are deleted and rebuilt based on the new split instructions.
- All actions (create, update, delete) are recorded in history and trigger updates to group balances.

# Split Calculation Logic

Let $A$ be the total amount of the expense, and $S$ be the set of participants.

### Equal Split:
Let $N = |S|$.
Each participant's share is $A / N$.
To handle rounding errors:
- Calculate $A_{each} = \text{round}(A / N, 2)$.
- The payer or the first participant is adjusted by the difference: $A - (A_{each} \times N)$.
  - Example: $10.00 split among 3 people: $3.33, $3.33, $3.34.

### Unequal Split:
User inputs absolute amounts $a_i$ for each participant $i$.
System validates that $\sum a_i = A$. If not, return validation error.

### Percentage Split:
User inputs percentages $p_i$ for each participant $i$.
System validates that $\sum p_i = 100\%$.
Each user's amount is $a_i = \text{round}(A \times p_i / 100, 2)$.
Any rounding discrepancies are resolved by adjusting the largest share.

### Share Split:
User inputs integer/decimal shares $s_i$ for each participant $i$.
Let $S_{total} = \sum s_i$.
Each user's amount is $a_i = \text{round}(A \times s_i / S_{total}, 2)$.
Any rounding discrepancies are resolved by adjusting the largest share.

# Settlement Logic

- A settlement is recorded as a direct transaction where user $X$ pays user $Y$ a sum $M$.
- Creating a settlement record reduces the amount $X$ owes $Y$ by $M$.
- It is stored in the database as an `expenses_settlement` record.
- Net balance updates immediately.

# Balance Calculation Logic

The net balance for a user $U$ within a group $G$ is computed as:

$$\text{Net Balance}(U) = \text{Total Lent}(U) - \text{Total Owed}(U) + \text{Total Settlements Received}(U) - \text{Total Settlements Paid}(U)$$

Where:
- $\text{Total Lent}(U)$: Sum of amounts of all expenses in group $G$ where $U$ was the payer (`paid_by_id = U`).
- $\text{Total Owed}(U)$: Sum of splits where `user_id = U` for all expenses in group $G$.
- $\text{Total Settlements Received}(U)$: Sum of settlements in group $G$ where `payee_id = U`.
- $\text{Total Settlements Paid}(U)$: Sum of settlements in group $G$ where `payer_id = U`.

### Who Owes Whom (Graph Settlement Matching)
To present a human-readable list of "Who owes whom" within group $G$:
1. Calculate the net balance for each user in the group. Users with net balance $> 0$ are **creditors** (owed money). Users with net balance $< 0$ are **debtors** (owe money). Users with net balance $= 0$ are settled up.
2. Separate debtors and creditors into two lists.
3. Sort both lists descending by absolute balance.
4. Greedily match the largest debtor with the largest creditor:
   - Let debtor $D$ have balance $-x$ (owes $x$), and creditor $C$ have balance $+y$ (is owed $y$).
   - Match amount $m = \min(x, y)$.
   - Record: "$D$ owes $C$ amount $m$".
   - Update $D$'s remaining debt to $x - m$ and $C$'s remaining credit to $y - m$.
   - Remove anyone whose remaining balance is $0$.
   - Repeat until all balances are settled (debtors list is empty).

# WebSocket Design

- **Channel Groups:** A separate Channel Group is created for each expense: `expense_chat_<expense_uuid>`.
- **Connection:** Client establishes a WebSocket connection at `ws/chat/expense/<expense_id>/` with their JWT token.
- **Sending Messages:** Clients send JSON messages:
  `{"content": "Hello world"}`
- **Server Actions:**
  1. Authenticate user from the WebSocket scope (JWT validation).
  2. Write comment to the PostgreSQL database.
  3. Broadcast comment to the channel group:
     `{"id": "uuid", "user": {"id": "uuid", "full_name": "Name"}, "content": "Hello world", "created_at": "timestamp"}`
  4. Clients receive message and append it to local chat UI.

# Deployment Strategy

### Frontend
- Host on Vercel.
- Configure build command: `npm run build`.
- Output directory: `dist`.
- Redirects configured in `vercel.json` to route all traffic to `index.html` (for React Router single page app behavior).

### Backend
- Host on Render.
- Deployment environment: Web Service.
- Build command: `pip install -r requirements.txt`.
- Start command: `daphne -b 0.0.0.0 -p $PORT backend.asgi:application` (to support both HTTP and WebSockets).

### Database
- Host on Neon PostgreSQL.
- Connect via connection string supplied in environment variables (`DATABASE_URL`).

# Testing Strategy

- **Backend Unit Tests:** Use Django REST Framework's `APITestCase` to test:
  - User registration, login, JWT issuance.
  - Expense creation with different split types (validating balance calculations).
  - WebSockets mock client testing to verify comment broadcasting.
- **Frontend Unit Tests:** React testing using Jest/React Testing Library or Vite-Vitest to mock API requests and render dashboard elements.
- **Manual End-to-End Testing:** Using browser subagent tools to verify user flows.

# Security Considerations

1. **JWT Storage:** Store access token in memory/state, and refresh token in local storage (standard React configuration).
2. **Password Hashing:** Use Django's PBKDF2 or Argon2 hashing.
3. **Database Access:** Enable SSL connections for Neon PostgreSQL.
4. **CORS:** Configure `django-cors-headers` to only allow requests from the Vercel frontend domain.
5. **WebSocket Security:** Validate JWT in the custom WebSocket connection handler.

# Tradeoffs

1. **In-Memory Channel Layer:** Avoids external Redis setup. Tradeoff: If Render spins down the backend or runs multiple instances (scaling horizontally), WebSocket messages will not sync across different instances. For a single-instance MVP, this is highly efficient and eliminates hosting costs.
2. **Direct Balances vs Debt Simplification:** The system uses a simple greedy matching algorithm to output "Who owes whom" dynamically at query time, instead of storing complex graph states. This is fast for groups under 100 members.

# Known Limitations

- Real-time chat requires a single instance of the application server since `InMemoryChannelLayer` does not share state across processes or servers.
- Offline support is not included; if connection is lost, users cannot write comments or log expenses until they are online.

# Change Log

- **2026-06-13:** Initialized document. Established defaults for MVP scope, database schema, split math, and balance engine.
- **2026-06-13:** Setup complete project files, package dependencies, configured SQLite dev DB, executed migrations, verified and executed unit test suite successfully, and created Vite/React dashboard with ledger views and WebSocket integrations.

# AI Prompts Used

- **Prompt 1:** Initial user requirements request and master prompt load.
- **Prompt 2:** Prompt request to deliver the complete project, leading to baseline defaults and build checklists.

