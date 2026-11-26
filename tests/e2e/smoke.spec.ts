import { expect, test } from "@playwright/test";

test.describe("FlowForge E2E Smoke", () => {
  test("loads studio, executes 1-click workflow without errors, and verifies /api/health", async ({
    page,
    request,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    const healthRes = await request.get("/api/health");
    expect(healthRes.status()).toBe(200);
    const healthJson = (await healthRes.json()) as {
      status: string;
      service: string;
    };
    expect(healthJson.status).toBe("ok");
    expect(healthJson.service).toBe("flowforge-dag");

    await page.goto("/");
    await expect(page.getByText("FlowForge")).toBeVisible();
    await expect(page.getByTestId("flow-node-trigger-1")).toBeVisible();
    await expect(page.getByTestId("flow-node-cond-1")).toBeVisible();

    await page.getByTestId("run-demo-btn").click();
    await expect(page.getByTestId("execution-logs-bar")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("node-status-trigger-1")).toContainText("ok");
    await expect(page.getByTestId("node-status-log-low-1")).toContainText(
      "skipped",
    );

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
