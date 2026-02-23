import { Hono } from "hono";
import type { AppEnv } from "../env";
import type { UserRecord } from "../middleware/userAuth";
import { userAuth } from "../middleware/userAuth";
import { getSiteMode } from "../services/settings";
import { generateToken, sha256Hex } from "../utils/crypto";
import { jsonError } from "../utils/http";
import { addHours, nowIso } from "../utils/time";

const LINUXDO_AUTH_URL = "https://connect.linux.do/oauth2/authorize";
const LINUXDO_TOKEN_URL = "https://connect.linux.do/oauth2/token";
const LINUXDO_USER_URL = "https://connect.linux.do/api/user";

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
		"SELECT id FROM users WHERE email = ? OR LOWER(name) = ?",
	)
		.bind(email, name.toLowerCase())
		.first();

	if (existing) {
		return jsonError(c, 409, "email_or_name_exists", "email_or_name_exists");
	}

	const id = crypto.randomUUID();
	const passwordHash = await sha256Hex(password);
	const now = nowIso();
	const defaultBalance = siteMode === "shared" ? 100 : 0;

	await c.env.DB.prepare(
		"INSERT INTO users (id, email, name, password_hash, role, balance, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(id, email, name, passwordHash, "user", defaultBalance, "active", now, now)
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
		user: { id, email, name, role: "user", balance: defaultBalance, status: "active" },
	});
});

/**
 * Logs in a user with email/username and password.
 */
