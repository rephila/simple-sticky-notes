import type { WorkspaceLeaf } from "obsidian";

export function isPopoutLeaf(
	leaf: WorkspaceLeaf,
	rootSplit: unknown,
	leftSplit: unknown,
	rightSplit: unknown,
): boolean {
	const root = leaf.getRoot();
	return root !== rootSplit && root !== leftSplit && root !== rightSplit;
}

export function findPopoutLeafForFile(
	leaves: WorkspaceLeaf[],
	filePath: string,
	rootSplit: unknown,
	leftSplit: unknown,
	rightSplit: unknown,
	getFilePath: (leaf: WorkspaceLeaf) => string | undefined,
	getNoteId: (leaf: WorkspaceLeaf) => string | null,
	registeredNoteIds: ReadonlySet<string> = new Set(),
): WorkspaceLeaf | null {
	let registeredMatch: WorkspaceLeaf | null = null;

	for (const leaf of leaves) {
		if (!isPopoutLeaf(leaf, rootSplit, leftSplit, rightSplit)) continue;
		if (getFilePath(leaf) !== filePath) continue;

		const noteId = getNoteId(leaf);
		if (noteId && registeredNoteIds.has(noteId)) {
			registeredMatch = registeredMatch ?? leaf;
			continue;
		}

		// Prefer an unregistered / not-yet-sticky popout to adopt.
		return leaf;
	}

	// Fall back to an already-registered sticky popout so callers do not open a duplicate.
	return registeredMatch;
}

export function isStickyNoteAlreadyOpen(
	openFilePaths: string[],
	filePath?: string,
): boolean {
	if (!filePath) return false;
	return openFilePaths.includes(filePath);
}
