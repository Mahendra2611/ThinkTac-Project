import admin from "firebase-admin";
import { env } from "../config/env";
import { logger } from "./logger";

let initialized = false;

export function initializeFirebase(): admin.app.App {
  if (initialized && admin.apps.length > 0) {
    return admin.app();
  }

  const app = admin.initializeApp(
    env.FIRESTORE_EMULATOR_HOST
      ? { projectId: env.FIRESTORE_PROJECT_ID }
      : {
          projectId: env.FIRESTORE_PROJECT_ID,
          credential: admin.credential.cert(
            env.GOOGLE_APPLICATION_CREDENTIALS as string,
          ),
        },
  );

  initialized = true;

  if (env.FIRESTORE_EMULATOR_HOST) {
    logger.info(
      { host: env.FIRESTORE_EMULATOR_HOST, projectId: env.FIRESTORE_PROJECT_ID },
      "Using Firestore emulator",
    );
  }

  return app;
}

export function getFirestore(): admin.firestore.Firestore {
  initializeFirebase();
  return admin.firestore();
}
