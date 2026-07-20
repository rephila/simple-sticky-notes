export function createObsidianPopoutDom(): Document {
	const document = window.document;
	document.documentElement.removeAttribute("note-id");
	document.documentElement.classList.remove("sticky-note-window");
	document.body.classList.remove("sticky-note-window", "sticky-note");
	document.body.innerHTML = `
		<div class="app-container">
			<div class="workspace">
				<div class="workspace-tabs">
					<div class="workspace-tab-header">Azure</div>
				</div>
				<div class="workspace-tab-header-container"></div>
				<div class="workspace-leaf">
					<div class="workspace-leaf-content">
						<div class="view-header">
							<div class="view-header-nav-buttons"></div>
							<div class="view-header-left"></div>
							<div class="view-header-breadcrumb">security / token / Azure</div>
							<div class="view-header-title-container">
								<div class="view-header-title">Azure</div>
							</div>
							<div class="view-actions"></div>
						</div>
						<div class="view-content">
							<div class="markdown-preview-view">
								<h2>Resource Status</h2>
								<table>
									<thead>
										<tr><th>Kaynak</th><th>Durum</th></tr>
									</thead>
									<tbody>
										<tr><td>Resource Group</td><td><code>pit-avengers-rg</code></td></tr>
										<tr><td>Web App</td><td><a href="https://example.com">https://example.com</a></td></tr>
									</tbody>
								</table>
								<pre><code>az webapp config appsettings list</code></pre>
								<p>Normal paragraph text</p>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="metadata-container"></div>
			<div class="status-bar"></div>
		</div>
	`;
	return document;
}

export function appendStyles(css: string): HTMLStyleElement {
	const style = document.createElement("style");
	style.textContent = css;
	document.head.appendChild(style);
	return style;
}
