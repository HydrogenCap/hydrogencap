import { expect, test } from '@playwright/test';
import { mockSupabaseRpc } from './helpers/supabase';

test.describe('Shared Document Page', () => {
  test('shows an access error when the share RPC rejects the token', async ({ page }) => {
    await mockSupabaseRpc(page, 'consume_document_share_link', {
      error: 'This share link has expired.',
    });

    await page.goto('/shared/expired-token');

    await expect(page.getByText('Unable to Access Document')).toBeVisible();
    await expect(page.getByText('This share link has expired.')).toBeVisible();
  });

  test('renders the shared document card for a valid token', async ({ page }) => {
    await mockSupabaseRpc(page, 'consume_document_share_link', {
      success: true,
      file_url: '/favicon.ico',
      file_name: 'Property Summary.txt',
      expires_at: new Date('2026-12-31T00:00:00.000Z').toISOString(),
      bucket_id: null,
    });

    await page.goto('/shared/valid-token');

    await expect(page.getByText('Property Summary.txt')).toBeVisible();
    await expect(page.getByRole('button', { name: /download document/i })).toBeVisible();
    await expect(page.getByText(/this document has been shared with you securely/i)).toBeVisible();
  });
});
