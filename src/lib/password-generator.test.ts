import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GENERATOR_OPTIONS, estimatePasswordStrength, generatePassword, getGeneratorAlphabet, secureRandomInt } from "./password-generator";

afterEach(() => vi.restoreAllMocks());

describe("password generator", () => {
  it("defaults to 20 characters and a strong entropy estimate", () => {
    expect(generatePassword(DEFAULT_GENERATOR_OPTIONS)).toHaveLength(20);
    expect(estimatePasswordStrength(DEFAULT_GENERATOR_OPTIONS).label).toBe("很强");
  });

  it("validates length and enabled character groups", () => {
    expect(() => generatePassword({ ...DEFAULT_GENERATOR_OPTIONS, length: 11 })).toThrow(RangeError);
    expect(() => generatePassword({ ...DEFAULT_GENERATOR_OPTIONS, length: 65 })).toThrow(RangeError);
    expect(() => generatePassword({ ...DEFAULT_GENERATOR_OPTIONS, uppercase: false, lowercase: false, numbers: false, symbols: false })).toThrow("至少选择一种字符类型");
  });

  it("uses only enabled lowercase characters", () => {
    const options = { ...DEFAULT_GENERATOR_OPTIONS, length: 12, uppercase: false, numbers: false, symbols: false };
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const password = generatePassword(options, () => values.shift() ?? 0);
    expect(password).toBe("abcdefghijkl");
  });

  it("removes ambiguous characters when requested", () => {
    const alphabet = getGeneratorAlphabet({ ...DEFAULT_GENERATOR_OPTIONS, excludeAmbiguous: true });
    expect(alphabet).not.toMatch(/[Il1O0o]/);
  });

  it("rejects random values outside the unbiased range", () => {
    const values = [0xffffffff, 5];
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint32Array)[0] = values.shift() ?? 5;
      return array;
    });
    expect(secureRandomInt(10)).toBe(5);
  });
});