userAuthRoutes.post("/login", async (c) => {
	const body = await c.req.json().catch(() => null);
	const account = body?.account ?? body?.email;
	if (!account || !body?.password) {
		return jsonError(c, 400, "missing_fields", "account and password required");
	}

	const accountStr = String(account).trim().toLowerCase();
	const password = String(body.password);
	const passwordHash = await sha256Hex(password);

	const user = await c.env.DB.prepare(
		"SELECT id, email, name, role, balance, status, password_hash FROM users WHERE email = ? OR LOWER(name) = ?",
	)
		.bind(accountStr, accountStr)
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

/**
 * Redirects the user to Linux DO OAuth2 authorization page.
 */
userAuthRoutes.get("/linuxdo", async (c) => {
	const clientId = c.env.LINUXDO_CLIENT_ID;
	if (!clientId) {
		return jsonError(c, 503, "linuxdo_not_configured", "Linux DO login is not configured");
	}

	const siteMode = await getSiteMode(c.env.DB);
	if (siteMode === "personal") {
		return jsonError(c, 403, "registration_disabled", "registration_disabled");
	}

	const origin = new URL(c.req.url).origin;
	const redirectUri = `${origin}/api/u/auth/linuxdo/callback`;

	const state = generateToken("ldo_");
	const stateHash = await sha256Hex(state);

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: "user",
		state,
	});

	const headers = new Headers();
	headers.set("Location", `${LINUXDO_AUTH_URL}?${params.toString()}`);
	headers.set("Set-Cookie", `linuxdo_state=${stateHash}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

	return new Response(null, { status: 302, headers });
});

/**
 * Handles the Linux DO OAuth2 callback.
 * Exchanges code for token, fetches user info, creates/logs in user.
 */
userAuthRoutes.get("/linuxdo/callback", async (c) => {
	const clientId = c.env.LINUXDO_CLIENT_ID;
	const clientSecret = c.env.LINUXDO_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		return jsonError(c, 503, "linuxdo_not_configured", "Linux DO login is not configured");
	}

	const code = c.req.query("code");
	const state = c.req.query("state");
	if (!code || !state) {
		return redirectWithError(c, "missing_code_or_state");
	}

	// Verify state matches cookie
	const cookieHeader = c.req.header("Cookie") ?? "";
	const stateHashFromCookie = parseCookie(cookieHeader, "linuxdo_state");
	if (!stateHashFromCookie) {
		return redirectWithError(c, "missing_state_cookie");
	}
	const stateHash = await sha256Hex(state);
	if (stateHash !== stateHashFromCookie) {
		return redirectWithError(c, "state_mismatch");
	}

	const origin = new URL(c.req.url).origin;
	const redirectUri = `${origin}/api/u/auth/linuxdo/callback`;

	// Exchange code for access token
	let accessToken: string;
	try {
		const tokenRes = await fetch(LINUXDO_TOKEN_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				code,
				redirect_uri: redirectUri,
				grant_type: "authorization_code",
			}).toString(),
		});
		const tokenData = (await tokenRes.json()) as { access_token?: string };
		if (!tokenData.access_token) {
			return redirectWithError(c, "token_exchange_failed");
		}
		accessToken = tokenData.access_token;
	} catch {
		return redirectWithError(c, "token_exchange_failed");
	}

	// Fetch user info from Linux DO
	let linuxdoUser: {
		id: number;
		username: string;
		name: string;
		active: boolean;
		trust_level: number;
		silenced: boolean;
	};
	try {
		const userRes = await fetch(LINUXDO_USER_URL, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		linuxdoUser = (await userRes.json()) as typeof linuxdoUser;
		if (!linuxdoUser?.id) {
			return redirectWithError(c, "user_info_failed");
		}
	} catch {
		return redirectWithError(c, "user_info_failed");
	}

	if (!linuxdoUser.active || linuxdoUser.silenced) {
		return redirectWithError(c, "linuxdo_account_restricted");
	}

	const linuxdoId = String(linuxdoUser.id);
	const now = nowIso();

	// Check if user already linked with this Linux DO account
	let user = await c.env.DB.prepare(
		"SELECT id, email, name, role, balance, status FROM users WHERE linuxdo_id = ?",
	)
		.bind(linuxdoId)
		.first<UserRecord>();

	if (user) {
		// Existing linked user — check status
		if (user.status !== "active") {
			return redirectWithError(c, "user_disabled");
		}
	} else {
		// New user — create account
		const siteMode = await getSiteMode(c.env.DB);
		if (siteMode === "personal") {
			return redirectWithError(c, "registration_disabled");
		}

		const id = crypto.randomUUID();
		const email = `linuxdo_${linuxdoId}@linuxdo.connect`;
		const displayName = linuxdoUser.name || linuxdoUser.username;
		// Random password hash so password login is disabled
		const passwordHash = await sha256Hex(generateToken("pwd_"));
		const defaultBalance = siteMode === "shared" ? 100 : 0;

		// Check if username already taken, append suffix if so
		let finalName = displayName;
		const nameExists = await c.env.DB.prepare(
			"SELECT id FROM users WHERE LOWER(name) = ?",
		)
			.bind(finalName.toLowerCase())
			.first();
		if (nameExists) {
			finalName = `${displayName}_ldo${linuxdoId}`;
		}

		await c.env.DB.prepare(
			"INSERT INTO users (id, email, name, password_hash, role, balance, status, linuxdo_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		)
			.bind(id, email, finalName, passwordHash, "user", defaultBalance, "active", linuxdoId, now, now)
			.run();

		user = { id, email, name: finalName, role: "user", balance: defaultBalance, status: "active" };
	}

	// Create session
	const rawToken = generateToken("u_");
	const tokenHash = await sha256Hex(rawToken);
	const expiresAt = addHours(new Date(), 24).toISOString();

	await c.env.DB.prepare(
		"INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
	)
		.bind(crypto.randomUUID(), user.id, tokenHash, expiresAt, now)
		.run();

	// Redirect to frontend with token
	const clearCookie = "linuxdo_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
	const frontendUrl = `${origin}/login?linuxdo_token=${encodeURIComponent(rawToken)}`;
	const headers = new Headers();
	headers.set("Location", frontendUrl);
	headers.set("Set-Cookie", clearCookie);
	return new Response(null, { status: 302, headers });
});

function redirectWithError(c: { req: { url: string } }, error: string) {
	const origin = new URL(c.req.url).origin;
	const headers = new Headers();
	headers.set("Location", `${origin}/login?linuxdo_error=${encodeURIComponent(error)}`);
	headers.set("Set-Cookie", "linuxdo_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
	return new Response(null, { status: 302, headers });
}

function parseCookie(cookieHeader: string, name: string): string | null {
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? match[1] : null;
}

export default userAuthRoutes;
