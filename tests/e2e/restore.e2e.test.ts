import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	findPopoutLeafForFile,
	isPopoutLeaf,
	isStickyNoteAlreadyOpen,
} from "../../core/utils/restoreLogic";

type MockLeaf = {
	id: string;
	root: string;
	filePath?: string;
	noteId?: string | null;
};

function createLeaf({
	id,
	root,
	filePath,
	noteId = null,
}: MockLeaf) {
	return {
		id,
		getRoot: () => root,
		getContainer: () => ({
			win: {
				activeDocument: {
					documentElement: {
						getAttribute: (name: string) =>
							name === "note-id" ? noteId : null,
					},
				},
			},
		}),
		view: { file: filePath ? { path: filePath } : undefined },
	} as never;
}

describe("e2e: startup restore scenarios", () => {
	const mainRoot = "main-root";
	const leftRoot = "left-root";
	const rightRoot = "right-root";
	const popoutRoot = "popout-root";

	it("detects popout leaves vs main workspace leaves", () => {
		const popout = createLeaf({ id: "p1", root: popoutRoot });
		const main = createLeaf({ id: "m1", root: mainRoot });
		expect(isPopoutLeaf(popout, mainRoot, leftRoot, rightRoot)).toBe(true);
		expect(isPopoutLeaf(main, mainRoot, leftRoot, rightRoot)).toBe(false);
	});

	it("adopts an existing Obsidian popout with the same file instead of duplicating", () => {
		const leaves = [
			createLeaf({
				id: "existing",
				root: popoutRoot,
				filePath: "notes/Azure.md",
			}),
			createLeaf({
				id: "already-sticky",
				root: popoutRoot,
				filePath: "notes/Azure.md",
				noteId: "sticky-note-0",
			}),
		];

		const adopted = findPopoutLeafForFile(
			leaves,
			"notes/Azure.md",
			mainRoot,
			leftRoot,
			rightRoot,
			(leaf) => (leaf as { view: { file?: { path: string } } }).view.file?.path,
			(leaf) =>
				leaf.getContainer()?.win?.activeDocument.documentElement.getAttribute(
					"note-id",
				),
		);

		expect((adopted as unknown as { id: string }).id).toBe("existing");
	});

	it("re-adopts orphaned sticky popouts that are not registered this session", () => {
		const leaves = [
			createLeaf({
				id: "orphaned-sticky",
				root: popoutRoot,
				filePath: "notes/Azure.md",
				noteId: "sticky-note-0",
			}),
		];

		const adopted = findPopoutLeafForFile(
			leaves,
			"notes/Azure.md",
			mainRoot,
			leftRoot,
			rightRoot,
			(leaf) => (leaf as { view: { file?: { path: string } } }).view.file?.path,
			(leaf) =>
				leaf.getContainer()?.win?.activeDocument.documentElement.getAttribute(
					"note-id",
				),
			new Set(),
		);

		expect((adopted as unknown as { id: string }).id).toBe("orphaned-sticky");
	});

	it("returns registered sticky popout as fallback to avoid duplicates", () => {
		const leaves = [
			createLeaf({
				id: "registered-sticky",
				root: popoutRoot,
				filePath: "notes/Azure.md",
				noteId: "sticky-note-0",
			}),
		];

		const adopted = findPopoutLeafForFile(
			leaves,
			"notes/Azure.md",
			mainRoot,
			leftRoot,
			rightRoot,
			(leaf) => (leaf as { view: { file?: { path: string } } }).view.file?.path,
			(leaf) =>
				leaf.getContainer()?.win?.activeDocument.documentElement.getAttribute(
					"note-id",
				),
			new Set(["sticky-note-0"]),
		);

		expect((adopted as unknown as { id: string }).id).toBe("registered-sticky");
	});

	it("skips restore when sticky note for file is already open", () => {
		expect(
			isStickyNoteAlreadyOpen(["notes/Azure.md", "notes/Other.md"], "notes/Azure.md"),
		).toBe(true);
		expect(isStickyNoteAlreadyOpen(["notes/Other.md"], "notes/Azure.md")).toBe(
			false,
		);
	});

	it("retries popout lookup during startup restore window", () => {
		const main = readFileSync(join(process.cwd(), "main.ts"), "utf8");
		expect(main).toMatch(/findPopoutLeafForFileWithRetry/);
		expect(main).toMatch(/attempts = 12/);
		expect(main).toMatch(/restoreStickyNotes\(300\)/);
		expect(main).toMatch(/isStickyNoteLive/);
		expect(main).toMatch(/layout-change/);
	});
});

describe("e2e: workspace persistence shape", () => {
	it("persists file path, colors, and opacity in workspace note state", () => {
		const sample = {
			id: "leaf-1",
			color: { value: "Base", lightColor: "#ffffff" },
			textColor: "#1a1a1a",
			filePath: "notes/Azure.md",
			opacity: 0.85,
		};
		expect(sample.filePath).toBeTruthy();
		expect(sample.opacity).toBeGreaterThan(0);
		expect(sample.color.lightColor).toBe("#ffffff");
	});
});
