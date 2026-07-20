import type { IBackgroundColor } from "core/interfaces/BackgroundColorInterface";

const NEW_NOTE_COLOR_CYCLE = ["Base", "Yellow", "Blue"] as const;

export function getDefaultColorForNewNote(
	colors: IBackgroundColor[],
	noteIndex: number,
): IBackgroundColor | undefined {
	const preferred = NEW_NOTE_COLOR_CYCLE[noteIndex % NEW_NOTE_COLOR_CYCLE.length];
	const matched = colors.find((color) => color.value === (preferred as string));
	if (matched) return matched;
	return colors[noteIndex % colors.length];
}

export function getCascadeOffset(noteIndex: number, step = 36): { x: number; y: number } {
	return { x: noteIndex * step, y: noteIndex * step };
}
