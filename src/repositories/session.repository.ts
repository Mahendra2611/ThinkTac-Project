import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { AppError } from "../errors/AppError";
import { getFirestore } from "../lib/firebase";
import { logger } from "../lib/logger";
import type { CreateSessionPayload, Session } from "../types/session.types";

const COLLECTION = "sessions";

function mapDocumentToSession(
  id: string,
  data: FirebaseFirestore.DocumentData,
): Session {
  const createdAt = data.createdAt as Timestamp | undefined;

  return {
    id,
    userId: data.userId as string,
    question: data.question as string,
    answer: data.answer as string,
    feedback: data.feedback as string,
    createdAt: createdAt?.toDate().toISOString() ?? new Date().toISOString(),
  };
}

export class SessionRepository {
  private readonly collection = getFirestore().collection(COLLECTION);

  async create(payload: CreateSessionPayload): Promise<Session> {
    try {
      const docRef = await this.collection.add({
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
      });

      const snapshot = await docRef.get();
      const data = snapshot.data();

      if (!data) {
        throw new AppError(
          "Failed to retrieve saved session",
          500,
          "INTERNAL_ERROR",
        );
      }

      return mapDocumentToSession(snapshot.id, data);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error({ err: error }, "Firestore create failed");
      throw new AppError(
        "Failed to save session",
        500,
        "INTERNAL_ERROR",
      );
    }
  }

  async findByUserId(userId: string): Promise<Session[]> {
    try {
      const snapshot = await this.collection
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();

      return snapshot.docs.map((doc) => mapDocumentToSession(doc.id, doc.data()));
    } catch (error) {
      logger.error({ err: error, userId }, "Firestore query failed");
      throw new AppError(
        "Failed to fetch sessions",
        500,
        "INTERNAL_ERROR",
      );
    }
  }

  async deleteById(sessionId: string): Promise<void> {
    try {
      await this.collection.doc(sessionId).delete();
    } catch (error) {
      logger.error({ err: error, sessionId }, "Firestore delete failed");
      throw new AppError(
        "Failed to delete session",
        500,
        "INTERNAL_ERROR",
      );
    }
  }
}
