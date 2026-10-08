import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/content/settings";
import { fullAddress, mapsDirectionsUrl, telHref } from "./contact";

const club = defaultSettings.club;

describe("contact links", () => {
  it("writes the full street address", () => {
    expect(fullAddress(club)).toBe("2551 X Road, Sabetha, KS 66534");
  });

  it("links Google Maps directions to the club", () => {
    expect(mapsDirectionsUrl(club)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Sabetha%20Golf%20Club%2C%202551%20X%20Road%2C%20Sabetha%2C%20KS%2066534",
    );
  });

  it("makes a tap-to-call link from the phone number", () => {
    expect(telHref("785-284-2023")).toBe("tel:7852842023");
  });
});
