---
name: opentui-core-development
description: Build, refactor, debug, and test terminal applications with @opentui/core. Use when implementing OpenTUI layouts, renderable trees, responsive terminal views, styled text, keyboard interaction, live updates, or lifecycle cleanup. Prefer real BoxRenderable/Yoga composition over printing a dashboard as an array of absolute-positioned strings.
---

# OpenTUI Core Development

Build small, dependable terminal applications using OpenTUI's **retained renderable tree**, not a simulated text canvas. Prioritize correctness, readable terminal geometry, and clean resource ownership.

## When to use

Use for changes involving `@opentui/core`, `CliRenderer`, `BoxRenderable`, `TextRenderable`, layout, terminal resizing, live updates, keyboard events, or terminal cleanup. For a visual design or redesign, **also load `terminal-ui-ux-design`**. This skill explains *how* to implement the UI; the companion skill establishes *what* the UI should communicate and how it should look.

## First: inspect the project

1. Read the repository's `AGENTS.md`, specification, task/issue, current implementation, tests, and package versions. Follow the owner's branch/PR/approval workflow. Do not begin unrelated tasks.
2. Check the installed `@opentui/core` version and runtime requirements. Read the **matching-version** documentation/API or installed types before writing unfamiliar options. Documentation URLs below may describe a newer version.
3. Identify the existing layout tree, state source, event handlers, resize strategy, and cleanup path. Do not rewrite functioning business logic just to improve presentation.
4. Establish required screen dimensions and states. Ask for design approval before a substantial redesign unless the task explicitly authorizes it.

## Architecture: compose renderables, not rows of strings

A dashboard usually belongs in a small tree like this:

```text
renderer.root
└── application container (width/height 100%)
    └── bounded content container
        ├── header
        ├── main/content
        │   ├── primary information panel
        │   ├── secondary information panel(s)
        │   └── data rows or columns
        └── status / shortcut footer
```

- Use `BoxRenderable` for semantic sections, padding, backgrounds, borders, gap, and row/column composition.
- Use `TextRenderable` for text, its own alignment, and styled spans. Use `StyledText` / supported helpers for mixed styles within one piece of text.
- Use Yoga (`flexDirection`, `flexGrow`, `flexShrink`, `alignItems`, `justifyContent`, `gap`, `maxWidth` and friends) **where verified by installed types**. Dimensions are terminal **cells**, not CSS pixels.
- Prefer relative/flex layout for ordinary content. Reserve `position: 'absolute'` for deliberate overlays, fixed ornaments or geometry that cannot reasonably participate in flow.
- A flat array of absolutely positioned one-row `TextRenderable`s is acceptable for simple fixed-format output, but **not the default for an interactive, designed dashboard**. If choosing it, document why genuine layout nodes would be worse.
- Do not wrap existing lines with borders and call it a redesign. Make the relationships among information groups explicit in the renderable tree.

### Minimal compositional example

```ts
import { BoxRenderable, TextRenderable, createCliRenderer } from '@opentui/core'

const renderer = await createCliRenderer({ screenMode: 'alternate-screen' })
try {
  const viewport = new BoxRenderable(renderer, {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    alignItems: 'center',
  })

  const content = new BoxRenderable(renderer, {
    width: '100%',
    maxWidth: 80,
    flexDirection: 'column',
    gap: 1,
    paddingX: 1,
  })

  const section = new BoxRenderable(renderer, {
    width: '100%',
    flexDirection: 'column',
    backgroundColor: '#202938',
    padding: 1,
  })
  const reading = new TextRenderable(renderer, {
    content: 'Current weather: +5°C',
    fg: '#F0D4A4',
  })
  section.add(reading)
  content.add(section)
  viewport.add(content)
  renderer.root.add(viewport)

  // Keep the app alive through its normal input/event loop.
  // Update reading.content when state changes; do not recreate the tree.
} finally {
  renderer.destroy()
  await renderer.closed
}
```

This is a **pattern sketch**, not a copy-paste app: insert it into the project's existing lifecycle, preserving its keyboard, data and shutdown behavior. In a real app, create all visible sections and choose sensible height behavior. Verify options against the pinned OpenTUI version.

## Live data and updates

- Keep fetching, parsing, application state, and persistence outside visual components.
- Expose a small `setState`/`setSnapshot` or equivalent update path. Create persistent nodes once; change their `content`, `fg`, visibility or layout props when state changes.
- Do not destroy/recreate the renderer for refreshes, and do not clear the terminal manually after each fetch.
- Avoid unnecessary continuous rendering; OpenTUI can render on demand after mutations. Use a timer only if the display genuinely depends on the passage of time.
- Change only the relevant nodes/props. Keep data refresh independent of terminal resize.
- Differentiate `loading`, `fresh`, `stale`, `unavailable`, errors and partial data in the UI. Never present missing or cached data as live.

