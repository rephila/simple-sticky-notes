import {
	ItemView,
	MarkdownView,
	type MarkdownViewModeType,
	Platform,
	TFile,
	View,
	WorkspaceLeaf,
	setIcon,
	setTooltip,
} from "obsidian";
import { BrowserWindow } from "@electron/remote";
import { NoteColorPicker } from "core/menus/NoteColorPicker";
import { DEFAULT_COLORS } from "core/constants/defaultColorSettings";
import {
	DEFAULT_TEXT_COLOR,
	DEFAULT_LINK_COLOR,
	DEFAULT_LINK_COLOR_HOVER,
	DEFAULT_NOTE_OPACITY,
	OPACITY_PROPERTY,
	TEXT_COLOR_PROPERTY,
} from "core/constants/defaultTextColorSettings";
import { SizeOptions } from "core/enums/sizeOptionEnum";
import { PinOptions } from "core/enums/pinOptionEnum";
import { type IBackgroundColor } from "core/interfaces/BackgroundColorInterface";
import { type MarkdownService } from "core/services/MarkdownService";
import { ImageOpenService } from "core/services/ImageOpenService";
import { LoggingService } from "core/services/LogginService";
import { type SettingService } from "core/services/SettingService";
import { SelectionToolbar } from "core/views/SelectionToolbar";
import {
	buildNoteCssVars,
	clearStaleInlineTextColors,
} from "core/utils/noteAppearance";
import { getCascadeOffset, getDefaultColorForNewNote } from "core/utils/newNoteDefaults";
import {
	applyStickyContainerClass,
	hideStickyChrome,
	markStickyWindow,
	watchStickyIntrusions,
} from "core/utils/stickyChrome";
import {
	isHtmlElement,
	setStickyCssProps,
} from "core/utils/domHelpers";
import type { IStickyNoteBounds } from "core/interfaces/WorkspaceStickyNoteInterface";

type StickyNoteSubLeaf = WorkspaceLeaf & { id: string };

export class StickyNoteLeaf {
	private static stickyNoteId = 0;
	public static leafsList = new Map<string, StickyNoteLeaf>();
	private static lastNotePinnedState = true;
	public static lastNoteColor: IBackgroundColor | undefined;
	public static lastTextColor = DEFAULT_TEXT_COLOR;

	private settingService: SettingService;
	private markdownService: MarkdownService;
	private imageOpenService: ImageOpenService;
	private imageClickHandler: ((event: MouseEvent) => void) | undefined;
	private doubleClickEditHandler: ((event: MouseEvent) => void) | undefined;
	private windowFocusHandler: ((event: Event) => void) | undefined;
	private selectionToolbar: SelectionToolbar | undefined;
	private appearanceObserver: MutationObserver | undefined;
	private appearanceRefreshTimer: number | undefined;
	private stopIntrusionWatch: (() => void) | undefined;
	private boundsSaveTimer: number | undefined;

