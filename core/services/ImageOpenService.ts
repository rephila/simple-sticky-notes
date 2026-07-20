import { FileSystemAdapter, Notice, TFile, normalizePath } from "obsidian";
import { shell } from "electron";
import type StickyNotesPlugin from "main";
import { isHtmlElement } from "core/utils/domHelpers";
import { LoggingService } from "./LogginService";

const IMAGE_EXTENSIONS = [
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"svg",
	"bmp",
	"ico",
	"tiff",
	"avif",
	"heic",
];

export class ImageOpenService {
	plugin: StickyNotesPlugin;

	constructor(plugin: StickyNotesPlugin) {
		this.plugin = plugin;
	}

	async openFromElement(
		img: HTMLImageElement,
		sourceFile: TFile | null,
	): Promise<boolean> {
		const absolutePath = this.resolveAbsolutePath(img, sourceFile);
		if (!absolutePath) return false;
		return this.openAbsolutePath(absolutePath);
	}

	async openFromLinkPath(
		linkPath: string,
		sourceFile: TFile | null,
	): Promise<boolean> {
		const absolutePath = this.resolveLinkPath(linkPath, sourceFile);
		if (!absolutePath) return false;
		return this.openAbsolutePath(absolutePath);
	}

	private async openAbsolutePath(absolutePath: string): Promise<boolean> {
		try {
			const errorMessage = await shell.openPath(absolutePath);
			if (errorMessage) {
				new Notice(`Could not open image: ${errorMessage}`);
				LoggingService.warn("Failed to open image", errorMessage);
				return false;
			}
			return true;
		} catch (error) {
			new Notice("Could not open image");
			LoggingService.warn("Failed to open image", error);
			return false;
		}
	}

	private resolveAbsolutePath(
		img: HTMLImageElement,
		sourceFile: TFile | null,
	): string | null {
		const embedCandidate = img.closest(
			".internal-embed.image-embed, .image-embed",
		);
		const embed = isHtmlElement(embedCandidate) ? embedCandidate : null;
		const embedSrc = embed?.getAttribute("src");
		if (embedSrc) {
			const fromEmbed = this.resolveLinkPath(embedSrc, sourceFile);
			if (fromEmbed) return fromEmbed;
		}

		const fromSrc = this.parseAppUrl(img.getAttribute("src") ?? "");
		if (fromSrc) return fromSrc;

		const alt = img.alt?.trim();
		if (alt) {
			const fromAlt = this.resolveLinkPath(alt, sourceFile);
			if (fromAlt) return fromAlt;
		}

		return null;
	}

	private resolveLinkPath(
		linkPath: string,
		sourceFile: TFile | null,
	): string | null {
		const adapter = this.plugin.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) return null;

		const cleanedPath = linkPath.split("|")[0]?.trim();
		if (!cleanedPath) return null;

		const dest = this.plugin.app.metadataCache.getFirstLinkpathDest(
			cleanedPath,
			sourceFile?.path ?? "",
		);
		if (dest instanceof TFile) {
			return adapter.getFullPath(dest.path);
		}

		const normalized = normalizePath(cleanedPath);
		if (this.plugin.app.vault.getAbstractFileByPath(normalized)) {
			return adapter.getFullPath(normalized);
		}

		return null;
	}

	private parseAppUrl(src: string): string | null {
		if (!src.startsWith("app://")) return null;

		try {
			const url = new URL(src);
			let path = decodeURIComponent(url.pathname);
			if (path.startsWith("/") && path.charAt(2) === ":") {
				path = path.slice(1);
			}
			return path;
		} catch (error) {
			LoggingService.warn("Failed to parse image app url", error);
			return null;
		}
	}

	static parseImagePathFromLine(lineText: string): string | null {
		const wikiMatch = lineText.match(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/);
		if (wikiMatch?.[1]) return wikiMatch[1].trim();

		const markdownMatch = lineText.match(/!\[[^\]]*\]\(([^)]+)\)/);
		if (markdownMatch?.[1]) return markdownMatch[1].trim();

		return null;
	}

	static isImagePath(path: string): boolean {
		const extension = path.split(".").pop()?.toLowerCase() ?? "";
		return IMAGE_EXTENSIONS.includes(extension);
	}
}
