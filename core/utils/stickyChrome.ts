import { isHtmlElement } from "core/utils/domHelpers";

export const STICKY_CHROME_SELECTORS = [
	".workspace-tab-header-container",
	".workspace-tab-header",
	".mod-workspace-tab-header",
	".view-header-nav-buttons",
	".view-header-breadcrumb",
	".view-header-left",
	".view-header-status-container",
	".sidebar-toggle-button",
	".side-dock-actions",
	".status-bar",
	".titlebar",
	'[class*="editingToolbar"]',
	'[class*="editing-toolbar"]',
	".metadata-container",
	".metadata-properties",
	".metadata-add-button",
	".frontmatter-section",
	".embedded-backlinks",
	".embedded-table-of-contents",
	".mod-footer-bar",
	".floating-toc-div",
	".daily-note-navbar",
	/* Inline title chrome — hiding only .inline-title leaves .mod-header gap */
	".mod-header",
	".inline-title",
] as const;

/** Obsidian / community-plugin UI that should not appear in sticky popouts. */
export const STICKY_INTRUSION_SELECTORS = [
	".notice-container",
	".notice",
	".progress-bar",
] as const;

/** Shared content inset — applied on preview/cm layers (not view-content). */
export const STICKY_CONTENT_PADDING = "4px 16px 16px 20px";

export function isStickyNoteDocument(document: Document): boolean {
	return (
		document.documentElement.classList.contains("sticky-note-window") ||
		document.documentElement.hasAttribute("note-id")
	);
}

export function markStickyWindow(document: Document, noteId: string): void {
	document.title = noteId;
	document.documentElement.setAttribute("note-id", noteId);
	document.documentElement.classList.add("sticky-note-window");
	document.body?.classList.add("sticky-note-window");
}

export function applyStickyContainerClass(document: Document): boolean {
	if (!isStickyNoteDocument(document)) return false;

	const appContainer = document.body.querySelector(".app-container");
	if (!appContainer) return false;
	appContainer.classList.add("sticky-note");
	document.body.classList.add("sticky-note");
	return true;
}

function hideElements(document: Document, selectors: readonly string[]): void {
	for (const selector of selectors) {
		document.querySelectorAll(selector).forEach((element) => {
			if (!isHtmlElement(element)) return;
			if (element.closest(".sticky-note-color-picker")) return;
			element.classList.add("is-sticky-hidden");
			element.setAttribute("data-sticky-hidden", "true");
		});
	}
}

export function hideStickyChrome(document: Document): void {
	if (!isStickyNoteDocument(document)) return;
	hideElements(document, STICKY_CHROME_SELECTORS);
	hideStickyIntrusions(document);
}

export function hideStickyIntrusions(document: Document): void {
	if (!isStickyNoteDocument(document)) return;
	hideElements(document, STICKY_INTRUSION_SELECTORS);
}

export function watchStickyIntrusions(document: Document): () => void {
	if (!isStickyNoteDocument(document)) return () => undefined;

	const observer = new MutationObserver(() => {
		hideStickyIntrusions(document);
	});

	observer.observe(document.body, { childList: true, subtree: true });
	hideStickyIntrusions(document);

	return () => observer.disconnect();
}

/** @deprecated DOM removal breaks popout content; use hideStickyChrome */
export function removeStickyChrome(document: Document): string[] {
	hideStickyChrome(document);
	return [];
}
