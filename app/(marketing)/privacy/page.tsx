import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy Policy',
  description:
    'Privacy policy for our Inventory Management SaaS. Learn how we process lead submissions, contact requests, and marketing preferences in a GDPR-friendly way.',
  pathname: '/privacy',
});

export default function PrivacyPolicyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated: Feb 23, 2026</p>

      <div className="mt-10 space-y-8 text-sm text-muted-foreground">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Summary</h2>
          <p>
            When you submit a demo request or contact form, we use the information you provide to respond to your request
            and communicate about the product. If you opt in to product updates, we may also send relevant product news.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">What we collect</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Contact details (name, work email, phone where provided)</li>
            <li>Company details (company name, optional company size)</li>
            <li>Country/region selection</li>
            <li>Your message and goals</li>
            <li>Basic campaign attribution (UTM parameters) when present</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Why we collect it</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>To respond to your request and provide product information</li>
            <li>To schedule and deliver demos</li>
            <li>To improve our marketing and understand which pages perform well (UTM attribution)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Legal basis</h2>
          <p>
            We process your information based on your consent (when you submit the form and accept consent) and our
            legitimate interest in responding to B2B inquiries. Marketing updates are only sent when you opt in.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Retention</h2>
          <p>
            We retain lead submissions as long as necessary to respond, manage the relationship, and maintain a record
            of communication. You can request deletion at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Your rights</h2>
          <p>
            Depending on your location, you may have rights to access, correct, delete, or restrict processing of your
            information. To exercise your rights, contact us using the contact form.
          </p>
        </section>
      </div>
    </section>
  );
}

