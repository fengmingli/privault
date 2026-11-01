# Welcome Pvault Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从欢迎页真实导入 `.pvault`，并确保空库和锁定库导入后都能使用原主密码解锁。

**Architecture:** 复用 `PvaultDialog`、`VaultGateway` 和 `VaultManager::import_pvault`。Rust 只修正允许的入口状态和成功后的锁定状态，前端只连接现有对话框，不增加命令、依赖或文件权限。

**Tech Stack:** Rust、React、TypeScript、Vitest、Testing Library、Playwright。

## Global Constraints

- 保留严格归档验证、原主密码验证、已有库备份和失败回滚。
- 导入成功不自动解锁；用户必须返回解锁页输入原主密码。
- Demo 不执行真实文件选择、读取或写入。
- 不修改 `.pvault` 格式、备份结构或 Tauri 权限。
- 当前会话直接执行，不使用子代理；先写失败测试。
- 不运行 macOS 原生桌面自动化。

---

### Task 1: 空库与锁定库导入状态

**Files:**
- Modify: `src-tauri/tests/pvault.rs`
- Modify: `src-tauri/src/vault/mod.rs`

**Interfaces:**
- Consumes: 现有 `VaultManager::import_pvault(source, master_password)`。
- Produces: `Empty` / `Locked` / `Unlocked` 均可导入，成功后状态为 `Locked`。

- [ ] **Step 1: 写两个失败测试**

在 `src-tauri/tests/pvault.rs` 使用 `manager_with_marker()` 导出源库，分别验证：

```rust
#[test]
fn import_from_empty_state_is_unlockable() {
    let dir = tempfile::TempDir::new().unwrap();
    let destination = dir.path().join("export.pvault");
    let (mut source, _) = manager_with_marker();
    source.export_pvault(destination.clone()).unwrap();
    let mut imported = VaultManager::new_for_test().unwrap();
    imported.import_pvault(destination, "Master-pass1!".into()).unwrap();
    imported.unlock("Master-pass1!".into()).unwrap();
    assert_eq!(imported.list_entries().unwrap()[0].title, "PRIVATE-PVAULT-MARKER");
}

#[test]
fn import_from_locked_state_is_unlockable() {
    let dir = tempfile::TempDir::new().unwrap();
    let destination = dir.path().join("export.pvault");
    let (mut source, _) = manager_with_marker();
    source.export_pvault(destination.clone()).unwrap();
    let mut imported = VaultManager::new_for_test().unwrap();
    imported.create("Current-pass1!".into()).unwrap();
    imported.import_pvault(destination, "Master-pass1!".into()).unwrap();
    imported.unlock("Master-pass1!".into()).unwrap();
    assert_eq!(imported.list_entries().unwrap()[0].title, "PRIVATE-PVAULT-MARKER");
}
```

- [ ] **Step 2: 确认测试因现有状态处理失败**

Run: `cd src-tauri && cargo test --test pvault import_from_`

Expected: 空库导入后 `unlock` 返回 `VaultNotFound`；锁定库导入返回 `Locked`。

- [ ] **Step 3: 最小修正状态转换**

允许 `SessionState::Locked` 进入 `import_pvault`；导入 `result.is_ok()` 时设置 `self.session = SessionState::Locked`。失败清理与回滚代码保持不变。

- [ ] **Step 4: 验证 Rust 测试**

Run: `cd src-tauri && cargo test --test pvault && cargo fmt --check`

Expected: 全部 `.pvault` 测试和格式检查通过。

- [ ] **Step 5: 提交**

```bash
git add src-tauri/tests/pvault.rs src-tauri/src/vault/mod.rs
git commit -m "feat: allow pvault import from access screens"
```

### Task 2: 欢迎页真实导入入口与通用文案

**Files:**
- Modify: `src/features/access/AccessFlow.tsx`
- Modify: `src/features/access/AccessFlow.test.tsx`
- Modify: `src/features/vault/PvaultDialog.tsx`
- Modify: `src/features/vault/PvaultDialog.test.tsx`

**Interfaces:**
- Consumes: `PvaultDialog({ open, mode: "import", gateway, onClose, onRequireUnlock, onBusyChange })`。
- Produces: 欢迎页真实导入对话框；成功后切换 `screen` 为 `unlock`。

- [ ] **Step 1: 写前端失败测试**

在 `AccessFlow.test.tsx` 增加真实网关测试：点击“导入已有保险库”后显示对话框，不再显示“本期不支持”；模拟选择 `/fixed/source.pvault`、输入原密码、点击“确认导入”，成功后点击“返回解锁”并断言出现主密码输入框。另保留 Demo 测试，断言 `chooseImportPath` 和 `importPvault` 未调用。

在 `PvaultDialog.test.tsx` 将确认按钮改为“确认导入”，确认标题改为“导入到当前保险库位置”，成功文案改为“导入完成”，并断言不再出现固定“原保险库已备份”。

- [ ] **Step 2: 确认前端测试失败**

Run: `npx vitest run src/features/access/AccessFlow.test.tsx src/features/vault/PvaultDialog.test.tsx`

Expected: 欢迎页仍只切换过期提示，旧对话框文案断言失败。

- [ ] **Step 3: 连接现有对话框并更新文案**

`AccessFlow` 用 `importOpen` / `importBusy` 替代 `importNotice`；欢迎页按钮设置 `importOpen=true`，忙碌时禁用欢迎操作。渲染现有 `PvaultDialog`，`onRequireUnlock` 关闭对话框并 `setScreen("unlock")`。

`PvaultDialog` 使用设计文档中的通用文案，主按钮改为“确认导入”，成功状态改为“导入完成”。不修改导出分支和 Demo 文件边界。

- [ ] **Step 4: 验证前端测试**

Run: `npx vitest run src/features/access/AccessFlow.test.tsx src/features/vault/PvaultDialog.test.tsx`

Expected: 全部通过。

- [ ] **Step 5: 提交**

```bash
git add src/features/access/AccessFlow.tsx src/features/access/AccessFlow.test.tsx src/features/vault/PvaultDialog.tsx src/features/vault/PvaultDialog.test.tsx
git commit -m "feat: import pvault from welcome screen"
```

### Task 3: 回归验证与记录

**Files:**
- Modify: `docs/development-process.md`

- [ ] **Step 1: 运行完整验证**

```bash
npm run lint && npm test && npm run build && npm run test:e2e
cd src-tauri && cargo test && cargo fmt --check && cargo clippy --all-targets -- -D warnings
```

Expected: 所有测试、lint、构建、格式和 Clippy 通过。

- [ ] **Step 2: 更新开发过程文档**

记录实际测试数量、提交和未运行桌面自动化的事实；不要把既有未提交桌面脚本混入本任务提交。
