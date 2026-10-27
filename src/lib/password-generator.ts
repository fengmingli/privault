export interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
};

export type RandomInt = (max: number) => number;

export function getGeneratorAlphabet(options: GeneratorOptions): string {
  const groups = [
    options.uppercase ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : "",
    options.lowercase ? "abcdefghijklmnopqrstuvwxyz" : "",
    options.numbers ? "0123456789" : "",
    options.symbols ? "!@#$%^&*()-_=+[]{};:,.?/" : "",
  ];
  const alphabet = groups.join("");
  return options.excludeAmbiguous ? alphabet.replace(/[Il1O0o]/g, "") : alphabet;
}

function validateOptions(options: GeneratorOptions) {
  if (!Number.isInteger(options.length) || options.length < 12 || options.length > 64) {
    throw new RangeError("密码长度必须在 12 到 64 之间");
  }
  if (!getGeneratorAlphabet(options)) throw new Error("至少选择一种字符类型");
}

export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) throw new RangeError("max 必须是正整数");
  const range = 0x1_0000_0000;
  const limit = Math.floor(range / max) * max;
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % max;
}

export function generatePassword(options: GeneratorOptions, randomInt: RandomInt = secureRandomInt): string {
  validateOptions(options);
  const alphabet = getGeneratorAlphabet(options);
  return Array.from({ length: options.length }, () => alphabet[randomInt(alphabet.length)]).join("");
}

export function estimatePasswordStrength(options: GeneratorOptions): { bits: number; label: "较弱" | "良好" | "很强" } {
  validateOptions(options);
  const bits = Math.round(options.length * Math.log2(getGeneratorAlphabet(options).length));
  return { bits, label: bits < 60 ? "较弱" : bits < 90 ? "良好" : "很强" };
}
