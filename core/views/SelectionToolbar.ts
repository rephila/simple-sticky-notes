import { MarkdownView, Menu, setIcon, setTooltip } from "obsidian";
import type { StickyNoteLeaf } from "core/views/StickyNoteLeaf";
import {
	setLineHeading as formatLineHeading,
	toggleWrapSelection as formatToggleWrap,
} from "core/utils/selectionFormat";
import {
	createStickyEl,
	setStickyCssProps,
} from "core/utils/domHelpers";

type SelectionCoords = {
	top: number;
	left: number;
	width: number;
};

type FormatEditor = MarkdownView["editor"];

export class SelectionToolbar {
	private el: HTMLElement;
	private headingButton: HTMLElement | null = null;
	private pendingPreviewSelection: string | null = null;

	constructor(
		private stickyNote: StickyNoteLeaf,
		private document: Document,
	) {
		this.el = createStickyEl(this.document, "div", {
			cls: "sticky-note-selection-toolbar",
		});
		this.buildToolbar();
	}

	attach() {
		this.document.addEventListener("mouseup", this.handleSelection);
		this.document.addEventListener("keyup", this.handleSelection);
		this.document.addEventListener("mousedown", this.handleOutsideClick, true);
	}

	detach() {
		this.document.removeEventListener("mouseup", this.handleSelection);
		this.document.removeEventListener("keyup", this.handleSelection);
		this.document.removeEventListener(
			"mousedown",
			this.handleOutsideClick,
			true,
		);
		this.hide();
		this.el.remove();
	}

	private buildToolbar() {
		this.headingButton = this.addButton("heading", "Heading", "heading");
		this.addSeparator();
		this.addButton("bold", "Bold", "bold");
		this.addButton("italic", "Italic", "italic");
		this.addButton("strikethrough", "Strikethrough", "strikethrough");
		this.addButton("underline", "Underline", "underline");
		this.addButton("highlight", "Highlight", "highlighter");
		this.addSeparator();
		this.addButton("link", "Link", "link");
	}

	private addSeparator() {
		createStickyEl(this.el, "div", {
			cls: "sticky-note-selection-toolbar-separator",
		});
	}

