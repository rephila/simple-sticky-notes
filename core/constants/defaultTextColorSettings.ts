export interface ITextColorOption {
	name: string;
	color: string;
}

export const DEFAULT_TEXT_COLOR = "#1a1a1a";
export const DEFAULT_LINK_COLOR = "#1a5fb4";
export const DEFAULT_LINK_COLOR_HOVER = "#134e96";
export const TEXT_COLOR_PROPERTY = "text_color";
export const OPACITY_PROPERTY = "note_opacity";
export const DEFAULT_NOTE_OPACITY = 1;

export const DEFAULT_TEXT_COLORS: ITextColorOption[] = [
	{ name: "Black", color: "#1a1a1a" },
	{ name: "Dark Gray", color: "#4a4a4a" },
	{ name: "Blue", color: "#1a4f8b" },
	{ name: "Red", color: "#b42318" },
	{ name: "Green", color: "#1a6638" },
	{ name: "Purple", color: "#5b3ea8" },
	{ name: "Brown", color: "#6b4423" },
	{ name: "Pink", color: "#db2777" },
	{ name: "Google Blue", color: "#4285F4" },
	{ name: "Google Red", color: "#EA4335" },
	{ name: "Google Yellow", color: "#F9AB00" },
	{ name: "Google Green", color: "#34A853" },
];
