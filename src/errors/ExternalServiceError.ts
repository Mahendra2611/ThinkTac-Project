import { AppError } from "./AppError";

export class ExternalServiceError extends AppError {
  constructor(message = "Feedback generation failed. Please try again.") {
    super(message, 502, "FEEDBACK_GENERATION_FAILED");
  }
}
