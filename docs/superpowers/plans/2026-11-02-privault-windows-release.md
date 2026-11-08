# Privault Windows Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Windows 版本的真实验证、打包和发布链路；在 Windows 证据完成前不得宣称正式支持。

**Architecture:** 复用现有 SQLCipher/Tauri 核心，新增 Windows 专用验证脚本和 GitHub Actions Windows runner；先完成测试与 NSIS 安装包，再根据真实 Windows 证据修复平台差异。前端业务代码和加密格式不变。

**Tech Stack:** Rust、Tauri 2、Node.js、Playwright、GitHub Actions `windows-latest`、NSIS、`icacls`。

## Global Constraints

- 所有 Windows 结论必须来自真实 Windows runner 或真机；macOS 交叉推理不作为验收证据。
- 发布产物必须来自已推送的 Git tag；不允许用未打 tag 代码补旧 Release。
- 不引入云同步、账号、遥测、网络请求、自动更新、浏览器自动填充、附件或生物识别。
- 测试只使用隔离目录与虚构凭据，不触碰真实保险库。
- 当前会话直接执行，不使用子代理；行为修复必须先写失败测试。
- 在 Windows 闭环通过前，README 必须保持“Windows 未实测/未验证”状态。

---

### Phase 0: Windows CI 与构建基线

**Files:**

- Create: `docs/superpowers/plans/2026-11-02-privault-windows-release.md`
- Create: `scripts/verify-windows.ps1`
- Create: `.github/workflows/windows.yml`

**Steps:**

- [x] 1.1 写入本计划并提交。
- [x] 1.2 新增 PowerShell 验证脚本，执行 lint、前端测试、生产构建、Chrome E2E、Rust fmt/clippy/test，可选 NSIS 构建。
- [x] 1.3 新增 GitHub Actions `windows-latest` workflow：安装 Node/Rust/Perl/NASM，运行验证脚本，缓存 Cargo，上传 NSIS 产物。
- [x] 1.4 推送到 GitHub 并观察真实 Windows runner 结果。
- [x] 1.5 根据失败修复构建依赖或代码；每次失败必须保留日志结论。

### Phase 1: Windows 平台安全语义

**Files:**

- Modify: `src-tauri/src/platform/windows.rs`
- Create: `src-tauri/tests/platform_windows.rs`

**Steps:**

- [x] 2.1 写失败测试：目录权限必须移除继承、只授予当前用户完全控制。
- [x] 2.2 修正 `secure_directory()` 使用明确 `icacls /inheritance:r /grant:r`。
- [x] 2.3 通过 Windows CI 验证测试。
- [ ] 2.4 评估 `sync_parent()` no-op、路径校验和目录迁移在 Windows 的差异；有行为差异必须先写测试再修复。

### Phase 2: Windows GUI 验收

**Files:**

- Create: `tests/windows-smoke.mjs`

**Steps:**

- [ ] 3.1 使用 Edge WebDriver/tauri-driver 建立独立 debug 会话。
- [ ] 3.2 覆盖创建、录入、重启解锁、迁移、导出、导入、收藏、备份、修改主密码。
- [ ] 3.3 不复用 Mac2 专属坐标、键盘枚举和元素等待。
- [ ] 3.4 通过后才能将 Windows 状态从“未实测”升级为“自动化验收通过”。

### Phase 3: NSIS 安装包与发布

**Files:**

- Modify: `src-tauri/tauri.conf.json`（如需要）
- Modify: `README.md`
- Modify: `docs/development-process.md`

**Steps:**

- [ ] 4.1 从 tag 构建 `Privault_<version>_x64-setup.exe`。
- [ ] 4.2 校验安装、启动、卸载不删除保险库。
- [ ] 4.3 如有 Authenticode 证书则签名；无证书时明确提示 SmartScreen 风险。
- [ ] 4.4 上传 GitHub Release 并从远端下载复验 SHA-256。
- [ ] 4.5 若 Windows 修复改动了代码，版本必须升级到 `v0.1.1`，不得补传旧 `v0.1.0`。

## 非目标

- 不实现云同步、自动填充、附件、生物识别、遥测或自动更新。
- 不在未获得真实 Windows 证据时宣称 Windows 已通过。
- 不修改 `.pvault` 格式或 SQLCipher 密钥派生。
