import { Hono } from "hono";
import type { AppEnv } from "../env";
import type { UserRecord } from "../middleware/userAuth";
import { userAuth } from "../middleware/userAuth";
import { getSiteMode } from "../services/settings";
import { generateToken, sha256Hex } from "../utils/crypto";
import { jsonError } from "../utils/http";
import { addHours, nowIso } from "../utils/time";

const userAuthRoutes = new Hono<AppEnv>();

/**
 * Registers a new user.
 */
userAuthRoutes.post("/register", async (c) => {
	const siteMode = await getSiteMode(c.env.DB);
	if (siteMode === "personal") {
		return jsonError(c, 403, "registration_disabled", "registration_disabled");
	}

	const body = await c.req.json().catch(() => null);
	if (!body?.email || !body?.name || !body?.password) {
		return jsonError(c, 400, "missing_fields", "email, name, password required");
	}

	const email = String(body.email).trim().toLowerCase();
	const name = String(body.name).trim();
	const password = String(body.password);

	if (!email.includes("@")) {
		return jsonError(c, 400, "invalid_email", "invalid_email");
	}
	if (password.length < 6) {
		return jsonError(c, 400, "password_too_short", "password_too_short");
	}

	const existing = await c.env.DB.prepare(
		"SELECT id FROM users WHERE email = ?",
	)
		.bind(email)
		.first();

	if (existing) {
		return jsonError(c, 409, "email_exists", "email_exists");
	}

	const id = crypto.randomUUID();
	const passwordHash = await sha256Hex(password);
	const now = nowIso();

	await c.env.DB.prepare(
		"INSERT INTO users (id, email, name, password_hash, role, balance, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(id, email, name, passwordHash, "user", 0, "active", now, now)
		.run();

	// Auto-login after registration
	const rawToken = generateToken("u_");
	const tokenHash = await sha256Hex(rawToken);
	const expiresAt = addHours(new Date(), 24).toISOString();

	await c.env.DB.prepare(
		"INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
	)
		.bind(crypto.randomUUID(), id, tokenHash, expiresAt, now)
		.run();

	return c.json({
		token: rawToken,
		expires_at: expiresAt,
		user: { id, email, name, role: "user", balance: 0, status: "active" },
	});
});

/**
 * Logs in a user with email and password.
 */
userAuthRoutes.post("/login", async (c) => {
	const body = await c.req.json().catch(() => null);
	if (!body?.email || !body?.password) {
		return jsonError(c, 400, "missing_fields", "email and password required");
	}

	const email = String(body.email).trim().toLowerCase();
	const password = String(body.password);
	const passwordHash = await sha256Hex(password);

	const user = await c.env.DB.prepare(
		"SELECT id, email, name, role, balance, status, password_hash FROM users WHERE email = ?",
	)
		.bind(email)
		.first<UserRecord & { password_hash: string }>();

	if (!user || user.password_hash !== passwordHash) {
		return jsonError(c, 401, "invalid_credentials", "invalid_credentials");
	}

	if (user.status !== "active") {
		return jsonError(c, 403, "user_disabled", "user_disabled");
	}

	const rawToken = generateToken("u_");
	const tokenHash = await sha256Hex(rawToken);
	const expiresAt = addHours(new Date(), 24).toISOString();
	const now = nowIso();

	await c.env.DB.prepare(
		"INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
	)
		.bind(crypto.randomUUID(), user.id, tokenHash, expiresAt, now)
		.run();

	return c.json({
		token: rawToken,
		expires_at: expiresAt,
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			balance: user.balance,
			status: user.status,
		},
	});
});

/**
 * Logs out the current user session.
 */
userAuthRoutes.post("/logout", userAuth, async (c) => {
	const token = c.req.header("Authorization")?.slice(7)?.trim();
	if (token) {
		const tokenHash = await sha256Hex(token);
		await c.env.DB.prepare(
			"DELETE FROM user_sessions WHERE token_hash = ?",
		)
			.bind(tokenHash)
			.run();
	}
	return c.json({ ok: true });
});

/**
 * Returns the current user's info.
 */
userAuthRoutes.get("/me", userAuth, async (c) => {
	const user = c.get("userRecord") as UserRecord;
	return c.json({ user });
});

export default userAuthRoutes;
