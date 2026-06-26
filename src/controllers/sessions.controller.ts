import type { Request, Response } from "express";
import type {
  CreateSessionBody,
  SessionIdParams,
  UserIdParams,
} from "../schemas/session.schemas";
import type { SessionService } from "../services/session.service";

export class SessionsController {
  constructor(private readonly sessionService: SessionService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateSessionBody;
    const session = await this.sessionService.createSession(body);
    res.status(201).json(session);
  };

  listByUserId = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params as unknown as UserIdParams;
    const sessions = await this.sessionService.getSessionsByUserId(userId);
    res.status(200).json(sessions);
  };

  deleteById = async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params as unknown as SessionIdParams;
    await this.sessionService.deleteSession(sessionId);
    res.status(204).send();
  };
}
