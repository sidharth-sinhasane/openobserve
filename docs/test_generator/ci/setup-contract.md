# Test Setup Contract: Synthetics Browser Test Click Types & Hover Action (area: Synthetics)

This contract is read by the **Engineer** (implements setup), the **Healer** and the
**Refiner** (consult it instead of blind-scanning when a data/setup failure appears).

There are **no existing Synthetics page objects or specs** — `tests/ui-testing/playwright-tests/Synthetics/`
and any `synthetics*` page object under `tests/ui-testing/pages/` do not exist. This feature is a
greenfield test area. The test navigates **directly via URL**; there is no menu-click helper for it.

## Environment / routing preconditions (blockers — verify before writing any assertion)

Synthetics UI routes are **enterprise/cloud-gated**, NOT OSS:

- Route registration: `web/src/composables/shared/useEnterpriseRoutes.ts:174` pushes the
  `synthetics*` routes only when `config.isCloud == "true" || config.isEnterprise == "true"`.
- Route guard: `syntheticsRouteGuard` (`useEnterpriseRoutes.ts:23-29`) redirects to `/` when the
  backend `/config` flag `synthetics_enabled === false` (`O2_SYNTHETICS_ENABLED`).
- Left-rail nav: `web/src/lib/core/Navbar/navGroups.ts:205` requires the `synthetics` capability.

**For the spec to run at all, the CI instance must be an enterprise/cloud build with
`synthetics_enabled` truthy.** The run-context `edition: "oss"` describes where the *frontend source*
lives (this checkout), not the build the test runs against — if the guard redirects home, every
selector in this spec will time out. Assert early: after `goto`, `expect(page.url()).toContain('synthetics')`.

The create view is reached at route **`synthetics-add`** (`?type=browser`), dispatched by
`web/src/views/synthetics/CreateCheck.vue` to `CreateBrowserTest.vue`.

## The browser extension is NOT installed in the test browser

The editor's two entry buttons differ on this exact point:

- **Record** (`synthetics-create-record-btn`) → `probeExtension()` returns false → the wizard goes to
  the **extension-setup** phase (`CreateBrowserTest.vue:536-557`), which cannot complete without a
  real Chrome extension + incognito toggle.
- **Build manually** (`synthetics-create-build-btn`) → `buildManually()` (`:559-564`) sets
  `autoRecord=false`, `phase="editor"` **with no extension check**.

**Always use "Build manually".** It is the only way to reach the Journey editor in a headless
Playwright browser, and it is what every assertion in this spec depends on.

## Streams / data the spec must establish

**None.** This feature does not ingest or query streams. It edits the in-memory journey model of a
browser check. No ingestion, no stream schema, no FTS fields are involved.

What the spec *does* establish is **UI state**, created entirely through the UI (no API seeding):

| Condition | How it is created (UI steps) | SCOPE |
|-----------|------------------------------|-------|
| A browser check in the **editor** phase, on the **Journey** step | `goto /web/synthetics/add?type=browser` → fill `synthetics-create-url-input` (`https://example.com`) → fill `synthetics-create-name-input` → click `synthetics-create-build-btn` | `[shared]` — do in a `beforeEach` helper |
| A **click step** (default new-step action) | click `synthetics-journey-add-step-btn` (or the empty-state "Add step manually" button) | `[per-test]` — each test adds its own |
| A click step with a **locator candidate** (needed only if saving) | in the step expansion, fill `synthetics-journey-step-locator-override-input` with e.g. `role=button[name="Login"]`, press Enter or click `synthetics-journey-step-locator-add` | `[per-test]` |
| A valid **navigate first step** (needed only if saving) | set first step's action to `navigate` via `synthetics-journey-step-action-select` and fill `synthetics-journey-step-value-input` with `https://example.com` | `[per-test]` |
| A **location** selected (needed only if saving) | step 2 (Configure) → select any location in `CheckConfigure` | `[per-test]` |

Most click-type/hover assertions are **model/UI-only and need no save** — the row label and editor
state update immediately on selection. Reserve the save round-trip for one heavier test (see below).

## How to interact with the OSelect controls (click-type / action pickers)

`OSelect` (`web/src/lib/forms/Select/OSelect.vue`) forwards `data-test` as a *suffix*, not verbatim:

