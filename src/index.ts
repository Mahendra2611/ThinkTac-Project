import { createApp } from "./app";
import { env } from "./config/env";
import { initializeFirebase } from "./lib/firebase";
import { logger } from "./lib/logger";

function startServer(): void {
  initializeFirebase();

  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "Server started");
  });
}

startServer();
