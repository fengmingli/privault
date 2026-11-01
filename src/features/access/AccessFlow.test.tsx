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
