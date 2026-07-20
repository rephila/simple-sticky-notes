import { SizeOptions } from "core/enums/sizeOptionEnum";
import { type IBackgroundColor } from "./BackgroundColorInterface";
import { DEFAULT_COLORS } from "core/constants/defaultColorSettings";
import {
	DEFAULT_NOTE_OPACITY,
	DEFAULT_TEXT_COLOR,
	DEFAULT_TEXT_COLORS,
	type ITextColorOption,
} from "core/constants/defaultTextColorSettings";
import { PinOptions } from "core/enums/pinOptionEnum";
import { type IStickyNoteState } from "./WorkspaceStickyNoteInterface";

export const DEFAULT_WIDTH = 280;
export const DEFAULT_HEIGHT = 320;

export interface IPluginSettings {
	/** Restore sticky notes (file, position, size, colors, opacity) on startup. */
	saveWorkspace: boolean;
	/** Show sticky windows in the OS taskbar. */
	taskbarVisibility: boolean;
	/** Default pin mode for newly opened sticky notes. */
	pinOption: PinOptions;
	sizeOption: SizeOptions;
	/** Window size as `widthxheight` (used for Fixed / Custom). */
	dimensions: string;
	resizable: boolean;
	/** New notes start with the last background you picked. */
	useRecentBgColor: boolean;
	/**
	 * Persist background, text color, and opacity in each note's frontmatter.
	 * (Key kept for backward compatibility with older installs.)
	 */
	rememberBgColors: boolean;
	bgColors: IBackgroundColor[];
	/** Text colors shown in the sticky note color picker. */
	textColors: ITextColorOption[];
	/** Default text color for new sticky notes. */
	defaultTextColor: string;
	/** Default transparency for new sticky notes (0.3–1). */
	defaultOpacity: number;
	newStickyNotePath: string;
	workspaceNotes: IStickyNoteState[];
}

export const DEFAULT_SETTINGS: IPluginSettings = {
	saveWorkspace: true,
	taskbarVisibility: true,
	pinOption: PinOptions.ALWAYS,
	sizeOption: SizeOptions.REMEMBER_LAST,
	dimensions: `${DEFAULT_WIDTH}x${DEFAULT_HEIGHT}`,
	resizable: true,
	useRecentBgColor: false,
	rememberBgColors: false,
	bgColors: structuredClone(DEFAULT_COLORS),
	textColors: structuredClone(DEFAULT_TEXT_COLORS),
	defaultTextColor: DEFAULT_TEXT_COLOR,
	defaultOpacity: DEFAULT_NOTE_OPACITY,
	newStickyNotePath: "",
	workspaceNotes: [],
};
