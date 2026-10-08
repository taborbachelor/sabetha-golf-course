import { describe, expect, it } from "vitest";
import { applicationSchema } from "./memberships/application";
import { errorId, errorsByField } from "./forms";

describe("errorsByField", () => {
  it("keeps the first message for each field", () => {
    expect(
      errorsByField([
        { path: ["name"], message: "Enter your name" },
        { path: ["name"], message: "Too short" },
        { path: ["email"], message: "Enter a valid email" },
      ]),
    ).toEqual({ name: "Enter your name", email: "Enter a valid email" });
  });

  it("reports every invalid field of a real form at once", () => {
    const parsed = applicationSchema.safeParse({
      tierId: "",
      name: "",
      address: "",
      phone: "123",
      email: "nope",
      cartShed: false,
    });
    expect(parsed.success).toBe(false);
    expect(Object.keys(errorsByField(parsed.error!.issues)).sort()).toEqual([
      "address",
      "email",
      "name",
      "phone",
      "tierId",
    ]);
  });

  it("ignores issues without a field", () => {
    expect(errorsByField([{ path: [], message: "Form error" }])).toEqual({});
  });
});

describe("errorId", () => {
  it("names the error element after the field", () => {
    expect(errorId("email")).toBe("email-error");
  });
});
