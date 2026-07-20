import { type IBackgroundColor } from "./BackgroundColorInterface";

export interface IStickyNoteBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface IStickyNoteState {
	id: string;
	noteKey?: string;
	color: IBackgroundColor;
	textColor: string;
	filePath?: string;
	opacity?: number;
	bounds?: IStickyNoteBounds;
}
