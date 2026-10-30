# Privault 开发过程记录

最后更新：2026-10-29（UTC）  
工作分支：`feature/frontend-ui`  
工作目录：`.worktrees/frontend-ui`

本文记录整个开发过程中安装或使用的工具、项目依赖、主要代码修改、验证结果和未完成的平台验收。后续安装新工具、改变环境或完成重要修改时，必须同步更新本文；不能只记录在被 Git 忽略的临时进度文件中。

> 当前状态：真实 SQLCipher 单机保险库和设置中的安全路径迁移已经实现，并通过 Rust、前端和浏览器 Demo 测试。真实桌面 UI 闭环尚未完成，界面中的“本地加密存储 · 验证中”提示必须保留。Windows 未实测。

## 1. 工具链与环境

### 1.1 已有环境（不是本轮新安装）

| 工具 | 当前版本 | 用途与说明 |
| --- | --- | --- |
| Node.js | 24.15.0 | 前端开发、构建和测试 |
| npm | 11.12.1 | JavaScript 依赖安装与脚本执行 |
| Google Chrome | 156 | Playwright 使用 `channel: "chrome"`；没有下载 Chromium |
| safaridriver | Safari 27.0.1 自带 | macOS 系统组件；不是本轮安装的软件 |

### 1.2 开发过程中安装的工具

| 工具 | 版本 | 安装/执行情况 | 当前状态 |
| --- | --- | --- | --- |
| Rust / Cargo | 1.99.1（Homebrew） | 在本地加密保险库阶段经用户单独批准后安装 | 可用于 SQLCipher、Tauri 和 Rust 测试 |
| tauri-driver | 2.1.0 | 2026-10-29 执行 `cargo install tauri-driver --locked` | 已安装到 `~/.cargo/bin/tauri-driver`，但**不支持当前 macOS 平台**，不能用于桌面验收 |
| WebdriverIO | 10.1.0 | 2026-10-29 执行 `npm install -D webdriverio --registry=https://registry.npmjs.org` | 已作为开发依赖写入 `package.json` 和 `package-lock.json` |
| Appium | 3.9.0 | 2026-10-29 经用户批准后执行项目本地 npm 安装 | 已作为开发依赖安装，`npx appium --version` 验证通过 |
| Appium Mac2 Driver | 4.5.1 | 与 Appium 一同作为项目开发依赖安装 | `npx appium driver list` 显示 `mac2@4.5.1 [installed (npm)]` |
| mas（Mac App Store CLI） | 7.0.0 | 通过 `brew install mas` 安装，用于尝试安装官方 Xcode | 工具已安装；Xcode 安装因需要交互式管理员认证而等待用户操作 |

补充说明：

- Rust/Cargo 的早期安装命令未保留在当前会话记录中，因此这里只记录已确认的批准事实和当前版本，不补写未经证实的命令。
- `cargo install` 输出了 `~/.cargo/bin` 不在当前 shell `PATH` 中的提示。本轮没有修改 `PATH`、shell 配置或全局 npm 配置；需要调用时使用绝对路径。
- npm 官方镜像只用于当次安装命令，没有写入全局 `.npmrc`。
- WebdriverIO 安装新增 164 个 npm 包，npm 报告 0 个漏洞；出现一个间接依赖弃用警告：`whatwg-encoding@3.1.1`。完整直接与间接版本以 lockfile 为准。

### 1.3 safaridriver 启用尝试与平台结论

2026-10-29 经用户批准执行：

```bash
safaridriver --enable
```

命令需要交互式管理员密码，非交互终端返回：

```text
Password:Password is not valid, please try again.
```

因此没有完成启用，也没有读取、记录或代填密码。随后检查 `tauri-driver 2.1.0` 安装源码，确认：

- `src/main.rs` 只在 `linux` 和 `windows` 上编译服务入口；其他平台直接输出 `tauri-driver is not supported on this platform`。
- 官方 README 只列出 Linux 的 WebKitWebDriver 和 Windows 的 Microsoft Edge Driver；macOS Appium Mac2 Driver 仍标为 Todo。
- 所以即使启用 `safaridriver`，当前 `tauri-driver` 仍不能完成 macOS Tauri 自动化验收。

