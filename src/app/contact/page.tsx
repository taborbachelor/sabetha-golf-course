import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return <StubPage title="Contact" />;
}
