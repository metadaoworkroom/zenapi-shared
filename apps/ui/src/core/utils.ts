/**
 * Formats a datetime string for display.
 *
 * Args:
 *   value: ISO datetime string or nullable value.
 *
 * Returns:
 *   A human-friendly datetime string or "-".
 */
const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatDateTime = (value?: string | null) => {
	if (!value) {
		return "-";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
		date.getDate(),
	)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(
		date.getSeconds(),
	)}`;
};

/**
 * Toggles channel or token status between active and disabled.
 *
 * Args:
 *   value: Current status value.
 *
 * Returns:
 *   Next status value.
 */
export const toggleStatus = (value: string) =>
	value === "active" ? "disabled" : "active";

export type PageItem = number | "ellipsis";

export const buildPageItems = (current: number, total: number): PageItem[] => {
	if (total <= 6) {
		return Array.from({ length: total }, (_, index) => index + 1);
	}
	const items: PageItem[] = [1, 2, 3];
	if (current > 3 && current < total - 1) {
		items.push("ellipsis", current);
	}
	items.push("ellipsis", total - 1, total);
	return items.filter((item, index, array) => {
		if (item === "ellipsis" && array[index - 1] === "ellipsis") {
			return false;
		}
		if (typeof item === "number") {
			return array.indexOf(item) === index;
		}
		return true;
	});
};
