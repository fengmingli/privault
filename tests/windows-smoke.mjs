import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { remote } from "webdriverio";

const appPath = process.env.PRIVAULT_WINDOWS_APP_PATH;
const root = process.env.PRIVAULT_WINDOWS_TEST_ROOT;
const configDir = process.env.PRIVAULT_CONFIG_DIR;
const migrationDir = process.env.PRIVAULT_MIGRATION_DIR;
const exportDir = process.env.PRIVAULT_EXPORT_DIR;
const importedConfigDir = process.env.PRIVAULT_IMPORT_DIR;
const tauriDriver = process.env.PRIVAULT_TAURI_DRIVER ?? "tauri-driver";

assert(appPath && root && configDir && migrationDir && exportDir && importedConfigDir, "缺少隔离 Windows GUI 验收路径");

const masterPassword = "Windows-Master1!";
const changedPassword = "Windows-NewPass1!";
const markerTitle = "Windows-persistence-marker";
const originalRecoveryNotice = "保存恢复密钥";

let browser;
let driver;
let stage = "启动隔离应用";
const driverLogPath = path.resolve("test-results/windows-tauri-driver.log");
mkdirSync(path.dirname(driverLogPath), { recursive: true });

function xpathLiteral(value) {
  const parts = value.split("'");
  if (parts.length === 1) return `'${value}'`;
  return `concat(${parts.map((part) => `'${part}'`).join(", \"'\", ")})`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendNativeKeys(keys) {
  const escaped = keys.replace(/'/g, "''");
  const command = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`;
  const encoded = Buffer.from(command, "utf16le").toString("base64");
  spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
    { stdio: "ignore", timeout: 15_000 },
  );
}

function selectNativeFolder(directory) {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.resolve("tests/windows-select-folder.ps1"),
      "-Directory",
      directory,
    ],
    { encoding: "utf8", timeout: 20_000 },
  );
  if (result.status !== 0) {
    const details = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
    throw new Error(`无法选择 Windows 目录：${details || `exit ${result.status}`}`);
  }
  mkdirSync(path.dirname(driverLogPath), { recursive: true });
  writeFileSync(
    "test-results/windows-folder-dialog.txt",
    `${new Date().toISOString()}\n${result.stdout}\n${result.stderr}\n`,
  );
}

function killProcessTree(pid) {
  if (!pid) return;
  spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
}

async function waitForPort(port) {
  const net = await import("node:net");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const connected = await new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
      socket.setTimeout(500, () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (connected) return;
    await sleep(500);
  }
  throw new Error(`tauri-driver port ${port} did not become ready`);
}

async function startDriver(configOverride) {
  if (driver) await stopDriver();
  const log = await import("node:fs").then((fs) => fs.openSync(driverLogPath, "a"));
  driver = spawn(tauriDriver, ["--port", "4444", "--native-port", "4445"], {
    env: { ...process.env, PRIVAULT_CONFIG_DIR: configOverride },
    stdio: ["ignore", log, log],
  });
  driver.on("exit", (code) => {
    writeFileSync("test-results/windows-tauri-driver-exit.txt", `exit=${code}\n`);
  });
  await waitForPort(4444);
}

async function stopDriver() {
  if (!driver) return;
  killProcessTree(driver.pid);
  driver = null;
  await sleep(500);
}

async function startSession(configOverride) {
  await startDriver(configOverride);
  browser = await remote({
    hostname: "127.0.0.1",
    port: 4444,
    logLevel: "error",
    capabilities: {
      alwaysMatch: {
        "tauri:options": {
          application: appPath,
          args: [],
        },
        "ms:edgeChromium": true,
        browserName: "webview2",
        "ms:edgeOptions": { args: [] },
      },
    },
  });
}

async function stopSession() {
  if (browser) {
    await browser.deleteSession().catch(() => {});
    browser = undefined;
  }
  await stopDriver();
}

async function element(selector) {
  const found = await browser.$(selector);
  await found.waitForExist({ timeout: 20_000 });
  return found;
}

async function clickButton(label, scope) {
  const root = scope ?? browser;
  const literal = xpathLiteral(label);
  const button = await root.$(
    `//button[@aria-label=${literal} or @title=${literal} or normalize-space()=${literal}]`,
  );
  await button.waitForExist({ timeout: 20_000 });
  await button.click();
}

async function setValue(selector, value) {
  const field = await element(selector);
  await field.click();
  await field.setValue(value);
}

async function waitText(label) {
  await browser.waitUntil(
    async () => (await browser.$$(`//*[contains(normalize-space(), ${xpathLiteral(label)})]`)).length > 0,
    { timeout: 20_000, interval: 250 },
  );
}

async function unlock(password) {
  await setValue("#demo-password", password);
  await clickButton("解锁");
  await waitText("本地保险库");
}

async function createVault(configOverride) {
  await startSession(configOverride);
  await clickButton("创建保险库");
  await setValue("#new-demo-password", masterPassword);
  await setValue("#confirm-demo-password", masterPassword);
  await clickButton("下一步");
  await waitText(originalRecoveryNotice);
  const recoveryConfirmed = await element(
    '//label[contains(normalize-space(), "我已离线保存恢复密钥")]/input',
  );
  await recoveryConfirmed.click();
  await clickButton("解锁保险库");
  await waitText("本地保险库");
}

async function addFavoriteMarker() {
  stage = "录入并收藏标记条目";
  await clickButton("新建");
  const typePicker = await element("//dialog[@open]");
  const loginKind = await typePicker.$(
    `//button[.//span[normalize-space()=${xpathLiteral("登录信息")}]]`,
  );
  await loginKind.waitForExist({ timeout: 20_000 });
  await loginKind.click();
  await setValue("#entry-title", markerTitle);
  await setValue("#entry-username", "windows@example.com");
  await setValue("#entry-password", "Windows-Entry-Pass1!");
  await clickButton("保存项目");
  await waitText(markerTitle);
  const favorite = await browser.$(
    `//section[@aria-label="条目详情"]//button[normalize-space()=${xpathLiteral("收藏")}]`,
  );
  await favorite.waitForExist({ timeout: 20_000 });
  await favorite.click();
  await waitText("取消收藏");
}

async function restartAndUnlock(configOverride) {
  stage = "重启并解锁保险库";
  await stopSession();
  await startSession(configOverride);
  await unlock(masterPassword);
  await waitText(markerTitle);
}

async function migrateStorage() {
  stage = "通过原生目录选择器迁移保险库";
  await clickButton("设置");
  await clickButton("更改存储目录");
  await sleep(1_500);
  selectNativeFolder(realpathSync(migrationDir));
  await waitText("输入主密码以验证目标副本");
  await setValue("#migration-master-password", masterPassword);
  await clickButton("验证并迁移");
  await waitText("存储位置已更新");
  await clickButton("返回解锁");
  await unlock(masterPassword);
  await waitText(markerTitle);
  const config = JSON.parse(readFileSync(path.join(configDir, "config.json"), "utf8"));
  assert.equal(config.storage_path, realpathSync(migrationDir));
}

async function exportArchive() {
  stage = "导出加密保险库文件";
  await clickButton("设置");
  await clickButton("导出保险库");
  await sleep(1_500);
  sendNativeKeys(path.join(realpathSync(exportDir), "windows-export.pvault"));
  sendNativeKeys("{ENTER}");
  await waitText("加密保险库已导出");
  await clickButton("返回解锁");
  await unlock(masterPassword);
  await waitText(markerTitle);
}

async function importArchive() {
  stage = "在独立工作区导入并替换保险库";
  await stopSession();
  await createVault(importedConfigDir);
  await clickButton("设置");
  await clickButton("导入保险库");
  await sleep(1_500);
  sendNativeKeys(path.join(realpathSync(exportDir), "windows-export.pvault"));
  sendNativeKeys("{ENTER}");
  await setValue("#pvault-master-password", masterPassword);
  await clickButton("确认导入");
  await waitText("导入完成");
  await clickButton("返回解锁");
  await unlock(masterPassword);
  await waitText(markerTitle);
  await clickButton("收藏");
  await clickButton("收藏 1");
  await waitText(markerTitle);
  const backups = readdirSync(path.join(importedConfigDir, "backups"), { withFileTypes: true });
  assert(backups.some((entry) => entry.isDirectory() && entry.name.startsWith("import-")), "缺少导入前自动备份");
}

async function changeMasterPassword() {
  stage = "修改主密码并重新解锁";
  await clickButton("设置");
  await clickButton("修改主密码");
  await setValue("#change-current-password", masterPassword);
  await setValue("#change-new-password", changedPassword);
  await setValue("#change-confirm-password", changedPassword);
  await clickButton("确认修改");
  await waitText("主密码已修改");
  await clickButton("返回解锁");
  await unlock(changedPassword);
  await waitText(markerTitle);
}

async function auditOutput() {
  stage = "审计 Windows 验收产物";
  for (const directory of [configDir, migrationDir, importedConfigDir]) {
    assert(existsSync(directory), `缺少验收目录 ${directory}`);
  }
  assert(existsSync(path.join(exportDir, "windows-export.pvault")), "缺少导出的 .pvault 文件");
  assert(existsSync(path.join(configDir, "config.json")), "缺少迁移后的配置文件");
  const config = JSON.parse(readFileSync(path.join(configDir, "config.json"), "utf8"));
  assert.equal(config.version, 1);
  assert.equal(config.storage_path, realpathSync(migrationDir));
}

async function saveFailureEvidence(reason) {
  try {
    if (browser) {
      await browser.saveScreenshot(`test-results/windows-smoke-${stage.replace(/[^\p{L}\p{N}]+/gu, "-")}.png`);
      writeFileSync(`test-results/windows-smoke-${stage.replace(/[^\p{L}\p{N}]+/gu, "-")}.xml`, await browser.getPageSource());
    }
    writeFileSync("test-results/windows-smoke-error.txt", `${stage}: ${reason?.stack ?? String(reason)}\n`);
  } catch (evidenceError) {
    writeFileSync("test-results/windows-smoke-error.txt", `${stage}: ${reason?.stack ?? String(reason)}\nevidence: ${evidenceError}\n`);
  }
}

try {
  mkdirSync("test-results", { recursive: true });
  mkdirSync(configDir, { recursive: true });
  mkdirSync(migrationDir, { recursive: true });
  mkdirSync(exportDir, { recursive: true });
  mkdirSync(importedConfigDir, { recursive: true });

  stage = "创建真实保险库";
  await createVault(configDir);
  await addFavoriteMarker();
  await restartAndUnlock(configDir);
  await migrateStorage();
  await exportArchive();
  await importArchive();
  await changeMasterPassword();
  await auditOutput();

  console.log("Windows GUI 验收通过：创建、重启、迁移、导出、导入、收藏和改密均已验证。");
} catch (reason) {
  await saveFailureEvidence(reason);
  throw reason;
} finally {
  await stopSession();
}
