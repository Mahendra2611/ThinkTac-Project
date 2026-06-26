import { AppError } from "./AppError";

export class ServiceUnavailableError extends AppError {
  constructor(
    message = "Feedback service is temporarily unavailable. Please try again later.",
  ) {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}

export class RateLimitError extends AppError {
  constructor(
    message = "Rate limit exceeded. You have made too many requests. Please try again later.",
  ) {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}