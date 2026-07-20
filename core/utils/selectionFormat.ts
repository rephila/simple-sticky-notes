export function toggleWrapSelection(
	text: string,
	prefix: string,
	suffix = prefix,
): string | null {
	if (!text) return null;

	if (text.startsWith(prefix) && text.endsWith(suffix)) {
		return text.slice(prefix.length, text.length - suffix.length);
	}

	return `${prefix}${text}${suffix}`;
}

export function setLineHeading(lineText: string, level: number): string {
	const stripped = lineText.replace(/^#{1,6}\s+/, "");
	if (level <= 0) return stripped;
	return `${"#".repeat(level)} ${stripped}`;
}

export function wrapLinkSelection(text: string, url: string): string | null {
	if (!text || !url) return null;
	return `[${text}](${url})`;
}
