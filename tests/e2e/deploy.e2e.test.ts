import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const VAULT_PLUGIN = "D:/notes/.obsidian/plugins/simple-sticky-notes";

function hashFile(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("e2e: vault deploy parity", () => {
	const root = process.cwd();
	const artifacts = ["main.js", "manifest.json", "styles.css"] as const;

	beforeAll(() => {
		for (const file of artifacts) {
			copyFileSync(join(root, file), join(VAULT_PLUGIN, file));
		}
	});

	it("deploys all required plugin files to the Obsidian vault", () => {
		for (const file of artifacts) {
			expect(existsSync(join(root, file))).toBe(true);
			expect(existsSync(join(VAULT_PLUGIN, file))).toBe(true);
		}
	});

	it("keeps vault copies byte-identical to the built artifacts", () => {
		for (const file of artifacts) {
			const built = join(root, file);
			const deployed = join(VAULT_PLUGIN, file);
			expect(hashFile(built)).toBe(hashFile(deployed));
		}
	});
});
