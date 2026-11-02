# Privault 开发过程记录

最后更新：2026-11-01（UTC）
工作分支：`main`
工作目录：`/Users/lifengming/Workspace/personal/privault`

本文记录整个开发过程中安装或使用的工具、项目依赖、主要代码修改、验证结果和未完成的平台验收。后续安装新工具、改变环境或完成重要修改时，必须同步更新本文；不能只记录在被 Git 忽略的临时进度文件中。

> 当前状态：真实 SQLCipher 单机保险库和设置中的安全路径迁移已经实现，macOS 真实桌面闭环已通过，真实模式提示已更新为“本地加密存储 · 完全离线”。Windows 未实测。

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
| mas（Mac App Store CLI） | 7.0.0 | 通过 `brew install mas` 安装，用于尝试安装官方 Xcode | 工具已安装；用户随后通过 App Store 完成 Xcode 安装 |
| Xcode | 27.2（27B52） | 用户通过 Apple App Store 安装并完成系统认证 | 已安装并接受许可，已用于真实桌面验收 |

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

Xcode 安装后由用户接受许可，并授予 WebDriverAgentRunner 辅助功能权限；随后完成 Appium/WKWebView 适配与真实桌面验收，详见 3.6。没有修改系统级 `xcode-select`，验收脚本通过 `DEVELOPER_DIR` 使用完整 Xcode。

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
- `rfd`：Rust 原生目录与文件选择器，前端不获得任意文件系统权限。
- `zip 9.2.0`：仅启用 `deflate`，用于 `.pvault` 严格三项归档；不重复加密 SQLCipher 数据库。
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

### 3.4 2026-10-29：桌面验收环境准备

- 安装项目本地 Appium / Mac2 和 App Store CLI `mas`，具体命令与阻塞见 1.4。
- `src-tauri/src/config.rs` 新增仅 debug/test 生效的 `PRIVAULT_CONFIG_DIR` 隔离覆盖；release 构建忽略该环境变量。
- 覆盖值必须为绝对路径，并同时决定默认配置和初始保险库目录，避免测试误写真实默认保险库。
- 新增绝对路径接受和相对路径拒绝测试；没有通过全局环境变量并发测试，避免测试间交叉污染。
- 通过 `npx tauri build --debug --bundles app` 成功构建隔离用 `Privault.app`（38.30 MiB），没有生成安装包。
- 新增 `scripts/verify-local-vault.sh`、`tests/desktop-smoke.mjs` 和 `npm run test:desktop`：使用独立临时目录、虚构凭据和条目，执行创建、重启、解锁、原生路径迁移、再解锁及明文扫描。
- 脚本只启动自己创建的 Appium 进程并只清理自己的临时目录；WebdriverIO 使用静默日志，失败仅报告阶段并保存测试截图，不打印密码或条目内容。
- `node --check tests/desktop-smoke.mjs` 与 `bash -n scripts/verify-local-vault.sh` 通过；实际桌面脚本在 Xcode 预检处停止，尚未创建 Appium 会话。

### 3.5 2026-10-30：Xcode 安装与首次许可

- 用户通过 App Store 完成 Xcode 27.2（27B52）安装，应用位于 `/Applications/Xcode.app`。
- 验收脚本在系统默认 `xcodebuild` 不可用时，自动设置 `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`，不修改系统级 `xcode-select`。
- 使用该目录执行 `npx appium driver doctor mac2`，结果为 **0 个必需修复项**；ffmpeg 和 Automation Mode 认证仍是可选项，未处理。
- 首次执行真实桌面脚本时，Rust 链接阶段确认 Apple SDK 许可尚未同意。已打开 Xcode 图形界面，等待用户接受许可和完成首次启动组件安装；尚未进入 Appium 会话。

### 3.6 2026-10-31：macOS 真实桌面闭环通过

用户接受 Xcode 许可并开启 WebDriverAgentRunner 辅助功能后，完成真实 Appium 验收。调试过程中确认并解决了以下工具链问题：

