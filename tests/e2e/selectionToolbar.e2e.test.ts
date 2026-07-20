import { describe, expect, it } from "vitest";

import { SelectionToolbar } from "../../core/views/SelectionToolbar";
import { markStickyWindow } from "../../core/utils/stickyChrome";

describe("e2e: selection toolbar in popout document", () => {
	it("builds the toolbar in a popout document", () => {
		const document = window.document;
		document.body.innerHTML = "";
		markStickyWindow(document, "sticky-note-0");

		const stickyNote = {
			view: {
				containerEl: document.createElement("div"),
			},
		};

		expect(() => {
			const toolbar = new SelectionToolbar(stickyNote as never, document);
			toolbar.attach();
		}).not.toThrow();

		const toolbarEl = document.querySelector(".sticky-note-selection-toolbar");
		expect(toolbarEl).not.toBeNull();
		expect(document.querySelectorAll(".sticky-note-selection-toolbar-button").length).toBeGreaterThan(
			5,
		);
	});
});
