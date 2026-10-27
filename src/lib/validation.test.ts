import { describe, expect, it } from "vitest";
import { isValidDemoRecoveryKey, validateMasterPassword } from "./validation";

describe("access validation", () => {
  it("rejects passwords shorter than 12 characters", () => {
    expect(validateMasterPassword("short", "short")).toBe("请使用至少 12 位的演示主密码");
  });

  it("rejects mismatched password confirmation", () => {
    expect(validateMasterPassword("demo-password-1", "demo-password-2")).toBe("两次输入的密码不一致");
  });

  it("accepts matching passwords of at least 12 characters", () => {
    expect(validateMasterPassword("demo-password", "demo-password")).toBeNull();
  });

  it("normalizes and validates only the explicit demo recovery-key format", () => {
    expect(isValidDemoRecoveryKey("  demo-4c7q-9m2x-6k8p ")).toBe(true);
    expect(isValidDemoRecoveryKey("REAL-4C7Q-9M2X-6K8P")).toBe(false);
    expect(isValidDemoRecoveryKey("DEMO-4C7Q-9M2X")).toBe(false);
  });
});
