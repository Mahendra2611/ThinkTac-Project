# Prep Buddy — Interview Feedback Backend: Implementation Plan

> **Scope:** Production-grade backend service to persist and retrieve AI-generated interview session feedback via Firestore.  
> **Product context:** Prep Buddy — users practice interview questions and receive AI feedback on their answers.  
> **Mindset:** Build for real users, integration, and deployment — not as a throwaway assignment.

---

## 1. Requirements Summary

| Requirement | Detail |
|---|---|
| Database | Firestore |
| Language | TypeScript (strict mode) |
| Endpoints | `POST /v1/sessions`, `GET /v1/sessions/:userId`, `DELETE /v1/sessions/:sessionId` |
| POST behavior | Validate input → generate feedback via Gemini → save `{ userId, question, answer, feedback, createdAt }` → return saved document |
| GET behavior | Return all sessions for `userId`, ordered by `createdAt` descending |
| DELETE behavior | Delete a single session by document ID |
| Validation | Basic input validation on all write/read params |
| Auth | Not required now; document where it would be added |
| README | Setup steps, env var names (no real keys), local run instructions |
| Frontend | Optional — not in scope |

All public routes are **version-prefixed** (`/v1/...`) so future breaking changes can ship as `/v2/...` without disrupting existing clients.

---

## 2. Recommended Stack & Rationale

### Choice: **Express + TypeScript + Firebase Admin SDK**

| Option | Verdict | Reason |
|---|---|---|
| **Express + firebase-admin** ✅ | **Selected** | Clearest REST mapping to the three required endpoints; simplest local dev (`ts-node-dev` / `nodemon`); no framework coupling; easy to test in isolation; deployable to Cloud Run, Render, or wrapped in Cloud Functions later without rewrite |
| Firebase Cloud Functions (HTTP) | Viable alternative | Native Firebase deployment and scaling, but colder local emulator setup, function cold starts, and HTTP routing is less ergonomic than a dedicated Express app for a 3-endpoint service |
| Next.js API routes | Not selected | Adds App/Pages Router structure and build pipeline for a backend-only task; frontend is explicitly optional and does not improve the submission |

**Why not Cloud Functions as primary:** For three CRUD-ish endpoints with no Firebase-trigger logic, a standalone Express service keeps the codebase small, the request lifecycle obvious, and local debugging straightforward. The same Express app can be exported as a Cloud Function handler in one line if deployment to Firebase is required later — we preserve optionality without paying complexity cost upfront.

**Why firebase-admin (not client SDK):** Server-side Admin SDK bypasses security rules (trusted backend), supports batch/query operations cleanly, and is the standard pattern for backend services writing to Firestore.

**LLM provider: Google Gemini (required in production):**

| Option | Verdict | Reason |
|---|---|---|
| **Gemini API** ✅ | **Selected** | Free tier via Google AI Studio; sufficient for short interview feedback; fast models (`gemini-2.0-flash`); official `@google/generative-ai` SDK; same Google ecosystem as Firebase |
| OpenAI | Not selected | Typically requires paid credits; no advantage for this use case |
| Deterministic stub (runtime fallback) | **Not used in production** | Misleading to real users expecting genuine AI coaching; mocks belong in unit tests only |

---

## 3. Architecture

```
┌─────────────┐     HTTP      ┌──────────────────────────────┐
│   Client    │ ────────────► │  Express API (TypeScript)    │
│  (Prep Buddy│               │  ┌────────────────────────┐  │
│   frontend) │               │  │ /v1/sessions routes    │  │
└─────────────┘               │  └──────────┬─────────────┘  │
                              │             │                │
                              │  ┌──────────▼─────────────┐  │
                              │  │ Validation middleware  │  │
                              │  └──────────┬─────────────┘  │
                              │             │                │
                              │  ┌──────────▼─────────────┐  │
                              │  │ SessionService         │  │
                              │  │ (orchestration)        │  │
                              │  └──────────┬─────────────┘  │
                              │             │                │
                              │  ┌──────────▼─────────────┐  │
                              │  │ FeedbackService        │  │
                              │  │ (Gemini API)           │  │
                              │  └──────────┬─────────────┘  │
                              │             │                │
                              │  ┌──────────▼─────────────┐  │
                              │  │ SessionRepository      │  │
                              │  │ (Firestore access)     │  │
                              │  └──────────┬─────────────┘  │
                              │             │                │
                              │  ┌──────────▼─────────────┐  │
                              │  │ Global error handler   │  │
                              │  │ (AppError → JSON)      │  │
                              │  └────────────────────────┘  │
                              └─────────────┼────────────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │  Firestore                │
                              │  collection: `sessions`   │
                              └───────────────────────────┘
```

