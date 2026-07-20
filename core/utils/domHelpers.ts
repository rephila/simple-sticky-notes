/** Minimal DOM options compatible with Obsidian createEl. */
export type StickyDomInfo = {
	cls?: string | string[];
	text?: string;
	title?: string;
	type?: string;
	value?: string;
	attr?: Record<string, string | number | boolean | null>;
};

type CreateElFn = <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	o?: StickyDomInfo | string,
) => HTMLElementTagNameMap[K];

/** Apply CSS custom properties via Obsidian helpers (review-safe). */
export function setStickyCssProps(
	el: HTMLElement,
	props: Record<string, string>,
): void {
	el.setCssProps(props);
}

/** Apply inline styles via Obsidian helpers (review-safe). */
export function setStickyCssStyles(
	el: HTMLElement,
	styles: Partial<CSSStyleDeclaration>,
): void {
	el.setCssStyles(styles);
}

/** Cross-window-safe Document check (popout has a different Document constructor). */
export function isDocumentLike(value: unknown): value is Document {
	return (
		!!value &&
		typeof value === "object" &&
		"nodeType" in value &&
		(value as Node).nodeType === 9 &&
		"body" in value
	);
}

/** Cross-window-safe HTMLElement check. */
export function isHtmlElement(value: unknown): value is HTMLElement {
	if (!value || typeof value !== "object") return false;
	const el = value as HTMLElement & { instanceOf?: (t: unknown) => boolean };
	if (typeof el.instanceOf === "function") {
		try {
			if (el.instanceOf(HTMLElement)) return true;
		} catch {
			/* ignore cross-realm lookup failures */
		}
	}
	return (
		"nodeType" in el &&
		(el as Node).nodeType === 1 &&
		typeof el.tagName === "string"
	);
}

function resolveCreateEl(host: HTMLElement): CreateElFn {
	const fromHost = (
		host as HTMLElement & { createEl?: CreateElFn }
	).createEl;
	if (typeof fromHost === "function") {
		return ((tag, options) => fromHost.call(host, tag, options)) as CreateElFn;
	}

	const view = host.ownerDocument.defaultView as
		| (Window & { createEl?: CreateElFn })
		| null;
	if (view && typeof view.createEl === "function") {
		return view.createEl.bind(view) as CreateElFn;
	}

	const fromGlobal = (
		globalThis as typeof globalThis & { createEl?: CreateElFn }
	).createEl;
	if (typeof fromGlobal === "function") {
		return fromGlobal;
	}

	throw new Error("Obsidian createEl is unavailable");
}

export function createStickyEl<K extends keyof HTMLElementTagNameMap>(
	parent: HTMLElement | Document,
	tag: K,
	options?: StickyDomInfo,
): HTMLElementTagNameMap[K] {
	const host = isDocumentLike(parent) ? parent.body : parent;
	if (!isHtmlElement(host)) {
		throw new Error("createStickyEl host is not an HTMLElement");
	}

	const create = resolveCreateEl(host);
	const el = create(tag, options);
	if (el.parentElement !== host) {
		host.appendChild(el);
	}
	return el;
}
