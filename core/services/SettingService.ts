import {
	DEFAULT_SETTINGS,
	type IPluginSettings,
} from "core/interfaces/PluginSettingsInterface";
import { LoggingService } from "./LogginService";
import type StickyNotesPlugin from "main";
import { type StickyNoteLeaf } from "core/views/StickyNoteLeaf";

export class SettingService {
	plugin: StickyNotesPlugin;
	private _settings!: IPluginSettings;

	constructor(plugin: StickyNotesPlugin) {
		this.plugin = plugin;
	}

	get settings(): Readonly<IPluginSettings> {
		return this._settings;
	}

	async initSettings() {
		await this.loadSettings();
	}

	async updateSettings(updatedSettings: Partial<IPluginSettings>) {
		LoggingService.info("Updated settings", updatedSettings);
		this._settings = {
			...this._settings,
			...updatedSettings,
		};
		await this.saveSettings();
	}

	async updateWindowDimensions(width: number, height: number) {
		const newDimensions = `${width}x${height}`;
		await this.updateSettings({
			dimensions: newDimensions,
		});
	}

	async updateWorkspaceNotes(leafsList: Map<string, StickyNoteLeaf>) {
		await this.updateSettings({
			workspaceNotes: Array.from(leafsList.values()).map((sn) => ({
				id: sn.leaf.id,
				noteKey: sn.title,
				color: sn.color,
				textColor: sn.textColor,
				filePath: sn.activeFile?.path,
				opacity: sn.opacity,
				bounds: sn.getWindowBounds(),
			})),
		});
	}

	getWindowDimensions() {
		return this._settings.dimensions.split("x").map(Number);
	}

	private async loadSettings() {
		const data: unknown = await this.plugin.loadData();
		const partial =
			data && typeof data === "object"
				? (data as Partial<IPluginSettings>)
				: {};

		const merged: IPluginSettings = {
			...DEFAULT_SETTINGS,
			...partial,
			bgColors:
				partial.bgColors?.length
					? partial.bgColors
					: structuredClone(DEFAULT_SETTINGS.bgColors),
			textColors:
				partial.textColors?.length
					? partial.textColors
					: structuredClone(DEFAULT_SETTINGS.textColors),
			defaultTextColor:
				partial.defaultTextColor ?? DEFAULT_SETTINGS.defaultTextColor,
			defaultOpacity: this.clampOpacity(
				partial.defaultOpacity ?? DEFAULT_SETTINGS.defaultOpacity,
			),
		};

		this._settings = merged;
		this.plugin.globalSettings = this._settings;
	}

	private clampOpacity(value: number): number {
		if (Number.isNaN(value)) return DEFAULT_SETTINGS.defaultOpacity;
		return Math.min(1, Math.max(0.3, value));
	}

	private async saveSettings() {
		await this.plugin.saveData(this._settings);
	}
}