### Layer responsibilities

| Layer | Responsibility |
|---|---|
| **Routes** | HTTP method/path mapping under `/v1`; delegate to controllers; no business logic |
| **Controllers** | Parse request, call service, send response; thin — one concern per handler |
| **Validation** | Reject malformed requests before any side effects (`400`) |
| **SessionService** | Orchestrates feedback generation + persistence; enforces fail-closed semantics |
| **FeedbackService** | Calls Gemini API with timeout; throws typed errors on failure |
| **SessionRepository** | All Firestore I/O — single place for queries and writes |
| **Global error handler** | Catches all thrown errors; maps to consistent JSON + HTTP status |

---

## 4. Firestore Data Model

**Collection:** `sessions`

**Document fields:**

```typescript
{
  userId: string;       // partition key for user queries
  question: string;
  answer: string;
  feedback: string;     // AI-generated via Gemini — always present on saved docs
  createdAt: Timestamp; // server-set on write (FieldValue.serverTimestamp())
}
```

**Document ID:** Auto-generated by Firestore (`add()` or `doc().id`) — returned to client on POST; used for DELETE.

**Invariant:** A document is only written after feedback generation succeeds. No partial or pending states in v1.

### Indexing

- **Query:** `where('userId', '==', userId).orderBy('createdAt', 'desc')`
- **Composite index required:** `userId` (Ascending) + `createdAt` (Descending)
- Firestore will provide a console link on first failed query; document this in README.

### Trade-off: flat collection vs subcollection

| Approach | Pros | Cons |
|---|---|---|
| **Flat `sessions` with `userId` field** ✅ | Simple DELETE by doc ID; one collection to manage; easy cross-user admin queries later | Requires composite index |
| `users/{userId}/sessions/{sessionId}` | Natural ownership hierarchy | DELETE needs userId + sessionId or collection group query; slightly more complex paths |

**Decision:** Flat collection — DELETE is specified as `/v1/sessions/:sessionId` only (no userId in path), so top-level documents with auto IDs fit the API contract cleanly.

---

## 5. API Contract

