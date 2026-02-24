import { Hono } from "hono";
import type { AppEnv } from "../env";
import { extractModelPricings, extractSharedModelPricings } from "../services/channel-models";
import { listActiveChannels } from "../services/channel-repo";
import { loadAllChannelAliasesGrouped } from "../services/model-aliases";
import { getRegistrationMode, getSiteMode } from "../services/settings";

const publicRoutes = new Hono<AppEnv>();

/**
 * Lightweight site info endpoint — always accessible.
 */
publicRoutes.get("/site-info", async (c) => {
	const siteMode = await getSiteMode(c.env.DB);
	const registrationMode = await getRegistrationMode(c.env.DB);
	const linuxdoEnabled = Boolean(c.env.LINUXDO_CLIENT_ID);
	return c.json({ site_mode: siteMode, registration_mode: registrationMode, linuxdo_enabled: linuxdoEnabled });
});

/**
 * Public models endpoint — controlled by site mode.
 *
 * personal → 403, not public
 * service  → show models with prices (users pay per usage)
 * shared   → show shared-flagged models only, hide prices and channel names
 */
publicRoutes.get("/models", async (c) => {
	const siteMode = await getSiteMode(c.env.DB);

	if (siteMode === "personal") {
		return c.json({ error: "模型信息不公开" }, 403);
	}

	const channels = await listActiveChannels(c.env.DB);

	// Load alias data
	const aliasGroups = await loadAllChannelAliasesGrouped(c.env.DB);

	// Compute effective mapping
	type ChannelEntry = { id: string; name: string; input_price: number | null; output_price: number | null };
	const effectiveMap = new Map<string, { channels: Map<string, ChannelEntry> }>();

	for (const channel of channels) {
		const pricings = siteMode === "shared"
			? extractSharedModelPricings(channel)
			: extractModelPricings(channel);
		const chAliases = aliasGroups.get(channel.id);

		for (const p of pricings) {
			const aliasInfo = chAliases?.get(p.id);
			const isAliasOnly = aliasInfo?.alias_only ?? false;
			const chInfo: ChannelEntry = siteMode === "shared"
				? { id: channel.id, name: "共享渠道", input_price: null, output_price: null }
				: { id: channel.id, name: channel.name, input_price: p.input_price ?? null, output_price: p.output_price ?? null };

			// Original name (unless alias_only)
			if (!isAliasOnly) {
				let entry = effectiveMap.get(p.id);
				if (!entry) {
					entry = { channels: new Map() };
					effectiveMap.set(p.id, entry);
				}
				entry.channels.set(channel.id, chInfo);
			}

			// Alias names
			if (aliasInfo) {
				for (const alias of aliasInfo.aliases) {
					let entry = effectiveMap.get(alias);
					if (!entry) {
						entry = { channels: new Map() };
						effectiveMap.set(alias, entry);
					}
					entry.channels.set(channel.id, chInfo);
				}
			}
		}
	}

	const models: Array<{ id: string; channels: ChannelEntry[] }> = [];
	for (const [callableName, entry] of effectiveMap) {
		models.push({ id: callableName, channels: Array.from(entry.channels.values()) });
	}

	return c.json({ models, site_mode: siteMode });
});

export default publicRoutes;
