export interface Session {
  id: string;
  userId: string;
  question: string;
  answer: string;
  feedback: string;
  createdAt: string;
}

export interface CreateSessionInput {
  userId: string;
  question: string;
  answer: string;
}

export interface CreateSessionPayload extends CreateSessionInput {
  feedback: string;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}