	id: number;
	leaf: StickyNoteSubLeaf;
	view: View;
	document: Document;
	mainWindow: Electron.BrowserWindow | undefined;
	colorPicker: NoteColorPicker | undefined;
	private viewInitialized = false;
	color: IBackgroundColor = DEFAULT_COLORS[0];
	textColor = DEFAULT_TEXT_COLOR;
	opacity = DEFAULT_NOTE_OPACITY;
	activeFile: TFile | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		settingService: SettingService,
		markdownService: MarkdownService,
	) {
		this.settingService = settingService;
		this.markdownService = markdownService;
		this.imageOpenService = new ImageOpenService(markdownService.plugin);
		this.leaf = leaf as StickyNoteSubLeaf;
		this.view = leaf.view;
		this.syncDocument();
		this.id = StickyNoteLeaf.stickyNoteId;
		StickyNoteLeaf.stickyNoteId++;
		StickyNoteLeaf.leafsList.set(this.title, this);
		void this.settingService.updateWorkspaceNotes(StickyNoteLeaf.leafsList);
	}

	get title() {
		return `sticky-note-${this.id}`;
	}

	static findByFilePath(filePath: string): StickyNoteLeaf | undefined {
		for (const note of StickyNoteLeaf.leafsList.values()) {
			if (note.activeFile?.path === filePath) return note;
		}
		return undefined;
	}

	focusStickyWindow() {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

		if (this.mainWindow.isMinimized()) {
			this.mainWindow.restore();
		}

		this.mainWindow.show();

		if (this.mainWindow.isAlwaysOnTop()) {
			// Windows sometimes drops always-on-top z-order until it is re-applied.
			this.mainWindow.setAlwaysOnTop(false);
			this.mainWindow.setAlwaysOnTop(true, "screen-saver");
			this.mainWindow.moveTop();
		}

		this.mainWindow.focus();

		try {
			this.markdownService.plugin.app.workspace.setActiveLeaf(this.leaf, {
				focus: true,
			});
		} catch (error) {
			LoggingService.warn(
				`Sticky note ${this.title} could not activate leaf: ${String(error)}`,
			);
		}
	}

	private syncDocument() {
		// Prefer the leaf view's ownerDocument — getContainer().doc can lag behind
		// during popout creation and point at the main window.
		this.document =
			this.leaf.view?.containerEl?.ownerDocument ??
			this.view?.containerEl?.ownerDocument ??
			this.leaf.getContainer()?.doc ??
			document;
	}

	getWindowBounds(): IStickyNoteBounds | undefined {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) return undefined;
		const bounds = this.mainWindow.getBounds();
		return {
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
		};
	}

	async initStickyNote(
		file: TFile | null = null,
		explicitColor: IBackgroundColor | null = null,
		resize = true,
		explicitTextColor: string | null = null,
		explicitOpacity: number | null = null,
		savedBounds: IStickyNoteBounds | null = null,
		isStartupRestore = false,
	) {
		LoggingService.info(`Init Sticky Note ${this.id} ...`);
		this.syncDocument();
		this.activeFile = file ?? this.getCurrentFile();
		this.markStickyWindow();
		this.initColorMenus();

		this.applySyncDefaultColors(explicitColor, explicitTextColor, explicitOpacity);
		this.applyNoteAppearance();

		await this.setDefaultColors(
			this.activeFile,
			explicitColor,
			explicitTextColor,
			explicitOpacity,
		);

		await this.waitForStickyDom(isStartupRestore ? 160 : 60);

		if (this.activeFile) {
			await this.leaf.openFile(this.activeFile);
		}

		this.activeFile = this.getCurrentFile() ?? this.activeFile;
		await this.waitForStickyDom();
		await this.waitForMarkdownView(isStartupRestore ? 200 : 80);

		this.initView();
		await this.initMainWindow(resize, savedBounds);
		
		this.refreshNoteTitle();
		if (isStartupRestore) {
			this.scheduleStartupAppearanceRefresh();
		} else {
			this.scheduleStickyChromeRefresh();
		}
		this.applyNoteAppearance();
		void this.settingService.updateWorkspaceNotes(StickyNoteLeaf.leafsList);
	}

	private markStickyWindow() {
		markStickyWindow(this.document, this.title);
	}

	private async waitForStickyDom(maxAttempts = 60): Promise<void> {
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			this.syncDocument();
			if (
				this.document.body.querySelector(".app-container") &&
				this.leaf.view?.containerEl
			) {
				return;
			}
			await new Promise((resolve) => window.setTimeout(resolve, 50));
		}
	}

	private async waitForMarkdownView(maxAttempts = 80): Promise<void> {
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			this.syncDocument();
			this.view = this.leaf.view;

			if (this.view instanceof MarkdownView) {
				const hasPreview = this.view.containerEl.querySelector(
					".markdown-preview-view",
				);
				const hasEditor = this.view.containerEl.querySelector(".cm-editor");
				const hasHeader = this.view.containerEl.querySelector(".view-header");
				if ((hasPreview || hasEditor) && hasHeader) return;
			}

			await new Promise((resolve) => window.setTimeout(resolve, 50));
		}

		LoggingService.warn(
			`Sticky note ${this.title} markdown view did not finish loading`,
		);
	}

	private scheduleStickyChromeRefresh() {
		for (const delay of [0, 100, 250, 500, 1000, 2000, 5000, 10000, 15000]) {
			window.setTimeout(() => {
				this.syncDocument();
				this.refreshStickyChrome();
				this.applyNoteAppearance();
			}, delay);
		}
	}

	private scheduleStartupAppearanceRefresh() {
		for (const delay of [0, 100, 250, 500, 1000, 2000, 5000, 10000, 15000]) {
			window.setTimeout(() => {
				this.syncDocument();
				this.refreshStickyChrome();
				this.applyNoteAppearance();
			}, delay);
		}
	}

	private applyStickyContentLayout() {
		this.syncDocument();
		markStickyWindow(this.document, this.title);
		applyStickyContainerClass(this.document);

		const viewContent =
			this.view.containerEl.querySelector<HTMLElement>(".view-content") ??
			this.document.querySelector<HTMLElement>(".view-content");
		const mode =
			this.view instanceof MarkdownView ? this.view.getMode() : "preview";
		const isSource = mode === "source";

		if (viewContent) {
			viewContent.classList.toggle("mod-sticky-source", isSource);
			viewContent.classList.toggle("mod-sticky-preview", !isSource);
		}
	}

	initView() {
		this.syncDocument();
		this.view = this.leaf.view;
		this.markStickyWindow();

		if (!this.viewInitialized) {
			LoggingService.info("Initializing Sticky Note view ...");
			this.viewInitialized = true;
			this.removeDefaultActionsMenu();
			this.addActions();
			this.setupImageClickHandler();
			this.setupDoubleClickToEdit();
			try {
				this.setupSelectionToolbar();
				this.setupAppearanceObserver();
			} catch (error) {
				LoggingService.warn(`Sticky note UI init failed: ${String(error)}`);
			}
		}

		this.refreshStickyChrome();
		this.setupIntrusionGuard();
		this.refreshNoteTitle();
	}

	private setupIntrusionGuard() {
		if (this.stopIntrusionWatch) return;
		this.stopIntrusionWatch = watchStickyIntrusions(this.document);
	}

	private refreshStickyChrome() {
		this.syncDocument();
		applyStickyContainerClass(this.document);
		hideStickyChrome(this.document);
		this.applyStickyContentLayout();
	}

	private setupAppearanceObserver() {
		if (this.appearanceObserver) return;

		const observeTarget =
			this.view.containerEl.querySelector(".markdown-preview-view") ??
			this.view.containerEl.querySelector(".cm-editor") ??
			this.view.containerEl;

		this.appearanceObserver = new MutationObserver(() => {
			this.scheduleAppearanceRefresh();
		});

		this.appearanceObserver.observe(observeTarget, {
			childList: true,
			subtree: true,
		});
	}

	private scheduleAppearanceRefresh() {
		if (this.appearanceRefreshTimer) {
			window.clearTimeout(this.appearanceRefreshTimer);
		}

		this.appearanceRefreshTimer = window.setTimeout(() => {
			this.applyStickyContentLayout();
			this.applyNoteAppearance();
		}, 50);
	}

	private setupSelectionToolbar() {
		if (this.selectionToolbar) return;
		this.selectionToolbar = new SelectionToolbar(this, this.document);
		this.selectionToolbar.attach();
	}

	private setupImageClickHandler() {
		if (this.imageClickHandler) return;

		this.imageClickHandler = (event: MouseEvent) => {
			void this.handleImageClick(event);
		};

		this.document.body.addEventListener(
			"click",
			this.imageClickHandler,
			true,
		);
	}

	/** Double-click reading view to enter editing (source) mode — same UX as classic sticky notes. */
	private setupDoubleClickToEdit() {
		if (this.doubleClickEditHandler) return;

		this.doubleClickEditHandler = (event: MouseEvent) => {
			if (!(this.view instanceof MarkdownView)) return;
			if (this.view.getMode() !== "preview") return;

			const target = event.target;
			if (!isHtmlElement(target)) return;
			if (
				target.closest(
					"a, img, button, input, textarea, .internal-embed, .cm-editor, .sticky-note-color-picker, .sticky-note-selection-toolbar",
				)
			) {
				return;
			}
			if (!target.closest(".markdown-preview-view, .view-content")) return;

			event.preventDefault();
			void this.setViewMode("source").then(() => this.updateEditButton());
		};

		this.document.body.addEventListener(
			"dblclick",
			this.doubleClickEditHandler,
		);
	}

	private setupWindowFocusBehavior() {
		if (this.windowFocusHandler || !this.mainWindow) return;

		this.windowFocusHandler = () => {
			this.focusStickyWindow();
		};

		this.document.addEventListener(
			"mousedown",
			this.windowFocusHandler,
			true,
		);

		this.mainWindow.on("focus", () => {
			if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
			if (!this.mainWindow.isAlwaysOnTop()) return;
			this.mainWindow.setAlwaysOnTop(true, "screen-saver");
		});
	}

	private async handleImageClick(event: MouseEvent) {
		const target = event.target;
		if (!isHtmlElement(target)) return;
		const img = target.closest("img");

		if (img?.closest(".markdown-preview-view, .markdown-source-view")) {
			event.preventDefault();
			event.stopPropagation();
			await this.imageOpenService.openFromElement(img, this.activeFile);
			return;
		}

		if (event.detail < 2) return;

		const line = target.closest(".cm-line");
		if (!line) return;

		const imagePath = ImageOpenService.parseImagePathFromLine(
			line.textContent ?? "",
		);
		if (!imagePath || !ImageOpenService.isImagePath(imagePath)) return;

		event.preventDefault();
		event.stopPropagation();
		await this.imageOpenService.openFromLinkPath(imagePath, this.activeFile);
	}


	private async initMainWindow(
		resize: boolean,
		savedBounds: IStickyNoteBounds | null = null,
	) {
		this.mainWindow = await this.resolveMainWindow();
		if (!this.mainWindow) {
			LoggingService.warn(
				`Sticky note ${this.title} does not have an electron window`,
			);
			return;
		}

		const resizable =
			this.settingService.settings.resizable ||
			this.settingService.settings.sizeOption === SizeOptions.REMEMBER_LAST;

		if (savedBounds) {
			this.mainWindow.setBounds(savedBounds);
		} else if (resize) {
			const [width, height] = this.settingService.getWindowDimensions();
			this.mainWindow.setSize(width, height);
			this.applyCascadePosition();
		}

		this.mainWindow.setMinimumSize(180, 180);
		this.mainWindow.setResizable(resizable);

		if (this.settingService.settings.sizeOption === SizeOptions.REMEMBER_LAST) {
			this.mainWindow.on("resize", () => {
				this.saveDimensions();
				this.colorPicker?.reposition();
				this.scheduleBoundsSave();
			});
		} else {
			this.mainWindow.on("resize", () => {
				this.colorPicker?.reposition();
				this.scheduleBoundsSave();
			});
		}

		this.mainWindow.on("move", () => {
			this.scheduleBoundsSave();
		});

		this.mainWindow.setSkipTaskbar(
			!this.settingService.settings.taskbarVisibility,
		);

		let isPinned = StickyNoteLeaf.lastNotePinnedState;
		if (this.settingService.settings.pinOption === PinOptions.ALWAYS) {
			isPinned = true;
		} else if (this.settingService.settings.pinOption === PinOptions.NEVER) {
			isPinned = false;
		}
		this.pinAction(isPinned);
		this.updatePinButton();
		this.setupWindowFocusBehavior();
		this.focusStickyWindow();

		if (this.mainWindow) {
			try {
				this.mainWindow.setBackgroundColor(
					this.toElectronColor(this.color.lightColor),
				);
			} catch (error) {
				LoggingService.warn(
					`Sticky note ${this.title} could not set window background: ${String(error)}`,
				);
			}
		}

		if (this.view instanceof MarkdownView) {
			this.viewModeAction("preview");
		}
	}

	private async resolveMainWindow(): Promise<Electron.BrowserWindow | undefined> {
		for (let attempt = 0; attempt < 20; attempt++) {
			this.syncDocument();
			const byTitle = BrowserWindow.getAllWindows().find(
				(window) => window.title === this.title,
			);
			if (byTitle && !byTitle.isDestroyed()) return byTitle;

			for (const window of BrowserWindow.getAllWindows()) {
				if (window.isDestroyed()) continue;
				try {
					const matches: unknown = await window.webContents.executeJavaScript(
						`document.documentElement.getAttribute("note-id") === ${JSON.stringify(this.title)}`,
					);
					if (matches === true) return window;
				} catch {
					continue;
				}
			}

			await new Promise((resolve) => window.setTimeout(resolve, 50));
		}

		return undefined;
	}

	private saveDimensions() {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
		const [width, height] = this.mainWindow.getSize();
		void this.settingService.updateWindowDimensions(width, height);
	}

	private applyCascadePosition() {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
		const { x, y } = getCascadeOffset(this.id);
		const [currentX, currentY] = this.mainWindow.getPosition();
		this.mainWindow.setPosition(currentX + x, currentY + y);
	}

	private scheduleBoundsSave() {
		if (this.boundsSaveTimer) {
			window.clearTimeout(this.boundsSaveTimer);
		}

		this.boundsSaveTimer = window.setTimeout(() => {
			void this.settingService.updateWorkspaceNotes(StickyNoteLeaf.leafsList);
		}, 250);
	}

	private addNoteContainerClass() {
		applyStickyContainerClass(this.document);
	}

	private getStickyRoot(): HTMLElement | null {
		return this.document.body.querySelector(".app-container.sticky-note");
	}

	private removeDefaultActionsMenu() {
		const actionsEl = this.view.containerEl.querySelector(".view-actions");
		const leftActionsEl =
			this.view.containerEl.querySelector(".view-header-left");
		actionsEl?.empty();
		leftActionsEl?.empty();
	}

	private getCurrentFile(): TFile | null {
		if (this.view instanceof MarkdownView && this.view.file) {
			return this.view.file;
		}

		const markdownView =
			this.markdownService.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		return markdownView?.file ?? null;
	}

	private titleObserver?: MutationObserver;

	private refreshNoteTitle() {
		const titleContainer =
			this.view.containerEl.querySelector(".view-header-title-container");
		const titleEl =
			this.view.containerEl.querySelector<HTMLElement>(".view-header-title");
		if (!titleEl) return;

		titleContainer
			?.querySelectorAll(
				".view-header-breadcrumb, .view-header-title-parent, .view-header-breadcrumb-separator",
			)
			.forEach((element) => {
				element.classList.add("is-sticky-hidden");
				element.setAttribute("data-sticky-hidden", "true");
			});

		const title = this.resolveHeaderTitle();
		titleEl.setText(title);

		const expectedTitle = `Simple Sticky Note - ${title}`;
		this.document.title = expectedTitle;
		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			this.mainWindow.setTitle(expectedTitle);
		}

		if (!this.titleObserver) {
			const headTitleEl = this.document.querySelector("title");
			if (headTitleEl) {
				this.titleObserver = new MutationObserver(() => {
					if (headTitleEl.textContent !== expectedTitle) {
						headTitleEl.textContent = expectedTitle;
						if (this.mainWindow && !this.mainWindow.isDestroyed()) {
							this.mainWindow.setTitle(expectedTitle);
						}
					}
				});
				this.titleObserver.observe(headTitleEl, { childList: true, characterData: true, subtree: true });
			}
		}

		this.hideInlineTitleOnly();
	}

	private resolveHeaderTitle(): string {
		const file = this.activeFile ?? this.getCurrentFile();
		if (file) {
			return this.formatHeaderTitle(file.basename);
		}

		return "NEW NOTE";
	}

	private formatHeaderTitle(rawTitle: string): string {
		return rawTitle
			.replace(/\.md$/i, "")
			.replace(/^\/+\s*/, "")
			.replace(/\s*\/+\s*/g, " ")
			.replace(/_/g, " ")
			.trim()
			.toUpperCase();
	}

	private hideInlineTitleOnly() {
		const hide = () => {
			this.document
				.querySelectorAll(
					".view-content .inline-title, .markdown-source-view .inline-title, .view-content .mod-header, .markdown-preview-view .mod-header, .markdown-source-view .mod-header",
				)
				.forEach((element) => {
					element.classList.add("is-sticky-hidden");
					element.setAttribute("data-sticky-hidden", "true");
				});
		};

		hide();
		window.setTimeout(hide, 100);
		window.setTimeout(hide, 500);
	}
	private addActions() {
		if (!(this.view instanceof ItemView)) return;

		this.view
			.addAction("palette", "Colors", (event) => {
				const button = event.currentTarget ?? event.target;
				if (!isHtmlElement(button)) return;
				const anchor = button.closest(".view-action") ?? button;
				if (!isHtmlElement(anchor)) return;
				try {
					this.colorPicker?.toggle(anchor);
				} catch (error) {
					LoggingService.warn(
						`Sticky note color picker failed: ${String(error)}`,
					);
				}
			})
			.addClasses(["color-button", "sticky-note-button"]);

		this.view
			.addAction("pen-line", "Edit", () => {
				this.viewModeAction();
				this.updateEditButton();
			})
			.addClasses(["edit-button", "sticky-note-button"]);

		this.view
			.addAction("pin", "Pin", () => this.pinAction())
			.addClasses(["pin-button", "sticky-note-button"]);

		if (!Platform.isMacOS) {
			this.view
				.addAction("x", "Close", () => this.closeStickyNote())
				.addClasses(["close-button", "sticky-note-button"]);
		}

		this.updatePinButton();
		this.updateEditButton();
	}

	private updateEditButton() {
		const editButton =
			this.view.containerEl.querySelector<HTMLElement>(".edit-button");
		if (!editButton || !(this.view instanceof MarkdownView)) return;

		const isPreview = this.view.getMode() === "preview";
		setIcon(editButton, isPreview ? "pen-line" : "book-open");
		setTooltip(editButton, isPreview ? "Edit" : "Reading view");
	}

	private closeStickyNote() {
		this.titleObserver?.disconnect();
		this.titleObserver = undefined;
		this.stopIntrusionWatch?.();
		this.stopIntrusionWatch = undefined;
		StickyNoteLeaf.leafsList.delete(this.title);
		void this.settingService.updateWorkspaceNotes(StickyNoteLeaf.leafsList);
		this.leaf.detach();
	}

	private updatePinButton() {
		const isPinned = this.mainWindow?.isAlwaysOnTop() ?? false;
		const pinButton =
			this.view.containerEl.querySelector<HTMLElement>(".pin-button");
		if (!pinButton) return;
		setIcon(pinButton, isPinned ? "pin-off" : "pin");
		setTooltip(pinButton, isPinned ? "Unpin" : "Pin");
	}

	private initColorMenus() {
		this.colorPicker = new NoteColorPicker(
			this.document,
			() => ({
				backgroundColor: this.color,
				textColor: this.textColor,
				opacity: this.opacity,
			}),
			(change) => this.applyColorPickerChange(change),
			this.settingService.settings.bgColors,
			this.settingService.settings.textColors,
			() => this.mainWindow,
		);
	}

	private applyColorPickerChange(
		change: Partial<{
			backgroundColor: IBackgroundColor;
			textColor: string;
			opacity: number;
		}>,
	) {
		if (change.backgroundColor) {
			this.updateBackgroundColor(change.backgroundColor);
		}
		if (change.textColor) {
			this.updateTextColor(change.textColor);
		}
		if (change.opacity !== undefined) {
			this.updateOpacity(change.opacity);
		}
	}

	private updateBackgroundColor(
		newColor: IBackgroundColor,
		file: TFile | null = null,
	) {
		this.color = newColor;
		StickyNoteLeaf.lastNoteColor = newColor;
		this.applyNoteAppearance();
		void this.settingService.updateWorkspaceNotes(StickyNoteLeaf.leafsList);
		void this.persistColors(file ?? this.activeFile);
	}

	private updateTextColor(newColor: string, file: TFile | null = null) {
		this.textColor = newColor;
		StickyNoteLeaf.lastTextColor = newColor;
		this.applyNoteAppearance();
		void this.settingService.updateWorkspaceNotes(StickyNoteLeaf.leafsList);
		void this.persistColors(file ?? this.activeFile);
	}

	private updateOpacity(newOpacity: number, file: TFile | null = null) {
		this.opacity = Math.min(1, Math.max(0.3, newOpacity));
		this.applyWindowOpacity();
		void this.settingService.updateWorkspaceNotes(StickyNoteLeaf.leafsList);
		void this.persistColors(file ?? this.activeFile);
	}

	private applyWindowOpacity() {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
		try {
			this.mainWindow.setOpacity(this.opacity);
			this.mainWindow.setBackgroundColor(this.toElectronColor(this.color.lightColor));
		} catch (error) {
			LoggingService.warn(
				`Sticky note ${this.title} could not apply window opacity: ${String(error)}`,
			);
		}
	}

	private toElectronColor(hexColor: string): string {
		const normalized = hexColor.replace("#", "");
		if (normalized.length === 3) {
			const [r, g, b] = normalized.split("");
			return `#ff${r}${r}${g}${g}${b}${b}`;
		}
		if (normalized.length === 6) {
			return `#ff${normalized}`;
		}
		return "#ffffffff";
	}

	private applyNoteAppearance() {
		this.syncDocument();
		this.refreshStickyChrome();

		const bgColor = this.color.lightColor;
		const textColor = this.textColor;
		const linkColor = DEFAULT_LINK_COLOR;
		const linkColorHover = DEFAULT_LINK_COLOR_HOVER;
		const cssVars = Object.fromEntries(
			buildNoteCssVars({
				bgColor,
				textColor,
				linkColor,
				linkColorHover,
			}),
		);

		const targets = [
			this.document.documentElement,
			this.document.body,
			this.document.body.querySelector(".app-container"),
			this.getStickyRoot(),
			this.view?.containerEl,
		].filter(isHtmlElement);

		for (const target of targets) {
			setStickyCssProps(target, cssVars);
		}

		const previewRoot =
			this.view?.containerEl?.querySelector(".markdown-preview-view") ??
			this.view?.containerEl?.querySelector(".cm-editor") ??
			this.view?.containerEl;
		if (previewRoot) {
			clearStaleInlineTextColors(previewRoot);
		}

		this.applyWindowOpacity();
	}

	private async persistColors(file: TFile | null) {
		if (!this.settingService.settings.rememberBgColors || !file) return;
		await this.markdownService.updateFrontmatterAsync(file, {
			[this.color.property]: this.color.value,
			[TEXT_COLOR_PROPERTY]: this.textColor,
			[OPACITY_PROPERTY]: String(this.opacity),
		});
	}

	private applySyncDefaultColors(
		explicitColor: IBackgroundColor | null = null,
		explicitTextColor: string | null = null,
		explicitOpacity: number | null = null,
	) {
		const settings = this.settingService.settings;
		if (explicitColor) {
			this.color = explicitColor;
		} else {
			const defaultColor = settings.bgColors.find((c) => c.isDefault);
			const cycledColor = getDefaultColorForNewNote(settings.bgColors, this.id);
			const lastUsed = StickyNoteLeaf.lastNoteColor ?? defaultColor;
			const colorToUse = settings.useRecentBgColor ? lastUsed : (cycledColor ?? defaultColor);
			if (colorToUse) this.color = colorToUse;
		}

		if (explicitTextColor) {
			this.textColor = explicitTextColor;
		} else {
			this.textColor = StickyNoteLeaf.lastTextColor ?? settings.defaultTextColor;
		}

		if (explicitOpacity !== null) {
			this.opacity = Math.min(1, Math.max(0.3, explicitOpacity));
		} else {
			this.opacity = settings.defaultOpacity;
		}
	}

	private async setDefaultColors(
		file: TFile | null = null,
		explicitColor: IBackgroundColor | null = null,
		explicitTextColor: string | null = null,
		explicitOpacity: number | null = null,
	) {
		if (explicitColor) {
			this.updateBackgroundColor(explicitColor, file);
		} else {
			await this.resolveDefaultBackgroundColor(file);
		}

		if (explicitTextColor) {
			this.updateTextColor(explicitTextColor, file);
		} else {
			await this.resolveDefaultTextColor(file);
		}

		if (explicitOpacity !== null) {
			this.updateOpacity(explicitOpacity, file);
		} else {
			await this.resolveDefaultOpacity(file);
		}
	}

	private async resolveDefaultBackgroundColor(file: TFile | null) {
		const rememberColors = this.settingService.settings.rememberBgColors;
		const useRecentColor = this.settingService.settings.useRecentBgColor;
		const defaultColor = this.settingService.settings.bgColors.find(
			(bg) => bg.isDefault,
		);
		const rotatedColor = getDefaultColorForNewNote(
			this.settingService.settings.bgColors,
			this.id,
		);
		const recentColor = StickyNoteLeaf.lastNoteColor ?? defaultColor;
		let currentColor = useRecentColor
			? recentColor
			: (rotatedColor ?? defaultColor);

		if (rememberColors && file) {
			const frontMatter = await this.markdownService.getFrontmatterAsync(file);
			for (const [property, value] of Object.entries(frontMatter)) {
				currentColor =
					this.settingService.settings.bgColors.find(
						(bg) => bg.property === property && bg.value === value,
					) ?? currentColor;
			}
		}

		if (!currentColor) {
			LoggingService.warn("No default color found ...");
			return;
		}

		this.updateBackgroundColor(currentColor, file);
	}

	private async resolveDefaultTextColor(file: TFile | null) {
		let currentTextColor =
			StickyNoteLeaf.lastTextColor ??
			this.settingService.settings.defaultTextColor;

		if (this.settingService.settings.rememberBgColors && file) {
			const frontMatter = await this.markdownService.getFrontmatterAsync(file);
			const savedTextColor = frontMatter[TEXT_COLOR_PROPERTY];
			if (savedTextColor) currentTextColor = savedTextColor;
		}

		this.updateTextColor(currentTextColor, file);
	}

	private async resolveDefaultOpacity(file: TFile | null) {
		let currentOpacity = this.settingService.settings.defaultOpacity;

		if (this.settingService.settings.rememberBgColors && file) {
			const frontMatter = await this.markdownService.getFrontmatterAsync(file);
			const savedOpacity = Number(frontMatter[OPACITY_PROPERTY]);
			if (!Number.isNaN(savedOpacity) && savedOpacity > 0) {
				currentOpacity = savedOpacity;
			}
		}

		this.updateOpacity(currentOpacity, file);
	}

	private pinAction(pin?: boolean) {
		if (!this.mainWindow) return;
		const isPinned = pin ?? !this.mainWindow.isAlwaysOnTop();
		this.mainWindow.setAlwaysOnTop(
			isPinned,
			isPinned ? "screen-saver" : "normal",
		);
		if (isPinned) {
			this.mainWindow.moveTop();
		}
		StickyNoteLeaf.lastNotePinnedState = isPinned;
		this.updatePinButton();
	}

	async setViewMode(mode: MarkdownViewModeType) {
		this.viewModeAction(mode);
		await new Promise((resolve) => window.setTimeout(resolve, 50));
	}

	private viewModeAction(mode?: MarkdownViewModeType) {
		if (!(this.view instanceof MarkdownView)) return;

		const newMode =
			mode ?? (this.view.getMode() === "source" ? "preview" : "source");
		void this.view.setState({ mode: newMode }, { history: false });
		window.setTimeout(() => {
			this.applyNoteAppearance();
			this.refreshStickyChrome();
			this.refreshNoteTitle();
			this.updateEditButton();
		}, 50);
	}
}
