# ReLife AI Emotional Support & Divorce Recovery Platform
## Overview
ReLife is a privacy‑first, end‑to‑end emotional wellness platform tailored for individuals navigating relationship separation, divorce, and major life transitions. It combines peer support, verified legal mediation resources, a daily mood & sentiment journal, and an AI Emotional Support Assistant powered by Retrieval‑Augmented Generation (RAG) with deterministic safety guardrails.

---

## ✨ Key Capabilities

### 1️⃣ AI Emotional Support Assistant (RAG + Safety Guardrails)
- **Empathetic Conversational Guide** – active‑listening, grounding exercises, and divorce‑transition guidance.
- **RAG‑Based Knowledge** – curated, authoritative sources (e.g., NALSA, APA, NHS) with real URLs, publishers, and review dates.
- **Deterministic Crisis Guardrail** – intercepts self‑harm or suicidal patterns and returns verified 24/7 helplines.
- **Safety Invariant** – sentiment scores alone never trigger a crisis.
- **Prompt‑Injection Defense** – user inputs and retrieved documents are sandboxed with `<user_message>` / `<retrieved_context>` delimiters.
- **Pluggable LLM Providers** – Google Gemini (`gemini-1.5‑flash`), OpenAI (`gpt‑4o‑mini`), or local mock adapters.

### 2️⃣ AI Mood Analyzer & Private Journal
- **Distraction‑Free Editor** – daily reflections with 1‑5 mood picker, autosave, character counter.
- **Automated Sentiment Classification** – continuous score (‑1.0 → +1.0), label, confidence, uncertainty, and detected emotions.
- **Trend Visualizations** – interactive 7‑, 30‑, and 90‑day sentiment trajectories via Chart.js.

### 3️⃣ Peer Support & Legal Resources
- **Verified Support Groups** – moderated channels for shared experiences.
- **Legal Mediation Directory** – links to NALSA, state‑level legal aid, and NGO counselling.
- **Crisis Helplines** – instant access to national services (e.g., 112, 1800‑891‑4416).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18 (tested on 18, 20, 22)
- **npm** (or **yarn**) for package management
- **MongoDB** instance (local or remote) – connection URI in `.env`

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/relife-ai.git
cd relife-ai

# Install dependencies
npm install

# Set up environment variables (copy from .env.example)
cp .env.example .env
# Edit .env as needed (MongoDB URI, JWT secret, etc.)
```

### Running the Backend
```bash
# Development mode with auto‑reload
npm run dev
```
The API will be available at `http://localhost:3000` (or the port defined in `.env`).

### Running Tests
```bash
npm test
```
All test suites pass (125 tests, 5 suites).

---

## 📚 API Documentation
The backend exposes a REST‑ful JSON API under `/api/journal`. Key endpoints:
- `POST /api/journal` – create a journal entry (user ID inferred from JWT).
- `GET /api/journal` – list paginated entries, supports `search`, `mood`, `page`, `limit`.
- `GET /api/journal/:id` – retrieve a single entry (owner‑only).
- `PUT /api/journal/:id` – update title, content, mood.
- `DELETE /api/journal/:id` – delete an entry.

Authentication is via Bearer JWT tokens. See `backend/src/middleware/auth.js` for details.

---

## 🤝 Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/awesome-feature`).
3. Write tests for your changes.
4. Ensure `npm test` passes.
5. Submit a Pull Request with a clear description.

Please follow the existing code style and run `npm run lint` (if configured) before submitting.

---

## 📄 License
This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

---

## 👀 Want to See More?
- **Demo UI** – open `frontend/dashboard.html` in a browser.
- **Architecture Diagram** – see `docs/architecture.md`.
- **Roadmap** – check `docs/AI_IMPLEMENTATION_PLAN.md`.

Feel free to open issues or contact the maintainers for any questions.