- Mac2 的 `element.click` 在当前 macOS 的 `XCElementSnapshot.displayID → SkyLight` 路径崩溃；改为从可访问元素读取坐标并调用 Mac2 应用坐标点击。
- Web 按钮名称主要位于 `title`，条目类型使用标题前缀，标题存在父/子重复静态节点；选择器分别处理，不再依赖严格单元素查询。
- Mac2 特殊键使用 `XCUIKeyboardKeyTab` / `XCUIKeyboardKeyReturn`，不使用 WebDriver Unicode 键码。
- 保存按钮位于滚动区域时使用键盘焦点导航，浏览器将焦点按钮滚入视口。
- 原生目录面板通过 `PathTextField` 输入绝对路径；目标空目录先在隔离临时根目录创建，再点击 Open。
- 系统目录面板关闭后，Mac2 一度丢失整个 WKWebView 可访问性子树。最终不再依赖该子树或坐标点击验证按钮，而是利用迁移密码框的 `autoFocus`，直接输入虚构主密码并用 `XCUIKeyboardKeyReturn` 提交。
- Rust 规范化 `/var` 为 `/private/var`，脚本使用 `realpathSync` 比较最终配置，避免将真实成功误判为路径不一致。

最终 `PRIVAULT_DESKTOP_DEBUG=1 npm run test:desktop` 通过后，又以正常非调试模式执行 `npm run test:desktop` 并再次通过。实际覆盖：创建 → 录入 → 重启 → 解锁 → 原生路径迁移 → 再重启解锁 → 条目一致 → 配置、备份和明文扫描。

另修复一个 Rust 测试随机边界：恢复密钥最后一个 Base32 字符含两个填充位，原测试修改末位时可能不改变解码 payload。`recovery_encoding_has_a_checksum` 现使用固定测试熵并篡改第一个有效字符，验证校验和必然拒绝有效位篡改；没有放宽实际校验逻辑。

真实模式横幅已从“验证中”改为“本地加密存储 · 完全离线”，应用窗口与 HTML 标题移除“UI 原型”，README 更新为真实加密存储、验证命令、平台证据和剩余排除项。

### 3.7 2026-10-31：release 应用本机安装

- 执行 `npx tauri build --bundles app`，release 构建成功，生成 16.39 MiB 的 `Privault.app`；没有生成 DMG/PKG 安装包。
- 初始 bundle 的临时签名未通过 `codesign --verify --deep --strict`，因此在本地执行 `codesign --force --deep --sign -` 重新进行 ad-hoc 签名。
- 重新签名及安装副本均通过严格校验。签名状态为 **ad-hoc、TeamIdentifier 未设置**，不是 Apple Developer 签名或 Apple 公证。
- 应用安装到 `~/Applications/Privault.app`，无需管理员权限，并已通过 `open` 启动且确认进程运行。
- 安装和启动过程没有创建、读取或修改真实保险库内容；用户首次创建或解锁由本人操作。

### 3.8 2026-10-31：创建目录与密码体验优化

- `27243d6`：新主密码策略统一为至少 8 个 Unicode 码点，并在大写、小写、数字、特殊字符中至少包含 3 类；创建、改密和恢复均由 Rust 独立校验，旧密码解锁不受影响。
- `3298282`：新增共享密码显隐组件，创建和恢复访问的主密码/确认密码可分别显示或隐藏，第一步按钮改为“下一步”。
- `6487f52`：`VaultManager::create_at` 支持可选固定磁盘目录，复用路径校验和 config-last 提交；冲突不覆盖，创建失败恢复原工作区与配置。
- `dc6956c`：创建页支持默认路径展示、原生目录选择、取消和恢复默认，Demo 不触发真实路径操作；`vault_create(masterPassword, destination?)` 前后端类型一致。
- 桌面验收改为分别使用初始自定义目录、配置目录和迁移目录，验证自定义创建、重启、迁移和两份加密库及备份。
- 测试 `.app` 使用独立 `com.privault.prototype.debug` 并在启动前 ad-hoc 签名，避免与已安装 release 冲突；目录自动补全面板必须关闭后再点击 Open，含大写/特殊字符的测试密码使用 Mac2 Shift 键映射。
- 正常非调试模式桌面闭环再次通过。release 已重新构建、ad-hoc 签名并更新到 `~/Applications/Privault.app`，安装副本严格校验通过后已启动。