Base path: **`/v1`**

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/sessions` | Create session with AI feedback |
| `GET` | `/v1/sessions/:userId` | List user sessions (newest first) |
| `DELETE` | `/v1/sessions/:sessionId` | Delete a session |

### `POST /v1/sessions`

**Request body (JSON):**

```json
{
  "userId": "user_abc123",
  "question": "Tell me about a time you handled conflict.",
  "answer": "In my last role, I..."
}
```

**Validation rules:**

| Field | Rules |
|---|---|
| `userId` | Required, non-empty string, max 128 chars |
| `question` | Required, non-empty string, max 2000 chars |
| `answer` | Required, non-empty string, max 10000 chars |

**Happy-path flow:**

1. Validate body → `400` on failure
2. Call `FeedbackService.generate(question, answer)` with server-side timeout
3. On success → build document with `createdAt: serverTimestamp()`
4. `sessions.add(...)` → return `{ id, ...fields, createdAt }` as `201`

**Failure handling (fail-closed — no partial writes):**

| Scenario | HTTP status | Behavior |
|---|---|---|
| Invalid input | `400 Bad Request` | Reject before calling Gemini or Firestore |
| Gemini responds within timeout | `201 Created` | Save full document; return saved doc |
| Gemini exceeds timeout | `504 Gateway Timeout` | **Do not save**; return `{ error, code }` |
| Gemini API error (5xx, bad key) | `502 Bad Gateway` | **Do not save**; log error server-side |
| Gemini quota / rate limit exceeded | `503 Service Unavailable` | **Do not save**; user-friendly retry message |
| Firestore write failure | `500 Internal Server Error` | Log error; return generic message (no stack trace in prod) |

**Why fail-closed:** Real users must never see a saved session without feedback, or retry and get inconsistent state. Either the full session is created or nothing is persisted.

**Response shape (201):**

```json
{
  "id": "firestore-doc-id",
  "userId": "user_abc123",
  "question": "...",
  "answer": "...",
  "feedback": "Your answer could be strengthened by...",
  "createdAt": "2026-06-25T10:30:00.000Z"
}
```

**Future note:** Duplicate sessions on retry are acceptable in v1. Idempotency keys (`Idempotency-Key` header) can be added in v2 without breaking v1 clients.

---

### `GET /v1/sessions/:userId`

**Validation:** `userId` param required, non-empty string.

**Flow:**

1. Query Firestore with filter + order
2. Return plain array of sessions (simplest contract for frontend integration)

**Response:** `200` with sessions ordered newest first.

**Empty result:** `200` with `[]` (not 404 — user may have no sessions yet).

**Errors:** Firestore failures → `500` via global error handler.

---

### `DELETE /v1/sessions/:sessionId`

**Validation:** `sessionId` param required, non-empty string.

**Flow:**

1. `sessions.doc(sessionId).delete()`
2. Idempotent delete → return `204 No Content` regardless of prior existence

**Trade-off:** Idempotent DELETE (204 always) vs strict 404. Idempotent DELETE reduces client complexity and matches Firestore's native delete behavior.

---

## 6. Feedback Generation (Gemini)

### Production behavior — Gemini required, no runtime stub

- **`GEMINI_API_KEY` is required at startup** — server fails fast on boot if missing (do not silently degrade).
- Use **`@google/generative-ai`** SDK with model **`gemini-2.0-flash`** (fast, cost-effective for 2–3 sentence feedback).
- **No production fallback to stub** — real users always receive genuine AI feedback or a clear error.
- **Stub/mock only in unit tests** — inject a mock `FeedbackService` in tests; never in runtime code paths.

### Prompt design

- System instruction: concise interview coach persona; 2–3 sentences of actionable feedback.
- User message: include `question` and `answer`.
- Keep `maxOutputTokens` low (~150) to control latency and cost.

### Resilience

| Concern | Implementation |
|---|---|
| Slow response | Server-side timeout via `AbortSignal` or `Promise.race` — default **20s** (`FEEDBACK_TIMEOUT_MS`) |
| API down / network error | Catch, log with context, throw `ExternalServiceError` → global handler → `502` |
| Timeout | Throw `TimeoutError` → global handler → `504` |
| Rate limit / quota | Detect 429 or quota errors → throw `ServiceUnavailableError` → `503` |
| Partial save | **Never** — feedback must succeed before Firestore write |

### Free tier awareness (document in README)

- Gemini free tier has rate limits (requests per minute/day) — sufficient for demo and early users.
- When limits are hit, return `503` with a user-friendly message; do not expose raw Google API errors to clients.

---

## 7. Project Structure

```
ThinkTac/
├── src/
│   ├── index.ts                      # App entry, listen on PORT
│   ├── app.ts                        # Express app factory (testable)
│   ├── config/
│   │   └── env.ts                    # Typed env loading + fail-fast validation
│   ├── routes/
│   │   ├── index.ts                  # Mounts /v1 router
│   │   └── v1/
│   │       └── sessions.routes.ts
│   ├── controllers/
│   │   └── sessions.controller.ts    # Thin HTTP handlers
│   ├── services/
│   │   ├── feedback.service.ts       # Gemini integration
│   │   └── session.service.ts        # Orchestrates feedback + persist
│   ├── repositories/
│   │   └── session.repository.ts     # All Firestore I/O
│   ├── middleware/
│   │   ├── validate.ts               # Zod-based request validation
│   │   └── errorHandler.ts           # Global error middleware (last in chain)
│   ├── errors/
│   │   ├── AppError.ts               # Base error class (statusCode, code, message)
│   │   ├── ValidationError.ts
│   │   ├── ExternalServiceError.ts   # Gemini failures → 502
│   │   ├── TimeoutError.ts           # → 504
│   │   └── ServiceUnavailableError.ts # Quota/rate limit → 503
│   ├── lib/
│   │   └── firebase.ts               # Singleton Admin SDK init
│   └── types/
│       └── session.types.ts
├── firebase/
│   └── serviceAccount.example.json   # Template only — never commit real key
├── package.json
├── tsconfig.json                     # "strict": true
├── .env.example
├── .gitignore
├── README.md
└── PLAN.md
```

**Why this structure:** Thin routes/controllers, focused services, isolated data access, centralized errors — each layer has one reason to change. Easy to test, extend, and onboard new developers.

---

## 8. Coding Standards & Production Practices

These conventions apply to every file. The goal is code that is **easy to read, maintain, modify, and scale** when Prep Buddy integrates this service in production.

### 8.1 Small, focused functions

- **Single responsibility** — each function does one thing (validate, call Gemini, map to DTO, write to Firestore).
- **Target size** — aim for **≤ 20–30 lines** per function; extract helpers when logic grows.
- **Controllers stay thin** — parse request → call one service method → send response. No Firestore or Gemini calls in controllers.
- **Services orchestrate; repositories persist** — never mix HTTP concerns with data access.

```typescript
// Good — orchestration is readable at a glance
async createSession(input: CreateSessionInput): Promise<Session> {
  const feedback = await this.feedbackService.generate(input.question, input.answer);
  return this.sessionRepository.create({ ...input, feedback });
}

