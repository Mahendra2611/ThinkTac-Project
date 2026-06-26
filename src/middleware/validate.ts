import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../errors/ValidationError";

type RequestPart = "body" | "params" | "query";

export function validate<T>(part: RequestPart, schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || part,
        message: issue.message,
      }));

      next(new ValidationError("Invalid request input", details));
      return;
    }

    req[part] = result.data as typeof req[typeof part];
    next();
  };
}
