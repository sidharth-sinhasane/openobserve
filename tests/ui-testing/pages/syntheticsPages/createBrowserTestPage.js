// createBrowserTestPage.js
//
// Page object for the Synthetics browser-check create editor
// (CreateBrowserTest.vue → BrowserJourney → BrowserJourneyStepEditor).
//
// Selector contract (matches the O2 component "audit pattern", see the comment
// block in StreamsFormValidationPage):
//   - OInput  data-test="<parent>"  →  the native field is <parent>-field
//   - OSelect data-test="<parent>"  →  <parent>-trigger opens the dropdown,
//     <parent>-popover holds the options, <parent>-option[data-test-value] is a choice
//   - OButton data-test="<parent>"  →  lands directly on the <button>
//
// Note: OSelect and OInput both set `inheritAttrs: false`, so the bare parent
// data-test (`synthetics-journey-step-action-select`) matches NO element — only the
// suffixed children exist in the DOM. We therefore target triggers/fields directly.
import { expect } from '@playwright/test';

export class CreateBrowserTestPage {
    constructor(page) {
        this.page = page;

        // ── Gate phase ─────────────────────────────────────────────────────────
        this.urlInput = '[data-test="synthetics-create-url-input-field"]';
        this.nameInput = '[data-test="synthetics-create-name-input-field"]';
        this.buildBtn = '[data-test="synthetics-create-build-btn"]';

        // ── Journey editor ──────────────────────────────────────────────────────
        this.addStepBtn = '[data-test="synthetics-journey-add-step-btn"]';
        this.actionTrigger = 'synthetics-journey-step-action-select-trigger';
        this.actionOptionPrefix = 'synthetics-journey-step-action-select';
        this.clickTypeTrigger = 'synthetics-journey-step-click-type-select-trigger';
        this.clickTypeOptionPrefix = 'synthetics-journey-step-click-type-select';
        this.valueInput = '[data-test="synthetics-journey-step-value-input-field"]';
        this.locatorBlock = '[data-test="synthetics-journey-step-locator"]';
        this.locatorOverrideInput = '[data-test="synthetics-journey-step-locator-override-input-field"]';
        this.locatorAddBtn = '[data-test="synthetics-journey-step-locator-add"]';
        // The save-time "this step names no element" error (`selector-error-message`
        // → BrowserJourneyLocator `errorMessage` prop) renders as the locator OInput's
        // inline error span, not as `synthetics-journey-step-locator-error` (that `<p>`
        // only fires for delete-last / duplicate-append). Target the OInput error.
        this.locatorError = '[data-test="synthetics-journey-step-locator-override-input-error"]';
        this.actionChangedNotice = '[data-test="synthetics-journey-step-action-changed-notice"]';

        // ── Configure phase ─────────────────────────────────────────────────────
        this.continueBtn = '[data-test="synthetics-create-continue-btn"]';
        this.configureLocations = '[data-test="synthetics-check-configure-locations"]';
        this.locationOption = '[data-test^="synthetics-check-locations-option-"]';
        this.saveBtn = '[data-test="synthetics-create-save-btn"]';
        this.toastMessage = '[data-test="o-toast-message"]';
    }

    /** The data row for a step (contains the action-label badge). */
    stepRow(index) {
        return this.page.locator(`[data-test="o2-table-row-${index}"]`);
    }

    /** The expansion row for a step (contains the inline editor). */
    expandedRow(index) {
        return this.page.locator(`[data-test="o2-table-expanded-row-${index}"]`);
    }

    // ── Navigation / gate ──────────────────────────────────────────────────────

    async gotoAddBrowserTest() {
        const url = `${process.env.ZO_BASE_URL}/web/synthetics/add?type=browser&org_identifier=${process.env.ORGNAME}`;
        await this.page.goto(url, { timeout: 60000 });
        await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        // Environment gate (Setup Contract): the synthetics route guard redirects to
        // `/` when the build is OSS or the `synthetics_enabled` flag is false. Assert
        // early so a gated shard fails with a clear URL, not a cascade of selector timeouts.
        await expect(this.page).toHaveURL(/synthetics/, { timeout: 15000 });
    }

    async fillGate(name, url) {
        await this.page.locator(this.nameInput).fill(name);
        await this.page.locator(this.urlInput).fill(url);
    }

    async buildManually() {
        await this.page.locator(this.buildBtn).click();
        // Editor (Journey stepper) mounts; the toolbar Add Step button is the first
        // stable signal that the empty journey is interactive.
        await expect(this.page.locator(this.addStepBtn)).toBeVisible({ timeout: 15000 });
    }

    /** Gate → editor in one call (the shared setup for every test). */
    async openJourneyEditor(name, url) {
        await this.gotoAddBrowserTest();
        await this.fillGate(name, url);
        await this.buildManually();
    }

    // ── Journey step editing ───────────────────────────────────────────────────

    /**
     * Append a step. A new step defaults to action "click", so its click-type
     * trigger appears inside the freshly-revealed expansion row.
     * @param {number} index the 0-based row index the new step will occupy
     */
    async addStep(index) {
        await this.page.locator(this.addStepBtn).click();
        await this.expandedRow(index)
            .locator(`[data-test="${this.clickTypeTrigger}"]`)
            .waitFor({ state: 'visible', timeout: 10000 });
    }

