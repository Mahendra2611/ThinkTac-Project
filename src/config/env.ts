import "dotenv/config";

console.log("Checking loaded env:", process.env.PORT, process.env.FIRESTORE_PROJECT_ID);

export interface EnvConfig {
  PORT: number;
  NODE_ENV: "development" | "production" | "test";
  FIRESTORE_PROJECT_ID: string;
  GOOGLE_APPLICATION_CREDENTIALS: string | undefined;
  FIRESTORE_EMULATOR_HOST: string | undefined;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  FEEDBACK_TIMEOUT_MS: number;
}

function requireString(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid integer between 1 and 65535");
  }
  return port;
}

function parseTimeout(value: string | undefined): number {
  const timeout = Number(value ?? "20000");
  if (!Number.isInteger(timeout) || timeout < 1000) {
    throw new Error("FEEDBACK_TIMEOUT_MS must be an integer >= 1000");
  }
  return timeout;
}

function parseNodeEnv(value: string | undefined): EnvConfig["NODE_ENV"] {
  const nodeEnv = value ?? "development";
  if (nodeEnv !== "development" && nodeEnv !== "production" && nodeEnv !== "test") {
    throw new Error("NODE_ENV must be development, production, or test");
  }
  return nodeEnv;
}

function loadEnv(): EnvConfig {
  const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim();
  const googleApplicationCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (!firestoreEmulatorHost && !googleApplicationCredentials) {
    throw new Error(
      "Missing Firebase credentials: set GOOGLE_APPLICATION_CREDENTIALS or FIRESTORE_EMULATOR_HOST",
    );
  }

  return {
    PORT: parsePort(process.env.PORT),
    NODE_ENV: parseNodeEnv(process.env.NODE_ENV),
    FIRESTORE_PROJECT_ID: requireString(
      "FIRESTORE_PROJECT_ID",
      process.env.FIRESTORE_PROJECT_ID,
    ),
    GOOGLE_APPLICATION_CREDENTIALS: googleApplicationCredentials,
    FIRESTORE_EMULATOR_HOST: firestoreEmulatorHost,
    GEMINI_API_KEY: requireString("GEMINI_API_KEY", process.env.GEMINI_API_KEY),
    GEMINI_MODEL: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
    FEEDBACK_TIMEOUT_MS: parseTimeout(process.env.FEEDBACK_TIMEOUT_MS),
  };
}

export const env: EnvConfig = loadEnv();
