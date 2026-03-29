import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db.js";
import type { Role } from "../middleware/auth.js";
import { requireJwt } from "../middleware/auth.js";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createOrgBody = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(48)
    .refine((s) => slugRe.test(s), { message: "invalid_slug" }),
});

const addMemberBody = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "approver", "member"]),
});

function getMembership(
  db: Db,
  orgId: string,
  userId: string,
): { role: Role } | undefined {
  return db
    .prepare(`SELECT role FROM org_members WHERE org_id = ? AND user_id = ?`)
    .get(orgId, userId) as { role: Role } | undefined;
}

export function orgsRouter(db: Db, jwtSecret: string) {
  const r = Router();
  const auth = requireJwt(jwtSecret);

  r.use(auth);

  r.post("/", (req, res) => {
    const parsed = createOrgBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    const userId = req.user!.sub;
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const { name, slug } = parsed.data;
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO organizations (id, name, slug, created_at) VALUES (?, ?, ?, ?)`,
      ).run(id, name, slug.toLowerCase(), createdAt);
      db.prepare(
        `INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, 'admin')`,
      ).run(id, userId);
    });
    try {
      tx();
    } catch {
      res.status(409).json({ error: "slug_taken" });
      return;
    }
    res.status(201).json({
      id,
      name,
      slug: slug.toLowerCase(),
      created_at: createdAt,
      your_role: "admin",
    });
  });

  r.get("/", (_req, res) => {
    const userId = _req.user!.sub;
    const rows = db
      .prepare(
        `
      SELECT o.id, o.name, o.slug, o.created_at, m.role AS your_role
      FROM organizations o
      JOIN org_members m ON m.org_id = o.id AND m.user_id = ?
      ORDER BY o.created_at ASC
    `,
      )
      .all(userId) as Array<{
      id: string;
      name: string;
      slug: string;
      created_at: string;
      your_role: Role;
    }>;
    res.json({ organizations: rows });
  });

  r.get("/:orgId", (req, res) => {
    const userId = req.user!.sub;
    const { orgId } = req.params;
    const mem = getMembership(db, orgId, userId);
    if (!mem) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const org = db
      .prepare(`SELECT id, name, slug, created_at FROM organizations WHERE id = ?`)
      .get(orgId) as
      | { id: string; name: string; slug: string; created_at: string }
      | undefined;
    if (!org) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const members = db
      .prepare(
        `
      SELECT u.id AS user_id, u.email, u.name, m.role
      FROM org_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.org_id = ?
      ORDER BY u.email ASC
    `,
      )
      .all(orgId) as Array<{
      user_id: string;
      email: string;
      name: string;
      role: Role;
    }>;
    res.json({ ...org, your_role: mem.role, members });
  });

  r.post("/:orgId/members", (req, res) => {
    const userId = req.user!.sub;
    const { orgId } = req.params;
    const mem = getMembership(db, orgId, userId);
    if (!mem || mem.role !== "admin") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const parsed = addMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    const target = db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(parsed.data.email.toLowerCase()) as { id: string } | undefined;
    if (!target) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
    try {
      db.prepare(
        `INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?)`,
      ).run(orgId, target.id, parsed.data.role);
    } catch {
      res.status(409).json({ error: "already_member" });
      return;
    }
    res.status(201).json({ user_id: target.id, role: parsed.data.role });
  });

  return r;
}
