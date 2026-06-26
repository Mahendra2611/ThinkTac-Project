import type { SessionRepository } from "../repositories/session.repository";
import type { FeedbackService } from "../services/feedback.service";
import type { CreateSessionInput, Session } from "../types/session.types";

export class SessionService {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async createSession(input: CreateSessionInput): Promise<Session> {
    const feedback = await this.feedbackService.generate(
      input.question,
      input.answer,
    );

    return this.sessionRepository.create({
      ...input,
      feedback,
    });
  }

  async getSessionsByUserId(userId: string): Promise<Session[]> {
    return this.sessionRepository.findByUserId(userId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionRepository.deleteById(sessionId);
  }
}
