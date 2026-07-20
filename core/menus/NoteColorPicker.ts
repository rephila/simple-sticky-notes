import type { IBackgroundColor } from "core/interfaces/BackgroundColorInterface";
import type { ITextColorOption } from "core/constants/defaultTextColorSettings";
import {
	createStickyEl,
	setStickyCssProps,
} from "core/utils/domHelpers";

export interface NoteColorPickerState {
	backgroundColor: IBackgroundColor;
	textColor: string;
	opacity: number;
}

type NoteColorPickerChange = Partial<NoteColorPickerState>;

export interface PaletteBudget {
	backgroundCount: number;
	textCount: number;
	sizeClass: "" | "is-compact" | "is-tiny";
}

export function getPaletteBudget(viewportWidth: number): PaletteBudget {
	if (viewportWidth < 320) {
		return { backgroundCount: 5, textCount: 8, sizeClass: "is-tiny" };
	}
	if (viewportWidth < 420) {
		return { backgroundCount: 6, textCount: 10, sizeClass: "is-compact" };
	}
	if (viewportWidth < 560) {
		return { backgroundCount: 8, textCount: 12, sizeClass: "is-compact" };
	}
	return {
		backgroundCount: Number.POSITIVE_INFINITY,
		textCount: Number.POSITIVE_INFINITY,
		sizeClass: "",
	};
}

export function limitPaletteItems<T>(
	items: T[],
	maxCount: number,
	isSelected: (item: T) => boolean,
): T[] {
	if (items.length <= maxCount) return items;

	const limited = items.slice(0, maxCount);
	const selected = items.find(isSelected);
	if (selected && !limited.includes(selected)) {
		limited[limited.length - 1] = selected;
	}
	return limited;
}

export class NoteColorPicker {
	private panel: HTMLElement | null = null;
	private anchor: HTMLElement | null = null;
	private outsideHandler: ((event: MouseEvent) => void) | null = null;
	private resizeHandler: (() => void) | null = null;
	private moveHandler: (() => void) | null = null;
	private lastBudgetKey = "";

	constructor(
		private document: Document,
		private getState: () => NoteColorPickerState,
		private onChange: (change: NoteColorPickerChange) => void,
		private backgroundColors: IBackgroundColor[],
		private textColors: ITextColorOption[],
		private getHostWindow?: () => Electron.BrowserWindow | undefined,
	) {}

	toggle(anchor: HTMLElement) {
		if (this.isOpen() && this.anchor === anchor) {
			this.hide();
			return;
		}
		this.anchor = anchor;
		this.render();
	}

	isOpen() {
		return !!this.panel?.classList.contains("is-open");
	}

	hide() {
		this.panel?.classList.remove("is-open", "is-measuring");
		this.panel?.remove();
		this.panel = null;
		if (this.outsideHandler) {
			this.document.removeEventListener("mousedown", this.outsideHandler, true);
			this.outsideHandler = null;
		}
		this.detachWindowListeners();
	}

	reposition() {
		if (!this.isOpen()) return;
		const budget = this.getCurrentBudget();
		const budgetKey = `${budget.backgroundCount}:${budget.textCount}:${budget.sizeClass}`;
		if (budgetKey !== this.lastBudgetKey) {
			this.render();
			return;
		}
		this.positionPanel();
	}

	private getViewportWidth() {
		return this.document.defaultView?.innerWidth ?? window.innerWidth;
	}

	private getCurrentBudget() {
		return getPaletteBudget(this.getViewportWidth());
	}

	private render() {
		const anchor = this.anchor;
		if (!anchor) return;

		this.panel?.remove();
		if (this.outsideHandler) {
			this.document.removeEventListener("mousedown", this.outsideHandler, true);
			this.outsideHandler = null;
		}
		this.detachWindowListeners();

		const budget = this.getCurrentBudget();
		this.lastBudgetKey = `${budget.backgroundCount}:${budget.textCount}:${budget.sizeClass}`;

		const className = budget.sizeClass
			? `sticky-note-color-picker ${budget.sizeClass}`
			: "sticky-note-color-picker";
		this.panel = createStickyEl(this.document, "div", { cls: className });

		this.populatePanel(this.panel, budget);
		this.document.body.appendChild(this.panel);
		this.positionPanel();
		this.attachOutsideClose();
		this.attachWindowListeners();
	}

	private populatePanel(panel: HTMLElement, budget: PaletteBudget) {
		const state = this.getState();

		createStickyEl(panel, "div", {
			cls: "sticky-note-color-picker-title",
			text: "Background",
		});

		const backgroundColors = limitPaletteItems(
			this.backgroundColors,
			budget.backgroundCount,
			(color) => color.value === state.backgroundColor.value,
		);
		this.renderSwatches(
			panel,
			backgroundColors.map((color) => ({
				label: color.value,
				color: color.lightColor,
				isSelected: color.value === state.backgroundColor.value,
				onClick: () => this.onChange({ backgroundColor: color }),
			})),
		);

		createStickyEl(panel, "div", {
			cls: "sticky-note-color-picker-title",
			text: "Text",
		});

		const textColors = limitPaletteItems(
			this.textColors,
			budget.textCount,
			(color) => color.color === state.textColor,
		);
		this.renderSwatches(
			panel,
			textColors.map((color) => ({
				label: color.name,
				color: color.color,
				isSelected: color.color === state.textColor,
				onClick: () => this.onChange({ textColor: color.color }),
			})),
		);

		createStickyEl(panel, "div", {
			cls: "sticky-note-color-picker-title",
			text: "Transparency",
		});
		this.renderOpacitySlider(panel, state.opacity);
	}

