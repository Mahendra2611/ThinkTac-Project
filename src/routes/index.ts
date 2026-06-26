import { Router } from "express";
import type { SessionsController } from "../controllers/sessions.controller";
import { createSessionsRouter } from "./v1/sessions.routes";

export function createV1Router(controller: SessionsController): Router {
  const router = Router();
  router.use(createSessionsRouter(controller));
  return router;
}
