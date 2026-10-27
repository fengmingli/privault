import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App foundation", () => {
  it("shows the product identity and persistent prototype warning", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Privault" })).toBeInTheDocument();
    expect(screen.getByText("UI 原型，请勿输入真实密码")).toBeInTheDocument();
  });
});
