import { useState } from "hono/jsx/dom";
import type { SiteMode } from "../core/types";

type UserRegisterViewProps = {
	notice: string;
	siteMode: SiteMode;
	onSubmit: (email: string, name: string, password: string) => void;
	onGoLogin: () => void;
};

export const UserRegisterView = ({
	notice,
	siteMode,
	onSubmit,
	onGoLogin,
}: UserRegisterViewProps) => {
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		setError("");
		if (password.length < 6) {
			setError("密码至少 6 个字符");
			return;
		}
		if (password !== confirmPassword) {
			setError("两次密码不一致");
			return;
		}
		onSubmit(email, name, password);
	};

	if (siteMode === "personal") {
		return (
			<div class="mx-auto mt-24 max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-lg">
				<h1 class="mb-2 font-['Space_Grotesk'] text-2xl tracking-tight text-stone-900">
					ZenApi
				</h1>
				<p class="text-sm text-stone-500">
					此站点为自用模式，暂不开放注册。
				</p>
				<p class="mt-4 text-center text-sm text-stone-500">
					已有账户？{" "}
					<button
						type="button"
						class="text-amber-600 hover:text-amber-700"
						onClick={onGoLogin}
					>
						登录
					</button>
				</p>
			</div>
		);
	}

	return (
		<div class="mx-auto mt-24 max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-lg">
			<h1 class="mb-2 font-['Space_Grotesk'] text-2xl tracking-tight text-stone-900">
				ZenApi
			</h1>
			<p class="text-sm text-stone-500">创建新账户。</p>
			<form class="mt-6 grid gap-4" onSubmit={handleSubmit}>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-stone-500"
						for="reg-email"
					>
						邮箱
					</label>
					<input
						class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
						id="reg-email"
						type="email"
						required
						value={email}
						onInput={(e) =>
							setEmail(
								(e.currentTarget as HTMLInputElement)?.value ?? "",
							)
						}
					/>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-stone-500"
						for="reg-name"
					>
						用户名
					</label>
					<input
						class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
						id="reg-name"
						type="text"
						required
						value={name}
						onInput={(e) =>
							setName(
								(e.currentTarget as HTMLInputElement)?.value ?? "",
							)
						}
					/>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-stone-500"
						for="reg-password"
					>
						密码
					</label>
					<input
						class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
						id="reg-password"
						type="password"
						required
						value={password}
						onInput={(e) =>
							setPassword(
								(e.currentTarget as HTMLInputElement)?.value ?? "",
							)
						}
					/>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-stone-500"
						for="reg-confirm"
					>
						确认密码
					</label>
					<input
						class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
						id="reg-confirm"
						type="password"
						required
						value={confirmPassword}
						onInput={(e) =>
							setConfirmPassword(
								(e.currentTarget as HTMLInputElement)?.value ?? "",
							)
						}
					/>
				</div>
				<button
					class="h-11 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg"
					type="submit"
				>
					注册
				</button>
			</form>
			{(error || notice) && (
				<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
					{error || notice}
				</div>
			)}
			<p class="mt-4 text-center text-sm text-stone-500">
				已有账户？{" "}
				<button
					type="button"
					class="text-amber-600 hover:text-amber-700"
					onClick={onGoLogin}
				>
					登录
				</button>
			</p>
		</div>
	);
};
