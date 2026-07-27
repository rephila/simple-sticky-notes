import {
	App,
	PluginSettingTab,
	Setting,
	TextComponent,
	ToggleComponent,
	ValueComponent,
} from "obsidian";
import { SettingService } from "core/services/SettingService";
import { SizeOptions } from "core/enums/sizeOptionEnum";
import type StickyNotesPlugin from "main";
import { IBackgroundColor } from "core/interfaces/BackgroundColorInterface";
import {
	DEFAULT_COLOR_PROPERTY,
	DEFAULT_COLORS,
} from "core/constants/defaultColorSettings";
import {
	DEFAULT_SETTINGS,
	DEFAULT_HEIGHT,
	DEFAULT_WIDTH,
	IPluginSettings,
} from "core/interfaces/PluginSettingsInterface";
import {
	DEFAULT_TEXT_COLORS,
	type ITextColorOption,
} from "core/constants/defaultTextColorSettings";
import { getRandomHexColor } from "core/utils/colorUtils";
import { PinOptions } from "core/enums/pinOptionEnum";
import { FolderSuggest } from "./FolderSuggestInput";

const SIZE_LABELS: Record<SizeOptions, string> = {
	[SizeOptions.DEFAULT]: `Fixed preset (${DEFAULT_WIDTH}×${DEFAULT_HEIGHT})`,
	[SizeOptions.CUSTOM]: "Custom size",
	[SizeOptions.REMEMBER_LAST]: "Remember last size",
};

const PIN_LABELS: Record<PinOptions, string> = {
	[PinOptions.ALWAYS]: "Always on top",
	[PinOptions.NEVER]: "Never pin",
	[PinOptions.REMEMBER_LAST]: "Remember last (this session)",
};

export class StickyNotesSettingsTab extends PluginSettingTab {
	settingService: SettingService;
	dimensionsSettingComponent: TextComponent | undefined;
	resizableSettingComponent: ToggleComponent | undefined;

	constructor(
		app: App,
		plugin: StickyNotesPlugin,
		settingService: SettingService,
	) {
		super(app, plugin);
		this.settingService = settingService;
	}

	display(): void {
		this.containerEl.empty();

		if (!this.settingService.settings) {
			this.containerEl.createEl("p", {
				text: "Failed to load settings.",
			});
			return;
		}

		this.addNotesWorkspaceSection();
		this.addWindowSection();
		this.addAppearanceSection();
	}

	getSettingDefinitions() {
		return [];
	}

	rerenderSettings() {
		this.display();
	}

	updateAndRerenderSettings(updatedSettings: Partial<IPluginSettings>) {
		void this.settingService.updateSettings(updatedSettings);
		this.rerenderSettings();
	}

	private get settings() {
		return this.settingService.settings as IPluginSettings;
	}

	/* ── Notes & workspace ─────────────────────────────────────── */

	addNotesWorkspaceSection() {
		new Setting(this.containerEl).setName("Notes & workspace").setHeading();

		new Setting(this.containerEl)
			.setName("New sticky note folder")
			.setDesc(
				"Vault folder used when you create a sticky note from the ribbon or command palette. Leave empty for the vault root.",
			)
			.addText((text) => {
				text
					.setPlaceholder("Example: Sticky Notes")
					.setValue(this.settings.newStickyNotePath)
					.onChange(async (value) => {
						await this.settingService.updateSettings({
							newStickyNotePath: value.trim(),
						});
					});

				new FolderSuggest(this.app, text.inputEl, (folder) => {
					void this.settingService.updateSettings({
						newStickyNotePath: folder.path,
					});
					text.setValue(folder.path);
				});
			});

		new Setting(this.containerEl)
			.setName("Restore open sticky notes")
			.setDesc(
				"When Obsidian starts, reopen sticky notes with their file, position, size, colors, and transparency.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.settings.saveWorkspace)
					.onChange((value) => {
						void this.settingService.updateSettings({
							saveWorkspace: value,
						});
					}),
			);

		new Setting(this.containerEl)
			.setName("Show in taskbar")
			.setDesc("Show sticky note windows in the Windows taskbar.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.settings.taskbarVisibility)
					.onChange((value) => {
						void this.settingService.updateSettings({
							taskbarVisibility: value,
						});
					}),
			);
	}

	/* ── Window ────────────────────────────────────────────────── */

	addWindowSection() {
		new Setting(this.containerEl).setName("Window").setHeading();

		new Setting(this.containerEl)
			.setName("Default pin mode")
			.setDesc(
				"Whether new sticky notes start pinned above other windows. You can still toggle pin on each note.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(
						Object.fromEntries(
							Object.values(PinOptions).map((value) => [
								value,
								PIN_LABELS[value],
							]),
						),
					)
					.setValue(this.settings.pinOption)
					.onChange((value) => {
						void this.settingService.updateSettings({
							pinOption: value as PinOptions,
						});
					}),
			);

