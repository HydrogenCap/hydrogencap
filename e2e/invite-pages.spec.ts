import { expect, test } from '@playwright/test';
import { mockSupabaseRpc } from './helpers/supabase';

test.describe('Invite Pages', () => {
  test('renders the invalid tenant invite state', async ({ page }) => {
    await mockSupabaseRpc(page, 'get_tenant_portal_invite', { status: 'invalid' });

    await page.goto('/tenant-portal/accept/test-tenant-token');

    await expect(page.getByText('Invalid Invite')).toBeVisible();
    await expect(page.getByText(/contact your landlord for a new invite/i)).toBeVisible();
  });

  test('prefills the tenant invite email for a valid token', async ({ page }) => {
    await mockSupabaseRpc(page, 'get_tenant_portal_invite', {
      status: 'valid',
      email: 'tenant@example.com',
    });

    await page.goto('/tenant-portal/accept/test-tenant-token');

    await expect(page.getByText('Tenant Portal Invite')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveValue('tenant@example.com');
    await expect(page.locator('input[type="email"]')).toBeDisabled();
    await page.getByRole('button', { name: 'Sign in' }).click({ force: true });
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('renders the expired shareholder invite state', async ({ page }) => {
    await mockSupabaseRpc(page, 'get_shareholder_invite', { status: 'expired' });

    await page.goto('/portal/accept/test-shareholder-token');

    await expect(page.getByText('Invitation Expired')).toBeVisible();
    await expect(page.getByText(/contact the portfolio owner for a new invitation/i)).toBeVisible();
  });

  test('prefills the shareholder invite details for a valid token', async ({ page }) => {
    await mockSupabaseRpc(page, 'get_shareholder_invite', {
      status: 'valid',
      email: 'shareholder@example.com',
      name: 'Jamie Investor',
    });

    await page.goto('/portal/accept/test-shareholder-token');

    await expect(page.getByText("You're Invited")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveValue('shareholder@example.com');
    await expect(page.locator('input[type="email"]')).toBeDisabled();
    await expect(page.getByPlaceholder('John Smith')).toHaveValue('Jamie Investor');
    await expect(page.getByRole('button', { name: 'Create Account & Accept' })).toBeVisible();
  });
});
