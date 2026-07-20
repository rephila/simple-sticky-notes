import {
	DEFAULT_LINK_COLOR,
	DEFAULT_LINK_COLOR_HOVER,
} from "core/constants/defaultTextColorSettings";
import { isHtmlElement } from "core/utils/domHelpers";

export type NoteAppearanceColors = {
	bgColor: string;
	textColor: string;
	linkColor?: string;
	linkColorHover?: string;
};

export const PREVIEW_TEXT_SELECTORS = [
	".markdown-preview-view",
	".markdown-preview-view p",
	".markdown-preview-view li",
	".markdown-preview-view td",
	".markdown-preview-view th",
	".markdown-preview-view tr",
	".markdown-preview-view table",
	".markdown-preview-view thead",
	".markdown-preview-view tbody",
	".markdown-preview-view strong",
	".markdown-preview-view em",
	".markdown-preview-view blockquote",
	".markdown-preview-view pre",
	".markdown-preview-view code",
	".markdown-preview-view h1",
	".markdown-preview-view h2",
	".markdown-preview-view h3",
	".markdown-preview-view h4",
	".markdown-preview-view h5",
	".markdown-preview-view h6",
	".markdown-preview-view span",
	".markdown-preview-view div",
	".cm-content",
	".cm-line",
].join(", ");

export const PREVIEW_BACKGROUND_SELECTORS = [
	"html",
	"body",
	".app-container",
	".workspace",
	".workspace-split",
	".workspace-leaf",
	".workspace-leaf-content",
	".view-content",
	".markdown-source-view",
	".markdown-preview-view",
	".markdown-preview-sizer",
	".markdown-preview-section",
	".markdown-preview-pusher",
	".empty-state",
	".empty-state-container",
	".cm-editor",
	".cm-scroller",
	".cm-gutters",
	".view-header",
].join(", ");

export function buildNoteCssVars({
	bgColor,
	textColor,
	linkColor = DEFAULT_LINK_COLOR,
	linkColorHover = DEFAULT_LINK_COLOR_HOVER,
}: NoteAppearanceColors): [string, string][] {
	const codeBg = deriveCodeBackground(bgColor);

	return [
		["--note-light-color", bgColor],
		["--note-text-color", textColor],
		["--note-code-bg", codeBg],
		["--link-color", linkColor],
		["--link-color-hover", linkColorHover],
		["--background-primary", bgColor],
		["--background-primary-alt", bgColor],
		["--titlebar-background", bgColor],
		["--titlebar-background-focused", bgColor],
		["--text-normal", textColor],
		["--text-muted", textColor],
		["--text-faint", textColor],
		["--text-on-accent", textColor],
		["--h1-color", textColor],
		["--h2-color", textColor],
		["--h3-color", textColor],
		["--h4-color", textColor],
		["--h5-color", textColor],
		["--h6-color", textColor],
		["--table-text-color", textColor],
		["--table-header-color", textColor],
		["--table-header-background", codeBg],
		["--table-background", bgColor],
		["--table-cell-background", bgColor],
		["--table-column-header-background", codeBg],
		["--code-normal", textColor],
		["--code-background", codeBg],
		["--interactive-accent", linkColor],
		["--interactive-accent-hover", linkColorHover],
		["--text-accent", linkColor],
		["--text-accent-hover", linkColorHover],
	];
}

export function deriveCodeBackground(hexColor: string): string {
	const rgb = parseHexColor(hexColor);
	if (!rgb) return "#ececec";

	const darken = (value: number) =>
		Math.max(0, Math.min(255, Math.round(value * 0.92 - 8)));

	return `#${[darken(rgb.r), darken(rgb.g), darken(rgb.b)]
		.map((part) => part.toString(16).padStart(2, "0"))
		.join("")}`;
}

export function parseHexColor(hexColor: string): { r: number; g: number; b: number } | null {
	const normalized = hexColor.replace("#", "").trim();
	if (normalized.length === 3) {
		const [r, g, b] = normalized.split("");
		return {
			r: parseInt(`${r}${r}`, 16),
			g: parseInt(`${g}${g}`, 16),
			b: parseInt(`${b}${b}`, 16),
		};
	}
	if (normalized.length === 6) {
		return {
			r: parseInt(normalized.slice(0, 2), 16),
			g: parseInt(normalized.slice(2, 4), 16),
			b: parseInt(normalized.slice(4, 6), 16),
		};
	}
	return null;
}

export function shouldSkipTextColorTarget(element: Element): boolean {
	if (!isHtmlElement(element)) return true;
	if (element.tagName === "A") return true;
	if (element.closest("a")) return true;
	if (element.matches("img, svg, path, input, textarea, button, canvas")) {
		return true;
	}
	return false;
}

/**
 * Removes leftover inline color from older plugin versions so CSS vars can win.
 * Inline `color: … !important` otherwise keeps the previous text color on headings.
 */
export function clearStaleInlineTextColors(root: ParentNode): void {
	root.querySelectorAll(PREVIEW_TEXT_SELECTORS).forEach((element) => {
		if (!isHtmlElement(element) || shouldSkipTextColorTarget(element)) return;
		if (
			element.style.getPropertyValue("color") ||
			element.style.getPropertyPriority("color") === "important"
		) {
			element.style.removeProperty("color");
		}
	});
}
