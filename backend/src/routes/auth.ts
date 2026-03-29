import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db.js";
import type { AuthedUser } from "../middleware/auth.js";
import { requireJwt } from "../middleware/auth.js";

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function authRouter(db: Db, jwtSecret: string) {
  const r = Router();

  r.post("/register", (req, res) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    const { email, password, name } = parsed.data;
    const id = randomUUID();
    const passwordHash = bcrypt.hashSync(password, 12);
    const createdAt = new Date().toISOString();
    try {
      db.prepare(
        `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`,
      ).run(id, email.toLowerCase(), passwordHash, name, createdAt);
    } catch {
      res.status(409).json({ error: "email_taken" });
      return;
    }
    const token = jwt.sign({ sub: id, email: email.toLowerCase() }, jwtSecret, {
      expiresIn: "7d",
    });
    res.status(201).json({
      token,
      user: { id, email: email.toLowerCase(), name },
    });
  });

  r.post("/login", (req, res) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;
    const row = db
      .prepare(`SELECT id, email, password_hash, name FROM users WHERE email = ?`)
      .get(email.toLowerCase()) as
      | { id: string; email: string; password_hash: string; name: string }
      | undefined;
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    const token = jwt.sign({ sub: row.id, email: row.email }, jwtSecret, {
      expiresIn: "7d",
    });
    res.json({ token, user: { id: row.id, email: row.email, name: row.name } });
  });

  r.get("/me", requireJwt(jwtSecret), (req, res) => {
    const u = req.user as AuthedUser;
    const row = db
      .prepare(`SELECT id, email, name, created_at FROM users WHERE id = ?`)
      .get(u.sub) as
      | { id: string; email: string; name: string; created_at: string }
      | undefined;
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(row);
  });

  return r;
}
