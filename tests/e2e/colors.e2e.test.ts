import { describe, expect, it } from "vitest";
import {
	buildNoteCssVars,
	deriveCodeBackground,
	shouldSkipTextColorTarget,
} from "../../core/utils/noteAppearance";
import { createObsidianPopoutDom } from "../helpers/domFixture";

function applyPreviewTextColors(document: Document, textColor: string) {
	const preview = document.querySelector(".markdown-preview-view");
	if (!preview) return;

	for (const element of Array.from(preview.querySelectorAll("*"))) {
		if (shouldSkipTextColorTarget(element)) continue;
		if (!(element instanceof HTMLElement)) continue;
		element.style.setProperty("color", textColor, "important");
	}
}

describe("e2e: text and table colors", () => {
	it("applies selected text color to table cells and paragraphs", () => {
		const document = createObsidianPopoutDom();
		applyPreviewTextColors(document, "#b42318");

		const td = document.querySelector("td") as HTMLElement;
		const th = document.querySelector("th") as HTMLElement;
		const p = document.querySelector(".markdown-preview-view p") as HTMLElement;

		expect(td.style.color.toLowerCase()).toContain("b42318");
		expect(th.style.color.toLowerCase()).toContain("b42318");
		expect(p.style.color.toLowerCase()).toContain("b42318");
	});

	it("keeps link color separate from body text color", () => {
		const document = createObsidianPopoutDom();
		applyPreviewTextColors(document, "#b42318");

		const link = document.querySelector("a") as HTMLElement;
		expect(link.style.color).not.toBe("rgb(180, 35, 24)");
	});

	it("sets table and code css vars from palette selections", () => {
		const vars = Object.fromEntries(
			buildNoteCssVars({
				bgColor: "#faf0d0",
				textColor: "#1a1a1a",
				linkColor: "#1a5fb4",
				linkColorHover: "#134e96",
			}),
		);

		expect(vars["--table-text-color"]).toBe("#1a1a1a");
		expect(vars["--code-normal"]).toBe("#1a1a1a");
		expect(vars["--table-background"]).toBe("#faf0d0");
		expect(vars["--note-code-bg"]).toBe(deriveCodeBackground("#faf0d0"));
	});

	it("applies text color to inline code blocks", () => {
		const document = createObsidianPopoutDom();
		applyPreviewTextColors(document, "#b42318");

		const code = document.querySelector("code") as HTMLElement;
		expect(code.style.color.toLowerCase()).toContain("b42318");
	});
});

describe("e2e: default palette values", () => {
	it("defaults to white background token", () => {
		const vars = Object.fromEntries(
			buildNoteCssVars({
				bgColor: "#ffffff",
				textColor: "#1a1a1a",
			}),
		);
		expect(vars["--note-light-color"]).toBe("#ffffff");
	});
});