// Avoid — one giant handler doing validation + LLM + Firestore + response formatting
```

### 8.2 Graceful error handling everywhere

- **Never swallow errors silently** — catch only to add context, rethrow typed errors, or log + map to HTTP response.
- **Use typed custom errors** (`AppError` hierarchy) instead of raw strings or magic numbers in handlers.
- **Fail fast on config** — validate env vars at startup; crash with clear message if `GEMINI_API_KEY` or Firebase config is missing.
- **No unhandled promise rejections** — wrap async route handlers; global handler catches the rest.
- **User-facing vs internal messages** — clients get safe, actionable messages; logs get full detail (error code, userId, requestId).
- **Never expose stack traces in production** — `NODE_ENV=production` returns generic `500` body.

### 8.3 Global error handler (mandatory)

All errors flow through a single Express error middleware registered **last** in the middleware chain:

```typescript
// Consistent error response shape for all endpoints
{
  "error": "Human-readable message",
  "code": "FEEDBACK_TIMEOUT"   // machine-readable for client handling
}
```

| Error type | Status | `code` example |
|---|---|---|
| `ValidationError` | `400` | `VALIDATION_ERROR` |
| `ExternalServiceError` | `502` | `FEEDBACK_GENERATION_FAILED` |
| `TimeoutError` | `504` | `FEEDBACK_TIMEOUT` |
| `ServiceUnavailableError` | `503` | `SERVICE_UNAVAILABLE` |
| Unknown / Firestore | `500` | `INTERNAL_ERROR` |

Controllers and services **throw** typed errors; they do not call `res.status()` for error cases (except explicit 404 routing). This keeps error mapping in one place.

### 8.4 API versioning

- All routes live under **`/v1`** — mounted via a versioned router (`app.use('/v1', v1Router)`).
- Breaking changes (field renames, response shape) ship as **`/v2`** while `/v1` remains stable for existing clients.
- Version appears in URL path (not headers) — simplest for frontend teams and API docs.
- Health check at **`GET /health`** (unversioned) for load balancers and deployment probes.

### 8.5 TypeScript strictness

- `"strict": true` in `tsconfig.json` — no exceptions.
- **No `any`** in core paths — use explicit types and Zod-inferred types for request bodies.
- Define shared types in `types/` — `Session`, `CreateSessionInput`, `SessionResponse`.
- Prefer `unknown` + narrowing over `any` in catch blocks.

### 8.6 Validation with Zod

- One schema per endpoint input (body params, route params).
- Validation middleware returns `400` with field-level `details` array when schema fails.
- Typed output from `schema.parse()` flows into services — no re-parsing.

### 8.7 Dependency injection (lightweight)

- Pass repositories and services into constructors or factory functions — enables unit testing with mocks without a DI framework.
- Firebase Admin initialized once in `lib/firebase.ts` — imported by repository only.

### 8.8 Logging (production-ready)

- Use structured logging (`pino` or `winston`) — JSON in production, pretty in dev.
- Log at appropriate levels: `info` for requests, `warn` for 4xx, `error` for 5xx and external failures.
- Include correlation context: `requestId`, `userId`, `sessionId` where applicable.
- **Never log** API keys, full answers, or PII beyond what is necessary.

### 8.9 Configuration & secrets

- All config from environment variables — loaded and validated once in `config/env.ts`.
- `.env` for local dev; platform env vars (Cloud Run, Render) for production.
- **Never commit secrets** — `.env`, service account JSON, and API keys stay out of git.

### 8.10 Testability

- Unit test services and validation with mocked dependencies.
- Mock `FeedbackService` in tests — no real Gemini calls in CI.
- Optional integration tests against Firestore emulator for repository layer.
- Keep tests next to source or in `__tests__/` — mirror production structure.

### 8.11 Code readability conventions

- Descriptive names over abbreviations (`sessionRepository`, not `sr`).
- Early returns for guard clauses — reduce nesting.
- Avoid premature abstraction — three similar lines beat a premature generic helper.
- Consistent file naming: `*.service.ts`, `*.repository.ts`, `*.controller.ts`, `*.routes.ts`.

---

## 9. Key Trade-offs (Senior Engineer View)

| Decision | Choice | Rationale |
|---|---|---|
| Runtime framework | Express | Minimal, explicit, matches REST spec; production-deployable |
| Firestore access | Repository pattern | Swappable for tests; queries not scattered in handlers |
| LLM provider | Gemini (required) | Free tier, fast models, Google ecosystem alignment with Firebase |
| Runtime stub fallback | **None** | Real users must get real feedback or a clear error |
| `createdAt` | Server timestamp | Prevents client clock skew; trustworthy ordering |
| API versioning | URL prefix `/v1` | Safe evolution without breaking integrated clients |
| Error handling | Global handler + typed errors | One place to map errors; consistent client experience |
| POST failure | Fail-closed (no save) | Data integrity — no sessions without feedback |
| Auth | Deferred | Requirement allows omission; hooks documented below |
| Pagination on GET | Not in v1 | YAGNI — add `limit` + cursor in v2 when scale demands |
| Response on DELETE | 204 idempotent | Simpler client; matches Firestore behavior |
| Validation library | Zod | Typed schemas, clear 400 messages, minimal boilerplate |
| Error response shape | `{ error, code }` | Human + machine readable; easy frontend handling |
| Async feedback (queue) | Not in v1 | Synchronous flow is correct for 3-endpoint scope; queues add complexity |

---

## 10. Environment Variables

Document in `.env.example` and README (no real values in repo):

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default `3000`) | HTTP server port |
| `NODE_ENV` | No | `development` \| `production` |
| `FIRESTORE_PROJECT_ID` | Yes | Firebase project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes (local/cloud) | Path to Firebase service account JSON |
| `GEMINI_API_KEY` | **Yes** | Google AI Studio API key — **required at startup** |
| `GEMINI_MODEL` | No (default `gemini-2.0-flash`) | Gemini model for feedback generation |
| `FEEDBACK_TIMEOUT_MS` | No (default `20000`) | Max wait for Gemini response before 504 |

**Local Firebase options:**

1. **Firebase Emulator Suite** — no cloud billing; set `FIRESTORE_EMULATOR_HOST`
2. **Real Firebase project** — service account from Firebase console

README will cover both paths. Emulator preferred for local dev without cloud setup.

**Gemini API key:** Obtain from [Google AI Studio](https://aistudio.google.com/apikey). Document free-tier rate limits; never commit the key.

---

## 11. HTTP Status Code Reference

| Status | When |
|---|---|
| `200` | Sessions listed successfully |
| `201` | Session created with feedback |
| `204` | Session deleted |
| `400` | Validation failure (body or params) |
| `502` | Gemini API error or unexpected provider failure |
| `503` | Gemini quota / rate limit exceeded |
| `504` | Gemini call exceeded `FEEDBACK_TIMEOUT_MS` |
| `500` | Unexpected Firestore or internal server error |

All error responses use the global format: `{ "error": "...", "code": "..." }`.

---

## 12. Part 2 — Where Authentication Would Go

Auth is **out of scope for v1** but integration points are fixed:

```
Request → [authMiddleware] → [validation] → [controller] → [service] → ...
                ↑
         attach before /v1 routes
