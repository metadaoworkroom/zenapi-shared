import { useState } from "hono/jsx/dom";
import type { InviteCode, RegistrationMode, SettingsForm, SiteMode } from "../core/types";

type SettingsViewProps = {
	settingsForm: SettingsForm;
	adminPasswordSet: boolean;
	onSubmit: (event: Event) => void;
	onFormChange: (patch: Partial<SettingsForm>) => void;
	inviteCodes: InviteCode[];
	onGenerateCodes: (count: number, maxUses: number, prefix: string) => Promise<void>;
	onDeleteCode: (id: string) => Promise<void>;
	onExportCodes: () => Promise<void>;
};

const siteModeOptions: { value: SiteMode; label: string; desc: string }[] = [
	{ value: "personal", label: "自用模式", desc: "个人使用，模型广场不公开" },
	{
		value: "service",
		label: "服务模式",
		desc: "向用户提供 API 服务，用户有余额，公开模型及价格",
	},
	{
		value: "shared",
		label: "共享模式",
		desc: "多人共享渠道资源，共同使用，公开模型广场",
	},
];

const registrationModeOptions: { value: RegistrationMode; label: string; desc: string }[] = [
	{ value: "open", label: "开放注册", desc: "允许通过邮箱密码和 Linux DO 注册" },
	{ value: "linuxdo_only", label: "仅 Linux DO", desc: "仅允许通过 Linux DO 登录注册" },
	{ value: "closed", label: "关闭注册", desc: "不接受新用户注册，已有用户可正常登录" },
];

