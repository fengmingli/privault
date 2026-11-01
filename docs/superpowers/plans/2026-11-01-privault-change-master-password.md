# Change Master Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在设置页补齐修改主密码对话框，成功后使用新密码重新解锁。

**Architecture:** 新增独立表单对话框，复用现有 `VaultGateway.changeMasterPassword` 和 `VaultWorkspace.performLock`。Rust 加密与密钥槽代码不变，Demo 仅修正自身状态。

**Tech Stack:** React、TypeScript、Vitest、Testing Library、现有 Tauri 网关。

## Global Constraints

- 不修改 Rust 改密算法、DEK、恢复密钥或数据库格式。
- 当前密码错误不得切换页面或修改数据。
- 成功不自动解锁；返回解锁后使用新主密码。
- 当前会话直接执行，不使用子代理；先写失败测试。
- 不运行 macOS 原生桌面自动化。

---

### Task 1: 修改主密码对话框与 Demo 状态

**Files:**
- Create: `src/features/vault/ChangePasswordDialog.tsx`
- Create: `src/features/vault/ChangePasswordDialog.test.tsx`
- Modify: `src/lib/demo-gateway.ts`
- Modify: `src/lib/vault-gateway.test.ts`

**Interfaces:**
- Produces: `ChangePasswordDialog({ open, gateway, onClose, onRequireUnlock })`。
- Consumes: `VaultGateway.changeMasterPassword(currentPassword, newPassword)` 和 `validateMasterPassword`。

- [ ] **Step 1: 写失败测试**

对话框测试覆盖：非法/不一致新密码不调用网关；后端拒绝当前密码时显示错误且不调用 `onRequireUnlock`；成功时以当前密码和新密码调用网关，显示成功状态，点击“返回解锁”触发 `onRequireUnlock`。

在 `src/lib/vault-gateway.test.ts` 增加 Demo 测试：修改后旧演示密码解锁失败，新密码解锁成功。

- [ ] **Step 2: 确认测试失败**

Run: `npx vitest run src/features/vault/ChangePasswordDialog.test.tsx src/lib/vault-gateway.test.ts`

Expected: 对话框模块不存在；Demo 改密后仍使用旧密码。

- [ ] **Step 3: 实现对话框和 Demo 状态**

实现当前密码、新密码、确认密码三个字段，前端校验、忙碌、错误和成功状态。提交时先清空当前密码字段，再调用网关；失败显示安全错误，成功只允许返回解锁。Demo 使用 `this.masterPassword` 校验当前密码并保存新密码。

- [ ] **Step 4: 验证并提交**

Run: `npx vitest run src/features/vault/ChangePasswordDialog.test.tsx src/lib/vault-gateway.test.ts`

Expected: 全部通过后提交：

```bash
git add src/features/vault/ChangePasswordDialog.tsx src/features/vault/ChangePasswordDialog.test.tsx src/lib/demo-gateway.ts src/lib/vault-gateway.test.ts
git commit -m "feat: add change master password dialog"
```

### Task 2: 设置与工作区接线

**Files:**
- Modify: `src/features/vault/SettingsDialog.tsx`
- Modify: `src/features/vault/SettingsDialog.test.tsx`
- Modify: `src/features/vault/VaultWorkspace.tsx`

**Interfaces:**
- `SettingsDialog` 新增 `onChangePassword: () => void`。
- `VaultWorkspace` 渲染 `ChangePasswordDialog`，成功后复用 `performLock`。

- [ ] **Step 1: 写设置入口失败测试**

在 `SettingsDialog.test.tsx` 传入 `onChangePassword`，点击“修改主密码”并断言回调执行一次。

- [ ] **Step 2: 确认失败并最小实现**

Run: `npx vitest run src/features/vault/SettingsDialog.test.tsx`

Expected: 入口不存在。随后添加设置按钮，并在工作区管理 `changePasswordOpen`；关闭设置后展示对话框，`onRequireUnlock` 关闭两者并执行 `performLock`。

- [ ] **Step 3: 验证并提交**

Run: `npx vitest run src/features/vault/SettingsDialog.test.tsx src/features/vault/VaultWorkspace.test.tsx`

Expected: 全部通过。

```bash
git add src/features/vault/SettingsDialog.tsx src/features/vault/SettingsDialog.test.tsx src/features/vault/VaultWorkspace.tsx
git commit -m "feat: connect master password settings"
```

### Task 3: 回归与记录

**Files:**
- Modify: `docs/development-process.md`

- [ ] **Step 1: 完整验证**

```bash
npm run lint && npm test && npm run build && npm run test:e2e
cd src-tauri && cargo test master_password_change_requires_current_password
```

Expected: 所有检查通过，既有 Rust 改密测试保持绿色。

- [ ] **Step 2: 记录实际结果**

写入提交、测试数量、未运行桌面自动化和安装版是否更新；不混入既有未提交桌面脚本。
