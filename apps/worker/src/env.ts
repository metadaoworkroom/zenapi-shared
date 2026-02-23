import type { D1Database } from "@cloudflare/workers-types";

export type Bindings = {
	DB: D1Database;
	CORS_ORIGIN?: string;
	PROXY_RETRY_ROUNDS?: string;
	PROXY_RETRY_DELAY_MS?: string;
	LINUXDO_CLIENT_ID?: string;
	LINUXDO_CLIENT_SECRET?: string;
};

export type Variables = {
	adminSessionId?: string;
	newApiUserId?: string | null;
	tokenRecord?: unknown;
	userId?: string;
	userRecord?: unknown;
};

export type AppEnv = {
	Bindings: Bindings;
	Variables: Variables;
};
