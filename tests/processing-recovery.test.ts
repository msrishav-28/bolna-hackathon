// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Processing } from "../src/components/product/processing";
import { previewSession } from "../src/lib/server/preview-data";
afterEach(cleanup);
it("offers a new round after the persisted scoring budget is exhausted", () => {
  render(
    createElement(Processing, {
      session: {
        ...previewSession,
        status: "failed",
        scorecard: null,
        overallScore: null,
        error: {
          code: "SCORING_FAILED",
          message: "Your transcript is preserved.",
          retryable: false,
        },
      },
    }),
  );
  expect(
    screen
      .getByRole("link", { name: /Start a new round/ })
      .getAttribute("href"),
  ).toBe("/practice");
  expect(
    screen.queryByRole("button", { name: /Check this round again/ }),
  ).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("preserved");
});
