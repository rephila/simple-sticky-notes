import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NoteColorPicker } from "../../core/menus/NoteColorPicker";
import { DEFAULT_COLORS } from "../../core/constants/defaultColorSettings";
import { DEFAULT_TEXT_COLORS } from "../../core/constants/defaultTextColorSettings";

describe("e2e: color picker", () => {
	it("opens anchored to palette button and applies background/text/opacity", () => {
		const document = window.document;
		document.body.innerHTML = `<button class="color-button">palette</button>`;
		const anchor = document.querySelector(".color-button") as HTMLElement;

		const changes: Array<Partial<{
			backgroundColor: { value: string };
			textColor: string;
			opacity: number;
		}>> = [];
		let state = {
			backgroundColor: DEFAULT_COLORS[0],
			textColor: "#1a1a1a",
			opacity: 1,
		};

		const picker = new NoteColorPicker(
			document,
			() => state,
			(change) => {
				changes.push(change);
				state = { ...state, ...change };
			},
			DEFAULT_COLORS,
			DEFAULT_TEXT_COLORS,
		);

		picker.toggle(anchor);
		expect(document.querySelector(".sticky-note-color-picker")).not.toBeNull();

		const yellowSwatch = Array.from(
			document.querySelectorAll(".sticky-note-color-picker-swatch"),
		).find((swatch) => swatch.getAttribute("title") === "Yellow");
		expect(yellowSwatch).toBeTruthy();
		yellowSwatch?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(changes.some((change) => change.backgroundColor?.value === "Yellow")).toBe(
			true,
		);

		const textTitles = Array.from(
			document.querySelectorAll(".sticky-note-color-picker-title"),
		);
		const textSectionIndex = textTitles.findIndex(
			(title) => title.textContent === "Text",
		);
		const textRow = textTitles[textSectionIndex]?.nextElementSibling;
		const redText = textRow?.querySelector('[title="Red"]');
		redText?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(changes.some((change) => change.textColor === "#b42318")).toBe(true);

		const slider = document.querySelector(
			'.sticky-note-color-picker-opacity input[type="range"]',
		) as HTMLInputElement;
		slider.value = "0.75";
		slider.dispatchEvent(new Event("input", { bubbles: true }));
		expect(changes.some((change) => change.opacity === 0.75)).toBe(true);
	});

	it("repositions when window resizes while open", () => {
		const document = window.document;
		document.body.innerHTML = `<button class="color-button">palette</button>`;
		const anchor = document.querySelector(".color-button") as HTMLElement;
		const picker = new NoteColorPicker(
			document,
			() => ({
				backgroundColor: DEFAULT_COLORS[0],
				textColor: "#1a1a1a",
				opacity: 1,
			}),
			() => undefined,
			DEFAULT_COLORS,
			DEFAULT_TEXT_COLORS,
		);

		picker.toggle(anchor);
		const panel = document.querySelector(
			".sticky-note-color-picker",
		) as HTMLElement;
		const before = panel.style.getPropertyValue("--sticky-picker-left");
		vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
			top: 120,
			left: 200,
			width: 24,
			height: 24,
			bottom: 144,
			right: 224,
			x: 200,
			y: 120,
			toJSON: () => ({}),
		});
		window.dispatchEvent(new Event("resize"));
		expect(panel.style.getPropertyValue("--sticky-picker-left")).not.toBe(before);
		picker.hide();
	});

	it("renders an in-document DOM panel anchored to the palette button", () => {
		const pickerSource = readFileSync(
			join(process.cwd(), "core/menus/NoteColorPicker.ts"),
			"utf8",
		);
		expect(pickerSource).toMatch(/sticky-note-color-picker/);
		expect(pickerSource).toMatch(/positionPanel/);
		expect(pickerSource).toMatch(/getPaletteBudget/);
		expect(pickerSource).toMatch(/limitPaletteItems/);
		expect(pickerSource).not.toMatch(/overlayWindow/);
	});

	it("reduces palette size for narrow sticky notes", async () => {
		const { getPaletteBudget, limitPaletteItems } = await import(
			"../../core/menus/NoteColorPicker"
		);

		expect(getPaletteBudget(300)).toEqual({
			backgroundCount: 5,
			textCount: 6,
			sizeClass: "is-tiny",
		});
		expect(getPaletteBudget(400).sizeClass).toBe("is-compact");
		expect(getPaletteBudget(700).backgroundCount).toBe(Number.POSITIVE_INFINITY);

		const colors = ["a", "b", "c", "d", "e", "f"];
		expect(limitPaletteItems(colors, 3, (item) => item === "e")).toEqual([
			"a",
			"b",
			"e",
		]);
	});
});
