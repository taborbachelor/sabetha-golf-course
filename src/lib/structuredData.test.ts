import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/content/settings";
import { golfCourseJsonLd } from "./structuredData";

describe("golfCourseJsonLd", () => {
  const ld = golfCourseJsonLd(defaultSettings, "https://example.com");

  it("is a GolfCourse with the club address", () => {
    expect(ld["@type"]).toBe("GolfCourse");
    expect(ld.address.postalCode).toBe("66534");
    expect(ld.url).toBe("https://example.com");
  });

  it("lists only open days", () => {
    const days = ld.openingHoursSpecification.map((s) => s.dayOfWeek);
    expect(days).toEqual([
      "Sunday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]);
    expect(ld.openingHoursSpecification[1]).toMatchObject({
      opens: "16:30",
      closes: "20:00",
    });
  });
});
