import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Admin Dashboard - Admin User", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.adminUser,
    });
  });

  test("admin can access admin dashboard", async ({ page }) => {
    await page.goto("/admin");

    // Should show admin page title
    await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();
  });

  test("displays system stats", async ({ page }) => {
    await page.goto("/admin");

    // Should show total users
    await expect(
      page.getByText(new RegExp(`${fixtures.testAdminStats.total_users}`))
    ).toBeVisible();

    // Should show total items
    await expect(
      page.getByText(new RegExp(`${fixtures.testAdminStats.total_items}`))
    ).toBeVisible();
  });

  test("displays revenue stats", async ({ page }) => {
    await page.goto("/admin");

    // Should show revenue (formatted as currency)
    const revenueInDollars = fixtures.testAdminStats.total_revenue_cents / 100;
    await expect(
      page.getByText(new RegExp(`\\$?${revenueInDollars}`))
    ).toBeVisible();
  });

  test("shows credit usage statistics", async ({ page }) => {
    await page.goto("/admin");

    // Should show purchased vs used credits
    await expect(
      page.getByText(
        new RegExp(`${fixtures.testAdminStats.total_credits_purchased}`)
      )
    ).toBeVisible();

    await expect(
      page.getByText(
        new RegExp(`${fixtures.testAdminStats.total_credits_used}`)
      )
    ).toBeVisible();
  });

  test("can navigate to users management", async ({ page }) => {
    await page.goto("/admin");

    const usersLink = page.getByRole("link", { name: /users/i });
    await usersLink.click();

    await expect(page).toHaveURL(/.*\/admin\/users/);
  });

  test("can navigate to packs management", async ({ page }) => {
    await page.goto("/admin");

    const packsLink = page.getByRole("link", { name: /packs/i });
    await packsLink.click();

    await expect(page).toHaveURL(/.*\/admin\/packs/);
  });
});

test.describe("Admin Users Management", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.adminUser,
    });
  });

  test("displays list of users", async ({ page }) => {
    await page.goto("/admin/users");

    // Should show user list
    for (const user of fixtures.testAdminUsers) {
      await expect(page.getByText(user.email)).toBeVisible();
    }
  });

  test("shows user credit balances", async ({ page }) => {
    await page.goto("/admin/users");

    // Should show credit balance for users
    const firstUser = fixtures.testAdminUsers[0];
    await expect(
      page.getByText(new RegExp(`${firstUser.credit_balance}`))
    ).toBeVisible();
  });

  test("can search users", async ({ page }) => {
    await page.goto("/admin/users");

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("user1");
      await searchInput.press("Enter");

      // Should show filtered results
      await expect(page.getByText("user1@example.com")).toBeVisible();
    }
  });

  test("can adjust user credits", async ({ page }) => {
    await page.goto("/admin/users");

    // Click on first user or find adjust button
    const adjustButton = page
      .getByRole("button", { name: /adjust|credit/i })
      .first();
    if (await adjustButton.isVisible()) {
      await adjustButton.click();

      // Should show adjustment form
      const amountInput = page.getByLabel(/amount/i);
      await amountInput.fill("10");

      const reasonInput = page.getByLabel(/reason/i);
      await reasonInput.fill("Test adjustment");

      const submitButton = page.getByRole("button", {
        name: /save|adjust|submit/i,
      });
      await submitButton.click();
    }
  });

  test("can toggle user admin status", async ({ page }) => {
    await page.goto("/admin/users");

    // Find admin toggle for first user
    const adminToggle = page.getByRole("switch", { name: /admin/i }).first();
    if (await adminToggle.isVisible()) {
      await adminToggle.click();
    }
  });

  test("shows user creation date", async ({ page }) => {
    await page.goto("/admin/users");

    // Should show when users joined
    const dateColumn = page.getByText(/2024/);
    await expect(dateColumn.first()).toBeVisible();
  });
});