- Trigger combobox: `<data-test>-trigger` — e.g. `synthetics-journey-step-click-type-select-trigger`
  and `synthetics-journey-step-action-select-trigger` (`OSelect.vue:1087,1704`).
- Options: `<data-test>-option` with **`data-test-value`** and `data-test-label` attributes
  (`OSelect.vue:1459-1461`). Select an option with
  `page.locator('[data-test="…-option"][data-test-value="right"]')`.

Click-type option values are the `ClickType` union: `left | right | middle | double`
(`web/src/constants/synthetics.ts:190`). Action option values are the `StepAction` union, including
`hover` (retired `scroll`/`wait`/`screenshot` are filtered out of the picker — see Gotchas).

## Preconditions / toggles

- Non-SQL mode / quick-mode state: **not applicable** — the Journey editor has no SQL mode.
- Extension state: the spec must never depend on `extensionReady`. Enter via Build manually.

## Timing / hydration gotchas

- After clicking **Build manually**, the editor mounts `BrowserJourney` inside `OStepper` step 1.
  The step list is empty → empty state ("No steps yet"). Wait for
  `synthetics-journey-add-step-btn` (toolbar) **or** the empty-state "Add step manually" button before
  acting.
- After clicking **Add Step**, the new row is expanded and scrolled to (`revealStep`,
  `BrowserJourney.vue:1004-1024`). Wait for `synthetics-journey-step-click-type-select-trigger`
  (the editor) before selecting a click type — it appears inside the expanded row.
- Row label updates are synchronous with the model; assert via the `OBadge` in the row's
  `cell-details` (`JourneySteps.vue:381-383`) whose text becomes "Right click"/"Double click"/
  "Middle click" (`stepActionLabelKey`, `constants/synthetics.ts:238-246`).

## Gotchas (so the Healer/Engineer don't rediscover them)

1. **Route gating** — if `synthetics_enabled` is false (or the build is OSS), the guard redirects to
   `/` and *every* selector fails. Check the URL first.
2. **Never click Record** — it routes to the un-completable extension-setup phase. Use Build manually.
3. **Click-type select renders only when `action === "click"`** (`isClickStep`,
   `BrowserJourneyStepEditor.vue:172`, template `:437-446`). A newly-added step defaults to `click`,
   so it is present immediately; it disappears the moment the action changes.
4. **Changing the action away from `click` clears `button`/`clickCount`** (`actionComputed` setter,
   `:160-170`) — so asserting "click type cleared after switching to hover and back" is expected
   behavior, not a bug.
5. **`left`/`1` serialises away** — `buildV2Step` (`buildV2Steps.ts:145-146`) omits `button` when it is
   `left` and `click_count` when `<= 1`, so a plain click round-trips byte-identically. A save+reload
   assertion must therefore check `right`/`double`/`middle` (non-default) to observe a change.
6. **Hover requires a locator but has no value field** — `hover ∈ SELECTOR_ACTIONS`
   (`constants/synthetics.ts:64-74`) but `hover ∉ VALUE_ACTIONS` (`:89-97`). The editor shows the
   Locator block, not a value input.
7. **The action picker's `hover` entry is the real feature signal** — `hover` was removed from
   `RETIRED_ACTIONS` (`:117-121`) when Playwright 1.56 added it to the recorder model. `scroll`/`wait`/
   `screenshot` remain in `ACTION_LABEL_KEYS`/`ACTION_ICONS` (so stored monitors still render) but are
   filtered out of `actionOptions` (`:169-175`). Assert `hover` is **present** and `scroll`/`wait`/
   `screenshot` are **absent** in the picker to pin this behavior.
8. **Server-side validation** (`src/config/src/meta/synthetics.rs:1944-1960`): `button ∈ {left,middle,right}`
   and `click_count ∈ 1..=3`. The UI's picker can only produce these values, so this only matters if
   the spec drives an API-level assertion.
9. **Saving is heavy** — a save requires: valid name + URL + at least one location (Configure step) +
   first step `navigate` + every element-action step carrying a locator candidate. The run-budget
   check (`CreateBrowserTest.vue:705-722`) also rejects two device combos at the default `retries:1`.
   Keep the save round-trip to a single focused test; default to model-level assertions elsewhere.
