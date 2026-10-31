# Privault

Privault 是面向 macOS 与 Windows 设计的完全离线个人保险库，用于保存账号密码、安全笔记、银行卡、证件和自定义字段。真实桌面模式通过 Rust 将私密数据写入 **SQLCipher 加密数据库**，不需要账号、云服务或网络连接。

> 当前证据：macOS 真实桌面闭环已通过；Windows 尚未实测。不要把 Windows 支持状态视为已验证。

## 已实现

- 主密码创建、解锁、锁定和修改，以及一次性恢复密钥恢复访问
- 创建时通过原生目录选择器直接选择保存文件夹，并支持恢复默认目录
- 新主密码至少 8 位且包含大写、小写、数字、特殊字符中的至少 3 类；设置和恢复时可独立显隐
- 登录信息、安全笔记、银行卡、证件、自定义字段和密码历史
- 三栏工作区、分类、搜索、收藏、增删改、软删除与撤销
- 本地密码生成器、密码显隐与复制、未保存修改保护
- 浅色、深色、跟随系统主题、自动锁定和快捷键
- 本机固定磁盘存储路径展示、原生目录选择和安全自动迁移
- 迁移前加密备份、目标副本解锁与完整性验证、失败回滚，原库和备份保留
- 浏览器独立内存 Demo，不会与真实保险库混合数据

## 加密与存储

- 使用随机 DEK 加密 SQLCipher 数据库。
- 新主密码至少 8 个 Unicode 码点，并包含大写字母、小写字母、数字、特殊字符中的至少 3 类；只约束新设置的密码，已有密码解锁不受影响。
- 主密码和恢复密钥分别经 **Argon2id** 派生 KEK，再通过 **XChaCha20-Poly1305** 封装同一个 DEK。
- 恢复密钥使用带校验和的 Crockford Base32 格式，恢复访问后旧密钥失效并生成新密钥。
- `vault.meta` 只保存格式、KDF 参数、盐值、Nonce 和封装密钥槽，不保存明文主密码或恢复密钥。
- `config.json` 只包含格式版本和存储路径。

默认目录：

- macOS：`~/Library/Application Support/Privault/`
- Windows：`%LOCALAPPDATA%\Privault\`

主要文件：

```text
config.json
vault.db
vault.meta
backups/migration-<时间与操作 ID>/
```

存储目录仅限本机固定磁盘。网络盘、U 盘、根目录、危险链接逃逸、目标同名保险库和静默覆盖都会被拒绝。创建时可直接选择合规目录，创建失败不切换原工作区或配置。迁移只有在目标副本成功解锁并通过完整性检查后才切换配置；失败继续使用原路径。

**恢复密钥丢失且忘记主密码将无法恢复数据。请离线保存恢复密钥。**

## 浏览器 Demo 与真实桌面模式

启动浏览器界面：

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:1420`：

- 演示密码：`demo`
- 演示恢复密钥：`DEMO-4C7Q-9M2X-6K8P`

浏览器只使用虚构内存数据，不创建或读取真实保险库。真实桌面模式需要 Rust/Cargo，并通过受限 Tauri 命令调用 Rust 安全核心：

```bash
npx tauri dev
```

前端没有任意文件系统、shell、网络、更新器或远程资源权限。

## 本机安装 release 应用

```bash
npx tauri build --bundles app
mkdir -p "$HOME/Applications"
ditto src-tauri/target/release/bundle/macos/Privault.app "$HOME/Applications/Privault.app"
open "$HOME/Applications/Privault.app"
```

如果构建产物未通过 `codesign --verify --deep --strict`，可在本机重新进行 ad-hoc 签名后重试：

```bash
codesign --force --deep --sign - src-tauri/target/release/bundle/macos/Privault.app
```

当前安装方式不是 Apple Developer 签名或公证，不包含自动更新。安装不会创建或修改保险库；首次创建、主密码和恢复密钥由用户本人处理。

## 验证

### 前端与 Rust

```bash
npm run lint
npm test
npm run build
npm run test:e2e

cd src-tauri
cargo test
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cd ..
```

浏览器 E2E 使用本机 Chrome（Playwright `channel: "chrome"`），不需要下载 Chromium。

### macOS 真实桌面闭环

```bash
npm run test:desktop
```

该命令使用项目开发依赖中的 Appium / Appium Mac2 Driver 和 WebdriverIO，执行：

> 创建时选择自定义目录 → 录入 → 重启 → 解锁 → 原生路径迁移 → 再重启解锁 → 条目一致性、配置与明文扫描

要求：

- 完整 Xcode（官方最低 13；本机验证使用 Xcode 27.2）
- 允许 `WebDriverAgentRunner-Runner.app` 使用 macOS“辅助功能”
- 需要时允许 Xcode/Appium 的自动化授权

脚本只使用 debug/test 生效的 `PRIVAULT_CONFIG_DIR` 和独立临时目录，不接触真实保险库；release 构建忽略该覆盖。测试 `.app` 使用独立的 `com.privault.prototype.debug`，避免与已安装应用冲突，并在启动前进行 ad-hoc 签名校验。它只启动自己的 Appium 进程并清理自己的临时数据，正常模式不保存页面结构或凭据日志。排障时可设置 `PRIVAULT_DESKTOP_DEBUG=1` 保存测试截图和调试文件。

## 平台证据与排除项

- **macOS**：前端、Rust、Chrome E2E 和真实 Appium 桌面闭环已在本机通过。
- **Windows**：尚未运行 Rust 测试或桌面闭环，不宣称验证通过。
- 本期不包含 `.pvault` 跨设备导入导出、云同步、账号、遥测、自动更新、浏览器或系统自动填充、附件、生物识别、原生剪贴板定时清理、系统休眠锁定、安装包发布与平台签名。

完整工具安装、修改、验证和平台限制记录见 [`docs/development-process.md`](docs/development-process.md)。
