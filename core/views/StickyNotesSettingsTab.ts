import {
	App,
	PluginSettingTab,
	Setting,
	type SettingDefinitionItem,
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

	constructor(
		app: App,
		plugin: StickyNotesPlugin,
		settingService: SettingService,
	) {
		super(app, plugin);
		this.settingService = settingService;
	}

	private get settings() {
		return this.settingService.settings as IPluginSettings;
	}

	getControlValue(key: string): unknown {
		switch (key) {
			case "defaultOpacityPercent":
				return Math.round(this.settings.defaultOpacity * 100);
			case "resizable":
				return (
					this.settings.resizable ||
					this.settings.sizeOption === SizeOptions.REMEMBER_LAST
				);
			default:
				return this.settings[key as keyof IPluginSettings];
		}
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		switch (key) {
			case "defaultOpacityPercent":
				await this.settingService.updateSettings({
					defaultOpacity: (value as number) / 100,
				});
				break;
			case "sizeOption": {
				const sizeOption = value as SizeOptions;
				if (sizeOption === SizeOptions.DEFAULT) {
					await this.settingService.updateWindowDimensions(
						DEFAULT_WIDTH,
						DEFAULT_HEIGHT,
					);
				} else if (sizeOption === SizeOptions.REMEMBER_LAST) {
					await this.settingService.updateSettings({ resizable: true });
				}
				await this.settingService.updateSettings({ sizeOption });
				break;
			}
			case "newStickyNotePath":
				await this.settingService.updateSettings({
					newStickyNotePath: String(value).trim(),
				});
				break;
			case "rememberBgColors":
				await this.settingService.updateSettings({
					rememberBgColors: value as boolean,
				});
				// Background rows gain/lose the frontmatter-key input.
				this.update();
				return;
			default:
				await this.settingService.updateSettings({
					[key]: value,
				} as Partial<IPluginSettings>);
		}
		this.refreshDomState();
	}

	private applySettingsAndRerender(updatedSettings: Partial<IPluginSettings>) {
		void this.settingService.updateSettings(updatedSettings);
		this.update();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		if (!this.settingService.settings) {
			return [{ name: "Failed to load settings." }];
		}

		return [
			{
				type: "group",
				heading: "Notes & workspace",
				items: [
					{
						name: "New sticky note folder",
						desc: "Vault folder used when you create a sticky note from the ribbon or command palette. Leave empty for the vault root.",
						control: {
							type: "folder",
							key: "newStickyNotePath",
							placeholder: "Example: Sticky Notes",
							includeRoot: true,
						},
					},
					{
						name: "Restore open sticky notes",
						desc: "When Obsidian starts, reopen sticky notes with their file, position, size, colors, and transparency.",
						control: { type: "toggle", key: "saveWorkspace" },
					},
					{
						name: "Show in taskbar",
						desc: "Show sticky note windows in the Windows taskbar.",
						control: { type: "toggle", key: "taskbarVisibility" },
					},
				],
			},
			{
				type: "group",
				heading: "Window",
				items: [
					{
						name: "Default pin mode",
						desc: "Whether new sticky notes start pinned above other windows. You can still toggle pin on each note.",
						control: {
							type: "dropdown",
							key: "pinOption",
							options: PIN_LABELS,
						},
					},
					{
						name: "Default window size",
						desc: "How large new sticky notes should open. Custom size uses the width×height field.",
						control: {
							type: "dropdown",
							key: "sizeOption",
							options: SIZE_LABELS,
						},
					},
					{
						name: "Custom size",
						desc: "Window size as width×height in pixels.",
						visible: () =>
							this.settings.sizeOption === SizeOptions.CUSTOM,
						control: {
							type: "text",
							key: "dimensions",
							placeholder: `${DEFAULT_WIDTH}x${DEFAULT_HEIGHT}`,
							validate: (value) =>
								/^\d+x\d+$/.test(value)
									? undefined
									: `Use the widthxheight format, e.g. ${DEFAULT_WIDTH}x${DEFAULT_HEIGHT}.`,
						},
					},
					{
						name: "Resizable window",
						desc: "Allow resizing sticky note windows. Always on when size mode is “Remember last size”.",
						control: {
							type: "toggle",
							key: "resizable",
							disabled: () =>
								this.settings.sizeOption === SizeOptions.REMEMBER_LAST,
						},
					},
				],
			},
			{
				type: "group",
				heading: "Appearance",
				items: [
					{
						name: "Save appearance to note",
						desc: "Store background, text color, and transparency in each note’s frontmatter so they reopen with the same look.",
						control: { type: "toggle", key: "rememberBgColors" },
					},
					{
						name: "Reuse last background",
						desc: "New sticky notes open with the background color you used most recently. When off, backgrounds cycle through the palette.",
						control: { type: "toggle", key: "useRecentBgColor" },
					},
					{
						name: "Default transparency",
						desc: "Starting opacity for new sticky notes (30%–100%). Same control as the Transparency slider on the note.",
						control: {
							type: "slider",
							key: "defaultOpacityPercent",
							min: 30,
							max: 100,
							step: 5,
							displayFormat: (value) => `${value}%`,
						},
					},
				],
			},
			{
				name: "",
				desc: "Palette shown in the note’s color picker (Background row). The toggle marks the default when “Reuse last background” is off.",
				searchable: false,
			},
			this.buildBackgroundPaletteList(),
			{
				name: "",
				desc: "Palette shown in the note’s color picker (Text row). The toggle marks the default text color for new notes.",
				searchable: false,
			},
			this.buildTextPaletteList(),
		];
	}

	private buildBackgroundPaletteList(): SettingDefinitionItem {
		return {
			type: "list",
			heading: "Background colors",
			cls: "bg-color-settings",
			extraButtons: [
				(button) =>
					button
						.setIcon("rotate-ccw")
						.setTooltip("Reset to defaults")
						.onClick(() =>
							this.applySettingsAndRerender({
								bgColors: structuredClone(DEFAULT_COLORS),
							}),
						),
			],
			addItem: {
				name: "Add color",
				action: () => {
					const randomColor = getRandomHexColor();
					this.settings.bgColors.push({
						lightColor: randomColor,
						darkColor: randomColor,
						isDefault: false,
						property: DEFAULT_COLOR_PROPERTY,
						value: `Color ${this.settings.bgColors.length + 1}`,
					});
					this.applySettingsAndRerender({});
				},
			},
			onDelete: (index) => {
				const bg = this.settings.bgColors[index];
				if (!bg || bg.isDefault) return;
				this.settings.bgColors.remove(bg);
				this.applySettingsAndRerender({});
			},
			items: this.settings.bgColors.map((bg) => ({
				name: "",
				searchable: false,
				render: (setting: Setting) => this.renderBackgroundColorRow(setting, bg),
			})),
		};
	}

	private renderBackgroundColorRow(setting: Setting, bg: IBackgroundColor) {
		setting.setClass("single-color-setting").addColorPicker((c) =>
			c.setValue(bg.lightColor).onChange((v) => {
				bg.lightColor = v;
				bg.darkColor = v;
				void this.settingService.updateSettings({});
			}),
		);

		if (this.settings.rememberBgColors) {
			setting.addText((propertyKey) =>
				propertyKey
					.setPlaceholder("frontmatter key")
					.setValue(bg.property)
					.onChange((v) => {
						bg.property = v;
						void this.settingService.updateSettings({});
					}),
			);
		}

		setting
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
						this.applySettingsAndRerender({});
					})
					.setDisabled(bg.isDefault),
			);
	}

	private buildTextPaletteList(): SettingDefinitionItem {
		return {
			type: "list",
			heading: "Text colors",
			cls: "bg-color-settings",
			extraButtons: [
				(button) =>
					button
						.setIcon("rotate-ccw")
						.setTooltip("Reset to defaults")
						.onClick(() =>
							this.applySettingsAndRerender({
								textColors: structuredClone(DEFAULT_TEXT_COLORS),
								defaultTextColor: DEFAULT_SETTINGS.defaultTextColor,
							}),
						),
			],
			addItem: {
				name: "Add color",
				action: () => {
					this.settings.textColors.push({
						name: `Color ${this.settings.textColors.length + 1}`,
						color: getRandomHexColor(),
					});
					this.applySettingsAndRerender({});
				},
			},
			onDelete: (index) => {
				const option = this.settings.textColors[index];
				if (!option || this.settings.textColors.length <= 1) return;
				if (option.color === this.settings.defaultTextColor) return;
				this.settings.textColors.remove(option);
				this.applySettingsAndRerender({});
			},
			items: this.settings.textColors.map((option) => ({
				name: "",
				searchable: false,
				render: (setting) => this.renderTextColorRow(setting, option),
			})),
		};
	}

	private renderTextColorRow(setting: Setting, option: ITextColorOption) {
		const isDefault = option.color === this.settings.defaultTextColor;

		setting
			.setClass("single-color-setting")
			.addColorPicker((c) =>
				c.setValue(option.color).onChange((v) => {
					const wasDefault =
						option.color === this.settings.defaultTextColor;
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
						this.applySettingsAndRerender({
							defaultTextColor: option.color,
						});
					})
					.setDisabled(isDefault),
			);
	}
}
