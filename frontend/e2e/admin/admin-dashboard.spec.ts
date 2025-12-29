import { http, HttpResponse } from "msw";
import { test, expect, authenticateUser } from "../fixtures/test-setup";
import { adminUser, testAdminStats } from "../fixtures/factories";

test.describe("Admin Dashboard", () => {
  test.beforeEach(async ({ page, network }) => {
    await authenticateUser(page);
    // Set admin user for all tests
    network.use(
      http.get("**/api/v1/auth/me", () => {
        return HttpResponse.json(adminUser);
      })
    );
  });

  test.describe("Desktop viewport", () => {
    test("displays key metrics with correct values", async ({ page }) => {
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

      // Check Credits Used stat (numbers are formatted with thousands separator)
      const creditsUsedStat = page.getByTestId("stat-credits-used");
      await expect(creditsUsedStat).toBeVisible();
      await expect(creditsUsedStat).toContainText("7,500");
      await expect(creditsUsedStat).toContainText("10,000");

      // Check Total Items stat (numbers are formatted with thousands separator)
      const totalItemsStat = page.getByTestId("stat-total-items");
      await expect(totalItemsStat).toBeVisible();
      await expect(totalItemsStat).toContainText("5,000");
    });

    test("displays quick action cards with correct badges", async ({
      page,
    }) => {
      await page.goto("/admin");

      await expect(page.getByTestId("quick-actions-grid")).toBeVisible();

      // Users quick action with badge
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

      // Settings quick action (consolidated from billing, packs, pricing, ai-models)
      const settingsAction = page.getByTestId("quick-action-settings");
      await expect(settingsAction).toBeVisible();

      // Integrations quick action (consolidated from webhooks, api-keys)
      const integrationsAction = page.getByTestId("quick-action-integrations");
      await expect(integrationsAction).toBeVisible();

      // AI Usage quick action
      const aiUsageAction = page.getByTestId("quick-action-ai-usage");
      await expect(aiUsageAction).toBeVisible();
    });

    test("displays recent activity feed with all activity types", async ({
      page,
    }) => {
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
      await page.goto("/admin");

      // Wait for the page to be fully loaded
      await expect(page.getByTestId("quick-actions-grid")).toBeVisible();

      const usersAction = page.getByTestId("quick-action-users");
      await expect(usersAction).toBeVisible();
      await usersAction.click();

      await expect(page).toHaveURL(/.*\/admin\/users/, { timeout: 10000 });
    });

    test("navigates to feedback page when clicking feedback quick action", async ({
      page,
    }) => {
      await page.goto("/admin");

      // Wait for the page to be fully loaded
      await expect(page.getByTestId("quick-actions-grid")).toBeVisible();

      const feedbackAction = page.getByTestId("quick-action-feedback");
      await expect(feedbackAction).toBeVisible();
      await feedbackAction.click();

      await expect(page).toHaveURL(/.*\/admin\/feedback/, { timeout: 10000 });
    });

    test("navigates to settings page when clicking settings quick action", async ({
      page,
    }) => {
      await page.goto("/admin");

      // Wait for the page to be fully loaded
      await expect(page.getByTestId("quick-actions-grid")).toBeVisible();

      const settingsAction = page.getByTestId("quick-action-settings");
      await expect(settingsAction).toBeVisible();
      await settingsAction.click();

      await expect(page).toHaveURL(/.*\/admin\/settings/, { timeout: 10000 });
    });

    test("navigates to integrations page when clicking integrations quick action", async ({
      page,
    }) => {
      await page.goto("/admin");

      // Wait for the page to be fully loaded
      await expect(page.getByTestId("quick-actions-grid")).toBeVisible();

      const integrationsAction = page.getByTestId("quick-action-integrations");
      await expect(integrationsAction).toBeVisible();
      await integrationsAction.click();

      await expect(page).toHaveURL(/.*\/admin\/integrations/, {
        timeout: 10000,
      });
    });

    test("navigates to users page when clicking total users stat", async ({
      page,
    }) => {
      await page.goto("/admin");

      const totalUsersStat = page.getByTestId("stat-total-users");
      await expect(totalUsersStat).toBeVisible();
      await totalUsersStat.click();

      await expect(page).toHaveURL(/.*\/admin\/users/);
    });

    test("navigates to settings packs tab when clicking active packs stat", async ({
      page,
    }) => {
      await page.goto("/admin");

      const activePacksStat = page.getByTestId("stat-active-packs");
      await expect(activePacksStat).toBeVisible();
      await activePacksStat.click();

      // The stat links to /admin/packs which redirects to /admin/settings?tab=packs
      await expect(page).toHaveURL(/.*\/admin\/settings\?tab=packs/, {
        timeout: 10000,
      });
    });

    test("navigates to feedback page when clicking pending feedback stat", async ({
      page,
    }) => {
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
      await page.goto("/admin");

      // All stats should be visible in mobile
      await expect(page.getByTestId("stat-total-users")).toBeVisible();
      await expect(page.getByTestId("stat-total-revenue")).toBeVisible();
      await expect(page.getByTestId("stat-credits-used")).toBeVisible();
      await expect(page.getByTestId("stat-total-items")).toBeVisible();
    });

    test("displays quick actions in mobile layout", async ({ page }) => {
      await page.goto("/admin");

      // Scroll to quick actions section
      await page.getByTestId("quick-actions-grid").scrollIntoViewIfNeeded();

      await expect(page.getByTestId("quick-action-users")).toBeVisible();
      await expect(page.getByTestId("quick-action-feedback")).toBeVisible();
      await expect(page.getByTestId("quick-action-settings")).toBeVisible();
      await expect(page.getByTestId("quick-action-integrations")).toBeVisible();
    });

    test("displays recent activity feed in mobile layout", async ({ page }) => {
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
      await page.goto("/admin");

      // Scroll and click users action
      const usersAction = page.getByTestId("quick-action-users");
      await usersAction.scrollIntoViewIfNeeded();
      await usersAction.click();

      await expect(page).toHaveURL(/.*\/admin\/users/);
    });

    test("displays additional stats row in mobile layout", async ({ page }) => {
      await page.goto("/admin");

      // Scroll to additional stats
      await page.getByTestId("additional-stats-grid").scrollIntoViewIfNeeded();

      await expect(page.getByTestId("stat-active-packs")).toBeVisible();
      await expect(page.getByTestId("stat-credits-purchased")).toBeVisible();
      await expect(page.getByTestId("stat-pending-feedback")).toBeVisible();
    });
  });

  test.describe("Edge cases", () => {
    test("displays message when no recent activity", async ({
      page,
      network,
    }) => {
      // Override activity endpoint with empty items
      network.use(
        http.get("**/api/v1/admin/stats", () => {
          return HttpResponse.json({
            ...testAdminStats,
            recent_activity: [],
          });
        }),
        http.get("**/api/v1/admin/activity*", () => {
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            limit: 15,
            total_pages: 0,
          });
        })
      );

      await page.goto("/admin");

      const activityFeed = page.getByTestId("recent-activity-feed");
      await expect(activityFeed).toBeVisible();
      await expect(page.getByTestId("no-activity-message")).toBeVisible();
    });

    test("does not show trend badge when no recent signups", async ({
      page,
      network,
    }) => {
      // Override stats endpoint
      network.use(
        http.get("**/api/v1/admin/stats", () => {
          return HttpResponse.json({
            ...testAdminStats,
            recent_signups_7d: 0,
          });
        })
      );

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
      network,
    }) => {
      // Override stats endpoint
      network.use(
        http.get("**/api/v1/admin/stats", () => {
          return HttpResponse.json({
            ...testAdminStats,
            pending_feedback_count: 0,
          });
        })
      );

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
