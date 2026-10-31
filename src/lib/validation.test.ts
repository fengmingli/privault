import { describe, expect, it } from "vitest";
import { isValidDemoRecoveryKey, isValidRecoveryKey, validateMasterPassword } from "./validation";

describe("access validation", () => {
  it("rejects passwords shorter than 8 code points", () => {
    expect(validateMasterPassword("Ab1!", "Ab1!")).toBe("主密码至少 8 位");
  });

  it("rejects mismatched password confirmation", () => {
    expect(validateMasterPassword("demo-password-1", "demo-password-2")).toBe("两次输入的密码不一致");
  });

  it("requires at least three character classes and accepts compliant passwords", () => {
    expect(validateMasterPassword("abcdefgh", "abcdefgh")).toBe("主密码需包含大写、小写、数字、特殊字符中的至少 3 类");
    expect(validateMasterPassword("Abcdef1!", "Abcdef1!")).toBeNull();
    expect(validateMasterPassword("Abcdefg1", "Abcdefg1")).toBeNull();
  });

  it("normalizes and validates only the explicit demo recovery-key format", () => {
    expect(isValidDemoRecoveryKey("  demo-4c7q-9m2x-6k8p ")).toBe(true);
    expect(isValidDemoRecoveryKey("REAL-4C7Q-9M2X-6K8P")).toBe(false);
    expect(isValidDemoRecoveryKey("DEMO-4C7Q-9M2X")).toBe(false);
  });

  it("accepts the generated Crockford Base32 recovery-key shape without using demo rules", () => {
    const groupedKey = `${Array.from({ length: 14 }, () => "aaaa").join("-")}-aa`;
    expect(isValidRecoveryKey(groupedKey)).toBe(true);
    expect(isValidRecoveryKey("DEMO-4C7Q-9M2X-6K8P")).toBe(false);
    expect(isValidRecoveryKey("AAAA")).toBe(false);
  });
});
