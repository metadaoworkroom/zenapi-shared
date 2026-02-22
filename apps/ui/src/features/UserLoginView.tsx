import { useState } from "hono/jsx/dom";

type UserLoginViewProps = {
	notice: string;
	onSubmit: (email: string, password: string) => void;
	onGoRegister: () => void;
};

export const UserLoginView = ({
	notice,
	onSubmit,
	onGoRegister,
}: UserLoginViewProps) => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		onSubmit(email, password);
	};

	return (
		<div class="mx-auto flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-8">
		<div class="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-lg">
			<h1 class="mb-2 font-['Space_Grotesk'] text-2xl tracking-tight text-stone-900">
				ZenApi
			</h1>
			<p class="text-sm text-stone-500">登录您的账户。</p>
			<form class="mt-6 grid gap-4" onSubmit={handleSubmit}>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-stone-500"
						for="user-email"
					>
						邮箱
					</label>
					<input
						class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
						id="user-email"
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
						for="user-password"
					>
						密码
					</label>
					<input
						class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
						id="user-password"
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
				<button
					class="h-11 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg"
					type="submit"
				>
					登录
				</button>
			</form>
			<p class="mt-4 text-center text-sm text-stone-500">
				没有账户？{" "}
				<button
					type="button"
					class="text-amber-600 hover:text-amber-700"
					onClick={onGoRegister}
				>
					注册
				</button>
			</p>
			{notice && (
				<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
					{notice}
				</div>
			)}
		</div>
		</div>
	);
};
