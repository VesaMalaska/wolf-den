# Navigator visual refinement QA

## Automated coverage

Navigator tests verify two-line name and Git metadata, right-aligned clean/dirty status, Unicode clipping, selected-entry styling across both lines, whole-entry viewport boundaries, narrow single-line fallback, empty and one-project registries, and resizing with the last of 12 projects selected. Provider and keyboard tests remain in the existing suite.

## Pseudo-terminal check

A temporary registry with 12 local Git repositories and a fixture GitHub CLI was launched in a 120 × 20 pseudo-terminal. Navigation reached the last project, then the terminal resized to 40 × 12. Captured output showed both selected lines, the blue/slate background on both lines, the compact detail panel, selected PR after `Tab`, and help after `?`. `PgDn`, project navigation and `q` completed. Exit code was 0 and pseudo-terminal settings were restored. Temporary paths and raw ANSI captures were discarded.

Representative navigator text at a 42-cell width (color and background omitted):

```text
  Project 10
  main                               clean

▌ Pitkä projekti 界界 🐺
▌ main                               dirty
```

The referenced design screenshot was not included with the pasted request. A real Kitty check is still needed for final color and font judgment; terminal-cell rendering and automated checks establish layout behavior, not pixel-level similarity.