		new Setting(this.containerEl)
			.setName("Default window size")
			.setDesc(
				"How large new sticky notes should open. Custom size uses the width×height field.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(
						Object.fromEntries(
							Object.values(SizeOptions).map((value) => [
								value,
								SIZE_LABELS[value],
							]),
						),
					)
					.setValue(this.settings.sizeOption)
					.onChange((value) => {
						const sizeOption = value as SizeOptions;
						if (sizeOption === SizeOptions.DEFAULT) {
							void this.settingService.updateWindowDimensions(
								DEFAULT_WIDTH,
								DEFAULT_HEIGHT,
							);
						} else if (sizeOption === SizeOptions.REMEMBER_LAST) {
							void this.settingService.updateSettings({
								resizable: true,
							});
						}
						this.updateAndRerenderSettings({ sizeOption });
					}),
			)
			.addText((text) => {
				this.dimensionsSettingComponent = text
					.setPlaceholder(`${DEFAULT_WIDTH}x${DEFAULT_HEIGHT}`)
					.setValue(this.settings.dimensions)
					.onChange(async (value) => {
						if (!value.match(/^\d+x\d+$/)) return;
						await this.settingService.updateSettings({
							dimensions: value,
						});
					});

				this.disabledDimensionSetting(
					this.settings.sizeOption !== SizeOptions.CUSTOM,
				);
				return this.dimensionsSettingComponent;
			});

		new Setting(this.containerEl)
			.setName("Resizable window")
			.setDesc(
				"Allow resizing sticky note windows. Always on when size mode is “Remember last size”.",
			)
			.addToggle((toggle) => {
				this.resizableSettingComponent = toggle
					.setValue(
						this.settings.resizable ||
							this.settings.sizeOption === SizeOptions.REMEMBER_LAST,
					)
					.onChange(async (value) => {
						await this.settingService.updateSettings({
							resizable: value,
						});
					});

				this.disabledResizableSetting(
					this.settings.sizeOption === SizeOptions.REMEMBER_LAST,
				);
				return this.resizableSettingComponent;
			});
	}

	/* ── Appearance (matches on-note color picker) ─────────────── */

	addAppearanceSection() {
		new Setting(this.containerEl).setName("Appearance").setHeading();

		new Setting(this.containerEl)
			.setName("Save appearance to note")
			.setDesc(
				"Store background, text color, and transparency in each note’s frontmatter so they reopen with the same look.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.settings.rememberBgColors)
					.onChange((value) => {
						this.updateAndRerenderSettings({
							rememberBgColors: value,
						});
					}),
			);

		new Setting(this.containerEl)
			.setName("Reuse last background")
			.setDesc(
				"New sticky notes open with the background color you used most recently. When off, backgrounds cycle through the palette.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.settings.useRecentBgColor)
					.onChange((value) => {
						void this.settingService.updateSettings({
							useRecentBgColor: value,
						});
					}),
			);

		new Setting(this.containerEl)
			.setName("Default transparency")
			.setDesc(
				"Starting opacity for new sticky notes (30%–100%). Same control as the Transparency slider on the note.",
			)
			.addSlider((slider) =>
				slider
					.setLimits(30, 100, 5)
					.setValue(Math.round(this.settings.defaultOpacity * 100))
					.onChange((value) => {
						void this.settingService.updateSettings({
							defaultOpacity: value / 100,
						});
					}),
			);

		this.addBackgroundPalette();
		this.addTextPalette();
	}

	addBackgroundPalette() {
		new Setting(this.containerEl)
			.setName("Background colors")
			.setDesc(
				"Palette shown in the note’s color picker (Background row). The toggle marks the default when “Reuse last background” is off.",
			)
			.addExtraButton((b) =>
				b.setIcon("rotate-ccw").setTooltip("Reset to defaults").onClick(() =>
					this.updateAndRerenderSettings({
						bgColors: structuredClone(DEFAULT_COLORS),
					}),
				),
			)
			.addExtraButton((b) =>
				b.setIcon("plus").setTooltip("Add color").onClick(() => {
					const randomColor = getRandomHexColor();
					this.settings.bgColors.push({
						lightColor: randomColor,
						darkColor: randomColor,
						isDefault: false,
						property: DEFAULT_COLOR_PROPERTY,
						value: `Color ${this.settings.bgColors.length + 1}`,
					});
					this.updateAndRerenderSettings({});
				}),
			);

		const colorContainer = new Setting(this.containerEl).setClass(
			"bg-color-settings",
		);
		const settingsContainer = colorContainer.settingEl.createDiv();
		this.settings.bgColors.forEach((bg) =>
			this.addBackgroundColorRow(settingsContainer, bg),
		);
	}

	addBackgroundColorRow(ele: HTMLElement, bg: IBackgroundColor) {
		const colorSetting = new Setting(ele)
			.setClass("single-color-setting")
			.addColorPicker((c) =>
				c.setValue(bg.lightColor).onChange((v) => {
					bg.lightColor = v;
					bg.darkColor = v;
					void this.settingService.updateSettings({});
				}),
			);

		if (this.settings.rememberBgColors) {
			colorSetting.addText((propertyKey) =>
				propertyKey
					.setPlaceholder("frontmatter key")
					.setValue(bg.property)
					.onChange((v) => {
						bg.property = v;
						void this.settingService.updateSettings({});
					}),
			);
		}

		colorSetting
			.addText((valueText) =>
				valueText
					.setPlaceholder(
						this.settings.rememberBgColors
							? "frontmatter value"
							: "color name",
					)
					.setValue(bg.value)
					.onChange((v) => {
						bg.value = v;
						void this.settingService.updateSettings({});
					}),
			)
			.addToggle((defaultToggle) =>
				defaultToggle
					.setTooltip("Default background")
					.setValue(bg.isDefault)
					.onChange(() => {
						this.settings.bgColors.forEach((b) => (b.isDefault = false));
						bg.isDefault = true;
						this.updateAndRerenderSettings({});
					})
					.setDisabled(bg.isDefault),
			)
			.addExtraButton((deleteButton) =>
				deleteButton
					.setIcon("trash")
					.setTooltip("Remove")
					.onClick(() => {
						this.settings.bgColors.remove(bg);
						this.updateAndRerenderSettings({});
					})
					.setDisabled(bg.isDefault),
			);
	}

	addTextPalette() {
		new Setting(this.containerEl)
			.setName("Text colors")
			.setDesc(
				"Palette shown in the note’s color picker (Text row). The toggle marks the default text color for new notes.",
			)
			.addExtraButton((b) =>
				b.setIcon("rotate-ccw").setTooltip("Reset to defaults").onClick(() =>
					this.updateAndRerenderSettings({
						textColors: structuredClone(DEFAULT_TEXT_COLORS),
						defaultTextColor: DEFAULT_SETTINGS.defaultTextColor,
					}),
				),
			)
			.addExtraButton((b) =>
				b.setIcon("plus").setTooltip("Add color").onClick(() => {
					this.settings.textColors.push({
						name: `Color ${this.settings.textColors.length + 1}`,
						color: getRandomHexColor(),
					});
					this.updateAndRerenderSettings({});
				}),
			);

		const colorContainer = new Setting(this.containerEl).setClass(
			"bg-color-settings",
		);
		const settingsContainer = colorContainer.settingEl.createDiv();
		this.settings.textColors.forEach((textColor) =>
			this.addTextColorRow(settingsContainer, textColor),
		);
	}

	addTextColorRow(ele: HTMLElement, option: ITextColorOption) {
		const isDefault = option.color === this.settings.defaultTextColor;

		new Setting(ele)
			.setClass("single-color-setting")
			.addColorPicker((c) =>
				c.setValue(option.color).onChange((v) => {
					const wasDefault = option.color === this.settings.defaultTextColor;
					option.color = v;
					void this.settingService.updateSettings(
						wasDefault ? { defaultTextColor: v } : {},
					);
				}),
			)
			.addText((nameText) =>
				nameText
					.setPlaceholder("color name")
					.setValue(option.name)
					.onChange((v) => {
						option.name = v;
						void this.settingService.updateSettings({});
					}),
			)
			.addToggle((defaultToggle) =>
				defaultToggle
					.setTooltip("Default text color")
					.setValue(isDefault)
					.onChange(() => {
						this.updateAndRerenderSettings({
							defaultTextColor: option.color,
						});
					})
					.setDisabled(isDefault),
			)
			.addExtraButton((deleteButton) =>
				deleteButton
					.setIcon("trash")
					.setTooltip("Remove")
					.onClick(() => {
						if (this.settings.textColors.length <= 1) return;
						this.settings.textColors.remove(option);
						const nextDefault =
							this.settings.defaultTextColor === option.color
								? this.settings.textColors[0]?.color
								: this.settings.defaultTextColor;
						this.updateAndRerenderSettings({
							defaultTextColor:
								nextDefault ?? DEFAULT_SETTINGS.defaultTextColor,
						});
					})
					.setDisabled(isDefault || this.settings.textColors.length <= 1),
			);
	}

	disabledDimensionSetting(value: boolean) {
		if (!this.dimensionsSettingComponent) return;
		this.disableSettingComponent(
			this.dimensionsSettingComponent,
			this.dimensionsSettingComponent.inputEl,
			value,
		);
	}

	disabledResizableSetting(value: boolean) {
		if (!this.resizableSettingComponent) return;
		this.disableSettingComponent(
			this.resizableSettingComponent,
			this.resizableSettingComponent.toggleEl,
			value,
		);
	}

	disableSettingComponent<T>(
		settingComponent: ValueComponent<T>,
		inputEl: HTMLElement,
		value: boolean,
	): ValueComponent<T> {
		settingComponent.setDisabled(value);
		if (value) {
			inputEl.addClass("disabled-setting");
		} else {
			inputEl.removeClass("disabled-setting");
		}
		return settingComponent;
	}
}
