import { expect, test } from "@playwright/test";

test("homepage navigation reaches the blog index and a published post", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "covered by the desktop browser project");
  await page.goto("/");
  await expect(page.getByRole("navigation")).toBeVisible();

  await page.getByRole("link", { name: "Blog" }).first().click();
  await expect(page).toHaveURL(/\/blog\/?$/);
  await expect(page.getByRole("heading", { name: "Blog", level: 1 })).toBeVisible();

  const firstPost = page.getByRole("main").getByRole("link").first();
  await expect(firstPost).toBeVisible();
  await firstPost.click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  await expect(page.locator("article h1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comments" })).toBeVisible();
});

test("mobile navigation is operable with the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menuButton = page.getByRole("button", { name: "Toggle menu" });
  await menuButton.focus();
  await page.keyboard.press("Enter");

  const mobileBlogLink = page.getByRole("link", { name: "Blog" }).last();
  await expect(mobileBlogLink).toBeVisible();
  await mobileBlogLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/blog\/?$/);
});
