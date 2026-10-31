import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { remote } from "webdriverio";

const appPath = process.env.PRIVAULT_APP_PATH;
const configDir = process.env.PRIVAULT_CONFIG_DIR;
const migrationDir = process.env.PRIVAULT_MIGRATION_DIR;
const createDir = process.env.PRIVAULT_CREATE_DIR;
assert(appPath && configDir && migrationDir && createDir, "缺少隔离桌面验收路径");
const expectedMigrationPath = realpathSync(migrationDir);
const bundleId = process.env.PRIVAULT_BUNDLE_ID ?? "com.privault.prototype";

const masterPassword = "Desktop-Master1!";
const entryPassword = "desktop-test-entry-password";
const markerTitle = "Desktop-persistence-marker";
let browser;
let stage = "启动隔离应用";

function xpathLiteral(value) {
  const parts = value.split("'");
  if (parts.length === 1) return `'${value}'`;
  return `concat(${parts.map((part) => `'${part}'`).join(`, "'", `)})`;
}

function textXpath(value) {
  const literal = xpathLiteral(value);
  return `//XCUIElementTypeStaticText[@label=${literal} or @value=${literal} or @name=${literal} or @title=${literal}]`;
}

function buttonXpath(value, last = false) {
  const literal = xpathLiteral(value);
  const query = `//XCUIElementTypeButton[@label=${literal} or @value=${literal} or @name=${literal} or @title=${literal} or .//*[@label=${literal} or @value=${literal} or @name=${literal} or @title=${literal}]]`;
  return last ? `(${query})[last()]` : query;
}

async function waitText(value) {
  await browser.waitUntil(async () => {
    const elements = await browser.$$(textXpath(value));
    return elements.length > 0;
  }, { timeout: 30_000 });
}

async function clickElement(element) {
  const { x, y } = await element.getLocation();
  const { width, height } = await element.getSize();
  await browser.execute("macos: click", {
    x: Math.round(x + width / 2),
    y: Math.round(y + height / 2),
  });
}

async function clickText(value) {
  let elements = [];
  await browser.waitUntil(async () => {
    elements = await browser.$$(textXpath(value));
    return elements.length > 0;
  }, { timeout: 30_000 });
  await clickElement(elements.at(-1));
}

async function clickButton(value, last = false) {
  const directQuery = `//XCUIElementTypeButton[@title=${xpathLiteral(value)}]`;
  const prefixQuery = `//XCUIElementTypeButton[starts-with(@title, ${xpathLiteral(value)})]`;
  const fallbackQuery = buttonXpath(value);
  if (process.env.PRIVAULT_DESKTOP_DEBUG === "1") {
    const allButtons = await browser.$$("//XCUIElementTypeButton");
    const directButtons = await browser.$$(directQuery);
    writeFileSync("test-results/desktop-selector-debug.json", JSON.stringify({ allButtons: allButtons.length, directButtons: directButtons.length, directQuery }));
  }
  let element;
  await browser.waitUntil(async () => {
    for (const query of [directQuery, prefixQuery, fallbackQuery]) {
      const elements = await browser.$$(query);
      if (elements.length > 0) {
        const candidate = last ? elements.at(-1) : elements[0];
        if (await candidate.isEnabled()) {
          element = candidate;
          return true;
        }
      }
    }
    return false;
  }, { timeout: 30_000 });
  await clickElement(element);
}

const inputLabels = {
  "new-demo-password": "设置主密码",
  "confirm-demo-password": "确认主密码",
  "demo-password": "主密码",
  "migration-master-password": "主密码",
  "entry-title": "标题",
  "entry-username": "用户名",
  "entry-password": "密码",
};

const shiftedCharacters = {
  "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\", "<": ",", ">": ".", "?": "/", "~": "`",
};

function nativeTextKeys(value) {
  return Array.from(value).map((character) => {
    if (/[A-Z]/.test(character)) return { key: character.toLowerCase(), modifierFlags: 2 };
    if (shiftedCharacters[character]) return { key: shiftedCharacters[character], modifierFlags: 2 };
    return character;
  });
}

async function setInput(id, value) {
  const label = xpathLiteral(inputLabels[id]);
  const queries = [
    `~${id}`,
    `//XCUIElementTypeSecureTextField[@title=${label}]`,
    `//XCUIElementTypeTextField[@title=${label}]`,
    `//XCUIElementTypeTextView[@title=${label}]`,
  ];
  let element;
  await browser.waitUntil(async () => {
    for (const query of queries) {
      const elements = await browser.$$(query);
      if (elements.length > 0) {
        element = elements[0];
        return true;
      }
    }
    return false;
  }, { timeout: 30_000 });
  await clickElement(element);
  await element.setValue(value);
}

