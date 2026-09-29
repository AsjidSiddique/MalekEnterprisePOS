import type { Metadata } from "next";
import { PageBand } from "@/components/marketing/PageBand";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Page() {
  return (
    <>
      <PageBand title="Privacy policy" />
      <div className="bg-paper py-14">
        <div className="mx-auto max-w-3xl space-y-4 px-5 text-lg text-ink-800">
          <p>This document is being prepared and will be published before general release.</p>
          <p>If you need it sooner, ask us and we&apos;ll send you the current draft.</p>
          <ButtonLink href="/contact" variant="dark">Contact us</ButtonLink>
        </div>
      </div>
    </>
  );
}