export const SettingsView = ({
	settingsForm,
	adminPasswordSet,
	onSubmit,
	onFormChange,
	inviteCodes,
	onGenerateCodes,
	onDeleteCode,
	onExportCodes,
}: SettingsViewProps) => {
	const [genCount, setGenCount] = useState("10");
	const [genMaxUses, setGenMaxUses] = useState("1");
	const [genPrefix, setGenPrefix] = useState("ZEN-");

	return (
	<div class="space-y-5">
	<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-lg">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="mb-0 font-['Space_Grotesk'] text-lg tracking-tight text-stone-900">
				系统设置
			</h3>
		</div>
		<form class="grid gap-3.5 lg:grid-cols-2" onSubmit={onSubmit}>
			<div>
				<label
					class="mb-1.5 block text-xs uppercase tracking-widest text-stone-500"
					for="retention"
				>
					日志保留天数
				</label>
				<input
					class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
					id="retention"
					name="log_retention_days"
					type="number"
					min="1"
					value={settingsForm.log_retention_days}
					onInput={(event) => {
						const target = event.currentTarget as HTMLInputElement | null;
						onFormChange({
							log_retention_days: target?.value ?? "",
						});
					}}
				/>
			</div>
			<div>
				<label
					class="mb-1.5 block text-xs uppercase tracking-widest text-stone-500"
					for="session-ttl"
				>
					会话时长（小时）
				</label>
				<input
					class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
					id="session-ttl"
					name="session_ttl_hours"
					type="number"
					min="1"
					value={settingsForm.session_ttl_hours}
					onInput={(event) => {
						const target = event.currentTarget as HTMLInputElement | null;
						onFormChange({
							session_ttl_hours: target?.value ?? "",
						});
					}}
				/>
			</div>
			<div class="lg:col-span-2">
				<label
					class="mb-1.5 block text-xs uppercase tracking-widest text-stone-500"
					for="admin-password"
				>
					管理员密码
				</label>
				<input
					class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
					id="admin-password"
					name="admin_password"
					type="password"
					placeholder={
						adminPasswordSet
							? "已设置，留空则不修改"
							: "未设置，保存后即为登录密码"
					}
					value={settingsForm.admin_password}
					onInput={(event) => {
						const target = event.currentTarget as HTMLInputElement | null;
						onFormChange({
							admin_password: target?.value ?? "",
						});
					}}
				/>
				<p class="mt-1 text-xs text-stone-500">
					密码状态：{adminPasswordSet ? "已设置" : "未设置"}
				</p>
			</div>
			<div class="lg:col-span-2">
				<label
					class="mb-1.5 block text-xs uppercase tracking-widest text-stone-500"
					for="site-mode"
				>
					站点模式
				</label>
				<select
					class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
					id="site-mode"
					name="site_mode"
					value={settingsForm.site_mode}
					onChange={(event) => {
						const target = event.currentTarget as HTMLSelectElement | null;
						onFormChange({
							site_mode: (target?.value ?? "personal") as SiteMode,
						});
					}}
				>
					{siteModeOptions.map((opt) => (
						<option key={opt.value} value={opt.value} selected={settingsForm.site_mode === opt.value}>
							{opt.label} — {opt.desc}
						</option>
					))}
				</select>
			</div>
			{settingsForm.site_mode !== "personal" && (
			<>
			<div class="lg:col-span-2">
				<label
					class="mb-1.5 block text-xs uppercase tracking-widest text-stone-500"
					for="registration-mode"
				>
					注册模式
				</label>
				<select
					class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
					id="registration-mode"
					name="registration_mode"
					value={settingsForm.registration_mode}
					onChange={(event) => {
						const target = event.currentTarget as HTMLSelectElement | null;
						onFormChange({
							registration_mode: (target?.value ?? "open") as RegistrationMode,
						});
					}}
				>
					{registrationModeOptions.map((opt) => (
						<option key={opt.value} value={opt.value} selected={settingsForm.registration_mode === opt.value}>
							{opt.label} — {opt.desc}
						</option>
					))}
				</select>
			</div>
			<div>
				<label
					class="mb-1.5 block text-xs uppercase tracking-widest text-stone-500"
					for="checkin-reward"
				>
					签到奖励额度
				</label>
				<input
					class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
					id="checkin-reward"
					name="checkin_reward"
					type="number"
					min="0.01"
					step="0.01"
					value={settingsForm.checkin_reward}
					onInput={(event) => {
						const target = event.currentTarget as HTMLInputElement | null;
						onFormChange({
							checkin_reward: target?.value ?? "",
						});
					}}
				/>
			</div>
			<div class="flex items-end">
				<label class="flex items-center gap-2 text-sm text-stone-700">
					<input
						type="checkbox"
						class="h-4 w-4 rounded border-stone-300 text-amber-500 focus:ring-amber-400"
						checked={settingsForm.require_invite_code === "true"}
						onChange={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								require_invite_code: target?.checked ? "true" : "false",
							});
						}}
					/>
					需要邀请码注册
				</label>
			</div>
			</>
			)}
			<div class="flex items-end lg:col-span-2">
				<button
					class="h-11 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
					type="submit"
				>
					保存设置
				</button>
			</div>
		</form>
	</div>
	{settingsForm.site_mode !== "personal" && settingsForm.require_invite_code === "true" && (
	<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-lg">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="font-['Space_Grotesk'] text-lg tracking-tight text-stone-900">
				邀请码管理
			</h3>
			<button
				type="button"
				class="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-all hover:border-stone-300 hover:shadow-sm"
				onClick={onExportCodes}
			>
				导出可用码
			</button>
		</div>
		<div class="mb-4 flex flex-wrap items-end gap-3">
			<div>
				<label class="mb-1 block text-xs text-stone-500">数量</label>
				<input
					type="number"
					min="1"
					max="100"
					class="w-20 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
					value={genCount}
					onInput={(e) => setGenCount((e.currentTarget as HTMLInputElement)?.value ?? "10")}
				/>
			</div>
			<div>
				<label class="mb-1 block text-xs text-stone-500">最大使用次数</label>
				<input
					type="number"
					min="1"
					class="w-20 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
					value={genMaxUses}
					onInput={(e) => setGenMaxUses((e.currentTarget as HTMLInputElement)?.value ?? "1")}
				/>
			</div>
			<div>
				<label class="mb-1 block text-xs text-stone-500">前缀</label>
				<input
					type="text"
					class="w-24 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
					value={genPrefix}
					onInput={(e) => setGenPrefix((e.currentTarget as HTMLInputElement)?.value ?? "ZEN-")}
				/>
			</div>
			<button
				type="button"
				class="h-[34px] rounded-lg bg-stone-900 px-3 text-xs font-semibold text-white transition-all hover:shadow-lg"
				onClick={() => onGenerateCodes(Number(genCount) || 10, Number(genMaxUses) || 1, genPrefix || "ZEN-")}
			>
				批量生成
			</button>
		</div>
		{inviteCodes.length === 0 ? (
			<p class="py-4 text-center text-sm text-stone-400">暂无邀请码</p>
		) : (
			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm">
					<thead>
						<tr class="border-b border-stone-100 text-xs uppercase tracking-widest text-stone-400">
							<th class="pb-2 pr-4 font-medium">邀请码</th>
							<th class="pb-2 pr-4 font-medium">最大次数</th>
							<th class="pb-2 pr-4 font-medium">已使用</th>
							<th class="pb-2 pr-4 font-medium">状态</th>
							<th class="pb-2 pr-4 font-medium">创建时间</th>
							<th class="pb-2 font-medium">操作</th>
						</tr>
					</thead>
					<tbody>
						{inviteCodes.map((code) => (
							<tr key={code.id} class="border-b border-stone-50">
								<td class="py-2 pr-4 font-['Space_Grotesk'] text-stone-700">{code.code}</td>
								<td class="py-2 pr-4 text-stone-600">{code.max_uses}</td>
								<td class="py-2 pr-4 text-stone-600">{code.used_count}</td>
								<td class="py-2 pr-4">
									<span class={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
										code.used_count >= code.max_uses
											? "bg-stone-100 text-stone-500"
											: "bg-green-50 text-green-600"
									}`}>
										{code.used_count >= code.max_uses ? "已用完" : "可用"}
									</span>
								</td>
								<td class="py-2 pr-4 text-xs text-stone-500">{code.created_at?.slice(0, 16)}</td>
								<td class="py-2">
									<button
										type="button"
										class="text-xs text-red-500 hover:text-red-700"
										onClick={() => onDeleteCode(code.id)}
									>
										删除
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		)}
	</div>
	)}
	</div>
	);
};
