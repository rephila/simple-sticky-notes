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
	for (const leaf of leaves) {
		if (!isPopoutLeaf(leaf, rootSplit, leftSplit, rightSplit)) continue;
		if (getFilePath(leaf) !== filePath) continue;

		const noteId = getNoteId(leaf);
		if (noteId && registeredNoteIds.has(noteId)) continue;

		return leaf;
	}
	return null;
}

export function isStickyNoteAlreadyOpen(
	openFilePaths: string[],
	filePath?: string,
): boolean {
	if (!filePath) return false;
	return openFilePaths.includes(filePath);
}
