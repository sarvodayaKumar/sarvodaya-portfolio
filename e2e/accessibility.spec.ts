import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function checkAccessibility(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const critical = results.violations.filter((violation) => violation.impact === "critical");
  const serious = results.violations.filter((violation) => violation.impact === "serious");

  if (serious.length > 0) {
    test.info().annotations.push({
      type: "axe-serious-violations",
      description: serious.map((item) => `${item.id}: ${item.help}`).join("; "),
    });
  }

  expect(
    critical.map((item) => ({ id: item.id, help: item.help, nodes: item.nodes.length })),
    "Critical WCAG accessibility violations must be fixed before merge",
  ).toEqual([]);
}

test("homepage has no critical WCAG accessibility violations", async ({ page }) => {
  await page.goto("/");
  await checkAccessibility(page);
});

test("blog index has no critical WCAG accessibility violations", async ({ page }) => {
  await page.goto("/blog");
  await checkAccessibility(page);
});