```

**Recommended approach (production):**

1. **`authMiddleware`** — verify Firebase ID token from `Authorization: Bearer <token>` using `firebase-admin.auth().verifyIdToken()`
2. **Bind `userId` from token** — ignore client-supplied `userId` on POST; use `req.auth.uid` instead (prevents impersonation)
3. **Authorize GET** — ensure `:userId` matches authenticated uid (or admin role)
4. **Authorize DELETE** — fetch session doc first; verify `session.userId === req.auth.uid` before delete
5. **Firestore Security Rules** — defense in depth for direct client access (if a mobile/web client is added later)

Document this in README under "Production Hardening".

---

## 13. Implementation Steps (Execution Order)

1. **Scaffold** — `package.json`, strict `tsconfig.json`, `.gitignore`, `.env.example`
2. **Config** — typed env loader; fail-fast if `GEMINI_API_KEY` or Firebase config missing
3. **Errors** — `AppError` hierarchy + global error handler middleware
4. **Firebase init** — singleton Admin app; emulator support via env
5. **Types** — `Session`, `CreateSessionInput`, API response types
6. **Repository** — `create`, `findByUserId`, `deleteById`
7. **FeedbackService** — Gemini integration with timeout and typed errors
8. **SessionService** — orchestrate generate → save (fail-closed)
9. **Validation** — Zod schemas + validation middleware
10. **Routes + controllers** — three endpoints under `/v1`
11. **Health check** — `GET /health` for deployment probes
12. **README** — setup, env vars, curl examples, Gemini notes, auth section
13. **Manual test** — curl/Postman against local server

---

## 14. Local Development & Testing

**Run locally:**

```bash
npm install
cp .env.example .env
# Set GEMINI_API_KEY, Firebase emulator or service account
npm run dev
```

**Example curls (for README):**

```bash
curl -X POST http://localhost:3000/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","question":"Why this role?","answer":"Because..."}'

