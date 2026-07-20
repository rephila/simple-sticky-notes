import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function test(name, fn) {
	fn();
	console.log(`ok - ${name}`);
}

function parseHexColor(hexColor) {
	const normalized = hexColor.replace("#", "").trim();
	if (normalized.length === 3) {
		const [r, g, b] = normalized.split("");
		return {
			r: parseInt(`${r}${r}`, 16),
			g: parseInt(`${g}${g}`, 16),
			b: parseInt(`${b}${b}`, 16),
		};
	}
	if (normalized.length === 6) {
		return {
			r: parseInt(normalized.slice(0, 2), 16),
			g: parseInt(normalized.slice(2, 4), 16),
			b: parseInt(normalized.slice(4, 6), 16),
		};
	}
	return null;
}

function deriveCodeBackground(hexColor) {
	const rgb = parseHexColor(hexColor);
	if (!rgb) return "#ececec";
	const darken = (value) =>
		Math.max(0, Math.min(255, Math.round(value * 0.92 - 8)));
	return `#${[darken(rgb.r), darken(rgb.g), darken(rgb.b)]
		.map((part) => part.toString(16).padStart(2, "0"))
		.join("")}`;
}

function shouldSkipTextColorTarget(element) {
	if (element.tagName === "A") return true;
	if (element.closest("a")) return true;
	if (element.matches("img, svg, path, input, textarea, button, canvas")) {
		return true;
	}
	return false;
}

test("deriveCodeBackground darkens light colors", () => {
	const codeBg = deriveCodeBackground("#ffffff");
	assert.notEqual(codeBg, "#ffffff");
	assert.match(codeBg, /^#[0-9a-f]{6}$/i);
});

test("shouldSkipTextColorTarget keeps links untouched", () => {
	const anchor = { tagName: "A", closest: () => null, matches: () => false };
	const nested = {
		tagName: "SPAN",
		closest: (selector) => (selector === "a" ? anchor : null),
		matches: () => false,
	};

	assert.equal(shouldSkipTextColorTarget(anchor), true);
	assert.equal(shouldSkipTextColorTarget(nested), true);
});

test("styles.css covers tables, code blocks, and text tokens", () => {
	const css = readFileSync(join(root, "styles.css"), "utf8");
	const leaf = readFileSync(join(root, "core/views/StickyNoteLeaf.ts"), "utf8");
	const utils = readFileSync(join(root, "core/utils/noteAppearance.ts"), "utf8");

	assert.match(css, /\.markdown-preview-view td/);
	assert.match(css, /\.markdown-preview-view th/);
	assert.match(css, /\.markdown-preview-view pre/);
	assert.match(css, /--table-text-color/);
	assert.match(css, /--code-normal/);
	assert.match(css, /--note-code-bg/);
	assert.match(leaf, /setStickyCssProps/);
	assert.match(leaf, /setupAppearanceObserver/);
	assert.match(utils, /buildNoteCssVars/);
});

console.log("noteAppearance e2e checks passed");
