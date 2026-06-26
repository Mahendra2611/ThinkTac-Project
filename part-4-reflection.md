### 1. The Hardest Decision
Choosing the core backend stack was the toughest call. Next.js API routes and Cloud Functions both offered advantages for deployment speed. However, when planning for real-world backend architectural control and clean layering, I chose to go with a standalone Express app. It allowed me to isolate dependencies properly, avoiding framework lock-in or cold-start penalties at the cost of managing the boilerplate myself.

### 2. Areas for Improvement
I am not fully satisfied with using Firestore as the primary database. While great for rapid prototyping, it lacks deep configuration options and becomes incredibly restrictive regarding complex queries at scale compared to a robust NoSQL database like MongoDB. To fix this, I would migrate the repository layer to MongoDB, providing better aggregation tools and standard indexing configurations.

### 3. Going Deeper at ThinkTac
If I join ThinkTac as a platform engineer, I want to dive deep into optimizing our LLM orchestration and scaling the backend infrastructure to support millions of concurrent users. Specifically, I want to design resilient, production-grade streaming architectures, error-budgeting around token quotas, and intelligent caching mechanisms to ensure fast, cost-effective AI interactions at scale.