在最初的 `tauri-driver` 评估阶段没有安装 Appium、Appium Mac2 Driver 或其他替代驱动。随后用户于 2026-10-29 明确批准安装自动化环境，实际安装过程见下节；任何新的后续工具仍需按约定记录。

### 1.4 Appium / Mac2 自动化环境安装

2026-10-29 用户批准安装完整自动化环境后执行：

```bash
npm install -D appium@3.9.0 appium-mac2-driver@4.5.1 --registry=https://registry.npmjs.org
```

结果：新增 222 个 npm 包，npm 报告 0 个漏洞；两项均写入项目开发依赖，没有全局安装 Appium。`npx appium driver list` 已确认 Mac2 驱动通过项目 npm 依赖被发现。

环境诊断命令：

```bash
npx appium driver doctor mac2
```

诊断确认两个必需问题都指向完整 Xcode：当前开发者目录是 Command Line Tools，且 `xcodebuild` 不可用。诊断还列出两个可选项：关闭 Automation Mode 认证、安装 ffmpeg 用于屏幕录制。为保持系统安全和减少无关依赖，本轮**没有关闭认证，也没有安装 ffmpeg**。

Homebrew 没有名为 `xcode` 的 cask，因此安装 `mas 7.0.0` 并尝试：

```bash
mas install 497799835
```

该命令触发 `sudo` 交互式密码要求，非交互终端无法继续。已为用户打开 Apple 官方 Xcode App Store 页面（应用 ID `497799835`），等待用户点击“获取/安装”并完成系统认证。Homebrew 在安装 `mas` 时自动更新了索引，但没有升级其他已安装包；出现的旧包和不受信任 tap 提示未做任何额外处理。

Xcode 安装后仍需：同意 Xcode 许可、配置 `xcode-select`、重新运行 Mac2 doctor，并由用户在系统设置中授予 Xcode Helper 辅助功能权限。当前尚未验证 Appium Mac2 能否稳定定位 Privault 的 Tauri/WKWebView 元素。

## 2. 项目依赖变化

### 2.1 前端和桌面直接依赖

项目初始阶段通过 npm 安装并锁定 React、Vite、TypeScript、Tailwind CSS、Tauri CLI 和测试工具。当前关键直接依赖包括：

- UI：React / React DOM 19.3.1、React Router 7.18.4、Lucide 1.62.0。
- Tauri：`@tauri-apps/api` 与 `@tauri-apps/cli` 2.12.4。
- 构建：Vite 8.3.5、TypeScript 7.0.2、Tailwind CSS 3.4.17、PostCSS、Autoprefixer。
- 测试：Vitest 5.0.5、Testing Library、Playwright 1.64.1、jsdom 30.1.3、WebdriverIO 10.1.0、Appium 3.9.0、Appium Mac2 Driver 4.5.1。
- 代码检查：oxlint（当前安装 1.90.0）。

Task 8 新增生产依赖 `@tauri-apps/api`，用于前端网关调用受限 Rust 命令。Task 10 工具准备阶段新增开发依赖 `webdriverio`、`appium` 和 `appium-mac2-driver`。所有准确版本和传递依赖分别由 `package.json`、`package-lock.json` 管理。

### 2.2 Rust 依赖

本地安全核心使用的主要 crate：

- `rusqlite`：`bundled-sqlcipher-vendored-openssl`，提供 SQLCipher 整库加密。
- `argon2`：Argon2id 凭据派生。
- `chacha20poly1305`：XChaCha20-Poly1305 DEK 密钥槽封装。
- `sha2`：恢复密钥校验和。
- `base32`：Crockford Base32 恢复密钥编码。
- `zeroize`：密钥材料清理。
- `serde` / `serde_json`：受限 DTO 与元数据序列化。
- `tauri` / `tauri-build`：桌面壳与命令层。
- `rfd`：Rust 原生目录选择器，前端不获得任意文件系统权限。
- `uuid`、`chrono`、`dirs`、`getrandom`、`hex`、`libc`、`thiserror` 等辅助依赖。
- Windows 专用 `windows-sys`；测试专用 `tempfile`。

声明版本见 `src-tauri/Cargo.toml`，锁定版本见 `src-tauri/Cargo.lock`。

## 3. 主要代码修改过程

### 3.1 2026-10-27：前端 UI 原型

