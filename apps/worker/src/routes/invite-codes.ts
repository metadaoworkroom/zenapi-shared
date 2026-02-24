import { Hono } from "hono";
import type { AppEnv } from "../env";
import { nowIso } from "../utils/time";

const inviteCodeRoutes = new Hono<AppEnv>();

/**
 * Lists all invite codes.
 */
inviteCodeRoutes.get("/", async (c) => {
	const result = await c.env.DB.prepare(
		"SELECT * FROM invite_codes ORDER BY created_at DESC",
	).all();
	return c.json({ codes: result.results ?? [] });
});

/**
 * Batch generates invite codes.
 */
inviteCodeRoutes.post("/", async (c) => {
	const body = await c.req.json().catch(() => null);
	const count = Math.min(Math.max(1, Number(body?.count) || 10), 100);
	const maxUses = Math.max(1, Number(body?.max_uses) || 1);
	const prefix = String(body?.prefix || "ZEN-").toUpperCase();
	const now = nowIso();

	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	const codes: Array<{ id: string; code: string }> = [];

	for (let i = 0; i < count; i++) {
		let random = "";
		for (let j = 0; j < 8; j++) {
			random += chars[Math.floor(Math.random() * chars.length)];
		}
		codes.push({ id: crypto.randomUUID(), code: `${prefix}${random}` });
	}

	const stmts = codes.map((item) =>
		c.env.DB.prepare(
			"INSERT INTO invite_codes (id, code, max_uses, used_count, status, created_at) VALUES (?, ?, ?, 0, 'active', ?)",
		).bind(item.id, item.code, maxUses, now),
	);

	await c.env.DB.batch(stmts);

	return c.json({ codes: codes.map((item) => item.code) });
});

/**
 * Deletes a single invite code.
 */
inviteCodeRoutes.delete("/:id", async (c) => {
	const id = c.req.param("id");
	await c.env.DB.prepare("DELETE FROM invite_codes WHERE id = ?")
		.bind(id)
		.run();
	return c.json({ ok: true });
});

/**
 * Exports all active codes as plain text.
 */
inviteCodeRoutes.get("/export", async (c) => {
	const result = await c.env.DB.prepare(
		"SELECT code FROM invite_codes WHERE status = 'active' AND used_count < max_uses ORDER BY created_at DESC",
	).all();
	const lines = (result.results ?? []).map((row) => String(row.code));
	return c.text(lines.join("\n"));
});

export default inviteCodeRoutes;
