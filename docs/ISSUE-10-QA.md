# Issue #10 navigator QA

## Automated checks

- Navigator tests cover empty, one, five and twelve-project lists, clamped selection, viewport boundaries, and resizing between 120 × 24, 40 × 15, 30 × 9 and 88 × 8.
- Row tests cover clean and dirty Git status, branches, loading and unavailable Git, configured remote loading/stale/unavailable indicators, and long Unicode names.
- Selection tests verify that changing projects clears PR selection while a boundary keypress preserves it.

## Pseudo-terminal check

A temporary twelve-project registry was run with real local Git repositories and a fixture `gh` executable. The terminal started at 120 × 20 and resized to 40 × 12 with the last project selected. The captured terminal stream showed the highlighted selected row (full-row background and `▌`), its matching details, and the compact layout after resize. `Tab` marked the fixture PR as selected; `PgDn`, `?`, project navigation, and a second PR selection ran without an application error. `q` exited with code 0, and the pseudo-terminal settings matched their original values after exit. Temporary registry paths and raw terminal output were discarded.

The test environment cannot capture a real Kitty screenshot. The remaining visual check is to inspect color contrast and clipping in Kitty with the user's actual font and theme. Issue #11 can refine the right-panel information hierarchy; this slice keeps those details intact.
