import { Hono } from "hono";
import type { AppEnv } from "../env";
import type { UserRecord } from "../middleware/userAuth";
import { userAuth } from "../middleware/userAuth";
import { disableNonMaintainerChannels } from "../services/ldoh-blocking";
import { jsonError } from "../utils/http";
import { nowIso } from "../utils/time";
import { extractHostname, hostnameMatches } from "../utils/url";

const ldohUser = new Hono<AppEnv>();

ldohUser.use("/*", userAuth);

/**
 * Returns sites the current user maintains (approved=1).
 */
ldohUser.get("/my-sites", async (c) => {
	const user = c.get("userRecord") as UserRecord;

	if (!user.linuxdo_username) {
		return c.json({ sites: [] });
	}

	const result = await c.env.DB.prepare(
		`SELECT s.*, m.id as maintainer_id, m.approved
		 FROM ldoh_site_maintainers m
		 JOIN ldoh_sites s ON s.id = m.site_id
		 WHERE m.username = ? AND m.approved = 1`,
	)
		.bind(user.linuxdo_username)
		.all();

	const sites = result.results ?? [];

	// Enrich with blocked status
	const enriched = [];
	for (const site of sites) {
		const blocked = await c.env.DB.prepare(
			"SELECT id, hostname FROM ldoh_blocked_urls WHERE site_id = ?",
		)
			.bind(site.id)
			.all();

		enriched.push({
			...site,
			blocked: blocked.results ?? [],
		});
	}

	return c.json({ sites: enriched });
});

/**
 * Claims a site as maintainer (manual declaration, requires admin approval).
 */
ldohUser.post("/claim-site", async (c) => {
	const user = c.get("userRecord") as UserRecord;
	const userId = c.get("userId") as string;

	if (!user.linuxdo_username) {
		return jsonError(c, 400, "linuxdo_required", "请先绑定 Linux DO 账号");
	}

	const body = await c.req.json().catch(() => null);
	if (!body?.apiBaseUrl) {
		return jsonError(c, 400, "missing_url", "请提供 API Base URL");
	}

	const apiBaseUrl = String(body.apiBaseUrl).trim();
	const hostname = extractHostname(apiBaseUrl);
	if (!hostname) {
		return jsonError(c, 400, "invalid_url", "无效的 URL");
	}

	// Check if the site already exists
	let site = await c.env.DB.prepare(
		"SELECT id, name FROM ldoh_sites WHERE api_base_hostname = ?",
	)
		.bind(hostname)
		.first<{ id: string; name: string }>();

	const now = nowIso();

	if (!site) {
		// Create a manual site entry
		const siteId = crypto.randomUUID();
		await c.env.DB.prepare(
			`INSERT INTO ldoh_sites (id, name, api_base_url, api_base_hostname, source, synced_at)
			 VALUES (?, ?, ?, ?, 'manual', ?)`,
		)
			.bind(siteId, hostname, apiBaseUrl, hostname, now)
			.run();
		site = { id: siteId, name: hostname };

		// Auto-block by default
		await c.env.DB.prepare(
			"INSERT INTO ldoh_blocked_urls (id, site_id, hostname, blocked_by, created_at) VALUES (?, ?, ?, 'system', ?)",
		).bind(crypto.randomUUID(), siteId, hostname, now).run();
		await disableNonMaintainerChannels(c.env.DB, siteId, hostname);
	}

	// Check if already a maintainer
	const existing = await c.env.DB.prepare(
		"SELECT id FROM ldoh_site_maintainers WHERE site_id = ? AND username = ?",
	)
		.bind(site.id, user.linuxdo_username)
		.first();

	if (existing) {
		return jsonError(c, 409, "already_claimed", "你已声明维护此站点");
	}

	const maintainerId = crypto.randomUUID();
	await c.env.DB.prepare(
		`INSERT INTO ldoh_site_maintainers (id, site_id, user_id, name, username, linuxdo_id, approved, source)
		 VALUES (?, ?, ?, ?, ?, ?, 0, 'manual')`,
	)
		.bind(
			maintainerId,
			site.id,
			userId,
			user.name,
			user.linuxdo_username,
			user.linuxdo_id || null,
		)
		.run();

	return c.json({ ok: true, site_id: site.id, message: "声明已提交，等待管理员审批" });
});

/**
 * Returns channels matching a site's hostname.
 */
