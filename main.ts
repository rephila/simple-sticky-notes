import {
	Menu,
	MarkdownView,
	Plugin,
	TFile,
	WorkspaceLeaf,
	WorkspaceWindow,
	setTooltip,
} from "obsidian";
import { IPluginSettings } from "core/interfaces/PluginSettingsInterface";
import { type IBackgroundColor } from "core/interfaces/BackgroundColorInterface";
import { LoggingService } from "core/services/LogginService";
import { SettingService } from "core/services/SettingService";
import { StickyNoteLeaf } from "core/views/StickyNoteLeaf";
import { StickyNotesSettingsTab } from "core/views/StickyNotesSettingsTab";
import { MarkdownService } from "core/services/MarkdownService";
import {
	findPopoutLeafForFile,
	isStickyNoteAlreadyOpen as isFileAlreadyOpen,
} from "core/utils/restoreLogic";
import type { IStickyNoteBounds } from "core/interfaces/WorkspaceStickyNoteInterface";

export default class StickyNotesPlugin extends Plugin {
	markdownService!: MarkdownService;
	settingsService!: SettingService;
	globalSettings!: IPluginSettings;
	private restoreInProgress = false;
	private restorePass = 0;

	async onload() {
		LoggingService.disable();
		LoggingService.info("Sticky Notes : plugin loading....");
		this.addServices();
		void this.addSettings();
		this.addStickyNoteRibbonAction();
		this.addStickyNoteCommand();
		this.addStickyNoteMenuOptions();
		this.addLeafChangeListener();
		this.addPopoutClosedListener();
	}

	onunload() {
		LoggingService.info("Stiky Notes : plugin UN-loading ....");
		void this.settingsService.updateWorkspaceNotes(StickyNoteLeaf.leafsList);
	}

	private destroyAllStickyNotes() {
		StickyNoteLeaf.leafsList.forEach((l) => l.leaf.detach());
		StickyNoteLeaf.leafsList.clear();
		void this.settingsService.updateWorkspaceNotes(StickyNoteLeaf.leafsList);
	}

	private addStickyNoteCommand() {
		this.addCommand({
			id: "open-sticky-note-view",
			name: "Open note",
			icon: "sticky-note",
			callback: () => void this.openStickyNotePopup(),
		});
		this.addCommand({
			id: "create-sticky-note",
			name: "Create note",
			icon: "sticky-note-plus",
			callback: () => void this.createNewStickyNote(),
		});
		this.addCommand({
			id: "destroy-sticky-note-views",
			name: "Close all",
			icon: "copy-x",
			callback: () => this.destroyAllStickyNotes(),
		});
	}

	private addStickyNoteRibbonAction() {
		const stickyNoteRibbon = this.addRibbonIcon(
			"sticky-note",
			"New sticky note",
			() => void this.createNewStickyNote(),
		);

		setTooltip(stickyNoteRibbon, "New sticky note");
	}

	private addStickyNoteMenuOptions() {
		const fileMenuEvent = this.app.workspace.on(
			"file-menu",
			(menu, file) =>
				file instanceof TFile && this.addStickyNoteMenuItem(menu, file),
		);
		const editorMenuEvent = this.app.workspace.on(
			"editor-menu",
			(menu, _editor, view) =>
				this.addStickyNoteMenuItem(menu, view.file),
		);
		this.registerEvent(fileMenuEvent);
		this.registerEvent(editorMenuEvent);
	}

	private addStickyNoteMenuItem(menu: Menu, file: TFile | null) {
		menu.addItem((item) => {
			item.setTitle("Open as sticky note")
				.setIcon("sticky-note")
				.onClick(() => void this.openStickyNotePopup(file));
		});
	}

	private addServices() {
		this.markdownService = new MarkdownService(this);
	}

	private async addSettings() {
		this.settingsService = new SettingService(this);
		await this.settingsService.initSettings();
		this.addSettingTab(
			new StickyNotesSettingsTab(this.app, this, this.settingsService),
		);
		this.addOnLayoutReadListener();
	}

	private addPopoutClosedListener() {
		const closeEvent = this.app.workspace.on(
			"window-close",
			(win: WorkspaceWindow, _window: Window) => {
				const noteId = win.doc.documentElement.getAttribute("note-id");
				if (noteId) {
					StickyNoteLeaf.leafsList.delete(noteId);
				}
			},
		);
		this.registerEvent(closeEvent);
	}

