import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6 text-center">
      <div>
        <p className="font-display text-7xl font-semibold text-ink-900">404</p>
        <h1 className="mt-2 text-xl font-semibold">That page isn&apos;t here</h1>
        <p className="mt-1 text-muted">The link may be old, or the page may have moved.</p>
        <ButtonLink href="/" variant="dark" className="mt-6">Back to the homepage</ButtonLink>
      </div>
    </div>
  );
}