ldohUser.get("/sites/:id/channels", async (c) => {
	const user = c.get("userRecord") as UserRecord;
	const siteId = c.req.param("id");

	// Verify maintainer access
	if (!user.linuxdo_username) {
		return jsonError(c, 403, "not_maintainer", "not_maintainer");
	}

	const maintainer = await c.env.DB.prepare(
		"SELECT id FROM ldoh_site_maintainers WHERE site_id = ? AND username = ? AND approved = 1",
	)
		.bind(siteId, user.linuxdo_username)
		.first();

	if (!maintainer) {
		return jsonError(c, 403, "not_maintainer", "你不是此站点的已审批维护者");
	}

	const site = await c.env.DB.prepare(
		"SELECT api_base_hostname FROM ldoh_sites WHERE id = ?",
	)
		.bind(siteId)
		.first<{ api_base_hostname: string }>();

	if (!site) {
		return jsonError(c, 404, "site_not_found", "site_not_found");
	}

	const channels = await c.env.DB.prepare(
		`SELECT c.id, c.name, c.base_url, c.status, c.contributed_by, c.created_at, u.name as user_name, u.linuxdo_username
		 FROM channels c
		 LEFT JOIN users u ON c.contributed_by = u.id
		 ORDER BY c.created_at DESC`,
	).all();

	// Filter channels whose base_url hostname matches the site hostname (domain suffix match)
	const matching = (channels.results ?? []).filter((ch) => {
		const chHostname = extractHostname(String(ch.base_url));
		return hostnameMatches(chHostname, site.api_base_hostname);
	});

	return c.json({ channels: matching });
});

/**
 * Blocks a site's hostname (only approved maintainers).
 */
ldohUser.post("/sites/:id/block", async (c) => {
	const user = c.get("userRecord") as UserRecord;
	const userId = c.get("userId") as string;
	const siteId = c.req.param("id");

	if (!user.linuxdo_username) {
		return jsonError(c, 403, "not_maintainer", "not_maintainer");
	}

	const maintainer = await c.env.DB.prepare(
		"SELECT id FROM ldoh_site_maintainers WHERE site_id = ? AND username = ? AND approved = 1",
	)
		.bind(siteId, user.linuxdo_username)
		.first();

	if (!maintainer) {
		return jsonError(c, 403, "not_maintainer", "你不是此站点的已审批维护者");
	}

	const site = await c.env.DB.prepare(
		"SELECT id, api_base_hostname FROM ldoh_sites WHERE id = ?",
	)
		.bind(siteId)
		.first<{ id: string; api_base_hostname: string }>();

	if (!site) {
		return jsonError(c, 404, "site_not_found", "site_not_found");
	}

	const existing = await c.env.DB.prepare(
		"SELECT id FROM ldoh_blocked_urls WHERE hostname = ?",
	)
		.bind(site.api_base_hostname)
		.first();

	if (existing) {
		return c.json({ ok: true, already_blocked: true });
	}

	const id = crypto.randomUUID();
	await c.env.DB.prepare(
		"INSERT INTO ldoh_blocked_urls (id, site_id, hostname, blocked_by, created_at) VALUES (?, ?, ?, ?, ?)",
	)
		.bind(id, siteId, site.api_base_hostname, userId, nowIso())
		.run();
	await disableNonMaintainerChannels(c.env.DB, siteId, site.api_base_hostname);

	return c.json({ ok: true });
});

/**
 * Unblocks a site's hostname.
 */
ldohUser.delete("/sites/:id/block", async (c) => {
	const user = c.get("userRecord") as UserRecord;
	const siteId = c.req.param("id");

	if (!user.linuxdo_username) {
		return jsonError(c, 403, "not_maintainer", "not_maintainer");
	}

	const maintainer = await c.env.DB.prepare(
		"SELECT id FROM ldoh_site_maintainers WHERE site_id = ? AND username = ? AND approved = 1",
	)
		.bind(siteId, user.linuxdo_username)
		.first();

	if (!maintainer) {
		return jsonError(c, 403, "not_maintainer", "你不是此站点的已审批维护者");
	}

	await c.env.DB.prepare("DELETE FROM ldoh_blocked_urls WHERE site_id = ?")
		.bind(siteId)
		.run();

	return c.json({ ok: true });
});

/**
 * Returns violations for a site.
 */
ldohUser.get("/sites/:id/violations", async (c) => {
	const user = c.get("userRecord") as UserRecord;
	const siteId = c.req.param("id");

	if (!user.linuxdo_username) {
		return jsonError(c, 403, "not_maintainer", "not_maintainer");
	}

	const maintainer = await c.env.DB.prepare(
		"SELECT id FROM ldoh_site_maintainers WHERE site_id = ? AND username = ? AND approved = 1",
	)
		.bind(siteId, user.linuxdo_username)
		.first();

	if (!maintainer) {
		return jsonError(c, 403, "not_maintainer", "你不是此站点的已审批维护者");
	}

	const result = await c.env.DB.prepare(
		"SELECT * FROM ldoh_violations WHERE site_id = ? ORDER BY created_at DESC LIMIT 100",
	)
		.bind(siteId)
		.all();

	return c.json({ violations: result.results ?? [] });
});

