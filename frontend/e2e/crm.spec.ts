import { test, expect } from '@playwright/test';

test.describe('Sales CRM Baseline End-to-End Tests', () => {
  test('Login view displays role authorized access portal', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Sales CRM System')).toBeVisible();
    await expect(page.locator('text=Sign In')).toBeVisible();
  });
});
