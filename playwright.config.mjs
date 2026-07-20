import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "tests/playwright",
	testMatch: "**/*.spec.mjs",
	timeout: 30000,
	use: {
		baseURL: "http://127.0.0.1:4173",
		trace: "on-first-retry",
	},
	webServer: {
		command: "npx serve . -p 4173",
		port: 4173,
		reuseExistingServer: true,
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
