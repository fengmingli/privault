import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { DemoVaultGateway } from "@/lib/demo-gateway";
import { SettingsDialog } from "./SettingsDialog";

describe("SettingsDialog", () => {
  it("updates preferences and opens data capability explanations", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCapability = vi.fn();
    const onPvault = vi.fn();
    render(<SettingsDialog open settings={DEFAULT_SETTINGS} onChange={onChange} onClose={vi.fn()} onCapability={onCapability} onPvault={onPvault} gateway={new DemoVaultGateway()} onMigrationActiveChange={vi.fn()} onRequireUnlock={vi.fn()} />);

    await user.click(screen.getByLabelText("深色"));
    expect(onChange).toHaveBeenCalledWith({ theme: "dark" });
    fireEvent.change(screen.getByLabelText("自动锁定"), { target: { value: "15" } });
    expect(onChange).toHaveBeenCalledWith({ autoLockMinutes: 15 });
    fireEvent.change(screen.getByLabelText("剪贴板倒计时"), { target: { value: "60" } });
    expect(onChange).toHaveBeenCalledWith({ clipboardSeconds: 60 });
    await user.click(screen.getByRole("button", { name: "导出保险库" }));
    expect(onPvault).toHaveBeenCalledWith("export");
    expect(screen.getAllByText("待接入安全核心").length).toBeGreaterThan(0);
  });
});
