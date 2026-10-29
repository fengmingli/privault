import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVaultGateway } from "@/lib/gateway";
import type { VaultGateway } from "@/lib/vault-client";
import App from "./App";

vi.mock("@/lib/gateway", () => ({ createVaultGateway: vi.fn() }));

const location = { path: "/fixed/vault", isDefault: true, volumeKind: "fixed" };
const status = vi.fn();

beforeEach(() => {
  status.mockReset();
  vi.mocked(createVaultGateway).mockReturnValue({ isDemo: false, status } as unknown as VaultGateway);
});

describe("App real-vault startup", () => {
  it("opens an existing vault at the unlock screen", async () => {
    status.mockResolvedValue({ state: "locked", location });
    render(<App />);
    expect(await screen.findByLabelText("主密码")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "创建保险库" })).not.toBeInTheDocument();
    expect(screen.getByText("本地加密存储 · 验证中")).toBeInTheDocument();
  });

  it("offers creation only when the vault is empty", async () => {
    status.mockResolvedValue({ state: "empty", location });
    render(<App />);
    expect(await screen.findByRole("button", { name: "创建保险库" })).toBeInTheDocument();
  });

  it("does not flash demo entries while a real workspace is loading", async () => {
    status.mockResolvedValue({ state: "unlocked", location });
    vi.mocked(createVaultGateway).mockReturnValue({
      isDemo: false,
      status,
      listEntries: vi.fn(() => new Promise(() => {})),
    } as unknown as VaultGateway);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "本地保险库" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "条目列表" })).toHaveTextContent("0 个项目");
    expect(screen.queryByText("示例 GitHub")).not.toBeInTheDocument();
  });

  it("keeps startup errors out of creation and supports retry", async () => {
    const user = userEvent.setup();
    status.mockRejectedValueOnce(new Error("配置不可读")).mockResolvedValueOnce({ state: "empty", location });
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("配置不可读");
    expect(screen.queryByRole("button", { name: "创建保险库" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByRole("button", { name: "创建保险库" })).toBeInTheDocument();
  });
});
