import { useCallback, useEffect, useState } from "hono/jsx/dom";
import { createApiFetch } from "./core/api";
import type { PublicModelItem, SiteMode } from "./core/types";
import { UserLoginView } from "./features/UserLoginView";
import { UserRegisterView } from "./features/UserRegisterView";

const normalizePath = (path: string) => {
	if (path.length <= 1) return "/";
	return path.replace(/\/+$/, "") || "/";
};

function formatPrice(n: number | null): string {
	if (n == null) return "-";
	return `$${n}`;
}

const PublicModelCard = ({ model }: { model: PublicModelItem }) => (
	<div class="rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
		<div class="mb-2 flex items-start justify-between gap-2">
			<h4 class="break-all font-['Space_Grotesk'] text-sm font-semibold tracking-tight text-stone-900">
				{model.id}
			</h4>
			<span class="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
				{model.channels.length} 渠道
			</span>
		</div>
		{model.channels.length > 0 && (
			<div class="rounded-lg bg-stone-50 p-2.5">
				<p class="mb-1.5 text-xs font-medium uppercase tracking-widest text-stone-400">
					渠道价格
				</p>
				<div class="space-y-1">
					{model.channels.map((ch) => (
						<div class="flex items-center justify-between text-xs">
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
	</div>
);

type PublicAppProps = {
	onUserLogin: (token: string) => void;
};

export const PublicApp = ({ onUserLogin }: PublicAppProps) => {
	const [page, setPage] = useState<"home" | "login" | "register">(() => {
		const normalized = normalizePath(window.location.pathname);
		if (normalized === "/login") return "login";
		if (normalized === "/register") return "register";
		return "home";
	});
	const [models, setModels] = useState<PublicModelItem[]>([]);
	const [siteMode, setSiteMode] = useState<SiteMode>("personal");
	const [search, setSearch] = useState("");
	const [notice, setNotice] = useState("");

	const apiFetch = useCallback(
		() => createApiFetch(null, () => {}),
		[],
	);

	useEffect(() => {
		const fetchModels = async () => {
			try {
				const api = apiFetch();
				const result = await api<{
					models: PublicModelItem[];
					site_mode: SiteMode;
				}>("/api/public/models");
				setModels(result.models);
				setSiteMode(result.site_mode);
			} catch {
				// personal mode returns 403, which is expected
			}
		};
		fetchModels();
	}, [apiFetch]);

	useEffect(() => {
		const handlePopState = () => {
			const normalized = normalizePath(window.location.pathname);
			if (normalized === "/login") setPage("login");
			else if (normalized === "/register") setPage("register");
			else setPage("home");
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	const navigate = useCallback((target: "home" | "login" | "register") => {
		const paths = { home: "/", login: "/login", register: "/register" };
		history.pushState(null, "", paths[target]);
		setPage(target);
		setNotice("");
	}, []);

	const handleLogin = useCallback(
		async (email: string, password: string) => {
			try {
				const api = apiFetch();
				const result = await api<{ token: string }>("/api/u/auth/login", {
					method: "POST",
					body: JSON.stringify({ email, password }),
				});
				onUserLogin(result.token);
			} catch (error) {
				setNotice((error as Error).message);
			}
		},
		[apiFetch, onUserLogin],
	);

	const handleRegister = useCallback(
		async (email: string, name: string, password: string) => {
			try {
				const api = apiFetch();
				const result = await api<{ token: string }>(
					"/api/u/auth/register",
					{
						method: "POST",
						body: JSON.stringify({ email, name, password }),
					},
				);
				onUserLogin(result.token);
			} catch (error) {
				setNotice((error as Error).message);
			}
		},
		[apiFetch, onUserLogin],
	);

	if (page === "login") {
		return (
			<div class="min-h-screen bg-linear-to-b from-white via-stone-50 to-stone-100 font-['IBM_Plex_Sans'] text-stone-900 antialiased">
				<nav class="border-b border-stone-200 bg-white px-6 py-3">
					<div class="mx-auto flex max-w-6xl items-center justify-between">
						<button
							type="button"
							class="font-['Space_Grotesk'] text-lg font-semibold tracking-tight text-stone-900"
							onClick={() => navigate("home")}
						>
							ZenApi
						</button>
						<div class="flex gap-3">
							<button
								type="button"
								class="rounded-lg px-4 py-2 text-sm text-stone-500 hover:text-stone-900"
								onClick={() => navigate("register")}
							>
								注册
							</button>
							<a
								href="/admin"
								class="rounded-lg px-4 py-2 text-sm text-stone-400 hover:text-stone-600"
							>
								管理后台
							</a>
						</div>
					</div>
				</nav>
				<UserLoginView
					notice={notice}
					onSubmit={handleLogin}
					onGoRegister={() => navigate("register")}
				/>
			</div>
		);
	}

	if (page === "register") {
		return (
			<div class="min-h-screen bg-linear-to-b from-white via-stone-50 to-stone-100 font-['IBM_Plex_Sans'] text-stone-900 antialiased">
				<nav class="border-b border-stone-200 bg-white px-6 py-3">
					<div class="mx-auto flex max-w-6xl items-center justify-between">
						<button
							type="button"
							class="font-['Space_Grotesk'] text-lg font-semibold tracking-tight text-stone-900"
							onClick={() => navigate("home")}
						>
							ZenApi
						</button>
						<div class="flex gap-3">
							<button
								type="button"
								class="rounded-lg px-4 py-2 text-sm text-stone-500 hover:text-stone-900"
								onClick={() => navigate("login")}
							>
								登录
							</button>
							<a
								href="/admin"
								class="rounded-lg px-4 py-2 text-sm text-stone-400 hover:text-stone-600"
							>
								管理后台
							</a>
						</div>
					</div>
				</nav>
				<UserRegisterView
					notice={notice}
					siteMode={siteMode}
					onSubmit={handleRegister}
					onGoLogin={() => navigate("login")}
				/>
			</div>
		);
	}

	// Home: public model marketplace
	const filtered = search
		? models.filter((m) =>
				m.id.toLowerCase().includes(search.toLowerCase()),
			)
		: models;

	return (
		<div class="min-h-screen bg-linear-to-b from-white via-stone-50 to-stone-100 font-['IBM_Plex_Sans'] text-stone-900 antialiased">
			<nav class="border-b border-stone-200 bg-white px-6 py-3">
				<div class="mx-auto flex max-w-6xl items-center justify-between">
					<h1 class="font-['Space_Grotesk'] text-lg font-semibold tracking-tight text-stone-900">
						ZenApi
					</h1>
					<div class="flex gap-3">
						{siteMode !== "personal" && (
							<>
								<button
									type="button"
									class="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:shadow-lg"
									onClick={() => navigate("login")}
								>
									登录
								</button>
								<button
									type="button"
									class="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-500 hover:text-stone-900"
									onClick={() => navigate("register")}
								>
									注册
								</button>
							</>
						)}
						<a
							href="/admin"
							class="rounded-lg px-4 py-2 text-sm text-stone-400 hover:text-stone-600"
						>
							管理后台
						</a>
					</div>
				</div>
			</nav>

			<main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-10">
				{siteMode === "personal" ? (
					<div class="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-lg">
						<h2 class="mb-2 font-['Space_Grotesk'] text-2xl tracking-tight text-stone-900">
							ZenApi
						</h2>
						<p class="text-sm text-stone-500">
							此站点为自用模式，暂不对外开放。
						</p>
						<a
							href="/admin"
							class="mt-4 inline-block rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg"
						>
							管理后台
						</a>
					</div>
				) : (
					<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-lg">
						<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div class="flex items-center gap-3">
								<h3 class="font-['Space_Grotesk'] text-lg tracking-tight text-stone-900">
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
									const target =
										e.currentTarget as HTMLInputElement | null;
									setSearch(target?.value ?? "");
								}}
							/>
						</div>
						{filtered.length === 0 ? (
							<div class="py-12 text-center text-sm text-stone-400">
								{models.length === 0
									? "暂无模型数据"
									: "未找到匹配的模型"}
							</div>
						) : (
							<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
								{filtered.map((model) => (
									<PublicModelCard model={model} />
								))}
							</div>
						)}
					</div>
				)}
			</main>
		</div>
	);
};
