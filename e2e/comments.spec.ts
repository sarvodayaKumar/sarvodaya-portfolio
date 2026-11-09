import { expect, test } from "@playwright/test";

test("visitor can submit a comment and receive the moderation confirmation", async ({ page }) => {
  await page.route("**/api/comments**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ comments: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ message: "Comment submitted for review." }),
    });
  });

  await page.goto("/blog");
  await page.getByRole("main").getByRole("link").first().click();

  await page.getByPlaceholder("Your name").fill("Playwright Visitor");
  await page.getByPlaceholder("Your comment").fill("This is an automated browser regression check.");
  await page.getByRole("button", { name: "Post comment" }).click();

  await expect(page.getByText("Comment submitted for review.")).toBeVisible();
  await expect(page.getByPlaceholder("Your name")).toHaveValue("");
  await expect(page.getByPlaceholder("Your comment")).toHaveValue("");
});