### 3.9 2026-10-31：合并 main 与验证环境收尾

- `feature/frontend-ui` 已 fast-forward 合并到 `main`，合并结果为 `6c1b1e9`；没有远程上游，未执行 pull 或 push。
- `vite.config.ts` 的 Vitest include 限定为 `src/**/*.{test,spec}.{ts,tsx}`，避免主目录中的 worktree 被重复扫描并引入多个 React 实例。
- `glob` 与 `minimatch` 通过 `overrides` 固定为 14.0.2 / 11.0.1，并清理 lockfile 中重复的旧嵌套条目；`npm ci`、生产依赖审计和完整审计均为 **0 vulnerabilities**。
- 桌面验收移除唯一的 `adjustWindow` 调用，避免不同仓库路径下的新 WebDriverAgentRunner 需要额外窗口几何权限；正常模式真实桌面闭环再次通过。
- 合并后重新验证 94 个前端测试、7 个 Chrome E2E、45 个 Rust 测试、lint、构建、Clippy 和真实桌面闭环。
- 已移除 `.worktrees/frontend-ui`、执行 `git worktree prune` 并删除已合并的 `feature/frontend-ui`；后续开发在 `main` 继续。

### 3.10 2026-11-01：独立收藏与核心字段校验

- `a011cf8`：`Category` 新增 `favorites`，侧栏提供独立收藏视图、数量和空状态，支持搜索、取消后自动选择下一条，其他分类行为不变。
- `39c8a2a`：前端要求登录用户名/密码、安全笔记正文、银行卡卡号/有效期/CVV、证件号码/日期合法，并在对应字段下方显示错误；Luhn 和日期测试使用固定时间。
- `374e6c5`：Rust 保存入口执行同类核心校验，非法条目不能写入 SQLCipher；旧测试夹具补齐合法正文和 CVV。
- 桌面验收增加真实收藏/分类切换，并兼容 macOS 将侧栏分类暴露为 `XCUIElementTypeCheckBox` 的结构。
- 系统自动化认证保持开启；一次 WDA 授权超时通过重新开启辅助功能和自动化授权解决，没有执行 `automationmodetool enable-automationmode-without-authentication`。
- 最终验证：100 个前端测试、48 个 Rust 测试、7 个 Chrome E2E、0 漏洞审计及正常模式真实桌面闭环全部通过。release 已重新构建、ad-hoc 签名并更新到 `~/Applications/Privault.app`，安装副本严格校验通过后已启动。

### 3.11 2026-11-01：`.pvault` 加密导入导出与增量构建

- `beba95a`：新增严格 `.pvault` 导出，仅包含 `vault.db`、`vault.meta`、`manifest.json`，拒绝覆盖已有目标。
- `506f960`：新增原主密码验证、导入前 `backups/import-*` 备份、失败回滚及恶意归档测试。
- `f328a2c`：新增前端网关、导入导出对话框和设置入口；Demo 不执行真实文件操作。
- 当前增量验证通过：106 个前端测试、54 个 Rust 测试、lint、TypeScript/Vite 构建和 `cargo fmt --check`。
- 桌面验收脚本已加入导出、独立工作区导入、收藏和备份检查；原生 Save/Open 面板自动化仍在修正，**本轮不记为桌面验收通过**。
- 本轮仅重新构建 release：`src-tauri/target/release/bundle/macos/Privault.app`，16.91 MiB；ad-hoc 严格签名校验通过。用户退出旧应用后，已替换并启动 `~/Applications/Privault.app`，安装副本严格签名校验通过。
- 后续 UI 调整：真实模式不再显示顶部“本地加密存储 · 完全离线”横幅，Demo 的“UI 原型，请勿输入真实密码”警告保留；相关 4 个启动测试通过，release 已重新构建并完成 ad-hoc 签名校验。用户退出旧应用后，安装副本已更新并启动，严格签名校验通过。

