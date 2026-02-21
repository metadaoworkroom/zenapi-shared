import { useState } from "hono/jsx/dom";
import type { ModelItem } from "../core/types";

type ModelsViewProps = {
	models: ModelItem[];
};

const MiniSparkline = ({
	data,
}: { data: { day: string; requests: number; tokens: number }[] }) => {
	if (data.length === 0) return null;
	const values = data.map((d) => d.requests);
	const max = Math.max(...values, 1);
	const width = 120;
	const height = 32;
	const padding = 2;
	const step = (width - padding * 2) / Math.max(values.length - 1, 1);

	const points = values
		.map((v, i) => {
			const x = padding + i * step;
			const y = height - padding - ((v / max) * (height - padding * 2));
			return `${x},${y}`;
		})
		.join(" ");

	const areaPoints = `${padding},${height - padding} ${points} ${padding + (values.length - 1) * step},${height - padding}`;

	return (
		<svg
			width={width}
			height={height}
			class="inline-block"
			viewBox={`0 0 ${width} ${height}`}
		>
			<polygon points={areaPoints} fill="rgba(245,158,11,0.15)" />
			<polyline
				points={points}
				fill="none"
				stroke="rgb(245,158,11)"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	);
};

function formatNumber(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

function formatCost(n: number): string {
	if (n === 0) return "$0";
	if (n < 0.01) return `$${n.toFixed(4)}`;
	return `$${n.toFixed(2)}`;
}

function formatPrice(n: number | null): string {
	if (n == null) return "-";
	return `$${n}`;
}

const ModelCard = ({ model }: { model: ModelItem }) => (
	<div class="rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
		<div class="mb-2 flex items-start justify-between gap-2">
			<h4 class="break-all font-['Space_Grotesk'] text-sm font-semibold tracking-tight text-stone-900">
				{model.id}
			</h4>
			<span class="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
				{model.channels.length} 渠道
			</span>
		</div>

		{model.avg_latency_ms != null && (
			<p class="mb-3 text-xs text-stone-400">
				平均延迟 {model.avg_latency_ms}ms
			</p>
		)}

		{model.channels.length > 0 && (
			<div class="mb-3 rounded-lg bg-stone-50 p-2.5">
				<p class="mb-1.5 text-xs font-medium uppercase tracking-widest text-stone-400">
					渠道价格
				</p>
				<div class="space-y-1">
					{model.channels.map((ch) => (
						<div
							key={ch.id}
							class="flex items-center justify-between text-xs"
						>
							<span class="truncate text-stone-600">{ch.name}</span>
							<span class="shrink-0 pl-2 text-stone-500">
								{ch.input_price != null || ch.output_price != null ? (
									<>
										<span class="text-emerald-600">
											{formatPrice(ch.input_price)}
										</span>
										{" / "}
										<span class="text-blue-600">
											{formatPrice(ch.output_price)}
										</span>
										<span class="ml-1 text-stone-400">/1M</span>
									</>
								) : (
									<span class="text-stone-300">未设置</span>
								)}
							</span>
						</div>
					))}
				</div>
			</div>
		)}

		{model.daily.length > 0 && (
			<div class="mb-3">
				<MiniSparkline data={model.daily} />
			</div>
		)}

		<div class="flex flex-wrap gap-x-3 gap-y-1 border-t border-stone-100 pt-2.5 text-xs text-stone-500">
			<span>
				请求{" "}
				<span class="font-medium text-stone-700">
					{formatNumber(model.total_requests)}
				</span>
			</span>
			<span>
				Token{" "}
				<span class="font-medium text-stone-700">
					{formatNumber(model.total_tokens)}
				</span>
			</span>
			<span>
				费用{" "}
				<span class="font-medium text-stone-700">
					{formatCost(model.total_cost)}
				</span>
			</span>
		</div>
	</div>
);

export const ModelsView = ({ models }: ModelsViewProps) => {
	const [search, setSearch] = useState("");

	const filtered = search
		? models.filter((m) =>
				m.id.toLowerCase().includes(search.toLowerCase()),
			)
		: models;

	return (
		<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-lg">
			<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-center gap-3">
					<h3 class="mb-0 font-['Space_Grotesk'] text-lg tracking-tight text-stone-900">
						模型广场
					</h3>
					<span class="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-500">
						{filtered.length} / {models.length} 个模型
					</span>
				</div>
				<input
					class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:w-64"
					type="text"
					placeholder="搜索模型..."
					value={search}
					onInput={(e) => {
						const target = e.currentTarget as HTMLInputElement | null;
						setSearch(target?.value ?? "");
					}}
				/>
			</div>
			{filtered.length === 0 ? (
				<div class="py-12 text-center text-sm text-stone-400">
					{models.length === 0 ? "暂无模型数据" : "未找到匹配的模型"}
				</div>
			) : (
				<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
					{filtered.map((model) => (
						<ModelCard key={model.id} model={model} />
					))}
				</div>
			)}
		</div>
	);
};
