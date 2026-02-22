import type { User, UserDashboardData } from "../core/types";

type UserDashboardProps = {
	data: UserDashboardData | null;
	user: User;
};

function formatCost(n: number): string {
	if (n === 0) return "$0.00";
	if (n < 0.01) return `$${n.toFixed(4)}`;
	return `$${n.toFixed(2)}`;
}

function formatNumber(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

export const UserDashboard = ({ data, user }: UserDashboardProps) => {
	if (!data) {
		return (
			<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-lg">
				<p class="text-sm text-stone-400">加载中...</p>
			</div>
		);
	}

	return (
		<div class="space-y-5">
			{/* Stats cards */}
			<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<div class="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
					<p class="text-xs font-medium uppercase tracking-widest text-stone-400">
						余额
					</p>
					<p class="mt-1 font-['Space_Grotesk'] text-2xl font-semibold text-stone-900">
						${user.balance.toFixed(2)}
					</p>
				</div>
				<div class="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
					<p class="text-xs font-medium uppercase tracking-widest text-stone-400">
						总请求
					</p>
					<p class="mt-1 font-['Space_Grotesk'] text-2xl font-semibold text-stone-900">
						{formatNumber(data.total_requests)}
					</p>
				</div>
				<div class="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
					<p class="text-xs font-medium uppercase tracking-widest text-stone-400">
						总 Token
					</p>
					<p class="mt-1 font-['Space_Grotesk'] text-2xl font-semibold text-stone-900">
						{formatNumber(data.total_tokens)}
					</p>
				</div>
				<div class="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
					<p class="text-xs font-medium uppercase tracking-widest text-stone-400">
						总费用
					</p>
					<p class="mt-1 font-['Space_Grotesk'] text-2xl font-semibold text-stone-900">
						{formatCost(data.total_cost)}
					</p>
				</div>
			</div>

			{/* Recent usage */}
			<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-lg">
				<h3 class="mb-4 font-['Space_Grotesk'] text-lg tracking-tight text-stone-900">
					最近使用
				</h3>
				{data.recent_usage.length === 0 ? (
					<p class="py-8 text-center text-sm text-stone-400">
						暂无使用记录
					</p>
				) : (
					<div class="overflow-x-auto">
						<table class="w-full text-left text-sm">
							<thead>
								<tr class="border-b border-stone-100 text-xs uppercase tracking-widest text-stone-400">
									<th class="pb-2 pr-4 font-medium">日期</th>
									<th class="pb-2 pr-4 font-medium">请求数</th>
									<th class="pb-2 font-medium">费用</th>
								</tr>
							</thead>
							<tbody>
								{data.recent_usage.map((item) => (
									<tr class="border-b border-stone-50">
										<td class="py-2 pr-4 text-stone-600">
											{item.day}
										</td>
										<td class="py-2 pr-4 text-stone-600">
											{item.requests}
										</td>
										<td class="py-2 text-stone-600">
											{formatCost(item.cost)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
};
