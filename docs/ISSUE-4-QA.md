# Issue #4 manual QA — 2026-11-03

## Environment and method

Ran the built dashboard with Node 26.10.0 and `--experimental-ffi` in a Linux pseudo terminal. A temporary `HOME` contained 12 temporary Git repositories and a project registry; one repository had an untracked file. A temporary `gh` executable returned one PR and zero issues, then a second run simulated a network failure. No real project was modified or sent to GitHub. The pseudo terminal was 52×18 cells, then resized to 100×32. Captured terminal output was inspected for displayed state and terminal control sequences.

## Observations

- Project list, selected-project details, manual next action, local branch and untracked change appeared. Arrow navigation changed selection. Long project names and the PR title were clipped within the narrow view.
- `Tab` visibly marked PR #5 with `>`; `?` showed shortcut help; `r` reported refresh. The display redrew after resizing. `q` exited with code 0 and emitted the alternate-screen restore sequence (`?1049l`).
- With a simulated `gh` network error, the GitHub section showed unavailable while local Git and the manual next action remained visible. Refresh repeated the error without hiding local state.
- A malformed temporary registry produced an actionable validation message on screen; `q` still restored the terminal.
- Automated action tests covered selected-target arguments, invalid paths, missing executables, and launch failures. Real VS Code, terminal emulator and browser windows were **not** verified end to end in this pseudo terminal. Kitty rendering on an actual openSUSE desktop also remains unverified.

## Verification

`pnpm typecheck`, `pnpm test`, and `pnpm build` passed. `pnpm test` reported six passing test files. The package manager warned that its own runtime was Node 26.0.0, below the declared `>=26.4.0` engine; the manual dashboard run used Node 26.10.0. Node 26.0.0 rejected `--experimental-ffi`, so startup on that version is unsupported as documented.

## Release review

Before tagging v0.1, a human should run the PR build in Kitty on openSUSE Tumbleweed and verify actual VS Code, terminal and browser launches from temporary projects. This graphical verification is the remaining release gate. No other unresolved failure was found in this review.