/**
 * Deletes a channel matching the maintainer's site.
 */
ldohUser.delete("/channels/:channelId", async (c) => {
	const user = c.get("userRecord") as UserRecord;
	const channelId = c.req.param("channelId");

	if (!user.linuxdo_username) {
		return jsonError(c, 403, "not_maintainer", "not_maintainer");
	}

	const channel = await c.env.DB.prepare(
		"SELECT id, base_url FROM channels WHERE id = ?",
	)
		.bind(channelId)
		.first<{ id: string; base_url: string }>();

	if (!channel) {
		return jsonError(c, 404, "channel_not_found", "channel_not_found");
	}

	const channelHostname = extractHostname(channel.base_url);

	// Check that user is an approved maintainer of a site matching this hostname (domain suffix match)
	const maintainerSites = await c.env.DB.prepare(
		`SELECT s.id, s.api_base_hostname FROM ldoh_site_maintainers m
		 JOIN ldoh_sites s ON s.id = m.site_id
		 WHERE m.username = ? AND m.approved = 1`,
	)
		.bind(user.linuxdo_username)
		.all();

	const maintainerSite = (maintainerSites.results ?? []).find((s) =>
		hostnameMatches(channelHostname, String(s.api_base_hostname)),
	);

	if (!maintainerSite) {
		return jsonError(c, 403, "not_site_maintainer", "你不是匹配此渠道地址的站点维护者");
	}

	await c.env.DB.prepare("DELETE FROM channels WHERE id = ?")
		.bind(channelId)
		.run();

	return c.json({ ok: true });
});

/**
 * Maintainer approves a pending channel.
 */
ldohUser.post("/channels/:channelId/approve", async (c) => {
	const user = c.get("userRecord") as UserRecord;
	const channelId = c.req.param("channelId");

	if (!user.linuxdo_username) {
		return jsonError(c, 403, "not_maintainer", "not_maintainer");
	}

	const channel = await c.env.DB.prepare(
		"SELECT id, base_url, status FROM channels WHERE id = ?",
	)
		.bind(channelId)
		.first<{ id: string; base_url: string; status: string }>();

	if (!channel) {
		return jsonError(c, 404, "channel_not_found", "channel_not_found");
	}

	const channelHostname2 = extractHostname(channel.base_url);

	const maintainerSites2 = await c.env.DB.prepare(
		`SELECT s.id, s.api_base_hostname FROM ldoh_site_maintainers m
		 JOIN ldoh_sites s ON s.id = m.site_id
		 WHERE m.username = ? AND m.approved = 1`,
	)
		.bind(user.linuxdo_username)
		.all();

	const maintainerSite2 = (maintainerSites2.results ?? []).find((s) =>
		hostnameMatches(channelHostname2, String(s.api_base_hostname)),
	);

	if (!maintainerSite2) {
		return jsonError(c, 403, "not_site_maintainer", "你不是匹配此渠道地址的站点维护者");
	}

	await c.env.DB.prepare(
		"UPDATE channels SET status = 'active', updated_at = ? WHERE id = ?",
	)
		.bind(nowIso(), channelId)
		.run();

	return c.json({ ok: true });
});

/**
 * Maintainer rejects a pending channel (deletes it).
 */
ldohUser.post("/channels/:channelId/reject", async (c) => {
	const user = c.get("userRecord") as UserRecord;
	const channelId = c.req.param("channelId");

	if (!user.linuxdo_username) {
		return jsonError(c, 403, "not_maintainer", "not_maintainer");
	}

	const channel = await c.env.DB.prepare(
		"SELECT id, base_url FROM channels WHERE id = ?",
	)
		.bind(channelId)
		.first<{ id: string; base_url: string }>();

	if (!channel) {
		return jsonError(c, 404, "channel_not_found", "channel_not_found");
	}

	const channelHostname3 = extractHostname(channel.base_url);

	const maintainerSites3 = await c.env.DB.prepare(
		`SELECT s.id, s.api_base_hostname FROM ldoh_site_maintainers m
		 JOIN ldoh_sites s ON s.id = m.site_id
		 WHERE m.username = ? AND m.approved = 1`,
	)
		.bind(user.linuxdo_username)
		.all();

	const maintainerSite3 = (maintainerSites3.results ?? []).find((s) =>
		hostnameMatches(channelHostname3, String(s.api_base_hostname)),
	);

	if (!maintainerSite3) {
		return jsonError(c, 403, "not_site_maintainer", "你不是匹配此渠道地址的站点维护者");
	}

	await c.env.DB.prepare("DELETE FROM channels WHERE id = ?")
		.bind(channelId)
		.run();

	return c.json({ ok: true });
});

export default ldohUser;