	private renderSwatches(
		panel: HTMLElement,
		items: {
			label: string;
			color: string;
			isSelected: boolean;
			onClick: () => void;
		}[],
	) {
		const row = createStickyEl(panel, "div", {
			cls: "sticky-note-color-picker-swatches",
		});

		for (const item of items) {
			const swatch = createStickyEl(row, "div", {
				cls: `sticky-note-color-picker-swatch${item.isSelected ? " is-selected" : ""}`,
				attr: { "aria-label": item.label },
				title: item.label,
			});
			setStickyCssProps(swatch, { "--swatch-color": item.color });
			swatch.addEventListener("mousedown", (event) => {
				event.preventDefault();
				event.stopPropagation();
			});
			swatch.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				item.onClick();
				this.render();
			});
		}
	}

	private renderOpacitySlider(panel: HTMLElement, opacity: number) {
		const row = createStickyEl(panel, "div", {
			cls: "sticky-note-color-picker-opacity",
		});
		const slider = createStickyEl(row, "input", {
			cls: "sticky-note-color-picker-slider",
			type: "range",
			value: String(opacity),
			attr: {
				min: "0.3",
				max: "1",
				step: "0.05",
				"aria-label": "Transparency",
			},
		});

		// Ensure type sticks even if createEl attr timing differs across windows.
		slider.type = "range";
		slider.min = "0.3";
		slider.max = "1";
		slider.step = "0.05";
		slider.value = String(opacity);

		const label = createStickyEl(row, "span", {
			cls: "sticky-note-color-picker-opacity-value",
			text: `${Math.round(opacity * 100)}%`,
		});

		slider.addEventListener("mousedown", (event) => {
			event.stopPropagation();
		});
		slider.addEventListener("input", () => {
			const nextOpacity = Number(slider.value);
			label.setText(`${Math.round(nextOpacity * 100)}%`);
			this.onChange({ opacity: nextOpacity });
		});
	}

	private positionPanel() {
		if (!this.panel || !this.anchor) return;

		this.panel.classList.add("is-measuring");
		this.panel.classList.remove("is-open");
		setStickyCssProps(this.panel, {
			"--sticky-picker-left": "0px",
			"--sticky-picker-top": "0px",
		});
		void this.panel.offsetWidth;

		const rect = this.anchor.getBoundingClientRect();
		const panelWidth = this.panel.offsetWidth;
		const panelHeight = this.panel.offsetHeight;
		const viewportWidth = this.getViewportWidth();
		const viewportHeight =
			this.document.defaultView?.innerHeight ?? window.innerHeight;
		const margin = 8;

		let left = rect.right - panelWidth;
		let top = rect.bottom + 6;

		if (top + panelHeight > viewportHeight - margin) {
			top = rect.top - panelHeight - 6;
		}

		left = Math.max(
			margin,
			Math.min(left, viewportWidth - panelWidth - margin),
		);
		top = Math.max(margin, top);

		setStickyCssProps(this.panel, {
			"--sticky-picker-left": `${left}px`,
			"--sticky-picker-top": `${top}px`,
		});
		this.panel.classList.remove("is-measuring");
		this.panel.classList.add("is-open");
	}

	private attachOutsideClose() {
		this.outsideHandler = (event: MouseEvent) => {
			const target = event.target as Node;
			if (this.panel?.contains(target)) return;
			if (this.anchor?.contains(target)) return;
			this.hide();
		};

		window.setTimeout(() => {
			if (this.outsideHandler) {
				this.document.addEventListener(
					"mousedown",
					this.outsideHandler,
					true,
				);
			}
		}, 0);
	}

	private attachWindowListeners() {
		this.detachWindowListeners();
		this.resizeHandler = () => this.reposition();
		this.moveHandler = () => this.reposition();
		this.document.defaultView?.addEventListener("resize", this.resizeHandler);
		this.getHostWindow?.()?.on("move", this.moveHandler);
		this.getHostWindow?.()?.on("resize", this.moveHandler);
	}

	private detachWindowListeners() {
		if (this.resizeHandler) {
			this.document.defaultView?.removeEventListener("resize", this.resizeHandler);
			this.resizeHandler = null;
		}

		const hostWindow = this.getHostWindow?.();
		if (hostWindow && !hostWindow.isDestroyed() && this.moveHandler) {
			hostWindow.removeListener("move", this.moveHandler);
			hostWindow.removeListener("resize", this.moveHandler);
		}
		this.moveHandler = null;
	}
}
