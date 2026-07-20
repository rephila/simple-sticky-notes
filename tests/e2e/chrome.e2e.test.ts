import { readFileSync, existsSync } from "node:fs";

import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {

	applyStickyContainerClass,

	hideStickyChrome,

	hideStickyIntrusions,

	isStickyNoteDocument,

	markStickyWindow,

	STICKY_CHROME_SELECTORS,

	STICKY_INTRUSION_SELECTORS,

	watchStickyIntrusions,

} from "../../core/utils/stickyChrome";

import { createObsidianPopoutDom } from "../helpers/domFixture";



function isHidden(element: HTMLElement): boolean {
	return (
		element.getAttribute("data-sticky-hidden") === "true" ||
		element.classList.contains("is-sticky-hidden")
	);
}



describe("e2e: sticky chrome", () => {

	it("marks html/body and hides tab chrome while keeping note content", () => {

		const document = createObsidianPopoutDom();



		markStickyWindow(document, "sticky-note-0");

		expect(document.documentElement.getAttribute("note-id")).toBe(

			"sticky-note-0",

		);



		expect(document.querySelector(".workspace-tabs")).not.toBeNull();

		expect(document.querySelector(".workspace-tab-header")).not.toBeNull();

		expect(document.querySelector(".view-header-breadcrumb")).not.toBeNull();



		hideStickyChrome(document);



		expect(document.querySelector(".workspace-tabs")).not.toBeNull();

		expect(

			isHidden(document.querySelector(".workspace-tab-header") as HTMLElement),

		).toBe(true);

		expect(

			isHidden(document.querySelector(".workspace-tabs") as HTMLElement),

		).toBe(false);

		expect(document.querySelector(".markdown-preview-view")).not.toBeNull();

	});



	it("applies sticky-note class to app container", () => {

		const document = createObsidianPopoutDom();

		markStickyWindow(document, "sticky-note-0");

		expect(applyStickyContainerClass(document)).toBe(true);

		expect(

			document.body.querySelector(".app-container")?.classList.contains("sticky-note"),

		).toBe(true);

	});



	it("ignores non-sticky documents so main Obsidian window stays untouched", () => {

		const document = createObsidianPopoutDom();

		expect(isStickyNoteDocument(document)).toBe(false);

		hideStickyChrome(document);

		expect(

			isHidden(document.querySelector(".workspace-tab-header") as HTMLElement),

		).toBe(false);

	});



	it("does not target the workspace-tabs container itself", () => {

		expect(STICKY_CHROME_SELECTORS).not.toContain(".workspace-tabs");

		expect(STICKY_CHROME_SELECTORS).toContain(".workspace-tab-header");

	});



	it("hides every configured chrome selector without removing nodes", () => {

		const document = createObsidianPopoutDom();

		markStickyWindow(document, "sticky-note-1");

		const host = document.body.querySelector(".app-container") ?? document.body;



		for (const selector of STICKY_CHROME_SELECTORS) {

			const element = document.createElement("div");

			if (selector.startsWith(".")) {

				element.className = selector.slice(1);

			} else if (selector.includes("editingToolbar")) {

				element.className = "plugin-editingToolbar-panel";

			} else if (selector.includes("editing-toolbar")) {

				element.className = "plugin-editing-toolbar-panel";

			}

			host.appendChild(element);

		}



		hideStickyChrome(document);



		for (const selector of STICKY_CHROME_SELECTORS) {

			for (const element of Array.from(

				document.querySelectorAll<HTMLElement>(selector),

			)) {

				expect(isHidden(element)).toBe(true);

			}

		}

	});

	it("hides Obsidian and plugin notifications in sticky windows", () => {

		const document = createObsidianPopoutDom();

		markStickyWindow(document, "sticky-note-2");

		expect(document.documentElement.classList.contains("sticky-note-window")).toBe(
			true,
		);

		const noticeContainer = document.createElement("div");

		noticeContainer.className = "notice-container";

		const notice = document.createElement("div");

		notice.className = "notice";

		notice.textContent = "Git: pulled 3 commits";

		noticeContainer.appendChild(notice);

		document.body.appendChild(noticeContainer);

		hideStickyIntrusions(document);

		expect(isHidden(noticeContainer)).toBe(true);

		expect(isHidden(notice)).toBe(true);

		expect(STICKY_INTRUSION_SELECTORS).toContain(".notice-container");

	});

	it("watchStickyIntrusions hides notices added after open", async () => {

		const document = createObsidianPopoutDom();

		markStickyWindow(document, "sticky-note-3");

		const stop = watchStickyIntrusions(document);

		const noticeContainer = document.createElement("div");

		noticeContainer.className = "notice-container";

		document.body.appendChild(noticeContainer);

		await new Promise((resolve) => window.setTimeout(resolve, 0));

		expect(isHidden(noticeContainer)).toBe(true);

		stop();

	});

});



describe("e2e: production deploy artifacts", () => {

	const root = join(process.cwd());



	it("ships manifest, bundle, and styles", () => {

		expect(existsSync(join(root, "manifest.json"))).toBe(true);

		expect(existsSync(join(root, "main.js"))).toBe(true);

		expect(existsSync(join(root, "styles.css"))).toBe(true);

	});



	it("uses simple-sticky-notes plugin id", () => {

		const manifest = JSON.parse(

			readFileSync(join(root, "manifest.json"), "utf8"),

		) as { id: string; name: string };

		expect(manifest.id).toBe("simple-sticky-notes");

		expect(manifest.name).toContain("Sticky");

	});

});


