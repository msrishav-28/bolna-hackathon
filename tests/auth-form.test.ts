// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "@/components/auth-form";
import { ApiError } from "@/lib/client/api";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/lib/client/api", async (original) => ({
  ...(await original<typeof import("@/lib/client/api")>()),
  request: mocks.request,
}));
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("account form", () => {
  it("keeps email recovery out of the password-only flow and explains account limits", async () => {
    render(
      createElement(AuthForm, {
        next: "/practice",
        flow: "signup",
        linkError: false,
        emailRecoveryEnabled: false,
      }),
    );
    expect(
      screen.queryByRole("button", { name: "Forgot password?" }),
    ).toBeNull();
    expect(screen.getByText(/Email ownership is not verified/)).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });
  it("handles an old reset link without promising an unavailable email", () => {
    render(
      createElement(AuthForm, {
        next: "/practice",
        flow: "reset",
        linkError: false,
        emailRecoveryEnabled: false,
      }),
    );
    expect(screen.getByRole("button", { name: /^Sign in/ })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Send reset link" }),
    ).toBeNull();
    expect(screen.getByRole("status").textContent).toContain(
      "Email recovery is not enabled",
    );
  });
  it("opens signup from the account CTA and focuses verification feedback", async () => {
    mocks.request.mockResolvedValue({
      message: "Check your email to verify your account.",
      next: "/",
    });
    render(
      createElement(AuthForm, { next: "/", flow: "signup", linkError: false }),
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "synthetic@example.test");
    await user.type(screen.getByLabelText("Password"), "synthetic-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("status")),
    );
    expect(mocks.request).toHaveBeenCalledWith("/api/auth", {
      action: "signup",
      email: "synthetic@example.test",
      password: "synthetic-password",
      next: "/",
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("lets the user reveal a password and hides it on a mode change", async () => {
    render(
      createElement(AuthForm, { next: "/", flow: "login", linkError: false }),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("text");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe(
      "password",
    );
  });

  it("sends a reset without a password and recovers from a rejected request", async () => {
    mocks.request.mockRejectedValue(new ApiError("Please try again.", "AUTH"));
    render(
      createElement(AuthForm, { next: "/", flow: "reset", linkError: false }),
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "synthetic@example.test");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("alert")),
    );
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(mocks.request).toHaveBeenCalledWith(
      "/api/auth",
      expect.objectContaining({ action: "reset", password: undefined }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Send reset link",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("prevents duplicate submits while signing in and uses the server redirect", async () => {
    let complete!: (value: { message: string; next: string }) => void;
    mocks.request.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    render(
      createElement(AuthForm, { next: "/", flow: "login", linkError: false }),
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "synthetic@example.test");
    await user.type(screen.getByLabelText("Password"), "synthetic-password");
    await user.dblClick(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole("button", { name: "Signing in…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    complete({ message: "", next: "/?signed-in" });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/?signed-in"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
