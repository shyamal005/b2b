import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type Role = "admin" | "approver" | "member";

export type AuthedUser = {
  sub: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export function requireJwt(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const hdr = req.headers.authorization;
    const token = hdr?.startsWith("Bearer ") ? hdr.slice(7) : undefined;
    if (!token) {
      res.status(401).json({ error: "missing_token" });
      return;
    }
    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
        email?: string;
      };
      if (typeof payload.sub !== "string" || !payload.email) {
        res.status(401).json({ error: "invalid_token" });
        return;
      }
      req.user = { sub: payload.sub, email: payload.email };
      next();
    } catch {
      res.status(401).json({ error: "invalid_token" });
    }
  };
}
