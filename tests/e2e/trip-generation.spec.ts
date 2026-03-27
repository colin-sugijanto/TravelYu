import { test, expect } from "@playwright/test";

test.describe("Trip Generation Flow", () => {
  test.skip("should complete intake chat and generate comparison options", async ({ page }) => {
    test.skip(true, "Requires Clerk authentication - manual testing needed");
    
    await page.goto("/login");
    await page.waitForURL(/.*dashboard/);

    await page.click('text="Mulai Trip Baru"');
    
    await expect(page).toHaveURL(/.*\/trip\/new\/intake/);

    await page.fill('input[placeholder="Tulis jawaban kamu..."]', "2 orang, saya dan pasangan");
    await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");

    await page.waitForTimeout(2000);

    await page.fill('input[placeholder="Tulis jawaban kamu..."]', "Bali, 5 hari 4 malam");
    await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");

    await page.waitForTimeout(2000);

    await page.fill('input[placeholder="Tulis jawaban kamu..."]', "Budget sekitar 15 juta");
    await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");

    await page.waitForTimeout(2000);

    await page.fill('input[placeholder="Tulis jawaban kamu..."]', "Santai, lebih suka pantai dan kuliner");
    await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");

    await page.waitForTimeout(3000);

    await expect(page).toHaveURL(/.*\/trip\/new\/compare/);
  });

  test.skip("should select comparison option and generate itinerary", async ({ page }) => {
    test.skip(true, "Requires Clerk authentication - manual testing needed");
    
    await page.goto("/login");
    await page.waitForURL(/.*dashboard/);

    const tripCards = await page.locator('[data-testid="trip-card"]').all();
    if (tripCards.length > 0) {
      await tripCards[0].click();
    } else {
      await page.click('text="Mulai Trip Baru"');
      await page.waitForURL(/.*\/trip\/new\/intake/);
      await page.fill('input[placeholder="Tulis jawaban kamu..."]', "Solo traveler");
      await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");
      await page.waitForTimeout(1000);
      await page.fill('input[placeholder="Tulis jawaban kamu..."]', "Yogyakarta, 3 hari");
      await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");
      await page.waitForTimeout(1000);
      await page.fill('input[placeholder="Tulis jawaban kamu..."]', "Budget 5 juta");
      await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");
      await page.waitForTimeout(1000);
      await page.fill('input[placeholder="Tulis jawaban kamu..."]', "Budaya dan sejarah");
      await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");
      await page.waitForTimeout(3000);
    }

    await expect(page).toHaveURL(/.*\/trip\/new\/compare/);

    const optionButtons = await page.locator('button:has-text("Pilih Opsi Ini")').all();
    if (optionButtons.length > 0) {
      await optionButtons[0].click();
      await page.waitForTimeout(1000);
    }

    await page.click('text="Generate Itinerary"');

    await page.waitForURL(/.*\/trip\/[a-f0-9-]+/);

    await expect(page.locator('text="Sedang Diproses AI"')).toBeVisible();

    await page.waitForFunction(
      () => {
        const statusBadge = document.querySelector('[data-testid="trip-status"]');
        return statusBadge?.textContent?.includes("Disetujui") || 
               statusBadge?.textContent?.includes("Draft");
      },
      { timeout: 120000 }
    );

    await expect(page.locator('text="Itinerary"')).toBeVisible();
  });

  test.skip("should handle generation timeout gracefully", async ({ page }) => {
    test.skip(true, "Requires Clerk authentication - manual testing needed");
    
    await page.goto("/login");
    await page.waitForURL(/.*dashboard/);

    await page.click('text="Mulai Trip Baru"');
    await page.waitForURL(/.*\/trip\/new\/intake/);

    await page.fill('input[placeholder="Tulis jawaban kamu..."]', "Test timeout");
    await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");
    await page.waitForTimeout(500);
    await page.fill('input[placeholder="Tulis jawaban kamu..."]', "Jakarta");
    await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");
    await page.waitForTimeout(500);
    await page.fill('input[placeholder="Tulis jawaban kamu..."]', "1 hari");
    await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");
    await page.waitForTimeout(500);
    await page.fill('input[placeholder="Tulis jawaban kamu..."]', "Budget 1 juta");
    await page.press('input[placeholder="Tulis jawaban kamu..."]', "Enter");
    await page.waitForTimeout(3000);

    await expect(page).toHaveURL(/.*\/trip\/new\/compare/);

    const optionButtons = await page.locator('button:has-text("Pilih Opsi Ini")').all();
    if (optionButtons.length > 0) {
      await optionButtons[0].click();
      await page.waitForTimeout(500);
    }

    await page.click('text="Generate Itinerary"');

    await page.waitForURL(/.*\/trip\/[a-f0-9-]+/);
    await expect(page.locator('text="Sedang Diproses AI"')).toBeVisible();

    await page.waitForTimeout(185000);

    const statusBadge = await page.locator('[data-testid="trip-status"]').textContent();
    expect(statusBadge).toMatch(/Perencanaan|Draft|Disetujui/);
  });
});
