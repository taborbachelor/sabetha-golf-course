import { describe, expect, it } from "vitest";
import { applicationFromForm, applicationSchema } from "./application";

const TIER = "82cce7e3-cbcb-4a6b-88be-43e5d22beb6e";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const valid = {
  tierId: TIER,
  name: "  Pat Golfer ",
  address: "123 Main St, Sabetha, KS 66534",
  phone: "(785) 555-0100",
  email: " pat@example.com ",
};

describe("membership application", () => {
  it("accepts a complete application and trims text", () => {
    const parsed = applicationSchema.parse(applicationFromForm(form(valid)));
    expect(parsed).toEqual({
      tierId: TIER,
      name: "Pat Golfer",
      address: "123 Main St, Sabetha, KS 66534",
      phone: "(785) 555-0100",
      email: "pat@example.com",
      cartShed: false,
    });
  });

  it("reads the Cart Shed checkbox", () => {
    const parsed = applicationSchema.parse(
      applicationFromForm(form({ ...valid, cartShed: "on" })),
    );
    expect(parsed.cartShed).toBe(true);
  });

  it("names the first bad field", () => {
    const cases: [Record<string, string>, string][] = [
      [{ ...valid, tierId: "" }, "tierId"],
      [{ ...valid, name: " " }, "name"],
      [{ ...valid, address: "" }, "address"],
      [{ ...valid, phone: "555-0100" }, "phone"],
      [{ ...valid, email: "pat@" }, "email"],
    ];
    for (const [fields, path] of cases) {
      const result = applicationSchema.safeParse(
        applicationFromForm(form(fields)),
      );
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path[0]).toBe(path);
    }
  });
});