[![Tests](https://img.shields.io/badge/Tests-125%20Passed-emerald.svg)](tests/)
[![Node.js](https://img.shields.io/badge/Node.js-18%20|%2020%20|%2022-blue.svg)](package.json)
[![Express](https://img.shields.io/badge/Express-5.1.0-slate.svg)](backend/src/app.js)
[![License](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)

**ReLife** is a comprehensive, privacy-first emotional wellness and support platform designed for individuals navigating relationship separation, divorce, and major life transitions.

The platform combines **peer support groups**, **verified legal mediation resources**, a **Daily Mood & Sentiment Journal**, and an **AI Emotional Support Assistant** powered by **Retrieval-Augmented Generation (RAG)** with deterministic safety guardrails.

---

## 🌟 Key Capabilities

### 1. 🤖 AI Emotional Support Assistant (RAG + Safety Guardrails)
- **Empathetic Conversational Guide**: Supportive active listening focused on emotional coping, grounding exercises, and divorce transition guidance.
- **Retrieval-Augmented Generation (RAG)**: Grounded in a curated knowledge base of **verified, authoritative organizations** with real URLs, publishers, and review dates (no synthetic or invented sources).
  - *Tele-MANAS* (MoHFW India, `14416` / `1800-891-4416`)
  - *KIRAN Mental Health* (Ministry of Social Justice, `1800-599-0019`)
  - *Pan-India Emergency Response System* (`112`)
  - *National Legal Services Authority (NALSA)* (Statutory free legal aid & pre-litigation mediation)
  - *American Psychological Association (APA)* (Healthy divorce coping & grief boundaries)
  - *National Institute of Mental Health (NIMH)* (Grounding & anxiety regulation techniques)
  - *Association of Family and Conciliation Courts (AFCC)* (Child-centered shared parenting plans)
  - *NHS Every Mind Matters* (Loneliness & isolation management)
- **Deterministic Crisis Safety Guardrail**: Immediately intercepts explicit self-harm, suicidal ideation, or acute danger patterns and outputs verified 24/7 helplines without calling the LLM.
- **Safety Invariant**: *Sentiment scores alone never trigger a crisis determination*.
- **Prompt Injection Defense**: Treats user inputs and retrieved documents as strictly untrusted data enclosed in boundary delimiters (`<user_message>`, `<retrieved_context>`), neutralizing system override attempts.
- **Configurable LLM Provider**: Supports Google Gemini API (`gemini-1.5-flash`), OpenAI (`gpt-4o-mini`), or local Mock adapters with zero server-side API keys exposed to browsers.

### 2. 📖 AI Mood Analyzer & Private Journal
- **Distraction-Free Journal Editor**: Daily reflection journaling with 1–5 self-reported mood picker, autosave, and character counter.
- **Automated Sentiment Classification**: Modular inference engine estimating continuous sentiment score (-1.0 to +1.0), positive/neutral/negative label, confidence, uncertainty, and detected emotions.
- **Longitudinal Trend Visualizations**: Interactive 7-day, 30-day, and 90-day sentiment trajectories and mood balance powered by Chart.js.
- **Privacy Boundary**: Journal entries are **never** shared with the AI chat assistant unless the user explicitly checks the opt-in checkbox (`includeJournalContext: true`).
- **Non-Clinical Disclaimer**: Persistent notices clarifying that sentiment analysis is for personal self-reflection, not medical or psychiatric diagnosis.

### 3. 👥 Community & Peer Support Groups
- Moderated support circles categorized by topic (Women Support, Men Support, Co-Parenting, Financial Independence, Legal Navigation).
- Participant management, scheduled calendar meetings, and video integration.

### 4. 🔐 Real-Application Authentication & Role-Based Authorization
- **Unified Client Architecture (`frontend/authClient.js`)**: Single modular auth controller delivering persistent multi-page session management across all application pages (`index.html`, `dashboard.html`, `journal.html`, `support-chat.html`, `moderator-dashboard.html`, `admin-dashboard.html`).
- **Modern User Profile Navigation Widget**:
  - Live Avatar pill with user initials (e.g. `SM`, `PS`, `RS`) and custom role badge (`Member`, `Moderator`, `Admin`).
  - Interactive profile dropdown menu displaying authenticated account credentials, quick portal navigation, 1-click test persona switcher, and full sign-out.
  - Reactive sync via custom events (`relife:authChange`) ensuring instant UI state updates across concurrent tabs.
- **4-in-1 Accessible Sign-In Modal**:
  - **🔑 Email / Username & Real Password (Primary & Recommended)**: Standard consumer SaaS registration and sign-in with secure `bcryptjs` password hashing, show/hide password toggle, and role selection (`POST /api/auth/register` & `POST /api/auth/login`).
  - **📱 Phone OTP Verification**: Full Indian 10-digit mobile number validation calling `POST /api/auth/send-otp` & `POST /api/auth/verify-otp`. In development/demo mode, provides a 1-click auto-fill chip for the generated OTP code.
  - **⚡ 1-Click Fast Personas**: Frictionless switching between genuine roles (`Sarah Miller - Member`, `Dr. Priya Sharma - Moderator`, `Rajesh Sethi - Super Admin`) calling `POST /api/auth/demo-login`.
  - **🛠 Custom JWT Tab**: Direct developer token inspection and custom token injection.
- **Backend Role-Based Access Control (RBAC)**:
  - `authenticateToken`: Validates Bearer JWT tokens, extracts authenticated user context, and normalizes `req.user.userId` and `req.user.role`.
  - `isModerator` & `isAdmin`: Route guards verifying privileged operations.
  - `GET /api/auth/me`: Secure profile endpoint validating current token and returning user roles and profile details.
- **Strict Multi-Tenant Isolation**: All database operations verify `{ _id: id, userId: req.user._id }`. Users cannot read, modify, or delete another user's journal or chat history.
- **Rate Limiting**: Express rate limiting on general API (100 req / 15m) and chat endpoints (60 messages / 15m).
- **Auto-Expiring Chat History**: 30-day MongoDB TTL index (`expires: '30d'`).
- **Zero Content Logging**: Journal reflections and chat messages are never logged to console or server logs.

### 5. 💳 Payment Integration
- Razorpay order creation, signature verification, and dynamic UPI QR code generation for premium support tier access.

---

## 📁 Repository Structure

```
ReLife-AI/
├── frontend/                                # Static Web Application
│   ├── index.html                           # Landing page & feature overview
│   ├── dashboard.html                       # User dashboard with twin AI banners
│   ├── journal.html                         # AI Mood Analyzer & Journal Visualizer
│   ├── support-chat.html                    # AI Emotional Support Assistant Chat
│   ├── about.html                           # Platform about & mission
│   ├── contact.html                         # Contact & support desk
│   ├── admin-dashboard.html                 # Administrator control panel
│   ├── moderator-dashboard.html             # Moderator community management
│   ├── js/                                  # Modular client scripts
│   └── css/                                 # Custom stylesheets
├── backend/                                 # Express 5 REST API Tier
│   └── src/
│       ├── app.js                           # Express entry point & CORS configuration
│       ├── config/
│       │   ├── database.js                  # MongoDB connection manager
│       │   └── llm.js                       # LLM provider configuration & getters
│       ├── knowledge/
│       │   └── wellnessResources.js         # Verified RAG knowledge base & citations
│       ├── middleware/
│       │   ├── auth.js                      # JWT token authentication & role gates
│       │   └── errorHandler.js              # Centralized error handler
│       ├── models/
│       │   ├── User.js                      # User profile & credentials schema
│       │   ├── Journal.js                   # Journal schema with sentiment indexes
│       │   ├── ChatHistory.js               # Chat history with citations & 30d TTL
│       │   ├── Group.js                     # Community support groups schema
│       │   └── Payment.js                   # Transaction & Razorpay order schema
│       ├── routes/
│       │   ├── auth.js                      # OTP & JWT authentication routes
│       │   ├── journal.js                   # Journal CRUD & longitudinal analytics
│       │   ├── chatbot.js                   # AI Support Chat & legacy FAQ routes
│       │   ├── groups.js                    # Support group community endpoints
│       │   ├── users.js                     # User profile management
│       │   ├── moderator.js                 # Moderator management routes
│       │   ├── admin.js                     # Platform administration routes
│       │   └── payments.js                  # Razorpay & UPI payment endpoints
│       └── services/
│           ├── supportAssistantService.js   # Chat orchestration, RAG & privacy check
│           ├── sentimentService.js          # Longitudinal analytics & trend aggregator
│           ├── chatbotService.js            # Legacy rule-based FAQ helper
│           ├── paymentService.js            # Payment gateway business logic
│           ├── rag/
│           │   ├── ragService.js            # Keyword & token retrieval engine
│           │   ├── safetyGuard.js           # Deterministic crisis & helpline guardrail
│           │   ├── promptBuilder.js         # Prompt boundaries & injection defense
│           │   └── llmAdapter.js            # Gemini / OpenAI / Mock provider adapter
│           └── sentiment/
│               └── sentimentAdapter.js      # Modular sentiment classification adapter
├── docs/                                    # Architectural & Deployment Documentation
│   ├── AI_IMPLEMENTATION_PLAN.md            # Multi-phase engineering roadmap
│   ├── CODEBASE_AUDIT.md                    # Initial baseline codebase audit
│   ├── SENTIMENT_MODEL_EVALUATION.md        # Sentiment model card & license analysis
│   └── DEPLOYMENT_AND_OPERATIONS_GUIDE.md   # Hosting, billing & operations guide
├── tests/                                   # Automated Integration & Unit Tests
│   ├── journal.test.js                      # Journal CRUD & user-isolation tests (31 tests)
│   ├── sentiment.test.js                    # Sentiment inference & trends tests (18 tests)
│   ├── ragChat.test.js                      # RAG citations, crisis & safety tests (22 tests)
│   ├── frontend.test.js                     # Static delivery & UI states tests (38 tests)
│   └── e2eIntegration.test.js               # End-to-end integration review (10 tests)
├── .env.example                             # Environment variables template
├── vercel.json                              # Clean URL routing configuration
└── package.json                             # Dependencies, scripts & engine specs
```

---

## 🛠 Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or higher (tested on Node v20 & v22)
- **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017`) or MongoDB Atlas URI
- *(Optional)* **Google Gemini API Key**: For cloud generative support (`gemini-1.5-flash`)
- *(Optional)* **Twilio Credentials**: For mobile OTP verification

### Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ReLife-AI
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your settings (see [Environment Variables Reference](#-environment-variables)).

4. Start development server:
   ```bash
   npm run dev
   ```
   The backend API will run on `http://localhost:5000` and serve the frontend at `http://localhost:5000/`.

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Port for the Express backend server |
| `NODE_ENV` | Yes | `development` | Environment mode (`development`, `production`, `test`) |
| `MONGODB_URI` | Yes | `mongodb://localhost:27017/onlydivorce` | MongoDB connection URI |
| `JWT_SECRET` | Yes | - | Secret key for signing and verifying JWT tokens |
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Production frontend domain for CORS validation |
| `SENTIMENT_PROVIDER` | No | `mock` | Sentiment analysis engine (`mock`, `transformers`, `gemini`) |
| `LLM_PROVIDER` | No | `mock` | LLM provider for support chat (`mock`, `gemini`, `openai`) |
| `LLM_TIMEOUT_MS` | No | `12000` | Timeout threshold in milliseconds before fallback |
| `GEMINI_API_KEY` | Conditional | - | API key required if `LLM_PROVIDER=gemini` |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | Google Gemini model name |
| `OPENAI_API_KEY` | Conditional | - | API key required if `LLM_PROVIDER=openai` |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model name |
| `TWILIO_ACCOUNT_SID`| Optional | - | Twilio Account SID for SMS OTP |
| `TWILIO_AUTH_TOKEN` | Optional | - | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER`| Optional| - | Twilio phone number |
| `RAZORPAY_KEY_ID`   | Optional | - | Razorpay public key ID |
| `RAZORPAY_KEY_SECRET`| Optional| - | Razorpay secret key |

---

## 📡 Core API Reference

### 1. Authentication (`/api/auth`)
- `POST /api/auth/send-otp` — Request 6-digit SMS OTP for mobile verification.
- `POST /api/auth/verify-otp` — Verify OTP and receive JWT access token.

### 2. Mood & Reflection Journal (`/api/journal`)
*All journal endpoints require `Authorization: Bearer <token>`.*
- `POST /api/journal` — Create new journal entry with optional mood rating (1–5) and tags.
- `GET /api/journal` — Retrieve paginated journal entries for authenticated user (`?page=1&limit=15&search=`).
- `GET /api/journal/:id` — Get single journal entry (verifies `userId === req.user._id`).
- `PUT /api/journal/:id` — Update journal entry title, content, or mood rating.
- `DELETE /api/journal/:id` — Delete journal entry.
- `POST /api/journal/:id/analyze` — Trigger on-demand sentiment re-analysis for an entry.
- `GET /api/journal/analytics/trends` — Get longitudinal trends (`?period=7d|30d|90d`).
- `GET /api/journal/analytics/summary` — Get high-level summary KPIs (total entries, % positive, average mood).

### 3. AI Emotional Support Assistant (`/api/chatbot`)
*All chat endpoints require `Authorization: Bearer <token>`.*
- `POST /api/chatbot/message` — Send message to AI Support Assistant.
  - **Payload**:
    ```json
    {
      "message": "How do I cope with acute anxiety after separation?",
      "sessionId": "optional-uuid",
      "includeJournalContext": false,
      "userLocation": "India"
    }
    ```
  - **Response**:
    ```json
    {
      "success": true,
      "sessionId": "b47e45e9-...",
      "response": "When emotional overwhelm peaks...",
      "citations": [
        {
          "title": "Caring for Your Mental Health: Grounding & Regulating Major Life Transitions",
          "publisher": "National Institute of Mental Health (NIMH)",
          "url": "https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health",
          "reviewDate": "2024-02-12"
        }
      ],
      "escalated": false,
      "crisisDetected": false,
      "disclaimer": "ReLife AI provides emotional wellness support, not medical diagnosis or therapy."
    }
    ```
- `GET /api/chatbot/sessions` — List all past chat sessions belonging strictly to the authenticated user.
- `GET /api/chatbot/history?sessionId=...` — Retrieve message history for a specific session (ownership enforced; cross-user returns `403 Forbidden`).
- `DELETE /api/chatbot/history/:sessionId` — Delete conversation history for a session.

---

## 🧪 Testing & Verification

The repository includes a comprehensive automated test suite built with **Jest**:

```bash
# Run all test suites
npm test
```

### Test Suites Overview
| Test Suite | File | Focus | Test Count |
|---|---|---|---|
| **Journal Backend** | [tests/journal.test.js](tests/journal.test.js) | JWT auth, isolated CRUD, input validation, multi-tenant boundaries | 31 tests |
| **Sentiment & Analytics** | [tests/sentiment.test.js](tests/sentiment.test.js) | Score calculation, emotion tags, failure fallback, longitudinal trends | 18 tests |
| **RAG & Support Chat** | [tests/ragChat.test.js](tests/ragChat.test.js) | RAG citations, crisis escalation, prompt injection, provider outage | 22 tests |
| **Frontend Applications** | [tests/frontend.test.js](tests/frontend.test.js) | Static delivery, clean routing, disclaimer notices, UI states, ARIA | 38 tests |
| **E2E Integration** | [tests/e2eIntegration.test.js](tests/e2eIntegration.test.js) | CORS, cross-user isolation, crisis invariant, journal privacy | 10 tests |
| **Total** | | **All 5 Test Suites Passing** | **119 tests** |

---

## 🚀 Deployment

### Frontend (Vercel)
The project includes [vercel.json](vercel.json) with clean URL rewrites:
```bash
# Deploy frontend to Vercel
vercel --prod
```
Clean routes:
- `/` ➔ `frontend/index.html`
- `/dashboard` ➔ `frontend/dashboard.html`
- `/journal` ➔ `frontend/journal.html`
- `/support-chat` ➔ `frontend/support-chat.html`
- `/chat` ➔ `frontend/support-chat.html`

### Backend (Google Cloud Run / Docker)
The project includes `Dockerfile` and `cloudbuild.yaml`:
```bash
# Build container image
docker build -t gcr.io/<PROJECT_ID>/relife-backend:v1.0.0 .

# Deploy container to Cloud Run
gcloud run deploy relife-backend \
  --image gcr.io/<PROJECT_ID>/relife-backend:v1.0.0 \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PORT=8080,LLM_PROVIDER=gemini,FRONTEND_URL=https://relife.app
```
For complete billing estimates, ONNX model download requirements, and data retention operations, see **[docs/DEPLOYMENT_AND_OPERATIONS_GUIDE.md](docs/DEPLOYMENT_AND_OPERATIONS_GUIDE.md)**.

---

## 🛡 Ethical AI, Safety & Privacy Guardrails

1. **Non-Clinical & Non-Legal Boundary**:
   ReLife provides supportive peer and wellness information. Persistent notices remind users:
   > *"ReLife AI provides emotional wellness support and coping information, not medical diagnosis, psychiatric treatment, or licensed legal counsel."*
2. **Immediate Crisis Helplines**:
   Deterministic regex pattern matching flags explicit self-harm or acute danger and provides verified 24/7 helplines:
   - **India**: Tele-MANAS (`14416` / `1800-891-4416`), KIRAN (`1800-599-0019`), Emergency (`112`), NCW (`7827170170`)
   - **USA / Canada**: 988 Suicide & Crisis Lifeline (`988`), Crisis Text Line (Text HOME to `741741`)
   - **United Kingdom**: Samaritans (`116 123`), NHS (`111`), Emergency (`999`)
   - **Australia**: Lifeline (`13 11 14`), Emergency (`000`)
3. **Sentiment Score Invariant**:
   Sentiment score calculations alone **never** trigger a crisis determination.
4. **Explicit Journal Privacy**:
   Journal entries are never queried or transmitted to third-party LLMs unless the user explicitly checks the opt-in checkbox in the chat UI.
5. **Auto-Purging**:
   Chat conversations automatically expire after 30 days via MongoDB TTL indexes.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

*Built with care to provide supportive, grounded, and safe guidance for individuals rebuilding their lives.*
