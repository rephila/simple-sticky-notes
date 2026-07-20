import { describe, expect, it } from "vitest";
import { Colors } from "../../core/enums/colorEnum";
import { DEFAULT_COLORS } from "../../core/constants/defaultColorSettings";
import {
	getCascadeOffset,
	getDefaultColorForNewNote,
} from "../../core/utils/newNoteDefaults";

describe("e2e: multiple sticky notes", () => {
	it("assigns white, yellow, and blue defaults to the first three new notes", () => {
		expect(getDefaultColorForNewNote(DEFAULT_COLORS, 0)?.value).toBe(Colors.BASE);
		expect(getDefaultColorForNewNote(DEFAULT_COLORS, 1)?.value).toBe(Colors.YELLOW);
		expect(getDefaultColorForNewNote(DEFAULT_COLORS, 2)?.value).toBe(Colors.BLUE);
	});

	it("cascades each new note window so multiple notes stay visible", () => {
		expect(getCascadeOffset(0)).toEqual({ x: 0, y: 0 });
		expect(getCascadeOffset(1)).toEqual({ x: 36, y: 36 });
		expect(getCascadeOffset(2)).toEqual({ x: 72, y: 72 });
	});
});
