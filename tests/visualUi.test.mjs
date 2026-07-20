import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function test(name, fn) {
	fn();
	console.log(`ok - ${name}`);
}

function read(relativePath) {
	return readFileSync(join(root, relativePath), "utf8");
}

test("header keeps close on the far right and no minimize button", () => {
	const leaf = read("core/views/StickyNoteLeaf.ts");
	const css = read("styles.css");

	assert.doesNotMatch(leaf, /minimize-button/);
	assert.doesNotMatch(leaf, /addAction\([^)]*minimize/i);
	assert.match(leaf, /close-button/);
	assert.match(css, /\.close-button[\s\S]*order:\s*10/);
	assert.match(css, /\.close-button[\s\S]*margin-left:\s*auto/);
	assert.match(css, /\.view-actions[\s\S]*padding-right:\s*4px/);
	assert.match(css, /\.view-header-title[\s\S]*text-transform:\s*uppercase/);
});

test("title stays centered while actions stay on the right", () => {
	const css = read("styles.css");

	assert.match(css, /\.view-header-title-container[\s\S]*position:\s*absolute/);
	assert.match(css, /\.view-header-title-container[\s\S]*justify-content:\s*center/);
	assert.match(css, /\.view-actions[\s\S]*margin-left:\s*auto/);
});

test("color picker and popup reposition hooks exist", () => {
	const picker = read("core/menus/NoteColorPicker.ts");
	const leaf = read("core/views/StickyNoteLeaf.ts");
	const css = read("styles.css");

	assert.match(picker, /reposition\(/);
	assert.match(picker, /resize/);
	assert.match(leaf, /colorPicker\?\.reposition/);
	assert.match(css, /\.sticky-note-color-picker/);
});

test("text, table, code, and link visuals are covered", () => {
	const css = read("styles.css");
	const leaf = read("core/views/StickyNoteLeaf.ts");
	const utils = read("core/utils/noteAppearance.ts");

	assert.match(css, /\.markdown-preview-view td/);
	assert.match(css, /\.markdown-preview-view th/);
	assert.match(css, /\.markdown-preview-view pre/);
	assert.match(css, /--table-text-color/);
	assert.match(css, /--code-normal/);
	assert.match(css, /--note-code-bg/);
	assert.match(css, /--link-color/);
	assert.match(leaf, /setStickyCssProps/);
	assert.match(leaf, /setupAppearanceObserver/);
	assert.match(utils, /buildNoteCssVars/);
});

test("selection toolbar and hidden Obsidian chrome remain configured", () => {
	const css = read("styles.css");
	const leaf = read("core/views/StickyNoteLeaf.ts");
	const chrome = read("core/utils/stickyChrome.ts");

	assert.match(css, /\.sticky-note-selection-toolbar/);
	assert.match(css, /\.metadata-container/);
	assert.match(css, /html\.sticky-note-window \.notice-container/);
	assert.match(leaf, /SelectionToolbar/);
	assert.match(leaf, /refreshStickyChrome/);
	assert.match(leaf, /setupIntrusionGuard/);
	assert.match(chrome, /STICKY_INTRUSION_SELECTORS/);
	assert.match(chrome, /watchStickyIntrusions/);
	assert.match(chrome, /is-sticky-hidden/);
	assert.doesNotMatch(chrome, /createElement\("style"\)/);
	assert.doesNotMatch(chrome, /CRITICAL_STICKY_LAYOUT_CSS/);
	assert.match(css, /::-webkit-scrollbar-button/);
});

test("scroll and responsive content layout are configured", () => {
	const css = read("styles.css");
	const leaf = read("core/views/StickyNoteLeaf.ts");
	const chrome = read("core/utils/stickyChrome.ts");

	assert.match(css, /--file-line-width:\s*100%/);
	assert.match(css, /--sticky-content-pad-left:\s*20px/);
	assert.match(css, /\.markdown-preview-view[\s\S]*--sticky-content-pad-left/);
	assert.match(css, /\.cm-gutters[\s\S]*display:\s*none/);
	assert.match(css, /\.view-content[\s\S]*overflow-y:\s*auto/);
	assert.match(css, /\.view-content[\s\S]*overflow-x:\s*hidden/);
	assert.match(css, /::-webkit-scrollbar/);
	assert.match(css, /--sticky-scrollbar-inset-bottom/);
	assert.match(css, /margin-bottom:\s*var\(--sticky-scrollbar-inset-bottom/);
	assert.match(css, /\.markdown-preview-view img[\s\S]*max-width:\s*100%/);
	assert.match(css, /overflow-wrap:\s*anywhere/);
	assert.match(css, /--folding-offset/);
	assert.match(css, /\.heading-collapse-indicator/);
	assert.match(leaf, /applyStickyContentLayout/);
	assert.match(leaf, /getMode\(\)/);
	assert.doesNotMatch(leaf, /StickyOverlayScrollbar/);
	assert.match(chrome, /STICKY_CONTENT_PADDING/);
	assert.match(css, /--sticky-content-pad/);
	assert.match(css, /::-webkit-scrollbar-button/);
	assert.doesNotMatch(
		chrome,
		/\.view-content:has\(\.markdown-source-view\)[\s\S]*padding:\s*0/,
	);
});

test("startup sticky window marks html and uses popout document", () => {
	const leaf = read("core/views/StickyNoteLeaf.ts");
	const chrome = read("core/utils/stickyChrome.ts");
	const css = read("styles.css");
	const main = read("main.ts");

	assert.match(leaf, /syncDocument/);
	assert.match(leaf, /ownerDocument/);
	assert.match(leaf, /getContainer\(\)\?\.doc/);
	assert.doesNotMatch(leaf, /activeDocument/);
	assert.match(chrome, /sticky-note-window/);
	assert.match(leaf, /waitForStickyDom/);
	assert.match(leaf, /refreshStickyChrome/);
	assert.match(chrome, /workspace-tab-header-container/);
	assert.match(chrome, /view-header-nav-buttons/);
	assert.match(css, /html\.sticky-note-window/);
	assert.match(css, /html\.sticky-note-window \.workspace-tab-header/);
	assert.doesNotMatch(
		css,
		/html\.sticky-note-window \.workspace-tabs,\s*\nhtml\.sticky-note-window \.workspace-tab-header/,
	);
	assert.match(main, /waitForPopoutReady/);
	assert.match(main, /attachStickyNoteToLeaf/);
});

console.log("visual ui e2e checks passed");
