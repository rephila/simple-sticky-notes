import { expect, test } from "@playwright/test";

test.describe("visual e2e: sticky note fixture", () => {
	test("renders header actions with close on the right", async ({ page }) => {
		await page.goto("/tests/fixtures/sticky-note.html");
		const actions = page.locator(".view-actions .view-action");
		await expect(actions).toHaveCount(3);
		await expect(actions.last()).toHaveClass(/close-button/);
		await expect(page.locator(".minimize-button")).toHaveCount(0);
	});

	test("applies note text color to table cells and keeps links blue", async ({
		page,
	}) => {
		await page.goto("/tests/fixtures/sticky-note.html");
		const tdColor = await page.locator("td").first().evaluate((el) =>
			getComputedStyle(el).color,
		);
		const thColor = await page.locator("th").first().evaluate((el) =>
			getComputedStyle(el).color,
		);
		const linkColor = await page.locator("a").first().evaluate((el) =>
			getComputedStyle(el).color,
		);

		expect(tdColor).toBe("rgb(180, 35, 24)");
		expect(thColor).toBe("rgb(180, 35, 24)");
		expect(linkColor).toBe("rgb(26, 95, 180)");
	});

	test("uses sticky background tokens instead of default Obsidian chrome", async ({
		page,
	}) => {
		await page.goto("/tests/fixtures/sticky-note.html");
		await expect(page.locator(".workspace-tabs")).toHaveCount(0);
		await expect(page.locator(".view-header-breadcrumb")).toHaveCount(0);
		const bg = await page.locator(".app-container.sticky-note").evaluate((el) =>
			getComputedStyle(el).backgroundColor,
		);
		expect(bg).toBe("rgb(250, 240, 208)");
	});

	test("centers the file title and keeps action order", async ({ page }) => {
		await page.goto("/tests/fixtures/sticky-note.html");
		await expect(page.locator(".view-header-title")).toHaveText("Azure");
		const titleContainer = page.locator(".view-header-title-container");
		const justify = await titleContainer.evaluate((el) =>
			getComputedStyle(el).justifyContent,
		);
		expect(justify).toBe("center");

		const classes = await page.locator(".view-actions .view-action").evaluateAll(
			(elements) => elements.map((el) => el.className),
		);
		expect(classes.some((name) => name.includes("color-button"))).toBe(true);
		expect(classes.some((name) => name.includes("pin-button"))).toBe(true);
		expect(classes.some((name) => name.includes("view-mode-button"))).toBe(false);
		expect(classes.at(-1)).toMatch(/close-button/);
	});

	test("styles code blocks with note text and background tokens", async ({
		page,
	}) => {
		await page.goto("/tests/fixtures/sticky-note.html");
		const codeColor = await page.locator("code").first().evaluate((el) =>
			getComputedStyle(el).color,
		);
		const codeBg = await page.locator("code").first().evaluate((el) =>
			getComputedStyle(el).backgroundColor,
		);
		expect(codeColor).toBe("rgb(180, 35, 24)");
		expect(codeBg).toBe("rgb(236, 228, 204)");
	});

	test("marks html with sticky-note-window class", async ({ page }) => {
		await page.goto("/tests/fixtures/sticky-note.html");
		await expect(page.locator("html.sticky-note-window")).toHaveCount(1);
	});
});
