# Simple Sticky Notes — Test Matrix

Run everything:

```bash
npm run test:all
```

Individual layers:

| Command | What it validates |
|---|---|
| `npm run test:unit` | Source contracts + CSS coverage |
| `npm run test:e2e` | DOM/integration scenarios (Vitest + happy-dom) |
| `npm run test:visual` | Real browser computed styles (Playwright + Chromium) |
| `npm run build` | Typecheck + production bundle |

## Covered scenarios

| Scenario | Layer |
|---|---|
| Open note → auto file, popout, sticky init, DOM wait | scenarios + unit |
| Startup restore → adopt popout / retry / open new | restore + scenarios |
| Close note → workspace list cleanup | scenarios |
| Hide Obsidian chrome → all 24 selectors removed | chrome (DOM) |
| Header → palette, pin, edit/read, close (no minimize) | header + visual |
| Color picker → background, text, opacity, resize reposition | colorPicker (DOM) |
| Text colors → table/code/paragraph + preserved links | colors + visual |
| Selection toolbar → bold/italic/strike/underline/highlight/link/heading | selectionFormat |
| Pin + preview default + image open hooks | scenarios |
| Deploy artifacts → vault byte-parity with build output | deploy |

Run count: **51 automated checks** (`test:unit` 9 + `test:e2e` 39 + `test:visual` 6).

## Limits

Obsidian Electron runtime itself is not launched in CI. Visual Playwright tests validate rendered HTML/CSS fixtures that mirror sticky note output. For manual acceptance, restart Obsidian and verify restored notes open in sticky mode.
