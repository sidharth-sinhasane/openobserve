/**
 * Synthetics Browser Test — Click Types & Hover Action E2E Tests
 *
 * Verifies, end-to-end through the UI, the browser-check journey step editor's
 * click-type picker (left / right / middle / double — stored as button + click_count)
 * and the first-class `hover` action:
 *   - the click-type picker renders only on `click` steps,
 *   - picking a type writes the correct button/click_count pair and updates the row label,
 *   - `hover` appears in the action picker, drops the click-type picker, and demands a
 *     locator but no value,
 *   - leaving `click` discards stale click metadata.
 *
 * Prerequisites (see docs/test_generator/ci/setup-contract.md):
 *   - ENTERPRISE build with the backend /config flag `synthetics_enabled` truthy. The
 *     synthetics routes redirect home otherwise — every test asserts the URL first.
 *   - No extension, no streams, no data: the editor is driven by in-memory model state.
 *     Always entered via "Build manually" (the extension-free path into the editor).
 *
 * Tags: @enterprise (enterprise-only routes), @synthetics, @synthetics-click-types.
 */

const { test, expect, navigateToBase } = require('../utils/enhanced-baseFixtures.js');
const testLogger = require('../utils/test-logger.js');
const PageManager = require('../../pages/page-manager.js');

test.describe("Synthetics Browser Test Click Types & Hover Action testcases", { tag: '@enterprise' }, () => {
  test.describe.configure({ mode: 'parallel' });
  let pm;

  test.beforeEach(async ({ page }, testInfo) => {
    testLogger.testStart(testInfo.title, testInfo.file);
    await navigateToBase(page);
    pm = new PageManager(page);
    // Shared setup: gate → Build manually → editor on the Journey step (empty journey).
    await pm.createBrowserTestPage.openJourneyEditor('synthetics-click-types', 'https://example.com');
    testLogger.info('Test setup completed');
  });

  // ==========================================================================
  // P0 — CRITICAL PATH
  // ==========================================================================

  test("P0: Set a non-default click type on a click step updates the row label to \"Right click\"", {
    tag: ['@synthetics-click-types', '@synthetics', '@ui', '@enterprise', '@all', '@P0']
  }, async ({ page }) => {
    testLogger.info('Adding a click step and selecting the right click type');

    await pm.createBrowserTestPage.addStep(0);

    // The click-type picker renders only on a `click` step; a fresh step is one.
    await pm.createBrowserTestPage.expectClickTypeSelectVisible(0);
    // Default (left/1) reads back as the plain action label.
    await pm.createBrowserTestPage.expectStepLabel('Click', 0);

    await pm.createBrowserTestPage.selectClickType('right', 0);
    await pm.createBrowserTestPage.expectStepLabel('Right click', 0);

    testLogger.info('✅ Right click type written and row label updated');
  });

  test("P0: Convert a click step to a hover step hides the click-type picker and shows the locator block without a value input", {
    tag: ['@synthetics-click-types', '@synthetics', '@ui', '@enterprise', '@all', '@P0']
  }, async ({ page }) => {
    testLogger.info('Converting a click step to a hover step');

    await pm.createBrowserTestPage.addStep(0);
    await pm.createBrowserTestPage.expectClickTypeSelectVisible(0);

    await pm.createBrowserTestPage.selectAction('hover', 0);

    // hover is not a click step → the click-type picker disappears.
    await pm.createBrowserTestPage.expectClickTypeSelectHidden(0);
    // hover ∈ SELECTOR_ACTIONS → the locator block renders.
    await pm.createBrowserTestPage.expectLocatorBlockVisible(0);
    // hover ∉ VALUE_ACTIONS → no value input.
    await pm.createBrowserTestPage.expectValueInputHidden(0);

    testLogger.info('✅ Hover step hides click-type picker and shows locator, no value input');
  });

  // ==========================================================================
  // P1 — IMPORTANT VARIATIONS
  // ==========================================================================

  test("P1: Each click type maps to its correct row label (double, middle, left)", {
    tag: ['@synthetics-click-types', '@synthetics', '@ui', '@enterprise', '@all', '@P1']
  }, async ({ page }) => {
    testLogger.info('Verifying double / middle / left click-type labels');

    await pm.createBrowserTestPage.addStep(0);

    await pm.createBrowserTestPage.selectClickType('double', 0);
    await pm.createBrowserTestPage.expectStepLabel('Double click', 0);

    await pm.createBrowserTestPage.selectClickType('middle', 0);
    await pm.createBrowserTestPage.expectStepLabel('Middle click', 0);

    // left/1 is the absent-field default — the badge returns to plain "Click".
    await pm.createBrowserTestPage.selectClickType('left', 0);
    await pm.createBrowserTestPage.expectStepLabel('Click', 0);

    testLogger.info('✅ double / middle / left map to the correct labels');
  });

  test("P1: The action picker offers hover and omits retired actions", {
    tag: ['@synthetics-click-types', '@synthetics', '@ui', '@enterprise', '@all', '@P1']
  }, async ({ page }) => {
    testLogger.info('Checking the action picker vocabulary (hover present, retired absent)');

    await pm.createBrowserTestPage.addStep(0);
    await pm.createBrowserTestPage.openActionDropdown(0);

    // hover is a first-class action (no longer retired).
    await pm.createBrowserTestPage.expectActionOptionPresent('hover');
    // scroll / wait / screenshot stay out of the authoring vocabulary.
    await pm.createBrowserTestPage.expectActionOptionAbsent('scroll');
    await pm.createBrowserTestPage.expectActionOptionAbsent('wait');
    await pm.createBrowserTestPage.expectActionOptionAbsent('screenshot');

    testLogger.info('✅ hover present, retired actions absent');
  });

  test("P1: Leaving click clears click metadata so returning to click shows a plain \"Click\"", {
    tag: ['@synthetics-click-types', '@synthetics', '@ui', '@enterprise', '@all', '@P1']
  }, async ({ page }) => {
    testLogger.info('Verifying click metadata is discarded when leaving click');

    await pm.createBrowserTestPage.addStep(0);
    await pm.createBrowserTestPage.selectClickType('right', 0);
    await pm.createBrowserTestPage.expectStepLabel('Right click', 0);

    // Leaving click clears button/clickCount → the picker disappears.
    await pm.createBrowserTestPage.selectAction('hover', 0);
    await pm.createBrowserTestPage.expectClickTypeSelectHidden(0);

    // Returning to click starts from the left/1 default, not a stray "Right click".
    await pm.createBrowserTestPage.selectAction('click', 0);
    await pm.createBrowserTestPage.expectClickTypeSelectVisible(0);
    await pm.createBrowserTestPage.expectStepLabel('Click', 0);

    testLogger.info('✅ Click metadata discarded on leaving click');
  });

  test("P1: A journey with a right-click and a hover step saves successfully", {
    tag: ['@synthetics-click-types', '@synthetics', '@ui', '@enterprise', '@all', '@P1']
  }, async ({ page }) => {
    testLogger.info('Building and saving a journey with a right-click and a hover step');

    // First step must navigate.
    await pm.createBrowserTestPage.addStep(0);
    await pm.createBrowserTestPage.selectAction('navigate', 0);
    await pm.createBrowserTestPage.fillValue('https://example.com', 0);

    // Second step: a right-click carrying a locator candidate.
    await pm.createBrowserTestPage.addStep(1);
    await pm.createBrowserTestPage.addLocatorCandidate('[data-test=hero]', 1);
    await pm.createBrowserTestPage.selectClickType('right', 1);
    await pm.createBrowserTestPage.expectStepLabel('Right click', 1);

    // Third step: a hover carrying a locator candidate.
    await pm.createBrowserTestPage.addStep(2);
    await pm.createBrowserTestPage.selectAction('hover', 2);
    await pm.createBrowserTestPage.addLocatorCandidate('[data-test=hero]', 2);

    await pm.createBrowserTestPage.continueToConfigure();
    await pm.createBrowserTestPage.expectConfigureVisible();

    // A selectable location is a hard prerequisite for saving (global-setup
    // provisioning). Skip gracefully when the environment has none — this is an
    // environment gap, not a code wiring gap.
    const hasLocation = await pm.createBrowserTestPage.hasAnyLocation();
    test.skip(!hasLocation, 'No synthetics location provisioned in this environment');

    await pm.createBrowserTestPage.selectFirstLocation();
    await pm.createBrowserTestPage.save();

    // Server accepts button:"right" and the hover action → success toast, no error.
    await pm.createBrowserTestPage.expectSaveSuccess();

    testLogger.info('✅ Journey with right-click and hover saved successfully');
  });

  // ==========================================================================
  // P2 — EDGE CASES
  // ==========================================================================

  test("P2: A hover step without a locator blocks the journey with a locator-required error", {
    tag: ['@synthetics-click-types', '@synthetics', '@ui', '@enterprise', '@all', '@P2']
  }, async ({ page }) => {
    testLogger.info('Verifying a hover step without a locator is rejected');

    // Valid first step (navigate) so the hover step is the one that fails validation.
    await pm.createBrowserTestPage.addStep(0);
    await pm.createBrowserTestPage.selectAction('navigate', 0);
    await pm.createBrowserTestPage.fillValue('https://example.com', 0);

    // Hover step with no locator candidate.
    await pm.createBrowserTestPage.addStep(1);
    await pm.createBrowserTestPage.selectAction('hover', 1);

    await pm.createBrowserTestPage.continueToConfigure();

    // validateStepSelectors blocks the transition and surfaces the locator-required
    // error inline on the hover step.
    await pm.createBrowserTestPage.expectLocatorErrorVisible(1);

    testLogger.info('✅ Hover without a locator is blocked with the locator-required error');
  });

  test("P2: A hand-added step action change shows no discard notice", {
    tag: ['@synthetics-click-types', '@synthetics', '@ui', '@enterprise', '@all', '@P2']
  }, async ({ page }) => {
    testLogger.info('Verifying no discard notice on a hand-added step action change');

    await pm.createBrowserTestPage.addStep(0);
    await pm.createBrowserTestPage.selectAction('navigate', 0);

    // The "recorded payload discarded" notice is recorded-steps-only; a hand-added
    // step has no `wire`, so switching its action must not show it.
    await pm.createBrowserTestPage.expectActionChangedNoticeHidden(0);

    testLogger.info('✅ No discard notice on a hand-added step');
  });
});
