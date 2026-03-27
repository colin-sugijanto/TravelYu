import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("should load homepage successfully", async ({ page }) => {
    await page.goto("/");
    
    await expect(page).toHaveTitle(/TravelYu/);
    await expect(page.locator("text=TravelYu")).toBeVisible();
  });
});

test.describe("Authentication Redirects", () => {
  test("should redirect to login when accessing dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("should redirect to login when accessing trip", async ({ page }) => {
    await page.goto("/trip/test-123");
    
    await expect(page).toHaveURL(/.*\/login/);
  });
});

test.describe("Login Page", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/login");
    
    await expect(page.getByRole("heading", { name: /Login ke TravelYu/i })).toBeVisible({ timeout: 10000 });
  });
});