完成内容：

- 建立 Privault 视觉系统、React 组件和响应式三栏工作区。
- 实现创建、解锁、恢复密钥、恢复访问的界面流程。
- 实现登录信息、安全笔记、银行卡、证件和自定义字段的内存 Demo。
- 实现搜索、分类、收藏、增删改、删除撤销、密码显隐、复制和密码生成器。
- 实现主题、自动锁定、设置、快捷键、未保存修改保护。
- 配置仅含 `core:default` 的 Tauri 桌面壳和本机 Chrome E2E。
- 修复锁定或放弃表单后残留敏感 UI 状态的问题。

此阶段曾通过 64 个单元/集成测试、6 个 Chrome E2E、生产构建和桌面截图审查。所有条目均为虚构内存数据。

主要提交：`05f5f80`、`a9920dd`、`e5b51ed`、`0be3f9b`、`0b9f3e3`、`640ee98`、`c5a5ae1`、`815db54`、`4e13bfc`。

### 3.2 2026-10-28：真实本地加密保险库

| 阶段 | 修改内容 | 提交 |
| --- | --- | --- |
| 设计 | 明确 SQLCipher、双密钥槽、固定卷限制、两阶段迁移与回滚设计 | `2a6a8f4`、`b6242f2` |
| Task 1 | Rust DTO、稳定错误码、前端可判别条目类型和依赖 | `7e8e8a5` |
| Task 2 | Argon2id、随机 DEK、XChaCha20-Poly1305 主密码/恢复密钥双槽、恢复密钥轮换 | `7e42af9` |
| Task 3 | SQLCipher schema、事务 CRUD、自定义字段、密码历史、软删除与恢复 | `662d93f` |
| Task 4 | 创建、解锁、锁定、改密、恢复访问和会话生命周期 | `bd4d7fa` |
| Task 5 | 本机固定磁盘、权限、危险链接、根目录、冲突和空间检查 | `1b62a3f` |
| Task 6 | 原库加密备份、临时副本、目标解锁与完整性验证、配置最后提交和失败回滚 | `33acb83` |
| Task 7 | 串行 Tauri 命令、DTO 序列化、Rust 原生目录选择；未添加任意 fs/shell/network 能力 | `545f2c6` |

### 3.3 2026-10-28 至 2026-10-29：真实前端闭环与存储设置

**Task 8 — `8bea834`**

- 新增 `VaultGateway`、`TauriVaultGateway` 和独立浏览器内存 Demo 网关。
- 创建、解锁、恢复访问改为异步真实命令；启动时通过 `vault_status` 选择创建、解锁或错误页。
- 工作区改为列表摘要 + 按需读取完整条目，保存、删除、撤销、收藏和锁定通过网关执行。
- 修复异步详情加载、删除撤销闭包、Toast 被错误覆盖、action 名称不一致和锁定后的未处理 Promise。
- 真实模式不再短暂显示 Demo 条目；Tauri 结构化错误保留稳定错误码和安全消息。
- 真实恢复流程改用 Crockford Base32 形状检查，校验和及凭据仍由 Rust 验证。

**Task 9 — `fa378d5`**

- 新增 `StorageLocationCard.tsx` 和 `MigrationDialog.tsx`。
- 设置中显示真实规范化路径及“本机固定磁盘 · 加密存储”；浏览器 Demo 不显示伪造路径。
- 完成 `preparing → awaiting-password → confirming → success/error` 两阶段 UI。
- 支持原生目录选择取消、迁移取消、错误密码保持原路径、成功后重新解锁。
- 迁移期间禁止新建、保存、删除、收藏和快捷键写入，并暂停自动锁定。
- “恢复默认目录”复用同一迁移流程：前端传 `destination: null`，默认路径只由 Rust 计算。
- 通用 Dialog 新增忙碌时禁止关闭，避免准备/验证中途留下未处理迁移。

### 3.4 2026-10-29：桌面验收环境准备（进行中）

