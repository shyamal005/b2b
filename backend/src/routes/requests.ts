import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db.js";
import type { Role } from "../middleware/auth.js";
import { requireJwt } from "../middleware/auth.js";

function membership(
  db: Db,
  orgId: string,
  userId: string,
): { role: Role } | undefined {
  return db
    .prepare(`SELECT role FROM org_members WHERE org_id = ? AND user_id = ?`)
    .get(orgId, userId) as { role: Role } | undefined;
}

function canDecide(role: Role) {
  return role === "admin" || role === "approver";
}

const createBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().default(""),
  amount_cents: z.number().int().min(1).max(1_000_000_000),
  currency: z.string().min(3).max(8).optional().default("USD"),
});

const rejectBody = z.object({
  note: z.string().min(1).max(2000),
});

export function requestsRouter(db: Db, jwtSecret: string) {
  const r = Router();
  const auth = requireJwt(jwtSecret);
  r.use(auth);

  r.get("/organizations/:orgId/requests", (req, res) => {
    const userId = req.user!.sub;
    const { orgId } = req.params;
    if (!membership(db, orgId, userId)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const rows = db
      .prepare(
        `
      SELECT pr.*, u.email AS requester_email, u.name AS requester_name
      FROM purchase_requests pr
      JOIN users u ON u.id = pr.requester_id
      WHERE pr.org_id = ?
      ORDER BY pr.created_at DESC
    `,
      )
      .all(orgId);
    res.json({ requests: rows });
  });

  r.post("/organizations/:orgId/requests", (req, res) => {
    const userId = req.user!.sub;
    const { orgId } = req.params;
    if (!membership(db, orgId, userId)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const b = parsed.data;
    db.prepare(
      `
      INSERT INTO purchase_requests
        (id, org_id, requester_id, title, description, amount_cents, currency, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `,
    ).run(
      id,
      orgId,
      userId,
      b.title,
      b.description,
      b.amount_cents,
      b.currency.toUpperCase(),
      createdAt,
    );
    res.status(201).json({
      id,
      org_id: orgId,
      requester_id: userId,
      title: b.title,
      description: b.description,
      amount_cents: b.amount_cents,
      currency: b.currency.toUpperCase(),
      status: "draft",
      created_at: createdAt,
    });
  });

  r.post("/requests/:requestId/submit", (req, res) => {
    const userId = req.user!.sub;
    const { requestId } = req.params;
    const row = db
      .prepare(
        `SELECT id, org_id, requester_id, status FROM purchase_requests WHERE id = ?`,
      )
      .get(requestId) as
      | { id: string; org_id: string; requester_id: string; status: string }
      | undefined;
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const mem = membership(db, row.org_id, userId);
    if (!mem) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (row.requester_id !== userId) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (row.status !== "draft") {
      res.status(409).json({ error: "invalid_status" });
      return;
    }
    db.prepare(
      `UPDATE purchase_requests SET status = 'pending' WHERE id = ?`,
    ).run(requestId);
    res.json({ id: requestId, status: "pending" });
  });

  r.post("/requests/:requestId/approve", (req, res) => {
    const userId = req.user!.sub;
    const { requestId } = req.params;
    const row = db
      .prepare(
        `SELECT id, org_id, status FROM purchase_requests WHERE id = ?`,
      )
      .get(requestId) as { id: string; org_id: string; status: string } | undefined;
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const mem = membership(db, row.org_id, userId);
    if (!mem || !canDecide(mem.role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (row.status !== "pending") {
      res.status(409).json({ error: "invalid_status" });
      return;
    }
    const decidedAt = new Date().toISOString();
    db.prepare(
      `
      UPDATE purchase_requests
      SET status = 'approved', decided_by = ?, decided_at = ?, decision_note = NULL
      WHERE id = ?
    `,
    ).run(userId, decidedAt, requestId);
    res.json({ id: requestId, status: "approved", decided_at: decidedAt });
  });

  r.post("/requests/:requestId/reject", (req, res) => {
    const userId = req.user!.sub;
    const { requestId } = req.params;
    const parsed = rejectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    const row = db
      .prepare(
        `SELECT id, org_id, status FROM purchase_requests WHERE id = ?`,
      )
      .get(requestId) as { id: string; org_id: string; status: string } | undefined;
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const mem = membership(db, row.org_id, userId);
    if (!mem || !canDecide(mem.role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (row.status !== "pending") {
      res.status(409).json({ error: "invalid_status" });
      return;
    }
    const decidedAt = new Date().toISOString();
    db.prepare(
      `
      UPDATE purchase_requests
      SET status = 'rejected', decided_by = ?, decided_at = ?, decision_note = ?
      WHERE id = ?
    `,
    ).run(userId, decidedAt, parsed.data.note, requestId);
    res.json({
      id: requestId,
      status: "rejected",
      decided_at: decidedAt,
      decision_note: parsed.data.note,
    });
  });

  return r;
}
