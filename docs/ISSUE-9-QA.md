# Issue #9 layout QA

## Automated and pseudo-terminal checks

- Layout tests cover the 88-column / 8-row breakpoint, panel dimensions, short terminals, empty and single-project registries, larger project lists, selected PR placement, and loading/stale/unavailable GitHub details.
- A temporary 12-project registry was run in a 120 × 24 pseudo-terminal, then resized to 40 × 16. Project navigation, help, detail scroll input, and `q` shutdown completed with exit code 0. Captured output included the selected project, help, unavailable GitHub state, and compact shortcut footer.
- The pseudo-terminal run does not establish how the interface looks in a real Kitty window. No Kitty screenshot is attached from this environment.

## Manual Kitty review checklist

1. Launch with a temporary registry containing 0, 1, and at least 12 projects. Confirm the empty message, single selection, and scrolling selection remain visible.
2. At 120 × 30, confirm the project navigator is on the left, details on the right, and the separator, status row, and shortcut row remain in place.
3. Resize below and above 88 columns, and below and above 8 rows. Confirm the compact list stays above details, the interface redraws cleanly, and `? help` and `q quit` remain visible.
4. With long Unicode project and PR names, confirm line clipping does not split graphemes or overlap panels.
5. Navigate projects, select PRs with `Tab`, scroll details and help with `PgUp` / `PgDn`, then confirm `q` and `Esc` restore the terminal.
6. Verify GitHub loading, unavailable and stale states leave local Git details visible. Verify launch errors and refresh feedback use the fixed status row.

## Remaining design work

Issue #10 can refine the information density and visual selection in navigator rows. Issue #11 can reorganize the selected-project details and feedback copy. This slice keeps their existing content and behavior.