## Responsive terminal geometry

- Plan **two genuinely coherent layouts** when the task needs them: normal and compact. The compact layout may change composition, not merely truncate labels.
- Define a minimum supported width and height. Below minimum, show a small readable resize warning with an exit path.
- Do not let `flexShrink` unexpectedly hide essential text. Use measurements and explicit constraints for required information.
- When constraining large displays, use a centered bounded content container rather than adding spaces to every row.
- Keep numeric columns aligned, preserve headings with their values, and check content wrapping and overflow.
- React to renderer `resize` where a breakpoint change is needed; ordinary Yoga layouts already recalculate on resize.
- Test actual terminal-cell widths. JavaScript `.length` counts UTF-16 units, **not display cells**. Graphemes, wide characters, combining marks, emoji and joined glyphs require terminal-aware measurement/truncation. Use OpenTUI's measurement behavior or carefully tested helpers.

## Colours, styled text and interaction

- Define a small **semantic** palette (background, surface, primary text, muted text, accent, status) instead of scattering arbitrary values.
- Terminal text cannot be resized with CSS font sizes. Prefer structure, foreground/background contrast, weight, location, grouping and white space before using multi-row ASCII numerals or glyph art.
- A large `ASCIIFont`/block-number treatment is an **optional design choice**, never an automatic answer to “make it more prominent.” It consumes rows and must win a screenshot comparison.
- Keep labels readable when colours are absent. Avoid emoji-only status indicators or symbols of uncertain terminal-cell width.
- Use `renderer.keyInput.on('keypress', handler)` for a small global shortcut set; remove listeners during shutdown. For more complex local shortcuts, consult OpenTUI key-binding documentation.
- Overlays may use absolute positioning and z-order when appropriate; ensure they dismiss and do not destroy underlying state.

## Resource ownership and shutdown

- Prefer `createCliRenderer()` to directly constructing a renderer.
- If the app owns signal handling, configure OpenTUI's built-in exit behavior to avoid competing handlers.
- Give every timer, request, subscription, listener, and child resource a corresponding cleanup path.
- Abort active network work on shutdown; clear timers and detach listeners; call `renderer.destroy()` and await `renderer.closed` on normal completion.
- Do not call `process.exit()` as a substitute for cleanup. Do not log over the active alternate-screen UI unless that path is designed for it.
- Test `q`, Ctrl+C, errors, and exit during a pending request.

## Required verification

1. Run the repository's typecheck, tests, build and diff/style checks. Never report an unrun check as passed.
2. Exercise model/formatting tests for missing/long/Unicode values, numeric bounds, status transitions and changes that affect layout.
3. Render the app in a PTY at **every specified** width/height. Inspect actual output and terminal restoration, not only a pure string-view-model test.
4. Perform a real target-terminal smoke test (e.g., Kitty) when accessible. State separately what a compositor or headless environment prevented.
5. For visual work, make **before/after captures at identical dimensions and the same representative data**. Apply the `terminal-ui-ux-design` review criteria. Green tests are not evidence of good visual design.
6. Submit the feature branch/PR with commands and outcomes, dimensions, visual evidence, known caveats, and scope deviations. **Do not self-merge without owner approval.**

## Stop signs

Stop and reassess if any of the following occurs:

- A requested visual redesign only changes string padding, boldness, or ASCII art while the underlying flat-row composition remains unsuitable.
- A “responsive” view hides a required section without product approval.
- A state or refresh update remounts the UI or causes visible flicker.
- The result passes unit tests but cannot be assessed as a real terminal rendering.
- A layout compromise silently changes the approved information hierarchy.

## Official references

- [OpenTUI Quickstart](https://opentui.com/docs/getting-started/quickstart/)
- [BoxRenderable](https://opentui.com/docs/components/box/)
- [Yoga layout](https://opentui.com/docs/core-concepts/layout/)
- [Renderables and retained tree](https://opentui.com/docs/core-concepts/renderables/)
- [Text and terminal cells](https://opentui.com/docs/core-concepts/text-and-cells/)
- [Renderer](https://opentui.com/docs/core-concepts/renderer/)
- [Keyboard input](https://opentui.com/docs/core-concepts/keyboard/)
- [Lifecycle and cleanup](https://opentui.com/docs/core-concepts/lifecycle/)

Always check documentation and installed types against the version pinned by the project.