	private addOnLayoutReadListener() {
		this.app.workspace.onLayoutReady(async () => {
			await this.restoreStickyNotes(300);
			window.setTimeout(() => void this.restoreStickyNotes(0), 2000);
			window.setTimeout(() => void this.restoreStickyNotes(0), 5000);
			window.setTimeout(() => void this.restoreStickyNotes(0), 10000);
		});

		let layoutRestoreTimer: number | undefined;
		const layoutEvent = this.app.workspace.on("layout-change", () => {
			if (layoutRestoreTimer) {
				window.clearTimeout(layoutRestoreTimer);
			}
			layoutRestoreTimer = window.setTimeout(() => {
				void this.restoreStickyNotes(0);
			}, 750);
		});
		this.registerEvent(layoutEvent);
	}

	private getRegisteredNoteIds(): Set<string> {
		return new Set(StickyNoteLeaf.leafsList.keys());
	}

	private async restoreStickyNotes(initialDelayMs = 0) {
		if (!this.settingsService.settings.saveWorkspace) return;

		const savedWorkspaceNotes =
			this.settingsService.settings.workspaceNotes;
		if (!savedWorkspaceNotes.length) return;

		if (this.restoreInProgress) return;

		this.restoreInProgress = true;
		this.restorePass++;

		try {
			if (initialDelayMs > 0) {
				await new Promise((resolve) =>
					window.setTimeout(resolve, initialDelayMs),
				);
			}

			for (const savedNote of savedWorkspaceNotes) {
				if (this.isStickyNoteLive(savedNote.filePath)) continue;

				const file = savedNote.filePath
					? this.app.vault.getAbstractFileByPath(savedNote.filePath)
					: null;
				let noteFile = file instanceof TFile ? file : null;
				if (!noteFile) {
					LoggingService.warn(
						`Skipping restore for missing file ${savedNote.filePath ?? "unknown"}`,
					);
					continue;
				}

				const existingPopout = await this.findPopoutLeafForFileWithRetry(
					noteFile.path,
					this.restorePass === 1 ? 12 : 6,
				);

				if (existingPopout) {
					await this.attachStickyNoteToLeaf(
						existingPopout,
						noteFile,
						savedNote.color,
						false,
						savedNote.textColor ?? null,
						savedNote.opacity ?? null,
						savedNote.bounds ?? null,
						true,
					);
					await new Promise((resolve) => window.setTimeout(resolve, 250));
					continue;
				}

				await this.openStickyNotePopup(
					noteFile,
					savedNote.color,
					!savedNote.bounds,
					savedNote.textColor ?? null,
					savedNote.opacity ?? null,
					savedNote.bounds ?? null,
					true,
				);
				await new Promise((resolve) => window.setTimeout(resolve, 250));
			}
		} finally {
			this.restoreInProgress = false;
		}
	}

	private findPopoutLeafForFile(filePath: string): WorkspaceLeaf | null {
		const leaves: WorkspaceLeaf[] = [];
		this.app.workspace.iterateAllLeaves((leaf) => leaves.push(leaf));

		return findPopoutLeafForFile(
			leaves,
			filePath,
			this.app.workspace.rootSplit,
			this.app.workspace.leftSplit,
			this.app.workspace.rightSplit,
			(leaf) =>
				leaf.view instanceof MarkdownView ? leaf.view.file?.path : undefined,
			(leaf) =>
				leaf.getContainer()?.doc.documentElement.getAttribute("note-id"),
			this.getRegisteredNoteIds(),
		);
	}

	private async findPopoutLeafForFileWithRetry(
		filePath: string,
		attempts = 12,
	): Promise<WorkspaceLeaf | null> {
		for (let attempt = 0; attempt < attempts; attempt++) {
			const leaf = this.findPopoutLeafForFile(filePath);
			if (leaf) return leaf;
			await new Promise((resolve) => window.setTimeout(resolve, 150));
		}
		return null;
	}

