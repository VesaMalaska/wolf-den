---
name: terminal-ui-ux-design
description: Design, critique, and polish terminal dashboards, TUIs, CLI interfaces, and OpenTUI applications. Use when asked to improve visual hierarchy, layout, spacing, colour, typography, responsiveness, information density, or usability. Require a visual concept and same-size before/after terminal evidence; automated tests alone do not satisfy visual acceptance.
---

# Terminal UI/UX Design

Design terminal interfaces that look **deliberate, balanced, readable and distinctive**, without pretending the terminal is a browser. This skill covers visual judgment and the user experience; for OpenTUI code, also load `opentui-core-development`.

## The fundamental rule

**Visual polish must be visible.** A successful build, passing tests, changed colours, a moved label, or larger ASCII digits does not prove improved UX. A good design communicates important information faster and more clearly *in an actual terminal screenshot*.

Respect the project's product requirements and owner approval gates. Preserve functional correctness, keyboard behavior, data honesty and compact layout throughout design work.

## Step 1 — Write a tiny design brief before touching code

Capture these decisions in the task/PR:

- **Purpose:** what must a person understand or do within two seconds?
- **Primary information:** what deserves the strongest attention? Only one main visual focal point by default.
- **Secondary information:** what supports that decision, and in what order?
- **Environment:** target terminal, colour support, font/Unicode behavior, and exact minimum/normal/large cell dimensions.
- **Required states:** loading, normal, stale/error, empty, long text, short text, keyboard help.
- **Visual personality:** 3–5 adjectives grounded in the product (e.g. calm, compact, technical, warm, precise).
- **Explicit constraints:** content that must stay visible, no-scroll requirements, accessibility, performance and human approval.

Do not invent a new product direction when the user requests only a refinement.

## Step 2 — Establish a composition, not a string arrangement

Create a **layout sketch** showing actual groups and proportions at the normal and compact dimensions before coding significant visual changes.

- Use semantic regions: header, primary panel, supporting metrics, forecast/list/table, status/footer.
- Prefer **one strong focal region**, 2–4 supporting groups, and a quiet footer.
- Group by shared purpose using alignment, spacing, surface contrast or a single divider; do not surround everything with boxes.
- Make numerical values scan vertically. Keep column headers **directly over their data**.
- Consider 1–2 cell padding at normal sizes, but reduce it in compact views. Space is a resource, not decoration.
- Maintain a consistent width rhythm. A bounded content width can help very wide terminals, but centering alone is not a design solution.
- Use panels/backgrounds when they clarify ownership or grouping, not to simulate gratuitous web-app cards.

Example of an **information hierarchy sketch** (not literal source or mandatory styling):

```text
FULL MOON WEATHER                         KOTKA · FI
───────────────────────────────────────────────────
CURRENT                  Cloudy
 +5°C     Feels -1°       Wind 8 m/s · Hum 74%
───────────────────────────────────────────────────
NEXT 12 HOURS
 16:00       19:00        22:00        01:00
 Cloudy      Drizzle      Drizzle      Cloudy
 +5° · 80%   +4° · 90%    +5° · 79%    +5° · 33%
───────────────────────────────────────────────────
4 DAYS                                  MIN     MAX
 FRI  Drizzle                           +3°     +6°
 SAT  Drizzle                           +2°     +5°
 SUN  Drizzle                           +2°     +8°
 MON  Drizzle                           +4°     +7°
───────────────────────────────────────────────────
Open-Meteo · FRESH 15:56      r · ? Help · q Quit
```

The key is **relationship and hierarchy**, not copying this sketch. A different application needs a different composition.

## Step 3 — Design for terminal realities

- Terminal geometry is character **cells**. Fonts generally have the terminal's fixed cell height. CSS-like `font-size` is not available for ordinary text.
- Prefer layout, meaningful colour contrast, positioning, a label/value rhythm, and selective boldness to communicate scale.
- Large block numerals and ASCII art are *not* default “prominence.” They are appropriate only when they improve the overall composition, survive minimum sizes, and are explicitly supported by a before/after comparison.
- Use a restrained 4–6-role palette: background, surface, primary text, secondary text, accent, status/alert. Do not invent a rainbow per section.
- High-importance numbers may use the accent. Supporting units, timestamps and probability labels should be calmer. Preserve contrast and readability.
- State must have **text**, not colour alone: `FRESH`, `STALE`, `OFFLINE`, `ERROR`, etc.
- Icons are optional, not essential; check terminal/Unicode coverage and cell widths. A readable label beats a broken icon.
- Use terminal-aware grapheme/cell measurement. Test accented strings, double-width glyphs, negative values, and long place names.
- Protect readable number/unit formatting: `-12°C`, `85%`, `8.4 m/s`, unknown `--`. Never use a visually elegant but ambiguous label.