	private addButton(action: string, label: string, icon: string) {
		const button = createStickyEl(this.el, "div", {
			cls: `sticky-note-selection-toolbar-button${action === "highlight" ? " highlight-button" : ""}${action === "heading" ? " heading-button" : ""}`,
			attr: { "aria-label": label },
		});
		setIcon(button, icon);
		setTooltip(button, label);

		if (action === "heading") {
			createStickyEl(button, "span", {
				cls: "sticky-note-selection-toolbar-heading-label",
				text: "H",
			});
			const chevron = createStickyEl(button, "span", {
				cls: "sticky-note-selection-toolbar-heading-chevron",
			});
			setIcon(chevron, "chevron-down");
			button.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.showHeadingMenu(event);
			});
			return button;
		}

		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.applyFormat(action);
		});
		return button;
	}

	private showHeadingMenu(event: MouseEvent) {
		const menu = new Menu();
		for (const level of [1, 2, 3, 4, 5, 6] as const) {
			menu.addItem((item) =>
				item
					.setTitle(`Heading ${level}`)
					.setIcon("heading")
					.onClick(() => this.applyFormat("heading", level)),
			);
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Normal text")
				.setIcon("type")
				.onClick(() => this.applyFormat("heading", 0)),
		);
		menu.showAtMouseEvent(event);
		window.setTimeout(() => {
			const menuEl = this.document.querySelector('.menu') as HTMLElement;
			if (menuEl) {
				const remainingHeight = (this.document.defaultView?.innerHeight || window.innerHeight) - menuEl.getBoundingClientRect().top - 10;
				menuEl.style.maxHeight = remainingHeight + 'px';
				menuEl.style.overflowY = 'auto';
			}
		}, 5);
	}

	private handleSelection = () => {
		window.setTimeout(() => {
			const view = this.getMarkdownView();
			if (!view) {
				this.hide();
				return;
			}

			if (view.getMode() === "source") {
				const selection = this.getEditorSelection();
				if (!selection.trim()) {
					this.hide();
					return;
				}
				const coords = this.getSourceCoords();
				if (!coords) {
					this.hide();
					return;
				}
				this.show(coords);
				return;
			}

			const previewSelection = this.getPreviewSelection();
			const coords = this.getPreviewCoords();
			if (!previewSelection?.trim() || !coords) {
				this.hide();
				return;
			}

			this.pendingPreviewSelection = previewSelection;
			this.show(coords);
		}, 10);
	};

	private handleOutsideClick = (event: MouseEvent) => {
		const target = event.target as Node;
		if (this.el.contains(target)) return;
		this.hide();
	};

	private hide = () => {
		this.el.classList.remove("is-open", "is-measuring");
		this.pendingPreviewSelection = null;
	};

	private show(coords: SelectionCoords) {
		this.el.classList.add("is-measuring");
		this.el.classList.remove("is-open");
		setStickyCssProps(this.el, {
			"--sticky-toolbar-left": "0px",
			"--sticky-toolbar-top": "0px",
		});

		const toolbarWidth = this.el.offsetWidth;
		const toolbarHeight = this.el.offsetHeight;
		const left = coords.left + coords.width / 2 - toolbarWidth / 2;
		const top = coords.top - toolbarHeight - 8;

		setStickyCssProps(this.el, {
			"--sticky-toolbar-left": `${Math.max(8, left)}px`,
			"--sticky-toolbar-top": `${Math.max(8, top)}px`,
		});
		this.el.classList.remove("is-measuring");
		this.el.classList.add("is-open");
	}

	private getMarkdownView(): MarkdownView | null {
		return this.stickyNote.view instanceof MarkdownView
			? this.stickyNote.view
			: null;
	}

	private getEditorSelection(): string {
		const view = this.getMarkdownView();
		if (!view) return "";
		return view.editor.getSelection();
	}

	private getPreviewSelection(): string | null {
		const view = this.getMarkdownView();
		if (!view || view.getMode() !== "preview") return null;

		const selection = window.getSelection();
		if (!selection || selection.isCollapsed) return null;
		const text = selection.toString();
		return text || null;
	}

	private getSourceCoords(): SelectionCoords | null {
		const view = this.getMarkdownView();
		if (!view) return null;
		const from = view.editor.getCursor("from");
		const editorUnknown = view.editor as unknown as {
			coordsAtPos?: (pos: unknown) => {
				top: number;
				left: number;
				right: number;
			} | null;
		};
		const coords = editorUnknown.coordsAtPos?.(from) ?? null;
		if (!coords) {
			const leafRect = view.containerEl.getBoundingClientRect();
			return { top: leafRect.top + 48, left: leafRect.left + 24, width: 40 };
		}
		return {
			top: coords.top,
			left: coords.left,
			width: Math.max(1, coords.right - coords.left),
		};
	}

	private getPreviewCoords(): SelectionCoords | null {
		const selection = window.getSelection();
		if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
			return null;
		}
		const range = selection.getRangeAt(0);
		const rect = range.getBoundingClientRect();
		if (!rect.width && !rect.height) return null;
		return {
			top: rect.top,
			left: rect.left,
			width: rect.width,
		};
	}

	private toggleWrapSelection(editor: FormatEditor, open: string, close = open) {
		const selected = editor.getSelection();
		const next = formatToggleWrap(selected, open, close);
		if (next === null) return;
		editor.replaceSelection(next);
	}

	private setLineHeading(editor: FormatEditor, level: number) {
		const line = editor.getCursor("from").line;
		const text = editor.getLine(line);
		editor.setLine(line, formatLineHeading(text, level));
	}

	private applyFormat(action: string, level: number = 1) {
		const view = this.getMarkdownView();
		if (!view) return;

		if (view.getMode() === "preview") {
			void this.stickyNote.setViewMode("source").then(() => {
				window.setTimeout(() => this.applyFormat(action, level), 50);
			});
			return;
		}

		const editor = view.editor;
		if (this.pendingPreviewSelection && !editor.getSelection()) {
			editor.replaceSelection(this.pendingPreviewSelection);
			this.pendingPreviewSelection = null;
		}

		switch (action) {
			case "bold":
				this.toggleWrapSelection(editor, "**");
				break;
			case "italic":
				this.toggleWrapSelection(editor, "*");
				break;
			case "strikethrough":
				this.toggleWrapSelection(editor, "~~");
				break;
			case "underline":
				this.toggleWrapSelection(editor, "<u>", "</u>");
				break;
			case "highlight":
				this.toggleWrapSelection(editor, "==");
				break;
			case "link": {
				const text = editor.getSelection() || "link";
				editor.replaceSelection(`[${text}]()`);
				break;
			}
			case "heading":
				this.setLineHeading(editor, level);
				break;
		}

		editor.focus();
		this.hide();
	}
}