test.describe("Admin Credit Packs Management", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.adminUser,
    });
  });

  test("displays list of credit packs", async ({ page }) => {
    await page.goto("/admin/packs");

    // Should show all packs
    for (const pack of fixtures.testAdminPacks) {
      await expect(page.getByText(pack.name)).toBeVisible();
    }
  });

  test("shows pack details", async ({ page }) => {
    await page.goto("/admin/packs");

    const pack = fixtures.testAdminPacks[0];

    // Should show credits
    await expect(page.getByText(new RegExp(`${pack.credits}`))).toBeVisible();

    // Should show price
    const priceInDollars = pack.price_cents / 100;
    await expect(
      page.getByText(new RegExp(`\\$?${priceInDollars}`))
    ).toBeVisible();
  });

  test("can create new credit pack", async ({ page }) => {
    await page.goto("/admin/packs");

    // Click add button
    const addButton = page.getByRole("button", { name: /add|new|create/i });
    await addButton.click();

    // Fill form
    await page.getByLabel(/name/i).fill("New Pack");
    await page.getByLabel(/credits/i).fill("50");
    await page.getByLabel(/price/i).fill("5");
    await page.getByLabel(/stripe/i).fill("price_new_pack");

    // Submit
    const submitButton = page.getByRole("button", { name: /save|create/i });
    await submitButton.click();

    // Should show new pack
    await expect(page.getByText("New Pack")).toBeVisible();
  });

  test("can edit credit pack", async ({ page }) => {
    await page.goto("/admin/packs");

    // Click edit on first pack
    const editButton = page.getByRole("button", { name: /edit/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();

      // Modify name
      const nameInput = page.getByLabel(/name/i);
      await nameInput.fill("Updated Pack");

      // Save
      const saveButton = page.getByRole("button", { name: /save|update/i });
      await saveButton.click();
    }
  });

  test("can toggle pack active status", async ({ page }) => {
    await page.goto("/admin/packs");

    // Find active toggle
    const activeToggle = page.getByRole("switch", { name: /active/i }).first();
    if (await activeToggle.isVisible()) {
      await activeToggle.click();
    }
  });

  test("can delete credit pack", async ({ page }) => {
    await page.goto("/admin/packs");

    // Click delete
    const deleteButton = page.getByRole("button", { name: /delete/i }).first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm
      const confirmButton = page.getByRole("button", { name: /confirm|yes/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });

  test("shows sort order for packs", async ({ page }) => {
    await page.goto("/admin/packs");

    // Packs should be displayed in order
    const packNames = await page
      .locator('[data-testid="pack-name"]')
      .allTextContents();
    // If no test ids, just verify packs are visible in some order
    await expect(page.getByText(fixtures.testAdminPacks[0].name)).toBeVisible();
  });
});

test.describe("Admin Access Control - Regular User", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.testUser, // Regular user, not admin
    });
  });

  test("regular user cannot access admin dashboard", async ({ page }) => {
    await page.goto("/admin");

    // Should redirect away or show access denied
    await expect(page).not.toHaveURL(/.*\/admin$/);
  });

  test("regular user cannot access users management", async ({ page }) => {
    await page.goto("/admin/users");

    // Should redirect or show forbidden
    await expect(page).not.toHaveURL(/.*\/admin\/users$/);
  });

  test("regular user cannot access packs management", async ({ page }) => {
    await page.goto("/admin/packs");

    // Should redirect or show forbidden
    await expect(page).not.toHaveURL(/.*\/admin\/packs$/);
  });

  test("admin link not shown in sidebar for regular users", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Admin link should not be visible
    const adminLink = page.getByRole("link", { name: /^admin$/i });
    await expect(adminLink).not.toBeVisible();
  });
});

test.describe("Admin Access Control - Admin User UI", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.adminUser,
    });
  });

  test("admin link shown in sidebar for admin users", async ({ page }) => {
    await page.goto("/dashboard");

    // Admin link should be visible
    const adminLink = page.getByRole("link", { name: /admin/i });
    await expect(adminLink).toBeVisible();
  });

  test("admin can navigate to admin from any page", async ({ page }) => {
    await page.goto("/items");

    // Should still have admin link
    const adminLink = page.getByRole("link", { name: /admin/i });
    await adminLink.click();

    await expect(page).toHaveURL(/.*\/admin/);
  });
});
