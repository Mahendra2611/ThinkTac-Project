import { Router } from "express";
import type { SessionsController } from "../../controllers/sessions.controller";
import { asyncHandler } from "../../middleware/asyncHandler";
import { validate } from "../../middleware/validate";
import {
  createSessionBodySchema,
  sessionIdParamSchema,
  userIdParamSchema,
} from "../../schemas/session.schemas";

export function createSessionsRouter(
  controller: SessionsController,
): Router {
  const router = Router();

  router.post(
    "/sessions",
    validate("body", createSessionBodySchema),
    asyncHandler(controller.create),
  );

  router.get(
    "/sessions/:userId",
    validate("params", userIdParamSchema),
    asyncHandler(controller.listByUserId),
  );

  router.delete(
    "/sessions/:sessionId",
    validate("params", sessionIdParamSchema),
    asyncHandler(controller.deleteById),
  );

  return router;
}
