import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
	resolve: {
		alias: {
			core: resolve(__dirname, "core"),
			obsidian: resolve(__dirname, "tests/helpers/obsidianMock.ts"),
		},
	},
	test: {
		environment: "happy-dom",
		include: ["tests/e2e/**/*.test.ts"],
		setupFiles: ["tests/helpers/obsidianMock.ts"],
		testTimeout: 15000,
	},
});
