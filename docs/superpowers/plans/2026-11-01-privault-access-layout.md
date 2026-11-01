# Privault Access Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让欢迎/创建页使用精简双栏，解锁/恢复页使用专注单栏，同时保持现有访问流程不变。

**Architecture:** 继续由 `AccessFlow` 管理访问页面状态，由 `AccessLayout` 提供 `split` 与 `focused` 两种纯展示布局。表单组件不感知布局模式，不新增业务状态或依赖。

**Tech Stack:** React 19、TypeScript、Tailwind CSS、Vitest、Testing Library、Playwright。

## Global Constraints

- 不修改 SQLCipher、主密码、恢复密钥、保存位置或解锁逻辑。
- 不恢复顶部“本地加密存储 · 完全离线”横幅。
- 保留浅色/深色主题、键盘焦点顺序和现有按钮可访问名称。
- 不增加宣传图片、渐变背景、动画或新依赖。
- 在当前会话直接执行，不使用子代理；每个行为先写失败测试。
- 本任务不运行 macOS 原生 `.pvault` 桌面自动化。

---

### Task 1: 双模式访问布局

**Files:**
- Create: `src/features/access/AccessFlow.test.tsx`
- Modify: `src/features/access/AccessLayout.tsx`
- Modify: `src/features/access/AccessFlow.tsx`

**Interfaces:**
- Consumes: 现有 `AccessScreen = "welcome" | "unlock" | "create" | "recover"`。
- Produces: `AccessLayout({ variant?: "split" | "focused", children })`；`main` 元素暴露 `data-layout` 用于验证当前模式。

- [ ] **Step 1: 写布局模式的失败测试**

创建 `src/features/access/AccessFlow.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VaultGateway } from "@/lib/vault-client";
import { AccessFlow } from "./AccessFlow";

type Screen = NonNullable<Parameters<typeof AccessFlow>[0]["initialScreen"]>;

function setup(initialScreen: Screen) {
  const gateway = { isDemo: true } as VaultGateway;
  render(<AccessFlow gateway={gateway} onUnlocked={vi.fn()} initialScreen={initialScreen} />);
}

describe("AccessFlow layout", () => {
  it.each([
    ["welcome", "split"],
    ["create", "split"],
    ["unlock", "focused"],
    ["recover", "focused"],
  ] as const)("maps %s to %s layout", (initialScreen, layout) => {
    setup(initialScreen);
    expect(screen.getByRole("main")).toHaveAttribute("data-layout", layout);
  });

  it("removes repeated branding and promotional tags", () => {
    setup("welcome");
    expect(screen.queryByText("PRIVAULT")).not.toBeInTheDocument();
    expect(screen.queryByText("完全离线设计")).not.toBeInTheDocument();
    expect(screen.queryByText("Mac · Windows")).not.toBeInTheDocument();
    expect(screen.queryByText("本地数据")).not.toBeInTheDocument();
    expect(screen.getByText("把重要信息，留在本机。")).toBeInTheDocument();
  });

  it("keeps focused access free of the marketing panel", () => {
    setup("unlock");
    expect(screen.getByText("Privault")).toBeInTheDocument();
    expect(screen.queryByText("把重要信息，留在本机。")).not.toBeInTheDocument();
    expect(screen.getByLabelText("演示密码")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试并确认因功能缺失失败**

Run: `npx vitest run src/features/access/AccessFlow.test.tsx`

Expected: FAIL；`main` 没有 `data-layout`，旧品牌 `PRIVAULT` 和宣传标签仍存在，解锁页仍显示营销区。

- [ ] **Step 3: 实现最小双模式布局**

将 `AccessLayout` 改为接收 `variant?: "split" | "focused"`，默认 `split`。两种模式都使用同一个内部 `AccessBrand` 和现有 `BrandMark`；`focused` 输出 `max-w-[420px]` 居中容器，`split` 输出 `lg:grid-cols-[minmax(0,1fr)_420px]` 双栏。`main` 设置 `data-layout={variant}`，卡片使用 `rounded-xl border bg-surface p-7 shadow-sm`。

在 `AccessFlow` 中计算：

```tsx
const layout = screen === "unlock" || screen === "recover" ? "focused" : "split";
```

并渲染：

```tsx
<AccessLayout variant={layout}>{/* 现有页面条件渲染保持不变 */}</AccessLayout>
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `npx vitest run src/features/access/AccessFlow.test.tsx`

Expected: 3 个测试通过；欢迎/创建为 `split`，解锁/恢复为 `focused`，营销内容不再出现在专注模式。

- [ ] **Step 5: 提交布局实现**

```bash
git add src/features/access/AccessFlow.test.tsx src/features/access/AccessLayout.tsx src/features/access/AccessFlow.tsx
git commit -m "feat: add focused access layout"
```

### Task 2: 回归验证与视觉检查

**Files:**
- Modify: `docs/development-process.md`
- Review: `test-results/` 中本轮生成的浏览器截图

**Interfaces:**
- Consumes: Task 1 的 `split` / `focused` 布局。
- Produces: 可复现的验证记录；不改变运行时代码接口。

- [ ] **Step 1: 运行完整前端检查**

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Expected: lint 无警告，全部 Vitest 与 Chrome E2E 通过，生产构建成功。

- [ ] **Step 2: 检查宽窗口与窄窗口截图**

使用本机 Chrome/Playwright 打开 Demo，分别检查欢迎、创建、解锁和恢复页面；至少覆盖 `1280×800` 与 `900×700`，并检查浅色和深色主题。确认：无横向溢出、无表单裁切、解锁到恢复不发生双栏/单栏跳动。

- [ ] **Step 3: 记录验证并提交文档**

在 `docs/development-process.md` 记录实际运行的命令、测试数量、截图尺寸和任何未完成事项。只提交本任务相关文档，不把既有未提交的 `.pvault` 或横幅修改混入布局提交。