	private async attachStickyNoteToLeaf(
		popoutLeaf: WorkspaceLeaf,
		file: TFile | null,
		explicitColor: IBackgroundColor | null = null,
		resize = true,
		explicitTextColor: string | null = null,
		explicitOpacity: number | null = null,
		savedBounds: IStickyNoteBounds | null = null,
		isStartupRestore = false,
	) {
		const stickNoteLeaf = new StickyNoteLeaf(
			popoutLeaf,
			this.settingsService,
			this.markdownService,
		);
		await stickNoteLeaf.initStickyNote(
			file,
			explicitColor,
			resize,
			explicitTextColor,
			explicitOpacity,
			savedBounds,
			isStartupRestore,
		);
	}

	private isStickyNoteLive(filePath?: string): boolean {
		if (!filePath) return false;

		const note = StickyNoteLeaf.findByFilePath(filePath);
		if (!note) return false;

		return !!note.mainWindow && !note.mainWindow.isDestroyed();
	}

	private isStickyNoteAlreadyOpen(filePath?: string): boolean {
		const openPaths = Array.from(StickyNoteLeaf.leafsList.values())
			.map((note) => note.activeFile?.path)
			.filter((path): path is string => !!path);
		return isFileAlreadyOpen(openPaths, filePath);
	}

	private addLeafChangeListener() {
		const leafChangeEvent = this.app.workspace.on(
			"active-leaf-change",
			(leaf: WorkspaceLeaf | null) => {
				const noteId = leaf?.getContainer()?.doc.documentElement.getAttribute(
					"note-id",
				);

				if (noteId) {
					const stickyLeaf = StickyNoteLeaf.leafsList.get(noteId);
					stickyLeaf?.initView();
				}
			},
		);
		this.registerEvent(leafChangeEvent);
	}

	private async createNewStickyNote() {
		await this.openStickyNotePopup(null);
	}

	private async ensureNoteFile(file: TFile | null): Promise<TFile | null> {
		if (file) return file;

		const now = new Date();
		const datePart = now.toDateString();
		const timePart = now.toTimeString().split(" ")[0].replace(/:/g, "'");
		const formattedName = `${datePart} ${timePart}`;
		const folder = this.settingsService.settings.newStickyNotePath.trim();
		const notePath = folder
			? `${folder}/${formattedName}.md`
			: `${formattedName}.md`;

		try {
			return await this.markdownService.plugin.app.vault.create(notePath, "");
		} catch {
			LoggingService.warn(`Unable to create sticky note file at ${notePath}`);
			return null;
		}
	}

	private async waitForPopoutReady(
		leaf: WorkspaceLeaf,
		maxAttempts = 80,
	): Promise<void> {
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const doc = leaf.getContainer()?.doc;
			if (
				doc?.querySelector(".app-container .workspace-leaf") &&
				leaf.view?.containerEl?.isConnected
			) {
				return;
			}
			await new Promise((resolve) => window.setTimeout(resolve, 50));
		}

		LoggingService.warn("Popout leaf did not finish loading before sticky init");
	}

	private async openStickyNotePopup(
		file: TFile | null = null,
		explicitColor: IBackgroundColor | null = null,
		resize = true,
		explicitTextColor: string | null = null,
		explicitOpacity: number | null = null,
		savedBounds: IStickyNoteBounds | null = null,
		isStartupRestore = false,
	) {
		LoggingService.info("Opened Sticky Note Popup");
		file = file ?? this.app.workspace.getActiveFile();
		if (file && this.isStickyNoteLive(file.path)) {
			const existingNote = StickyNoteLeaf.findByFilePath(file.path);
			if (existingNote) {
				existingNote.focusStickyWindow();
				return;
			}
		}
		file = await this.ensureNoteFile(file);
		if (isStartupRestore && file) {
			const existingPopout = this.findPopoutLeafForFile(file.path);
			if (existingPopout) {
				await this.attachStickyNoteToLeaf(
					existingPopout,
					file,
					explicitColor,
					resize,
					explicitTextColor,
					explicitOpacity,
					savedBounds,
					true,
				);
				return;
			}
		}
		const [width, height] = this.settingsService.getWindowDimensions();
		const popoutLeaf = this.app.workspace.openPopoutLeaf({
			size: {
				height,
				width,
			},
		});
		await this.waitForPopoutReady(popoutLeaf);
		await this.attachStickyNoteToLeaf(
			popoutLeaf,
			file,
			explicitColor,
			resize,
			explicitTextColor,
			explicitOpacity,
			savedBounds,
			isStartupRestore,
		);
	}
}
