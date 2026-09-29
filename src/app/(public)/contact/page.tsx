import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/ContactForm";
import { PageBand } from "@/components/marketing/PageBand";
import { fetchPublicSettings } from "@/lib/firebase/publicRest";

export const revalidate = 60;
export const metadata: Metadata = { title: "Contact", description: "Ask a question or request a quote for Malek Enterprise POS." };

export default async function ContactPage() {
  const { supportEmail, salesEmail } = await fetchPublicSettings();
  return (
    <>
      <PageBand title="Talk to us" lede="Ask a question, request a quote or tell us what your shop needs." />
      <div className="bg-paper py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1.4fr_1fr]">
          <ContactForm />
          <aside className="h-fit space-y-6 rounded-xl3 bg-ink-900 p-8 text-[15px] text-ink-200 shadow-lift">
            {salesEmail && <div><h2 className="font-display text-lg font-bold text-white">Sales</h2><a className="text-accent underline underline-offset-4 hover:text-white" href={`mailto:${salesEmail}`}>{salesEmail}</a></div>}
            {supportEmail && <div><h2 className="font-display text-lg font-bold text-white">Support</h2><a className="text-accent underline underline-offset-4 hover:text-white" href={`mailto:${supportEmail}`}>{supportEmail}</a></div>}
            <p className="text-ink-300">Messages go straight to the team&apos;s admin inbox. We usually reply within one business day.</p>
          </aside>
        </div>
      </div>
    </>
  );
}
