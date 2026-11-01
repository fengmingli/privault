# 修改主密码入口设计

日期：2026-11-01  
状态：已确认，待实施

## 根因与目标

`VaultManager::change_master_password`、`vault_change_master_password` 和 `VaultGateway.changeMasterPassword` 已存在且有 Rust 测试，但设置页没有入口或前端对话框，因此用户无法修改主密码。本任务只补齐用户流程，不改变加密和密钥槽实现。

## 用户流程

- 设置页新增“修改主密码”按钮，打开独立对话框。
- 用户输入当前主密码、新主密码和确认新主密码。
- 前端使用现有 `validateMasterPassword` 检查新密码规则和两次输入一致性。
- 提交后通过现有网关调用 Rust；当前密码错误、新密码非法或后端失败时显示错误，不关闭对话框，也不触发解锁页切换。
- 成功后显示“主密码已修改，请使用新主密码解锁”。用户点击“返回解锁”后关闭设置和对话框，复用现有 `performLock` 清理敏感视图并返回解锁页。
- Rust 成功改密后本就会锁定会话，不自动解锁，不保留旧密码会话。

## 组件边界

- 新增 `ChangePasswordDialog`，只管理表单、忙碌、错误和成功状态。
- `SettingsDialog` 通过 `onChangePassword` 回调通知工作区打开对话框，不直接执行改密。
- `VaultWorkspace` 管理对话框开关，并向它传递当前网关和 `onRequireUnlock`。
- `DemoVaultGateway.changeMasterPassword` 校验当前演示密码并保存新密码，确保 Demo 的流程与真实状态一致；不会写入真实保险库。

## 安全与状态

- 三个密码字段均使用现有 `PasswordInput`，支持独立显隐，忙碌时禁用。
- 当前密码不出现在日志、错误详情或成功状态中。
- 提交时先清空当前密码字段，再等待后端结果；失败后用户可重新输入。
- 忙碌时禁止关闭对话框，成功后只允许返回解锁。
- 不修改恢复密钥、数据库 DEK、存储位置或 `.pvault` 格式。

## 验证

- 对话框：新密码校验失败不调用网关；当前密码错误保留对话框；成功调用网关并返回解锁。
- 设置页：按钮触发 `onChangePassword`。
- Demo：改密后旧密码不能解锁，新密码可以解锁。
- 既有 Rust 改密测试继续通过，前端完整测试和 Chrome E2E 通过。
- 本任务不运行 macOS 原生桌面自动化。
