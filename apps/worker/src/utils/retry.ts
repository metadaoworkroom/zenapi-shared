/**
 * Determines whether a response status should be retried.
 */
export function isRetryableStatus(status: number): boolean {
	return status === 408 || status === 429 || status >= 500;
}

export async function sleep(ms: number): Promise<void> {
	if (ms <= 0) return;
	await new Promise((resolve) => setTimeout(resolve, ms));
}