## Step 4 — Treat compact layout as a first-class design

Sketch and validate at least these categories **when relevant to the project**:

1. **Compact/minimum:** all essential content still available; tighter grouping, fewer separators, shortened *labels*, not removed data.
2. **Normal target:** intended default composition and visual balance.
3. **Large terminal:** deliberate maximum content width and whitespace distribution, without four-hour sample columns drifting across the whole screen.
4. **Below minimum:** explicit resize guidance and a reliable quit path.

Never sacrifice the established information contract just to fit a decorative temperature treatment or big panel. When the proposed design cannot fit, offer a specific trade-off and obtain owner approval; do not silently drop sections.

## Step 5 — Prototype, render, inspect, iterate

**Required workflow for visible redesigns:**

1. Capture the current UI at a specified cell size with representative fixed values. That is the **baseline**.
2. Propose a concrete direction: annotated text sketch or visual reference, explicit hierarchy, spacing, palette, and changes from baseline.
3. If the change is substantial, get the owner's design approval **before implementing**. If approval was already granted by the issue, proceed within that brief.
4. Implement with appropriate terminal layout primitives. For OpenTUI, use `BoxRenderable`/Yoga composition where appropriate; do not treat a list of strings as the only possible UI architecture.
5. Capture the new UI at the **same size and with the same data**. Also capture compact and large views.
6. Compare the two *visually*, not only by code diff or cell-count tests. Adjust the design if the improvement is subtle, awkward or cluttered.
7. Present what changed, how it improved usability, what remained unchanged, and any unverified terminal constraints. Wait for human visual QA before declaring polish complete.

A screenshot of a pure text formatter is useful for unit geometry but **is not the same as an actual OpenTUI render**. Distinguish model captures, PTY renders, and real target-terminal screenshots in the report.

## Screenshot review rubric

Review each criterion as **pass / needs work / unverified**:

| Criterion | Question |
| --- | --- |
| Hierarchy | Can I identify the main information in two seconds? |
| Composition | Do sections feel intentionally grouped, rather than printed sequentially? |
| Proportion | Does the focal element deserve its visual footprint, or dominate awkwardly? |
| Alignment | Do headings, rows, columns, units and values line up? |
| Density | Is there enough breathing room without wasting essential cells? |
| Contrast | Is muted text readable; are accents purposeful? |
| Data honesty | Are units, freshness, missing data and probabilities unambiguous? |
| Responsiveness | Is compact useful and large balanced? |
| Accessibility | Does meaning survive limited colour, missing glyphs and keyboard-only use? |
| Distinctiveness | Does this product look intentional rather than like a generic ASCII table? |

**UX acceptance gate:** if the new screen looks almost the same as the old one, or the main difference is a huge ASCII numeral, do **not** report that a visual redesign is complete. Explain the gap and iterate.

## Frequent anti-patterns

- **String-polish masquerading as UI design:** adding padding, a bold row, or separators without meaningful compositional improvement.
- **Big-number reflex:** making a temperature five rows high solely because the brief asked for prominence.
- **Border addiction:** boxing every value and consuming the compact terminal with decorative lines.
- **Uncontrolled centering:** content width capped, but columns and whitespace still feel disconnected.
- **Technically correct, visually weak:** all tests pass but real screenshots reveal dull hierarchy or poor balance.
- **Overcrowding:** labels clipped or forecast rows hidden to make room for decoration.
- **Inconsistent semantics:** stale data looks fresh; “80%” lacks precipitation context; red/green alone carries meaning.
- **Changing too much at once:** refresh, data model, design language and keyboard behavior rewritten without necessity.

## Deliverables for visual tasks

Report:

- Short design intention (primary focal point, hierarchy and style decisions).
- Baseline and revised captures at **identical** dimensions/data, plus minimum-size capture.
- What changed in component structure and why, if code was involved.
- Screenshot rubric findings (including weaknesses), functional tests and terminal smoke-test results.
- Any environment limitations (e.g. real Kitty unavailable because of Wayland) stated plainly.
- The exact requested human approval gate. **Do not self-merge or claim UX acceptance without it.**

## References

- [OpenTUI Box](https://opentui.com/docs/components/box/)
- [OpenTUI Layout](https://opentui.com/docs/core-concepts/layout/)
- [OpenTUI Text and terminal cells](https://opentui.com/docs/core-concepts/text-and-cells/)
- [OpenTUI Renderables](https://opentui.com/docs/core-concepts/renderables/)

These links are implementation references, not permission to substitute technical feasibility for visual judgment.