### 3.12 2026-11-01：访问页双模式布局

- 设计 `b2cc75f`、计划 `9ad2d87`：确认欢迎/创建使用精简双栏，解锁/恢复使用专注单栏。
- `1435673`：`AccessLayout` 新增 `split` / `focused`，移除重复品牌与宣传标签；`AccessFlow` 按页面选择布局，表单和安全流程不变。
- `a638f75`：浏览器截图发现 `900×700` 创建页顶部被 flex 居中裁切，改用自动外边距居中并保留溢出滚动；新增品牌与底部操作可达性回归测试。
- 最终验证：112 个前端测试、8 个 Chrome E2E、lint 和生产构建通过。生成并审查 16 张访问页截图，覆盖欢迎、创建、解锁、恢复，`1280×800` / `900×700` 及浅色/深色主题；无横向溢出。
- 本次未运行 macOS 原生桌面自动化，未改变 `.pvault` 桌面验收的待完成状态。
- 已重新构建 16.91 MiB release，完成 ad-hoc 签名严格校验；确认旧应用未运行后，已更新并启动 `~/Applications/Privault.app`，安装副本严格签名校验通过。

### 3.13 2026-11-01：欢迎页真实 `.pvault` 导入

- 设计与计划 `69caa1e`：欢迎页接入现有导入对话框，空库和锁定库均可导入，成功后返回解锁而不自动解锁。
- `126cc39`：Rust 允许 `Empty` / `Locked` / `Unlocked` 进入导入，成功后统一转为 `Locked`；新增空库、锁定库导入后原密码解锁测试。
- `c555fb1`：欢迎页移除“本期不支持导入或导出”的过期提示，连接现有原生选择器与 `PvaultDialog`；Demo 仍不执行真实文件操作。
- 对话框改为兼容空库和已有库的通用文案，成功只提示“导入完成”；已有库备份和失败回滚不变。
- 最终验证：114 个前端测试、56 个 Rust 测试、8 个 Chrome E2E，以及 lint、生产构建、`cargo fmt --check`、Clippy 全部通过；未运行 macOS 原生桌面自动化。

### 3.14 2026-11-01：访问页布局回退

- `e294157`：按用户要求恢复布局优化前的固定双栏访问页，欢迎、创建、解锁和恢复共用原品牌区与表单卡片。
- 本次只回退访问页视觉布局；欢迎页真实 `.pvault` 导入、空库/锁定库导入状态修复、真实模式横幅移除和其他功能均保留。
- 回退后验证：109 个前端测试、7 个 Chrome E2E、lint 和生产构建通过；未修改 Rust，也未运行 macOS 原生桌面自动化。
- 16.91 MiB release 已重新构建并通过 ad-hoc 严格签名校验；用户退出旧应用后，安装副本已更新并启动，严格签名校验通过。

### 3.15 2026-11-01：补齐修改主密码流程

- 根因：Rust 和 `VaultGateway.changeMasterPassword` 已有改密能力，但设置页没有入口或调用组件，导致用户无法修改主密码。
- `ec407ba`：新增当前密码、新密码和确认密码对话框，覆盖校验失败、当前密码错误和成功返回解锁；Demo 改密后使用新演示密码。
- `53c67a0`：设置页新增“修改主密码”入口，工作区复用 `performLock` 清理敏感视图；成功不自动解锁。
- 验证：113 个前端测试、7 个 Chrome E2E、lint、生产构建及 Rust `master_password_change_requires_current_password` 通过；未运行 macOS 原生桌面自动化。
- 16.91 MiB release 已重新构建并通过 ad-hoc 严格签名校验；用户退出旧应用后，安装副本已更新并启动，严格签名校验通过。

