import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("e2e: header actions and layout", () => {
	const css = readFileSync(join(process.cwd(), "styles.css"), "utf8");
	const leaf = readFileSync(
		join(process.cwd(), "core/views/StickyNoteLeaf.ts"),
		"utf8",
	);

	it("does not ship minimize button", () => {
		expect(leaf).not.toMatch(/minimize-button/);
		expect(leaf).not.toMatch(/addAction\([^)]*minimize/i);
	});

	it("registers palette, pin, and close actions", () => {
		expect(leaf).toMatch(/addAction\("palette"/);
		expect(leaf).toMatch(/addAction\("pin"/);
		expect(leaf).not.toMatch(/view-mode-button/);
		expect(leaf).toMatch(/addAction\("x"/);
		expect(leaf).toMatch(/closeStickyNote/);
		expect(leaf).toMatch(/formatHeaderTitle/);
		expect(leaf).toMatch(/replace\(\/_\/g,\s*" "\)/);
		expect(leaf).toMatch(/toUpperCase\(\)/);
	});

	it("keeps close button on the far right", () => {
		expect(css).toMatch(/\.close-button[\s\S]*order:\s*10/);
		expect(css).toMatch(/\.close-button[\s\S]*margin-left:\s*auto/);
		expect(css).toMatch(/\.view-actions[\s\S]*flex-direction:\s*row/);
	});

	it("centers title independently from action buttons", () => {
		expect(css).toMatch(/\.view-header-title-container[\s\S]*position:\s*absolute/);
		expect(css).toMatch(/\.view-header-title-container[\s\S]*justify-content:\s*center/);
		expect(css).toMatch(/\.view-header-title-container[\s\S]*-webkit-app-region:\s*drag/);
	});
});

describe("e2e: selection toolbar contract", () => {
	const css = readFileSync(join(process.cwd(), "styles.css"), "utf8");
	const toolbar = readFileSync(
		join(process.cwd(), "core/views/SelectionToolbar.ts"),
		"utf8",
	);

	it("supports heading, bold, italic, strike, underline, highlight, link", () => {
		expect(toolbar).toMatch(/toggleWrapSelection/);
		expect(toolbar).toMatch(/showHeadingMenu/);
		expect(toolbar).toMatch(/"highlight"/);
		expect(toolbar).toMatch(/"link"/);
		expect(css).toMatch(/\.sticky-note-selection-toolbar/);
	});
});
