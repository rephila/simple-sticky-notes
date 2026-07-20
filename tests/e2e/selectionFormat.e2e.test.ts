import { describe, expect, it } from "vitest";
import {
	setLineHeading,
	toggleWrapSelection,
	wrapLinkSelection,
} from "../../core/utils/selectionFormat";

describe("e2e: selection formatting behavior", () => {
	it("wraps plain text with bold markers", () => {
		expect(toggleWrapSelection("hello", "**")).toBe("**hello**");
	});

	it("unwraps already bold text", () => {
		expect(toggleWrapSelection("**hello**", "**")).toBe("hello");
	});

	it("wraps italic, strike, highlight, and underline markers", () => {
		expect(toggleWrapSelection("x", "*")).toBe("*x*");
		expect(toggleWrapSelection("x", "~~")).toBe("~~x~~");
		expect(toggleWrapSelection("x", "==")).toBe("==x==");
		expect(toggleWrapSelection("x", "<u>", "</u>")).toBe("<u>x</u>");
	});

	it("returns null for empty selections", () => {
		expect(toggleWrapSelection("", "**")).toBeNull();
	});

	it("sets and clears markdown headings", () => {
		expect(setLineHeading("Title", 1)).toBe("# Title");
		expect(setLineHeading("## Old", 3)).toBe("### Old");
		expect(setLineHeading("### Keep", 0)).toBe("Keep");
	});

	it("creates markdown links from selected text", () => {
		expect(wrapLinkSelection("Azure", "https://example.com")).toBe(
			"[Azure](https://example.com)",
		);
		expect(wrapLinkSelection("", "https://example.com")).toBeNull();
		expect(wrapLinkSelection("Azure", "")).toBeNull();
	});
});
