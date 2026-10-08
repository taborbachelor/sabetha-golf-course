import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Golf" };

export default function Page() {
  return <StubPage title="Golf" />;
}
