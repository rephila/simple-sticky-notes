import { Menu, type MenuItem } from "obsidian";

export interface ColorMenuOption {
	title: string;
	color: string;
}

type ColorMenuItem = MenuItem & { dom: HTMLElement };

export class ColorMenu extends Menu {
	items: ColorMenuItem[] = [];
	private options: ColorMenuOption[];
	private onSelect: (option: ColorMenuOption) => void;

	constructor(
		options: ColorMenuOption[],
		onSelect: (option: ColorMenuOption) => void,
	) {
		super();
		this.options = options;
		this.onSelect = onSelect;
		this.addColorItems();
	}

	private addColorItems() {
		for (const option of this.options) {
			this.addItem((item) =>
				item
					.setTitle(option.title)
					.setIcon("circle")
					.onClick(() => this.onSelect(option)),
			);
		}
	}

	override onload(): void {
		super.onload();
		const menuDom = (this as Menu & { dom?: HTMLElement }).dom;
		menuDom?.addClass("color-menu");
		if (this.items.length === 0) return;

		this.items.forEach((item, index) => {
			const itemEl = item.dom;
			if (!itemEl) return;
			itemEl.addClass("color-menu-item");
			const itemIcon = itemEl.querySelector("svg");
			if (itemIcon) {
				const color = this.options[index].color;
				itemIcon.setCssStyles({ color, fill: color });
			}
		});
	}
}