- 安装项目本地 Appium / Mac2 和 App Store CLI `mas`，具体命令与阻塞见 1.4。
- `src-tauri/src/config.rs` 新增仅 debug/test 生效的 `PRIVAULT_CONFIG_DIR` 隔离覆盖；release 构建忽略该环境变量。
- 覆盖值必须为绝对路径，并同时决定默认配置和初始保险库目录，避免测试误写真实默认保险库。
- 新增绝对路径接受和相对路径拒绝测试；没有通过全局环境变量并发测试，避免测试间交叉污染。
- 通过 `npx tauri build --debug --bundles app` 成功构建隔离用 `Privault.app`（38.30 MiB），没有生成安装包。
- 新增 `scripts/verify-local-vault.sh`、`tests/desktop-smoke.mjs` 和 `npm run test:desktop`：使用独立临时目录、虚构凭据和条目，执行创建、重启、解锁、原生路径迁移、再解锁及明文扫描。
- 脚本只启动自己创建的 Appium 进程并只清理自己的临时目录；WebdriverIO 使用静默日志，失败仅报告阶段并保存测试截图，不打印密码或条目内容。
- `node --check tests/desktop-smoke.mjs` 与 `bash -n scripts/verify-local-vault.sh` 通过；实际桌面脚本在 Xcode 预检处停止，尚未创建 Appium 会话。

## 4. 验证记录

最近一次完整非桌面验证（Appium 环境准备及隔离配置修改后）：

| 检查 | 结果 |
| --- | --- |
| 前端单元/集成测试 | 19 个测试文件，87 个测试通过 |
| 本机 Chrome E2E | 7 个测试通过，包括 Demo 存储边界 |
| 前端 lint | 通过，无警告 |
| TypeScript + Vite 生产构建 | 通过 |
| Rust 测试 | 41 个测试通过 |
| `cargo fmt --check` | 通过 |
| `cargo clippy --all-targets -- -D warnings` | 通过 |
| `cargo check --release` | 通过，确认 release 配置可编译 |
| `npm run test:desktop` | **预检阻塞**：完整 Xcode 不可用，未启动 Appium 会话，不能记为桌面验收通过 |

测试数据边界：

- 浏览器测试只使用虚构内存数据，不创建真实保险库或真实路径。
- Rust 测试使用隔离临时目录。
- 尚未运行真实 Tauri 桌面 UI 的创建、重启和迁移闭环。

## 5. 当前阻塞与后续事项

### 5.1 macOS 桌面自动化阻塞

原 Task 10 计划假设 `tauri-driver + safaridriver` 可覆盖 macOS，但已安装的 `tauri-driver 2.1.0` 源码证明该假设不成立。随后已按用户批准安装项目本地 Appium 3.9.0 和 Mac2 Driver 4.5.1；完整 Xcode 安装仍等待 App Store 交互式认证，真实桌面自动化验收尚未运行。

当前采用 Appium 评估路线，仍需完成：

1. 完成官方 Xcode 安装和许可配置，验证 Appium Mac2 是否能可靠控制 Privault 的 Tauri/WKWebView；辅助功能等系统权限需要用户手动授权。
2. 如果 Appium 路线不可行，保留自动化验收为未完成，提供隔离环境的人工桌面验收步骤，由用户实际操作并记录结果。
3. 在 Linux/Windows 环境可使用受支持的 `tauri-driver` 执行自动化流程；Windows 仍需单独实测，不能根据 macOS 或其他平台结果推断通过。

### 5.2 Task 10 尚未完成

- 隔离桌面配置目录与真实应用重启验收。
- 创建 → 录入 → 重启 → 解锁 → 迁移 → 再解锁 → 数据一致的桌面证据。
- 最终网络、日志、前端文件访问和明文物件审计。
- 更新已经过时的 `README.md`（当前仍描述为纯 UI 原型并声称未安装 Rust）。
- 根据真实验收结果决定是否移除“验证中”提示；目前不得移除。

## 6. 维护要求

后续每次发生以下情况，都应更新本文并注明日期、命令、版本、影响和验证证据：

- 安装、升级或启用任何工具、驱动和系统组件。
- 新增生产或开发依赖。
- 修改存储格式、密钥管理、路径策略、Tauri 命令或权限。
- 完成重要 UI/安全行为修改。
- 执行完整测试、真实桌面验收或发现新的平台限制。

不得把“安装成功”写成“功能验证通过”，不得在 Windows 未实测时宣称 Windows 通过，也不得在真实桌面闭环完成前删除验证提示。
