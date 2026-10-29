import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function unlock(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "解锁演示保险库" }).click();
  await page.getByLabel("演示密码").fill("demo");
  await page.getByRole("button", { name: /^解锁$/ }).click();
  await expect(page.getByRole("region", { name: "条目列表" })).toBeVisible();
}

test("main workflow stays on local assets", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && !["127.0.0.1", "localhost"].includes(url.hostname)) externalRequests.push(request.url());
  });

  await unlock(page);
  await page.getByLabel("搜索项目").fill("GITHUB");
  await expect(page.getByText("1 个项目")).toBeVisible();
  await page.getByRole("button", { name: "显示密码" }).click();
  await expect(page.getByText("Demo-Not-A-Real-Password")).toBeVisible();
  await page.getByRole("button", { name: "复制密码" }).click();
  await expect(page.getByText("密码已复制")).toBeVisible();
  await page.getByRole("button", { name: "立即锁定" }).click();
  await expect(page.getByLabel("演示密码")).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test("create, generate, save, delete, and undo", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: "新建" }).click();
  const picker = page.getByRole("dialog", { name: "选择条目类型" });
  await picker.getByRole("button", { name: /登录信息/ }).click();
  const editor = page.getByRole("dialog", { name: "新建登录信息" });
  await editor.getByLabel("标题").fill("Playwright 演示账号");
  await editor.getByRole("button", { name: "密码生成器" }).click();
  const generator = page.getByRole("dialog", { name: "密码生成器" });
  const generated = await generator.getByLabel("生成的密码").textContent();
  await generator.getByRole("button", { name: "填入密码" }).click();
  await expect(editor.getByLabel("密码", { exact: true })).toHaveValue(generated ?? "");
  await editor.getByRole("button", { name: "保存项目" }).click();
  await expect(page.getByRole("heading", { name: "Playwright 演示账号" })).toBeVisible();
  await page.getByRole("button", { name: "删除" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.getByRole("heading", { name: "Playwright 演示账号" })).toBeVisible();
});

test("validation and unsaved-change states", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "解锁演示保险库" }).click();
  await page.getByLabel("演示密码").fill("wrong");
  await page.getByRole("button", { name: /^解锁$/ }).click();
  await expect(page.getByText("演示密码不正确")).toBeVisible();
  await unlock(page);

  await page.getByLabel("搜索项目").fill("not-found");
  await expect(page.getByText("没有匹配的项目")).toBeVisible();
  await page.getByRole("button", { name: "清除搜索" }).click();
  await page.getByRole("button", { name: "密码生成器" }).click();
  const generator = page.getByRole("dialog", { name: "密码生成器" });
  for (const label of ["大写字母", "小写字母", "数字", "符号"]) await generator.getByLabel(label).uncheck();
  await expect(generator.getByText("至少选择一种字符类型", { exact: true })).toBeVisible();
  await generator.getByRole("button", { name: "关闭对话框" }).click();

  await page.getByRole("button", { name: "新建" }).click();
  const picker = page.getByRole("dialog", { name: "选择条目类型" });
  await picker.getByRole("button", { name: /登录信息/ }).click();
  const editor = page.getByRole("dialog", { name: "新建登录信息" });
  await editor.getByLabel("标题").fill("未保存的 Playwright 修改");
  await editor.getByRole("button", { name: "关闭对话框" }).click();
  await page.getByRole("button", { name: "继续编辑" }).click();
  await expect(editor.getByLabel("标题")).toHaveValue("未保存的 Playwright 修改");
  await editor.getByRole("button", { name: "关闭对话框" }).click();
  await page.getByRole("button", { name: "放弃修改" }).click();
  await expect(editor).not.toBeVisible();
});

test("browser demo keeps real storage controls unavailable", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: "设置" }).click();
  const settings = page.getByRole("dialog", { name: "设置" });
  await expect(settings.getByText("浏览器 Demo 使用内存数据，不显示或修改真实存储路径。")).toBeVisible();
  await expect(settings.getByRole("button", { name: "更改存储目录" })).toHaveCount(0);
  await expect(settings.getByText("本机固定磁盘 · 加密存储")).toHaveCount(0);
});

test("light and dark desktop screenshots", async ({ page }) => {
  await mkdir("test-results", { recursive: true });
  await page.emulateMedia({ colorScheme: "light" });
  await unlock(page);
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByLabel("浅色").check();
  await page.getByRole("dialog", { name: "设置" }).getByRole("button", { name: "关闭对话框" }).click();
  await page.screenshot({ path: "test-results/privault-1280-light.png", fullPage: true, animations: "disabled" });

  await page.getByRole("button", { name: "设置" }).click();
  await page.getByLabel("深色").check();
  await page.getByRole("dialog", { name: "设置" }).getByRole("button", { name: "关闭对话框" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: "test-results/privault-1280-dark.png", fullPage: true, animations: "disabled" });
});

test("dark controls inherit semantic foreground colors", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByLabel("深色").check();
  await page.getByRole("dialog", { name: "设置" }).getByRole("button", { name: "关闭对话框" }).click();
  await expect.poll(() => page.locator("body").evaluate((element) => getComputedStyle(element).color)).toBe("rgb(243, 241, 237)");
  const bodyColor = await page.locator("body").evaluate((element) => getComputedStyle(element).color);
  const listButton = page.getByRole("button", { name: /示例证件/ });
  await expect.poll(() => listButton.evaluate((element) => getComputedStyle(element).color)).toBe(bodyColor);
});

test("1024px layout has no horizontal overflow", async ({ page }) => {
  await mkdir("test-results", { recursive: true });
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.emulateMedia({ colorScheme: "light" });
  await unlock(page);
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasOverflow).toBe(false);
  await page.screenshot({ path: "test-results/privault-1024-light.png", fullPage: true, animations: "disabled" });
});
