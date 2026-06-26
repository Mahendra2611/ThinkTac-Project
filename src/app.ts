import express from "express";
import { SessionsController } from "./controllers/sessions.controller";
import { errorHandler } from "./middleware/errorHandler";
import { SessionRepository } from "./repositories/session.repository";
import { createV1Router } from "./routes";
import { FeedbackService } from "./services/feedback.service";
import { SessionService } from "./services/session.service";

export function createApp(): express.Application {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  const sessionRepository = new SessionRepository();
  const feedbackService = new FeedbackService();
  const sessionService = new SessionService(feedbackService, sessionRepository);
  const sessionsController = new SessionsController(sessionService);

  app.use("/v1", createV1Router(sessionsController));

  app.use(errorHandler);

  return app;
}
