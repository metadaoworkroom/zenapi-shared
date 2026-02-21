import { Hono } from "hono";
import type { AppEnv } from "../env";
import { extractModelPricings } from "../services/channel-models";
import { listActiveChannels } from "../services/channel-repo";
import { getSiteMode } from "../services/settings";

const publicRoutes = new Hono<AppEnv>();

/**
 * Public models endpoint — controlled by site mode.
 */
publicRoutes.get("/models", async (c) => {
	const siteMode = await getSiteMode(c.env.DB);

	if (siteMode === "personal") {
		return c.json({ error: "模型信息不公开" }, 403);
	}

	const channels = await listActiveChannels(c.env.DB);
	const modelMap = new Map<
		string,
		Array<{
			id: string;
			name: string;
			input_price: number | null;
			output_price: number | null;
		}>
	>();

	for (const channel of channels) {
		const pricings = extractModelPricings(channel);
		for (const p of pricings) {
			const existing = modelMap.get(p.id) ?? [];
			existing.push({
				id: channel.id,
				name: channel.name,
				input_price:
					siteMode === "shared" ? null : (p.input_price ?? null),
				output_price:
					siteMode === "shared" ? null : (p.output_price ?? null),
			});
			modelMap.set(p.id, existing);
		}
	}

	const models = Array.from(modelMap.entries()).map(([id, chs]) => ({
		id,
		channels: chs,
	}));

	return c.json({ models });
});

export default publicRoutes;
