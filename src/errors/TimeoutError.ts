import { AppError } from "./AppError";

export class TimeoutError extends AppError {
  constructor(message = "Feedback generation timed out. Please try again.") {
    super(message, 504, "FEEDBACK_TIMEOUT");
  }
}
