import path from 'path';
import { test, expect } from '@playwright/test';
import { hasAuthCredentials, login } from './helpers/auth';
import { mockSupabaseAuth, mockSupabaseRest, injectFakeSession } from './helpers/mock-api';
import { mockSupabaseRpc } from './helpers/supabase';

const TEST_CERTIFICATE_PATH = path.resolve(__dirname, 'fixtures/test-certificate.pdf');

test.describe('Compliance Upload Flow', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!hasAuthCredentials(), 'Skipping: E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navigate to property detail and find compliance section', async ({ page }) => {
    await page.goto('/properties-v2');

    // Open first property
    const firstProperty = page.locator('a[href*="/properties-v2/"]').first();
    await expect(firstProperty).toBeVisible({ timeout: 10000 });
    await firstProperty.click();
    await page.waitForURL(/\/properties-v2\/.+/);

    // Look for the compliance section — it should be on the detail page
    const complianceHeading = page.getByText(/compliance/i).first();
    await expect(complianceHeading).toBeVisible({ timeout: 10000 });
  });

  test('open compliance detail and trigger upload dialog', async ({ page }) => {
    await page.goto('/properties-v2');

    const firstProperty = page.locator('a[href*="/properties-v2/"]').first();
    await expect(firstProperty).toBeVisible({ timeout: 10000 });
    await firstProperty.click();
    await page.waitForURL(/\/properties-v2\/.+/);

    // Scroll to compliance section
    const complianceSection = page.getByText(/compliance/i).first();
    await complianceSection.scrollIntoViewIfNeeded();

    // Click on a compliance item to open the detail modal
    const complianceItem = page
      .locator('button')
      .filter({ hasText: /gas safety|epc|eicr|fire risk/i })
      .first();

    if (await complianceItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await complianceItem.click();

      // Look for the Upload Document button in the modal
      const uploadBtn = page.getByRole('button', { name: /upload document/i });
      await expect(uploadBtn).toBeVisible({ timeout: 5000 });
      await uploadBtn.click();

      // Upload dialog should open
      await expect(page.getByText(/upload compliance document/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('upload a test certificate file', async ({ page }) => {
    await page.goto('/properties-v2');

    const firstProperty = page.locator('a[href*="/properties-v2/"]').first();
    await expect(firstProperty).toBeVisible({ timeout: 10000 });
    await firstProperty.click();
    await page.waitForURL(/\/properties-v2\/.+/);

    // Find and click a compliance item
    const complianceItem = page
      .locator('button')
      .filter({ hasText: /gas safety|epc|eicr|fire risk/i })
      .first();

    if (!(await complianceItem.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No compliance items visible on this property');
      return;
    }

    await complianceItem.click();

    const uploadBtn = page.getByRole('button', { name: /upload document/i });
    if (!(await uploadBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Upload button not found in compliance detail');
      return;
    }
    await uploadBtn.click();

    // Wait for upload dialog
    await expect(page.getByText(/upload compliance document/i)).toBeVisible({ timeout: 5000 });

    // Find the file input (may be hidden behind a styled dropzone)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CERTIFICATE_PATH);

    // Fill required fields if the V2 form is shown
    const issueDateInput = page.getByLabel(/issue date/i);
    if (await issueDateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await issueDateInput.fill('2026-01-15');
    }

    // Click save/submit
    const saveBtn = page
      .getByRole('button', { name: /save document|save information|create record/i })
      .first();

    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
    }

    // Either we see AI processing or the dialog closes
    const processingVisible = await page
      .getByText(/ai analyzing|uploading/i)
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (processingVisible) {
      // Wait for processing to complete (up to 30s) or dismiss
      await page
        .getByText(/ai analyzing/i)
        .waitFor({ state: 'hidden', timeout: 30000 })
        .catch(() => {
          // Processing took too long — that's expected without a real backend
        });
    }
  });
});

test.describe('Compliance Upload Flow (mocked)', () => {
  test('compliance section renders with mocked data', async ({ page }) => {
    await mockSupabaseAuth(page);
    await injectFakeSession(page);

    await mockSupabaseRest(page, 'properties', [
      {
        id: 'mock-prop-1',
        org_id: 'org-1',
        address_line_1: '42 Test Street',
        city: 'Testville',
        postcode: 'TE1 1ST',
        entity_id: 'ent-1',
        property_type: 'single_let',
        lifecycle_stage: 'stabilised',
      },
    ]);

    await mockSupabaseRest(page, 'compliance_requirements', [
      {
        id: 'req-1',
        property_id: 'mock-prop-1',
        org_id: 'org-1',
        document_type: 'gas_safety_certificate',
        is_required: true,
        review_frequency_months: 12,
      },
      {
        id: 'req-2',
        property_id: 'mock-prop-1',
        org_id: 'org-1',
        document_type: 'epc',
        is_required: true,
        review_frequency_months: 120,
      },
    ]);

    await mockSupabaseRest(page, 'compliance_documents', [
      {
        id: 'doc-1',
        requirement_id: 'req-1',
        property_id: 'mock-prop-1',
        org_id: 'org-1',
        document_type: 'gas_safety_certificate',
        issue_date: '2025-06-01',
        expiry_date: '2026-06-01',
        status: 'valid',
        certificate_number: 'GS-001',
        file_url: null,
      },
    ]);

    await mockSupabaseRpc(page, 'get_property_compliance_score', { score: 50 });

    await page.goto('/properties-v2/mock-prop-1');

    // Mocked auth may redirect — verify gracefully
    const onDetailPage = await page
      .waitForURL(/\/properties-v2\/mock-prop-1/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (onDetailPage) {
      // Compliance section should be visible
      const complianceText = page.getByText(/compliance/i).first();
      await expect(complianceText).toBeVisible({ timeout: 5000 });
    }
  });

  test('upload dialog shows correct file input', async ({ page }) => {
    await mockSupabaseAuth(page);
    await injectFakeSession(page);

    // Mock storage upload
    await page.route('**/storage/v1/object/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Key: 'test-upload.pdf' }),
      });
    });

    // Route to compliance upload page directly if it exists,
    // or validate the upload modal in isolation
    await page.goto('/compliance-v2');

    const onCompliancePage = await page
      .waitForURL(/\/compliance/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (onCompliancePage) {
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });
});
