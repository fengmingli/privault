import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { remote } from "webdriverio";

const appPath = process.env.PRIVAULT_APP_PATH;
const configDir = process.env.PRIVAULT_CONFIG_DIR;
const migrationDir = process.env.PRIVAULT_MIGRATION_DIR;
assert(appPath && configDir && migrationDir, "缺少隔离桌面验收路径");

const masterPassword = "desktop-test-master-password";
const entryPassword = "desktop-test-entry-password";
const markerTitle = "Desktop persistence marker";
let browser;
let stage = "启动隔离应用";

function xpathLiteral(value) {
  const parts = value.split("'");
  if (parts.length === 1) return `'${value}'`;
  return `concat(${parts.map((part) => `'${part}'`).join(`, "'", `)})`;
}

function textXpath(value) {
  const literal = xpathLiteral(value);
  return `//XCUIElementTypeStaticText[@label=${literal} or @value=${literal} or @name=${literal}]`;
}

function buttonXpath(value, last = false) {
  const literal = xpathLiteral(value);
  const query = `//XCUIElementTypeButton[@label=${literal} or @value=${literal} or @name=${literal} or .//*[@label=${literal} or @value=${literal} or @name=${literal}]]`;
  return last ? `(${query})[last()]` : query;
}

async function waitText(value) {
  const element = await browser.$(textXpath(value));
  await element.waitForExist({ timeout: 30_000 });
}

async function clickText(value) {
  const element = await browser.$(textXpath(value));
  await element.waitForExist({ timeout: 30_000 });
  await element.click();
}

async function clickButton(value, last = false) {
  const element = await browser.$(buttonXpath(value, last));
  await element.waitForExist({ timeout: 30_000 });
  await element.click();
}

async function setInput(id, value) {
  const element = await browser.$(`~${id}`);
  await element.waitForExist({ timeout: 30_000 });
  await element.setValue(value);
}

async function startSession() {
  browser = await remote({
    hostname: "127.0.0.1",
    port: 4723,
    path: "/",
    logLevel: "silent",
    connectionRetryTimeout: 180_000,
    capabilities: {
      platformName: "mac",
      "appium:automationName": "mac2",
      "appium:appPath": appPath,
      "appium:bundleId": "com.privault.prototype",
      "appium:environment": { PRIVAULT_CONFIG_DIR: configDir },
      "appium:noReset": false,
      "appium:skipAppKill": false,
      "appium:newCommandTimeout": 120,
      "appium:serverStartupTimeout": 180_000,
      "appium:showServerLogs": false,
    },
  });
  await browser.updateSettings({ useDomIdAsAccessibilityId: true });
}

async function stopSession() {
  if (!browser) return;
  const current = browser;
  browser = undefined;
  await current.deleteSession();
}

async function unlock() {
  await setInput("demo-password", masterPassword);
  await clickButton("解锁");
  await waitText("本地保险库");
}

async function auditEncryptedFiles() {
  const marker = Buffer.from(markerTitle);
  for (const root of [configDir, migrationDir]) {
    for (const name of ["vault.db", "vault.meta"]) {
      const path = `${root}/${name}`;
      assert(existsSync(path), "缺少保险库文件");
      assert(!readFileSync(path).includes(marker), "保险库文件中出现测试条目标记");
    }
  }
  const config = JSON.parse(readFileSync(`${configDir}/config.json`, "utf8"));
  assert.deepEqual(Object.keys(config).sort(), ["storagePath", "version"]);
  assert.equal(config.storagePath, migrationDir);
  const backups = readdirSync(`${configDir}/backups`, { withFileTypes: true });
  assert(backups.some((entry) => entry.isDirectory() && entry.name.startsWith("migration-")), "缺少迁移加密备份");
}

async function main() {
  try {
    await startSession();
    stage = "创建真实保险库";
    await clickButton("创建保险库");
    await setInput("new-demo-password", masterPassword);
    await setInput("confirm-demo-password", masterPassword);
    await clickButton("继续");
    await waitText("保存恢复密钥");
    await clickText("我已离线保存恢复密钥");
    await clickButton("解锁保险库");
    await waitText("本地保险库");

    stage = "录入并保存测试条目";
    await clickButton("新建");
    await clickButton("登录信息", true);
    await setInput("entry-title", markerTitle);
    await setInput("entry-username", "desktop@example.invalid");
    await setInput("entry-password", entryPassword);
    await clickButton("保存项目");
    await waitText(markerTitle);
    await stopSession();

    stage = "重启并解锁原保险库";
    await startSession();
    await unlock();
    await waitText(markerTitle);

    stage = "通过原生目录选择器迁移保险库";
    await clickButton("设置");
    await clickButton("更改存储目录");
    await browser.keys(["\uE03D", "\uE008", "g"]);
    await browser.keys(migrationDir);
    await browser.keys(["\uE007"]);
    await browser.pause(500);
    await browser.keys(["\uE007"]);
    await setInput("migration-master-password", masterPassword);
    await clickButton("验证并迁移");
    await waitText("存储位置已更新，请重新解锁");
    await clickButton("返回解锁");

    stage = "迁移后重新解锁并核对条目";
    await unlock();
    await waitText(markerTitle);

    stage = "审计加密文件、配置和备份";
    await auditEncryptedFiles();
    console.log("真实桌面闭环验收通过；条目一致性、配置边界及明文扫描均已验证。");
  } catch {
    if (browser) {
      try {
        mkdirSync("test-results", { recursive: true });
        await browser.saveScreenshot("test-results/desktop-smoke-error.png");
      } catch {
        // 截图失败不覆盖原始验收阶段。
      }
    }
    throw new Error(`真实桌面验收失败于阶段：${stage}`);
  } finally {
    if (browser) {
      try {
        await stopSession();
      } catch {
        // 清理失败仍由 Appium 服务进程回收；不输出会话或条目内容。
      }
    }
  }
}

await main();
