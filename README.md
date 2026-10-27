# Privault 前端 UI 原型

Privault 是面向 Mac 与 Windows 的完全离线个人保险库。本仓库当前仅包含**前端 UI 原型**，用于确认界面与交互，不具备保存真实隐私数据的安全能力。

> UI 原型，请勿输入真实密码。

## 已实现

- 欢迎、创建演示保险库、恢复密钥、解锁与恢复访问流程
- 三栏桌面工作区：分类、搜索、详情、密码显隐与复制
- 登录信息、安全笔记、银行卡、证件和自定义字段
- 新增、编辑、删除、撤销、收藏及未保存修改保护
- 本地密码生成器及填入编辑表单
- 浅色、深色、跟随系统主题
- 自动锁定、快捷键及原生能力说明
- 仅含 `core:default` 权限的 Tauri 2 窗口配置

所有条目均为虚构数据，只保留在内存中，刷新后复位。仅主题、自动锁定时间和剪贴板倒计时偏好会持久化，不保存密码、恢复密钥、条目或搜索词。应用不加载远程资源。

## 运行 UI

要求：Node.js 24+ 与 npm。

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:1420`。

- 演示解锁密码：`demo`
- 演示恢复密钥：`DEMO-4C7Q-9M2X-6K8P`

## 验证

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

端到端测试使用本机 Chrome（Playwright `channel: "chrome"`），不需要下载浏览器。测试覆盖主要交互、外部请求审计、浅色/深色截图和 1024×700 布局。

## Tauri 桌面壳

`src-tauri/` 已包含最小 Tauri 2 配置，没有 HTTP、文件系统、更新器或 shell 插件。构建桌面壳需要额外安装 Rust 工具链：

```bash
npm run tauri dev
npm run tauri build
```

当前环境未安装 Rust，因此桌面二进制构建尚未验证。前端生产构建和 Chrome 端到端测试可独立验证。

## 尚未接入

- Argon2id、SQLCipher 与真实密钥管理
- 真实保险库读写、加密备份与迁移
- 原生剪贴板定时清理、系统休眠锁定
- Mac / Windows 安装包与平台签名

这些能力需要独立的 Rust 安全核心设计与验证，不能把当前原型用于真实账号密码。
