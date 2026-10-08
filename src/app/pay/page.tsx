import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Pay to Play" };

export default function Page() {
  return <StubPage title="Pay to Play" />;
}