    /**
     * Open an OSelect popover by clicking its trigger until reka-ui reports open.
     * Mirrors `oselectHelpers.openOSelectDropdown`, but targets the exact trigger
     * because OSelect uses `inheritAttrs: false` (the `-select` root does not exist).
     * Waits on `aria-expanded` (auto-retrying) instead of a fixed sleep.
     */
    async openSelect(triggerTestId, stepIndex) {
        const trigger = this.expandedRow(stepIndex).locator(`[data-test="${triggerTestId}"]`);
        await trigger.waitFor({ state: 'visible', timeout: 10000 });
        for (let i = 0; i < 5; i++) {
            if ((await trigger.getAttribute('aria-expanded')) === 'true') return;
            await trigger.click();
            try {
                await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 500 });
                return;
            } catch {
                // reka-ui can open-then-close on a single click — retry the toggle.
            }
        }
        throw new Error(`OSelect popover did not open: ${triggerTestId}`);
    }

    async clickOption(prefix, value) {
        const option = this.page.locator(`[data-test="${prefix}-option"][data-test-value="${value}"]`);
        await expect(option).toBeVisible({ timeout: 5000 });
        await option.click();
    }

    async openActionDropdown(stepIndex = 0) {
        await this.openSelect(this.actionTrigger, stepIndex);
    }

    async selectAction(value, stepIndex = 0) {
        await this.openSelect(this.actionTrigger, stepIndex);
        await this.clickOption(this.actionOptionPrefix, value);
    }

    async selectClickType(type, stepIndex = 0) {
        await this.openSelect(this.clickTypeTrigger, stepIndex);
        await this.clickOption(this.clickTypeOptionPrefix, type);
    }

    async fillValue(value, stepIndex = 0) {
        const input = this.expandedRow(stepIndex).locator(this.valueInput);
        await input.waitFor({ state: 'visible', timeout: 10000 });
        await input.fill(value);
    }

    async addLocatorCandidate(value, stepIndex = 0) {
        const input = this.expandedRow(stepIndex).locator(this.locatorOverrideInput);
        await input.waitFor({ state: 'visible', timeout: 10000 });
        await input.fill(value);
        await this.expandedRow(stepIndex).locator(this.locatorAddBtn).click();
    }

    // ── Assertions ─────────────────────────────────────────────────────────────

    /**
     * The row label badge (OBadge in the step's data row) text. The badge text is
     * scoped to the data row — the inline editor (with its OSelect selected labels
     * that can carry the same string) lives in the separate expansion row.
     */
    async expectStepLabel(text, stepIndex = 0) {
        const badge = this.stepRow(stepIndex).getByText(text, { exact: true }).first();
        await expect(badge).toBeVisible({ timeout: 10000 });
    }

    async expectClickTypeSelectVisible(stepIndex = 0) {
        await expect(
            this.expandedRow(stepIndex).locator(`[data-test="${this.clickTypeTrigger}"]`)
        ).toBeVisible({ timeout: 10000 });
    }

    async expectClickTypeSelectHidden(stepIndex = 0) {
        await expect(
            this.expandedRow(stepIndex).locator(`[data-test="${this.clickTypeTrigger}"]`)
        ).toHaveCount(0);
    }

    async expectLocatorBlockVisible(stepIndex = 0) {
        await expect(this.expandedRow(stepIndex).locator(this.locatorBlock)).toBeVisible({
            timeout: 10000,
        });
    }

    async expectValueInputHidden(stepIndex = 0) {
        await expect(this.expandedRow(stepIndex).locator(this.valueInput)).toHaveCount(0);
    }

    async expectActionChangedNoticeHidden(stepIndex = 0) {
        await expect(this.expandedRow(stepIndex).locator(this.actionChangedNotice)).toHaveCount(0);
    }

    async expectLocatorErrorVisible(stepIndex = 0) {
        await expect(this.expandedRow(stepIndex).locator(this.locatorError)).toBeVisible({
            timeout: 10000,
        });
    }

    /** A single action option exists in the open popover (used for `hover`). */
    async expectActionOptionPresent(value) {
        await expect(
            this.page.locator(`[data-test="${this.actionOptionPrefix}-option"][data-test-value="${value}"]`)
        ).toHaveCount(1);
    }

    /** A single action option is absent from the picker (retired actions). */
    async expectActionOptionAbsent(value) {
        await expect(
            this.page.locator(`[data-test="${this.actionOptionPrefix}-option"][data-test-value="${value}"]`)
        ).toHaveCount(0);
    }

    // ── Configure / save ───────────────────────────────────────────────────────

    async continueToConfigure() {
        await this.page.locator(this.continueBtn).click();
    }

    async expectConfigureVisible() {
        await expect(this.page.locator(this.configureLocations)).toBeVisible({ timeout: 15000 });
    }

    /** True once at least one selectable location renders (after the loading skeleton). */
    async hasAnyLocation() {
        const first = this.page.locator(this.locationOption).first();
        try {
            await first.waitFor({ state: 'visible', timeout: 8000 });
            return true;
        } catch {
            return false;
        }
    }

    async selectFirstLocation() {
        const first = this.page.locator(this.locationOption).first();
        await first.locator('[role="checkbox"]').click();
    }

    async save() {
        await this.page.locator(this.saveBtn).click();
    }

    async expectSaveSuccess() {
        await expect(
            this.page.locator(this.toastMessage).filter({ hasText: 'Check saved successfully.' }).first()
        ).toBeVisible({ timeout: 30000 });
    }
}
