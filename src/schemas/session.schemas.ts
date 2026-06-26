import { z } from "zod";

export const createSessionBodySchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, "userId is required")
    .max(128, "userId must be at most 128 characters"),
  question: z
    .string()
    .trim()
    .min(1, "question is required")
    .max(2000, "question must be at most 2000 characters"),
  answer: z
    .string()
    .trim()
    .min(1, "answer is required")
    .max(10000, "answer must be at most 10000 characters"),
});

export const userIdParamSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, "userId is required")
    .max(128, "userId must be at most 128 characters"),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId is required"),
});

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;
export type UserIdParams = z.infer<typeof userIdParamSchema>;
export type SessionIdParams = z.infer<typeof sessionIdParamSchema>;
