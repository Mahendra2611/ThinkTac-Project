import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import type { ErrorResponse } from "../types/session.types";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const payload: ErrorResponse = {
      error: err.message,
      code: err.code,
    };

    if (err.details !== undefined) {
      payload.details = err.details;
    }

    if (err.statusCode >= 500) {
      logger.error({ err, code: err.code }, err.message);
    } else {
      logger.warn({ code: err.code, details: err.details }, err.message);
    }

    res.status(err.statusCode).json(payload);
    return;
  }

  logger.error({ err }, "Unhandled error");

  const payload: ErrorResponse = {
    error:
      env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err instanceof Error
          ? err.message
          : "An unexpected error occurred",
    code: "INTERNAL_ERROR",
  };

  res.status(500).json(payload);
}
