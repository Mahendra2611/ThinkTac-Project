// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { env } from "../config/env";
// import { ExternalServiceError } from "../errors/ExternalServiceError";
// import { ServiceUnavailableError } from "../errors/ServiceUnavailableError";
// import { TimeoutError } from "../errors/TimeoutError";
// import { logger } from "../lib/logger";

// const SYSTEM_INSTRUCTION =
//   "You are a concise interview coach. Give 2-3 sentences of actionable feedback on the candidate's answer. Be constructive and specific.";

// function isRateLimitError(error: unknown): boolean {
//   if (!(error instanceof Error)) {
//     return false;
//   }

//   const message = error.message.toLowerCase();
//   return (
//     message.includes("429") ||
//     message.includes("quota") ||
//     message.includes("rate limit") ||
//     message.includes("resource exhausted")
//   );
// }

// function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
//   return new Promise((resolve, reject) => {
//     const timer = setTimeout(() => {
//       reject(new TimeoutError());
//     }, timeoutMs);

//     promise
//       .then(resolve)
//       .catch(reject)
//       .finally(() => clearTimeout(timer));
//   });
// }

// export class FeedbackService {
//   private readonly client: GoogleGenerativeAI;
//   private readonly modelName: string;
//   private readonly timeoutMs: number;

//   constructor(
//     apiKey: string = env.GEMINI_API_KEY,
//     modelName: string = env.GEMINI_MODEL,
//     timeoutMs: number = env.FEEDBACK_TIMEOUT_MS,
//   ) {
//     this.client = new GoogleGenerativeAI(apiKey);
//     this.modelName = modelName;
//     this.timeoutMs = timeoutMs;
//   }

//   async generate(question: string, answer: string): Promise<string> {
//     const prompt = buildPrompt(question, answer);

//     try {
//       const feedback = await withTimeout(this.callGemini(prompt), this.timeoutMs);
//       return feedback.trim();
//     } catch (error) {
//       if (
//         error instanceof TimeoutError ||
//         error instanceof ServiceUnavailableError
//       ) {
//         throw error;
//       }

//       if (isRateLimitError(error)) {
//         logger.warn({ err: error }, "Gemini rate limit exceeded");
//         throw new ServiceUnavailableError();
//       }

//       logger.error({ err: error }, "Gemini feedback generation failed");
//       throw new ExternalServiceError();
//     }
//   }

//   private async callGemini(prompt: string): Promise<string> {
//     const model = this.client.getGenerativeModel({
//       model: this.modelName,
//       systemInstruction: SYSTEM_INSTRUCTION,
//       generationConfig: {
//         maxOutputTokens: 150,
//         temperature: 0.7,
//       },
//     });

//     const result = await model.generateContent(prompt);
//     const text = result.response.text();

//     if (!text) {
//       throw new ExternalServiceError("Feedback generation returned empty response.");
//     }

//     return text;
//   }
// }

// function buildPrompt(question: string, answer: string): string {
//   return [
//     "Interview question:",
//     question,
//     "",
//     "Candidate answer:",
//     answer,
//     "",
//     "Provide brief interview feedback.",
//   ].join("\n");
// }



import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { ExternalServiceError } from "../errors/ExternalServiceError";
//import { ServiceUnavailableError } from "../errors/ServiceUnavailableError";
import { TimeoutError } from "../errors/TimeoutError";
import { logger } from "../lib/logger";

const SYSTEM_INSTRUCTION =
  "You are a concise interview coach. Give 2-3 sentences of actionable feedback on the candidate's answer. Be constructive and specific.";

// function isRateLimitError(error: unknown): boolean {
//   if (!(error instanceof Error)) {
//     return false;
//   }

//   const message = error.message.toLowerCase();
//   return (
//     message.includes("429") ||
//     message.includes("quota") ||
//     message.includes("rate limit") ||
//     message.includes("resource exhausted")
//   );
// }

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError());
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

export class FeedbackService {
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;
  private readonly timeoutMs: number;

  constructor(
    apiKey: string = env.GEMINI_API_KEY,
    modelName: string = env.GEMINI_MODEL,
    timeoutMs: number = env.FEEDBACK_TIMEOUT_MS,
  ) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.timeoutMs = timeoutMs;
  }

  async generate(question: string, answer: string): Promise<string> {
    const prompt = buildPrompt(question, answer);

    try {
      const feedback = await withTimeout(this.callGemini(prompt), this.timeoutMs);
      return feedback.trim();
    } catch (error) {
      // Log the actual error for debugging
      logger.warn({ err: error }, "Gemini API unavailable or failed. Using deterministic stub fallback.");

      // Return the fallback stub instead of throwing an exception
      return this.getDeterministicStub(question, answer);
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.7,
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text) {
      throw new ExternalServiceError("Feedback generation returned empty response.");
    }

    return text;
  }

  /**
   * Generates a structural fallback response when Gemini fails or times out.
   */
  private getDeterministicStub(question: string, answer: string): string {
    const trimmedAnswer = answer.trim();

    if (trimmedAnswer.length < 15) {
      return "Your response is a bit brief. Try expanding on your practical experiences and elaborate specifically on how they relate to the question: '" + question + "'.";
    }

    return `Great focus on core concepts. To improve, try structure your answer using the STAR method (Situation, Task, Action, Result) to make your experience with "${trimmedAnswer.slice(0, 30)}..." even more impactful.`;
  }
}

function buildPrompt(question: string, answer: string): string {
  return [
    "Interview question:",
    question,
    "",
    "Candidate answer:",
    answer,
    "",
    "Provide brief interview feedback.",
  ].join("\n");
}