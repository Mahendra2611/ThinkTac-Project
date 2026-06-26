# Prep Buddy : Interview Feedback API

Backend service for **Prep Buddy**, an AI interview practice platform. Persists interview sessions and generates short AI feedback using **Google Gemini**, stored in **Firestore**.

## Stack

| Layer | Choice | 
|---|---|---|
| Runtime | Node.js 20+ | 
| Framework | Express | 
| Database | Firestore (firebase-admin) | 
| LLM | Gemini (`gemini-2.0-flash`) | 
| Validation | Zod | 
| Logging | Pino |

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- A [Gemini API key](https://aistudio.google.com/apikey) (free tier)
- A **Firebase project** with Firestore enabled + service account JSON
 

---

## Setup: Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey).
2. Sign in with your Google account.
3. Click **Create API key**.
4. Copy the key — you will set it as `GEMINI_API_KEY` in `.env`.

>

---

## Setup: Firestore 


1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** → follow the wizard → enable **Firestore** (production or test mode).
3. Open **Project settings** → **Service accounts** → **Generate new private key**.
4. Save the JSON file as `firebase/serviceAccount.json` (this path is gitignored).
5. Deploy the composite index (required for `GET /v1/sessions/:userId`):
   ```bash
   firebase deploy --only firestore:indexes
   ```
   Or wait for Firestore to show an index-creation link in the server logs on first GET failure.
6. In `.env`, set:
   ```env
   FIRESTORE_PROJECT_ID=your-firebase-project-id
   GOOGLE_APPLICATION_CREDENTIALS=./firebase/serviceAccount.json
   ```

See `firebase/serviceAccount.example.json` for the expected JSON shape (placeholders only).

---

## Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default `3000`) | HTTP server port |
| `NODE_ENV` | No | `development` or `production` |
| `FIRESTORE_PROJECT_ID` | Yes | Firebase project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | Path to service account JSON |
| `GEMINI_API_KEY` | **Yes** | Google AI Studio API key |
| `GEMINI_MODEL` | No (default `gemini-2.0-flash`) | Gemini model name |
| `FEEDBACK_TIMEOUT_MS` | No (default `20000`) | Max wait for Gemini before 504 |


**Never commit `.env` or service account JSON files.**

---

## Install & Run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

---

## API Reference (v1)

Base URL: `http://localhost:3000/v1`

### POST `/v1/sessions`

Create a session with AI-generated feedback.

**Request:**

```json
{
  "userId": "user_abc123",
  "question": "Tell me about a time you handled conflict.",
  "answer": "In my last role, I mediated a disagreement between two teammates..."
}
```

**Response `201`:**

```json
{
  "id": "abc123",
  "userId": "user_abc123",
  "question": "...",
  "answer": "...",
  "feedback": "Your answer shows good structure...",
  "createdAt": "2026-06-25T10:30:00.000Z"
}
```

**Failure behavior (fail-closed):** If Gemini fails or times out, **nothing is saved** to Firestore.

```bash
curl -X POST http://localhost:3000/v1/sessions \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"u1\",\"question\":\"Why this role?\",\"answer\":\"Because I am passionate about building reliable systems.\"}"
```

---

### GET `/v1/sessions/:userId`

Returns all sessions for a user, newest first.

**Response `200`:** JSON array (empty array if none).

```bash
curl http://localhost:3000/v1/sessions/u1
```

**Firestore index:** Requires composite index on `userId` + `createdAt desc`. Deploy via `firebase deploy --only firestore:indexes` or use the link from Firestore error logs.

---

### DELETE `/v1/sessions/:sessionId`

Deletes a session by document ID. Idempotent — always returns `204`.

```bash
curl -X DELETE http://localhost:3000/v1/sessions/<sessionId>
```

---

## Error Responses

All errors use a consistent shape:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": []
}
```

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid request body or params |
| `502` | `FEEDBACK_GENERATION_FAILED` | Gemini API error |
| `503` | `SERVICE_UNAVAILABLE` | Gemini quota / rate limit |
| `504` | `FEEDBACK_TIMEOUT` | Gemini exceeded timeout |
| `500` | `INTERNAL_ERROR` | Firestore or unexpected server error |

---



## Project Structure

```
src/
├── config/env.ts           # Typed env loading (fail-fast)
├── controllers/          # Thin HTTP handlers
├── errors/                 # Typed AppError hierarchy
├── lib/                    # Firebase + logger
├── middleware/             # Validation, async wrapper, global errors
├── repositories/           # Firestore access
├── routes/v1/              # Versioned routes
├── schemas/                # Zod validation schemas
├── services/               # Business logic (Gemini + orchestration)
├── app.ts                  # Express app factory
└── index.ts                # Entry point
```


