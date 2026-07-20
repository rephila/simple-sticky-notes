export class Menu {
	addItem(
		callback: (item: {
			setTitle: () => unknown;
			setIcon: () => unknown;
			onClick: () => unknown;
		}) => unknown,
	) {
		callback({
			setTitle: () => ({ setIcon: () => ({ onClick: () => undefined }) }),
			setIcon: () => ({ onClick: () => undefined }),
			onClick: () => undefined,
		});
		return this;
	}

	showAtMouseEvent() {}
}

export const setIcon = () => undefined;
export const setTooltip = () => undefined;

export type DomElementInfo = {
	cls?: string | string[];
	text?: string;
	title?: string;
	attr?: Record<string, string | number | boolean | null>;
};

function applyDomInfo(el: HTMLElement, options?: DomElementInfo) {
	if (!options) return;
	if (options.cls) {
		const classes = Array.isArray(options.cls) ? options.cls : options.cls.split(/\s+/);
		el.classList.add(...classes.filter(Boolean));
	}
	if (options.text !== undefined) el.textContent = options.text;
	if (options.title) el.title = options.title;
	if (options.attr) {
		for (const [key, value] of Object.entries(options.attr)) {
			if (value === null || value === false) continue;
			el.setAttribute(key, String(value));
		}
	}
}

export function createEl<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options?: DomElementInfo,
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	applyDomInfo(el, options);
	return el;
}

(globalThis as typeof globalThis & { createEl?: typeof createEl }).createEl =
	createEl;

if (typeof HTMLElement !== "undefined") {
	const proto = HTMLElement.prototype as HTMLElement & {
		createEl?: (
			tag: string,
			options?: DomElementInfo,
		) => HTMLElement;
		setCssProps?: (props: Record<string, string>) => void;
		setCssStyles?: (styles: Partial<CSSStyleDeclaration>) => void;
		setText?: (value: string) => void;
		empty?: () => void;
	};

	proto.createEl =
		proto.createEl ??
		function (this: HTMLElement, tag: string, options?: DomElementInfo) {
			const child = this.ownerDocument.createElement(tag);
			applyDomInfo(child, options);
			this.appendChild(child);
			return child;
		};

	proto.setCssProps =
		proto.setCssProps ??
		function (this: HTMLElement, props: Record<string, string>) {
			for (const [name, value] of Object.entries(props)) {
				this.style.setProperty(name, value);
			}
		};

	proto.setCssStyles =
		proto.setCssStyles ??
		function (this: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
			Object.assign(this.style, styles);
		};

	proto.setText =
		proto.setText ??
		function (this: HTMLElement, value: string) {
			this.textContent = value;
		};

	proto.empty =
		proto.empty ??
		function (this: HTMLElement) {
			this.replaceChildren();
		};
}