## 4. 验证记录

最近一次完整验证（2026-11-01，含真实桌面和收藏）：

| 检查 | 结果 |
| --- | --- |
| 前端单元/集成测试 | 19 个测试文件，100 个测试通过 |
| 本机 Chrome E2E | 7 个测试通过，包括 Demo 存储边界 |
| 前端 lint | 通过，无警告 |
| TypeScript + Vite 生产构建 | 通过 |
| Rust 测试 | 48 个测试通过 |
| `cargo fmt --check` | 通过 |
| `cargo clippy --all-targets -- -D warnings` | 通过 |
| `cargo check --release` | 通过，确认 release 配置可编译 |
| `npm run test:desktop` | **通过**：macOS 自定义目录创建、两次重启、解锁、迁移、独立收藏视图、条目一致性及明文扫描 |
| release `.app` 构建 | 通过，16.47 MiB；ad-hoc 本机签名严格校验通过 |
| 本机安装 | 已安装到 `~/Applications/Privault.app` 并启动 |
| 网络 API 扫描 | `fetch`、Axios、XMLHttpRequest、WebSocket 无匹配 |
| npm 依赖审计 | 生产依赖及完整依赖均为 **0 vulnerabilities** |
| Rust 日志扫描 | 无 `println!` / `eprintln!` / `dbg!` / 日志宏；`log::` 仅命中 `rfd::FileDialog` 的名称片段 |
| 前端文件 API 扫描 | `fs::`、`read_to_string`、`write(` 无匹配 |
| Tauri 权限 | 仍只有 `core:default`，无 fs、HTTP、shell、clipboard、updater 或 process 插件 |
| 测试清理 | 无残留验收 Appium/Privault 进程或 `privault-desktop-*` 临时目录 |

测试数据边界：

- 浏览器测试只使用虚构内存数据，不创建真实保险库或真实路径。
- Rust 测试使用隔离临时目录。
- 真实桌面验收使用 debug/test 专用绝对路径覆盖和虚构凭据，成功后清理临时保险库；没有读取或修改用户真实保险库。

## 5. 当前阻塞与后续事项

### 5.1 平台证据

- **macOS**：既有真实 Appium 桌面闭环已通过；`.pvault` 核心测试已通过，但其新增桌面导入导出闭环尚未复验完成。
- **Windows**：尚未运行 Rust 测试或桌面闭环，不宣称验证通过；后续需在 Windows 使用匹配的 WebDriver 环境单独执行。
- macOS 自动化复验需要完整 Xcode 和 WebDriverAgentRunner 辅助功能权限；这些系统授权没有通过关闭安全认证绕过。

### 5.2 本期仍然排除

- 云同步、账号、遥测、远程资源和自动更新。
- 浏览器或系统自动填充、附件、生物识别。
- 原生剪贴板定时清理、系统休眠锁定。
- 安装包发布、平台签名和 Windows 实测。

真实桌面验收脚本、环境限制、排障方法和 macOS 证据均已写入 README 与本文，后续变更必须继续保留可复现的验证证据。

## 6. 维护要求

后续每次发生以下情况，都应更新本文并注明日期、命令、版本、影响和验证证据：

- 安装、升级或启用任何工具、驱动和系统组件。
- 新增生产或开发依赖。
- 修改存储格式、密钥管理、路径策略、Tauri 命令或权限。
- 完成重要 UI/安全行为修改。
- 执行完整测试、真实桌面验收或发现新的平台限制。

不得把“安装成功”写成“功能验证通过”，不得在 Windows 未实测时宣称 Windows 通过，也不得将未经实际运行的桌面验收脚本记为验收证据。