curl http://localhost:3000/v1/sessions/u1

curl -X DELETE http://localhost:3000/v1/sessions/<sessionId>

curl http://localhost:3000/health
```

**Testing strategy:**

- Unit test `FeedbackService` with mocked Gemini client
- Unit test Zod validation schemas (invalid payloads → `ValidationError`)
- Unit test `SessionService` fail-closed behavior (Gemini throws → no repository call)
- Optional integration test against Firestore emulator for repository

---

## 15. Security & Repo Hygiene

- `.gitignore`: `node_modules`, `.env`, `*-service-account.json`, Firebase debug logs
- Never commit service account keys or `GEMINI_API_KEY`
- Provide `serviceAccount.example.json` with placeholder fields only
- Request body size limit (`express.json({ limit: '1mb' })`) — prevent abuse
- Rate limiting — note as future hardening at API gateway or middleware layer
- CORS — configure allowed origins when frontend integrates (not open `*` in production)

---

## 16. README Outline (Deliverable Checklist)

The README will include:

1. Project overview (Prep Buddy feedback backend)
2. Stack choice (Express + firebase-admin + Gemini) and rationale
3. Prerequisites (Node 20+, Firebase project or emulator, Gemini API key)
4. Environment variables table (names only, no real keys)
5. Firebase setup steps (emulator + production path)
6. Gemini API key setup and free-tier rate limit note
7. Install and run commands
8. API reference under `/v1` with request/response examples
9. Error response format (`{ error, code }`) and status code table
10. Firestore composite index instructions
11. **Production Hardening:** auth middleware integration points
12. Deployment notes (Cloud Run / Render — env vars, health check)

---

## 17. Out of Scope (v1)

- React / Next.js frontend
- User registration / login implementation
- Pagination, search, or filtering beyond userId
- Async feedback via queues (save pending → background job)
- Idempotency keys on POST
- Multi-tenant billing or usage metering
- Comprehensive E2E test suite

These can be added in v2+ without breaking `/v1` clients.

---

## 18. Success Criteria

- [ ] All three `/v1` endpoints work against Firestore (emulator or cloud)
- [ ] POST persists full document only after Gemini succeeds; returns `201` with `id` and `createdAt`
- [ ] POST returns `502`/`503`/`504` on Gemini failure — **nothing saved**
- [ ] GET returns user sessions newest-first
- [ ] DELETE removes session by ID; returns `204`
- [ ] Invalid input returns `400` with `{ error, code }`
- [ ] All errors flow through global error handler — consistent JSON shape
- [ ] `GEMINI_API_KEY` required at startup — no silent stub fallback
- [ ] TypeScript strict mode; no `any` in core paths
- [ ] Functions are small, layered, and readable
- [ ] README enables a reviewer to run locally without guessing
- [ ] Auth integration point documented, not implemented

---

*This plan targets production quality: real AI feedback, fail-closed writes, versioned API, and maintainable code structure. Implementation follows this document without scope creep.*
