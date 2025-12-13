import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Admin Dashboard", () => {
  test.describe("Desktop viewport", () => {
    test("displays key metrics with correct values", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      // Wait for stats to load
      await expect(page.getByTestId("admin-metrics-grid")).toBeVisible();

      // Check Total Users stat
      const totalUsersStat = page.getByTestId("stat-total-users");
      await expect(totalUsersStat).toBeVisible();
      await expect(totalUsersStat).toContainText("150");

      // Check that Total Users has a trend badge showing recent signups
      const trendBadge = page.getByTestId("stat-total-users-trend");
      await expect(trendBadge).toBeVisible();
      await expect(trendBadge).toContainText("12");

      // Check Total Revenue stat
      const totalRevenueStat = page.getByTestId("stat-total-revenue");
      await expect(totalRevenueStat).toBeVisible();
      await expect(totalRevenueStat).toContainText("$2500.00");

      // Check Credits Used stat
      const creditsUsedStat = page.getByTestId("stat-credits-used");
      await expect(creditsUsedStat).toBeVisible();
      await expect(creditsUsedStat).toContainText("7500");
      await expect(creditsUsedStat).toContainText("10000");

      // Check Total Items stat
      const totalItemsStat = page.getByTestId("stat-total-items");
      await expect(totalItemsStat).toBeVisible();
      await expect(totalItemsStat).toContainText("5000");
    });

    test("displays quick action cards with correct badges", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      await expect(page.getByTestId("quick-actions-grid")).toBeVisible();

      // Users quick action
      const usersAction = page.getByTestId("quick-action-users");
      await expect(usersAction).toBeVisible();
      await expect(page.getByTestId("quick-action-users-badge")).toContainText(
        "150"
      );

      // Feedback quick action with pending count
      const feedbackAction = page.getByTestId("quick-action-feedback");
      await expect(feedbackAction).toBeVisible();
      const feedbackBadge = page.getByTestId("quick-action-feedback-badge");
      await expect(feedbackBadge).toBeVisible();
      await expect(feedbackBadge).toContainText("3");

      // Credit Packs quick action
      const packsAction = page.getByTestId("quick-action-packs");
      await expect(packsAction).toBeVisible();
      await expect(page.getByTestId("quick-action-packs-badge")).toContainText(
        "3"
      );

      // Webhooks quick action
      const webhooksAction = page.getByTestId("quick-action-webhooks");
      await expect(webhooksAction).toBeVisible();
    });

    test("displays recent activity feed with all activity types", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      const activityFeed = page.getByTestId("recent-activity-feed");
      await expect(activityFeed).toBeVisible();

      // Check that all three activity items are displayed
      await expect(activityFeed.getByText("New user registered")).toBeVisible();
      await expect(activityFeed.getByText("newuser@example.com")).toBeVisible();

      await expect(
        activityFeed.getByText("Bug report submitted")
      ).toBeVisible();
      await expect(
        activityFeed.getByText("Unable to upload images")
      ).toBeVisible();

      await expect(
        activityFeed.getByText("Credit pack purchased")
      ).toBeVisible();
      await expect(
        activityFeed.getByText("Standard Pack - 100 credits")
      ).toBeVisible();
    });

    test("displays additional stats row", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      await expect(page.getByTestId("additional-stats-grid")).toBeVisible();

      // Active Packs
      const activePacksStat = page.getByTestId("stat-active-packs");
      await expect(activePacksStat).toBeVisible();
      await expect(activePacksStat).toContainText("3");

      // Credits Purchased
      const creditsPurchasedStat = page.getByTestId("stat-credits-purchased");
      await expect(creditsPurchasedStat).toBeVisible();
      await expect(creditsPurchasedStat).toContainText("10,000");

      // Pending Feedback
      const pendingFeedbackStat = page.getByTestId("stat-pending-feedback");
      await expect(pendingFeedbackStat).toBeVisible();
      await expect(pendingFeedbackStat).toContainText("3");
    });

    test("navigates to users page when clicking users quick action", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      const usersAction = page.getByTestId("quick-action-users");
      await expect(usersAction).toBeVisible();
      await usersAction.click();

      await expect(page).toHaveURL(/.*\/admin\/users/);
    });

    test("navigates to feedback page when clicking feedback quick action", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      const feedbackAction = page.getByTestId("quick-action-feedback");
      await expect(feedbackAction).toBeVisible();
      await feedbackAction.click();

      await expect(page).toHaveURL(/.*\/admin\/feedback/);
    });

    test("navigates to packs page when clicking credit packs quick action", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      const packsAction = page.getByTestId("quick-action-packs");
      await expect(packsAction).toBeVisible();
      await packsAction.click();

      await expect(page).toHaveURL(/.*\/admin\/packs/);
    });

    test("navigates to webhooks page when clicking webhooks quick action", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      const webhooksAction = page.getByTestId("quick-action-webhooks");
      await expect(webhooksAction).toBeVisible();
      await webhooksAction.click();

      await expect(page).toHaveURL(/.*\/admin\/webhooks/);
    });

    test("navigates to users page when clicking total users stat", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      const totalUsersStat = page.getByTestId("stat-total-users");
      await expect(totalUsersStat).toBeVisible();
      await totalUsersStat.click();

      await expect(page).toHaveURL(/.*\/admin\/users/);
    });

    test("navigates to packs page when clicking active packs stat", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      const activePacksStat = page.getByTestId("stat-active-packs");
      await expect(activePacksStat).toBeVisible();
      await activePacksStat.click();

      await expect(page).toHaveURL(/.*\/admin\/packs/);
    });

    test("navigates to feedback page when clicking pending feedback stat", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      const pendingFeedbackStat = page.getByTestId("stat-pending-feedback");
      await expect(pendingFeedbackStat).toBeVisible();
      await pendingFeedbackStat.click();

      await expect(page).toHaveURL(/.*\/admin\/feedback/);
    });
  });

  test.describe("Mobile viewport", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("displays key metrics in mobile layout", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      // All stats should be visible in mobile
      await expect(page.getByTestId("stat-total-users")).toBeVisible();
      await expect(page.getByTestId("stat-total-revenue")).toBeVisible();
      await expect(page.getByTestId("stat-credits-used")).toBeVisible();
      await expect(page.getByTestId("stat-total-items")).toBeVisible();
    });

    test("displays quick actions in mobile layout", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      // Scroll to quick actions section
      await page.getByTestId("quick-actions-grid").scrollIntoViewIfNeeded();

      await expect(page.getByTestId("quick-action-users")).toBeVisible();
      await expect(page.getByTestId("quick-action-feedback")).toBeVisible();
      await expect(page.getByTestId("quick-action-packs")).toBeVisible();
      await expect(page.getByTestId("quick-action-webhooks")).toBeVisible();
    });

    test("displays recent activity feed in mobile layout", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      // Scroll to activity feed
      await page.getByTestId("recent-activity-feed").scrollIntoViewIfNeeded();

      const activityFeed = page.getByTestId("recent-activity-feed");
      await expect(activityFeed).toBeVisible();

      // Activity items should be visible
      await expect(activityFeed.getByText("New user registered")).toBeVisible();
      await expect(
        activityFeed.getByText("Bug report submitted")
      ).toBeVisible();
      await expect(
        activityFeed.getByText("Credit pack purchased")
      ).toBeVisible();
    });

    test("can navigate from mobile quick actions", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      // Scroll and click users action
      const usersAction = page.getByTestId("quick-action-users");
      await usersAction.scrollIntoViewIfNeeded();
      await usersAction.click();

      await expect(page).toHaveURL(/.*\/admin\/users/);
    });

    test("displays additional stats row in mobile layout", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      // Scroll to additional stats
      await page.getByTestId("additional-stats-grid").scrollIntoViewIfNeeded();

      await expect(page.getByTestId("stat-active-packs")).toBeVisible();
      await expect(page.getByTestId("stat-credits-purchased")).toBeVisible();
      await expect(page.getByTestId("stat-pending-feedback")).toBeVisible();
    });
  });

  test.describe("Edge cases", () => {
    test("displays message when no recent activity", async ({ page }) => {
      await authenticateUser(page);

      // Create custom admin stats with no activity
      const emptyActivityStats = {
        ...fixtures.testAdminStats,
        recent_activity: [],
      };

      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      // Override the stats endpoint with empty activity
      await page.route("**/api/v1/admin/stats", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(emptyActivityStats),
        });
      });

      await page.goto("/admin");

      const activityFeed = page.getByTestId("recent-activity-feed");
      await expect(activityFeed).toBeVisible();
      await expect(page.getByTestId("no-activity-message")).toBeVisible();
    });

    test("does not show trend badge when no recent signups", async ({
      page,
    }) => {
      await authenticateUser(page);

      // Create custom admin stats with no recent signups
      const noSignupsStats = {
        ...fixtures.testAdminStats,
        recent_signups_7d: 0,
      };

      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      // Override the stats endpoint
      await page.route("**/api/v1/admin/stats", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(noSignupsStats),
        });
      });

      await page.goto("/admin");

      const totalUsersStat = page.getByTestId("stat-total-users");
      await expect(totalUsersStat).toBeVisible();

      // Trend badge should not be visible
      await expect(
        page.getByTestId("stat-total-users-trend")
      ).not.toBeVisible();
    });

    test("does not show feedback badge when no pending feedback", async ({
      page,
    }) => {
      await authenticateUser(page);

      // Create custom admin stats with no pending feedback
      const noPendingStats = {
        ...fixtures.testAdminStats,
        pending_feedback_count: 0,
      };

      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      // Override the stats endpoint
      await page.route("**/api/v1/admin/stats", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(noPendingStats),
        });
      });

      await page.goto("/admin");

      const feedbackAction = page.getByTestId("quick-action-feedback");
      await expect(feedbackAction).toBeVisible();

      // Badge should not be visible
      await expect(
        page.getByTestId("quick-action-feedback-badge")
      ).not.toBeVisible();
    });
  });
});
