import "./styles.css";
import { render, useCallback, useEffect, useState } from "hono/jsx/dom";
import { createApiFetch } from "./core/api";
import type { User } from "./core/types";
import { AdminApp } from "./AdminApp";
import { LoginView } from "./features/LoginView";
import { PublicApp } from "./PublicApp";
import { UserApp } from "./UserApp";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
	throw new Error("Missing #app root");
}

const normalizePath = (path: string) => {
	if (path.length <= 1) return "/";
	return path.replace(/\/+$/, "") || "/";
};

const App = () => {
	const [adminToken, setAdminToken] = useState<string | null>(() =>
		localStorage.getItem("admin_token"),
	);
	const [userToken, setUserToken] = useState<string | null>(() =>
		localStorage.getItem("user_token"),
	);
	const [userRecord, setUserRecord] = useState<User | null>(null);
	const [notice, setNotice] = useState("");
	const [path, setPath] = useState(() =>
		normalizePath(window.location.pathname),
	);

	const updateAdminToken = useCallback((next: string | null) => {
		setAdminToken(next);
		if (next) {
			localStorage.setItem("admin_token", next);
		} else {
			localStorage.removeItem("admin_token");
		}
	}, []);

	const updateUserToken = useCallback((next: string | null) => {
		setUserToken(next);
		if (next) {
			localStorage.setItem("user_token", next);
		} else {
			localStorage.removeItem("user_token");
			setUserRecord(null);
		}
	}, []);

	// Load user record when user token is available
	useEffect(() => {
		if (!userToken) {
			setUserRecord(null);
			return;
		}
		const api = createApiFetch(userToken, () => updateUserToken(null));
		api<{ user: User }>("/api/u/auth/me")
			.then((result) => {
				setUserRecord(result.user);
				// If on login/register page, redirect to user panel
				const current = normalizePath(window.location.pathname);
				if (current === "/login" || current === "/register") {
					history.pushState(null, "", "/user");
					setPath("/user");
				}
			})
			.catch(() => {
				updateUserToken(null);
			});
	}, [userToken, updateUserToken]);

	useEffect(() => {
		const handlePopState = () => {
			setPath(normalizePath(window.location.pathname));
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	const handleUserLogin = useCallback(
		(token: string) => {
			updateUserToken(token);
			history.pushState(null, "", "/user");
			setPath("/user");
		},
		[updateUserToken],
	);

	const handleAdminLogin = useCallback(
		async (event: Event) => {
			event.preventDefault();
			const form = event.currentTarget as HTMLFormElement;
			const formData = new FormData(form);
			const password = String(formData.get("password") ?? "");
			try {
				const api = createApiFetch(null, () => {});
				const result = await api<{ token: string }>("/api/auth/login", {
					method: "POST",
					body: JSON.stringify({ password }),
				});
				updateAdminToken(result.token);
				setNotice("");
			} catch (error) {
				setNotice((error as Error).message);
			}
		},
		[updateAdminToken],
	);

	// Admin routes
	if (path.startsWith("/admin")) {
		if (!adminToken) {
			return (
				<div class="min-h-screen bg-linear-to-b from-white via-stone-50 to-stone-100 font-['IBM_Plex_Sans'] text-stone-900 antialiased">
					<LoginView notice={notice} onSubmit={handleAdminLogin} />
				</div>
			);
		}
		return (
			<div class="min-h-screen bg-linear-to-b from-white via-stone-50 to-stone-100 font-['IBM_Plex_Sans'] text-stone-900 antialiased">
				<AdminApp token={adminToken} updateToken={updateAdminToken} />
			</div>
		);
	}

	// User routes
	if (path.startsWith("/user")) {
		if (!userToken || !userRecord) {
			// Redirect to login
			if (path !== "/login") {
				history.replaceState(null, "", "/login");
				setPath("/login");
			}
			return (
				<PublicApp onUserLogin={handleUserLogin} />
			);
		}
		return (
			<div class="min-h-screen bg-linear-to-b from-white via-stone-50 to-stone-100 font-['IBM_Plex_Sans'] text-stone-900 antialiased">
				<UserApp
					token={userToken}
					user={userRecord}
					updateToken={updateUserToken}
				/>
			</div>
		);
	}

	// Public routes (/, /login, /register)
	return <PublicApp onUserLogin={handleUserLogin} />;
};

render(<App />, root);
