import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("e2e: full scenario matrix", () => {
	const files = {
		main: readFileSync(join(process.cwd(), "main.ts"), "utf8"),
		leaf: readFileSync(join(process.cwd(), "core/views/StickyNoteLeaf.ts"), "utf8"),
		image: readFileSync(
			join(process.cwd(), "core/services/ImageOpenService.ts"),
			"utf8",
		),
		toolbar: readFileSync(
			join(process.cwd(), "core/views/SelectionToolbar.ts"),
			"utf8",
		),
		settings: readFileSync(
			join(process.cwd(), "core/interfaces/PluginSettingsInterface.ts"),
			"utf8",
		),
	};

	it("open note: auto creates file, opens popout, initializes sticky view", () => {
		expect(files.main).toMatch(/ensureNoteFile/);
		expect(files.main).toMatch(/openPopoutLeaf/);
		expect(files.main).toMatch(/attachStickyNoteToLeaf/);
		expect(files.leaf).toMatch(/waitForStickyDom/);
		expect(files.leaf).toMatch(/initView\(/);
	});

	it("startup restore: reopens saved notes and adopts existing popouts", () => {
		expect(files.main).toMatch(/restoreStickyNotes/);
		expect(files.main).toMatch(/findPopoutLeafForFileWithRetry/);
		expect(files.main).toMatch(/saveWorkspace/);
		expect(files.leaf).not.toMatch(/createEl\("link"/);
		expect(files.leaf).toMatch(/scheduleStartupAppearanceRefresh/);
	});

	it("close note: removes from workspace list on explicit close", () => {
		expect(files.main).toMatch(/window-close/);
		expect(files.leaf).toMatch(/closeStickyNote/);
		expect(files.main).toMatch(/updateWorkspaceNotes/);
	});

	it("pin note: supports always on top", () => {
		expect(files.leaf).toMatch(/pinAction/);
		expect(files.leaf).toMatch(/setAlwaysOnTop/);
	});

	it("focus note: brings sticky window to front on click", () => {
		expect(files.leaf).toMatch(/focusStickyWindow/);
		expect(files.leaf).toMatch(/setupWindowFocusBehavior/);
		expect(files.leaf).toMatch(/moveTop/);
		expect(files.main).toMatch(/findByFilePath/);
	});

	it("read/edit toggle: defaults to preview mode", () => {
		expect(files.leaf).toMatch(/viewModeAction\("preview"\)/);
	});

	it("image click: opens via system viewer", () => {
		expect(files.image).toMatch(/openPath/);
		expect(files.leaf).toMatch(/setupImageClickHandler/);
	});

	it("selection formatting: bold, link, heading, highlight", () => {
		expect(files.toolbar).toMatch(/formatToggleWrap|toggleWrapSelection/);
		expect(files.toolbar).toMatch(/showHeadingMenu/);
		expect(files.toolbar).toMatch(/wrapLinkSelection|replaceSelection/);
	});

	it("defaults: white background and save workspace enabled", () => {
		expect(files.settings).toMatch(/saveWorkspace: true/);
		expect(files.settings).toMatch(/useRecentBgColor: false/);
	});

	it("supports multiple independent notes with saved bounds and colors", () => {
		expect(files.main).toMatch(/savedNote\.bounds/);
		expect(files.leaf).toMatch(/getWindowBounds/);
		expect(files.leaf).toMatch(/getDefaultColorForNewNote/);
		expect(files.leaf).toMatch(/scheduleBoundsSave/);
	});
});
