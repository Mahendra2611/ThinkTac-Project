# Prep Buddy Task :  Technical Decisions

This document highlights the engineering choices and architectural trade-offs made during the development of the Prep Buddy interview feedback backend.

---

## 1. Architecture Choice & Structure

I chose a classic layered Express app in TypeScript over Firebase Cloud Functions or Next.js API routes. While Cloud Functions scale well, they introduce cold starts and local testing friction. Similarly, Next.js adds unnecessary build pipeline overhead for a dedicated backend service. 

The codebase is split into distinct, isolated layers: **Routes, Controllers, Services, and Repositories**. This clean separation of concerns ensures that switching the database engine or changing the LLM provider will not break the HTTP delivery layer. 

* **Thin Controllers:** Handlers function size stay within screen to improve readability; their only job is to parse inputs, delegate orchestration to the service layer, and return responses.
* **No Runtime Stubs:** I ruled out using a mock AI stub fallback in production. Real users expect genuine, dynamic coaching. If Gemini fails, the system must fail transparently. I used in local for testing the flow.
* **Synchronous Processing over Queues:** A background job queue or polling setup (e.g., saving a "pending" status) was considered but eventually ruled out. For a basic 3-endpoint MVP, a synchronous lifecycle keeps the API snappy, simplifies client integration, and lowers infrastructure costs.

---

## 2. Firestore Data Model & Scale

I implemented a **flat `sessions` collection** where each document holds a `userId` field. This directly satisfies the API contract for the `DELETE /v1/sessions/:sessionId` endpoint, allowing the service to locate and destroy a document instantly without requiring a `userId` prefix in the path.

### Scaling
Currently, the `GET` endpoint returns an entire unpaginated array of documents. At production scale, this approach would eventually crash the client and trigger massive read costs. 

To mitigate this, I had to use a composite index (`userId` Ascending + `createdAt` Descending) for predictable ordering. To hit users at scale, we would need to scale this by:
* Implementing **cursor-based pagination** using Firestore's `.limit()` and `.startAfter()` operators.
* Moving cold, historical data to a long-term analytical store (like BigTable) or compressing older feedback text fields to keep the active Firestore database footprint slim.

---

## 3. AI Integration & Resilience

The LLM orchestration layer integrates the official `@google/generative-ai` SDK using the `gemini-2.0-flash` model. It offers low latency, highly competitive pricing, and handles the 2–3 sentence actionable feedback constraint perfectly.

The most critical technical pattern enforced here is **fail-closed semantics**. The backend will *never* commit a session document to Firestore if the Gemini API call fails or times out. This guarantees data integrity and prevents orphan documents that lack feedback.

### Failure Modes & Production Hardening
* **Gemini Timeout:** Managed via a 20-second timeout window. If exceeded, the application throws a custom `TimeoutError` which maps cleanly to an HTTP `504 Gateway Timeout`.
* **Rate Limits & Quotas (429):** Caught explicitly by the service layer to issue an HTTP `503 Service Unavailable` carrying a user-friendly retry message, preventing raw Google API stack traces from leaking to clients.
* **Network Resilience:** In a production setting, I would wrap the SDK call in an exponential backoff retry routine to handle transient network blips gracefully before failing the request entirely.

---

## 4. Security Gaps & Auth Integration

Because the build specification explicitly bypasses authentication, it represents the largest gap before a production launch. To fix this, authentication must be plugged in right before the Zod validation middleware layer.
Request ──> [authMiddleware] ──> [validationMiddleware] ──> [Controller]
### Proposed Approach
1.  **Token Verification:** Implement an `authMiddleware` that intercepts incoming requests, reads the `Authorization: Bearer <token>` header, and verifies the Firebase ID token server-side using `firebase-admin.auth().verifyIdToken(token)`.
2.  **Context Binding:** Once validated, the middleware extracts the verified `uid` and appends it directly to the request context (`req.user.uid`).
3.  **Payload Protection:** For `POST /v1/sessions`, the system must completely ignore any `userId` supplied in the JSON request body, using the verified token identity instead. This prevents identity impersonation. 
4.  **Ownership Checks:** For `DELETE` and `GET` requests, an ownership check must validate that the target record's `userId` matches the token context before mutating or reading data.

---

## 5. Given Another Two Hours...

If granted an extra block of time to harden the implementation, I would prioritize these three production features:

* **Idempotency Keys:** Introduce an `Idempotency-Key` header verification on the `POST` endpoint. If a user suffers a drop in connection mid-flight and triggers a duplicate click, the backend will identify the signature, preventing double-billing on Gemini tokens and duplicate Firestore entries.
* **Automated Integration Tests:** Spin up a local suite using the native Firebase Firestore Emulator to validate that index ordering and edge cases behave correctly under stress.
* **API Gateway / Middleware Rate Limiting:** Introduce standard `express-rate-limit` middleware to establish strict per-IP thresholds. This mitigates brute-force script abuse targeting the Gemini endpoint, safeguarding our API quota from budget leakage.