async function selectNativeDirectory(path) {
  await browser.execute("macos: keys", { keys: [{ key: "g", modifierFlags: 18 }] });
  const pathField = await browser.$("~PathTextField");
  await pathField.waitForExist({ timeout: 30_000 });
  await clickElement(pathField);
  await pathField.setValue(path);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await browser.execute("macos: keys", { keys: ["XCUIKeyboardKeyReturn"] });
    await browser.pause(300);
    if ((await browser.$$("~PathTextField")).length === 0) break;
  }
  if ((await browser.$$("~PathTextField")).length > 0) throw new Error("目录输入面板未关闭");
  await clickButton("Open");
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
      "appium:bundleId": bundleId,
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
  for (const root of [createDir, migrationDir]) {
    for (const name of ["vault.db", "vault.meta"]) {
      const path = `${root}/${name}`;
      assert(existsSync(path), "缺少保险库文件");
      assert(!readFileSync(path).includes(marker), "保险库文件中出现测试条目标记");
    }
  }
  const config = JSON.parse(readFileSync(`${configDir}/config.json`, "utf8"));
  assert.deepEqual(Object.keys(config).sort(), ["storagePath", "version"]);
  assert.equal(config.storagePath, expectedMigrationPath);
  const backups = readdirSync(`${createDir}/backups`, { withFileTypes: true });
  assert(backups.some((entry) => entry.isDirectory() && entry.name.startsWith("migration-")), "缺少迁移加密备份");
}

async function main() {
  try {
    await startSession();
    stage = "在自定义目录创建真实保险库";
    await clickButton("创建保险库");
    await setInput("new-demo-password", masterPassword);
    await setInput("confirm-demo-password", masterPassword);
    await clickButton("选择保存文件夹");
    await selectNativeDirectory(createDir);
    await browser.execute("macos: activateApp", { bundleId });
    await browser.pause(500);
    await clickButton("下一步");
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
    await browser.execute("macos: keys", { keys: [...Array(8).fill("XCUIKeyboardKeyTab"), "XCUIKeyboardKeyReturn"] });
    await waitText(markerTitle);
    await stopSession();

    stage = "重启并解锁原保险库";
    await startSession();
    await unlock();
    await waitText(markerTitle);

    stage = "通过原生目录选择器迁移保险库";
    await clickButton("设置");
    await clickButton("更改存储目录");
    await selectNativeDirectory(migrationDir);
    await browser.execute("macos: activateApp", { bundleId });
    await browser.pause(500);
    await browser.execute("macos: keys", { keys: [...nativeTextKeys(masterPassword), "XCUIKeyboardKeyReturn"] });
    if (process.env.PRIVAULT_DESKTOP_DEBUG === "1") {
      await browser.pause(500);
      await browser.saveScreenshot("test-results/desktop-after-confirm.png");
    }
    await browser.waitUntil(async () => {
      try {
        const config = JSON.parse(readFileSync(`${configDir}/config.json`, "utf8"));
        return config.storagePath === expectedMigrationPath;
      } catch {
        return false;
      }
    }, { timeout: 30_000, interval: 250 });
    await stopSession();

    stage = "迁移后重新启动、解锁并核对条目";
    await startSession();
    await unlock();
    await waitText(markerTitle);

    stage = "审计加密文件、配置和备份";
    await auditEncryptedFiles();
    console.log("真实桌面闭环验收通过；条目一致性、配置边界及明文扫描均已验证。");
  } catch (reason) {
    if (browser) {
      try {
        mkdirSync("test-results", { recursive: true });
        if (process.env.PRIVAULT_DESKTOP_DEBUG === "1") {
          writeFileSync("test-results/desktop-smoke-error.txt", String(reason));
        }
        await browser.saveScreenshot("test-results/desktop-smoke-error.png");
        if (process.env.PRIVAULT_DESKTOP_DEBUG === "1") {
          writeFileSync("test-results/desktop-smoke-source.xml", await browser.getPageSource());
        }
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
