import { Footer } from "@/components/marketing/Footer";
import { Navbar } from "@/components/marketing/Navbar";
import { fetchPublicSettings } from "@/lib/firebase/publicRest";

export const revalidate = 60;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { supportEmail } = await fetchPublicSettings();
  return (
    <>
      <Navbar />
      <main id="content">{children}</main>
      <Footer supportEmail={supportEmail || undefined} />
    </>
  );
}
