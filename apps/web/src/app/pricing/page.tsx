"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { billingCheckoutAvailability } from "@/lib/billing-checkout-contract";

const betaFeatures = [
  "Connect 1 GitHub repository",
  "3 scans per month",
  "Default-branch scanning",
  "Findings with severity, file, line, and evidence",
  "Human review before any action",
  "Read-only code inspection",
  "Email support",
];

const developerFeatures = [
  "Connect up to 5 GitHub repositories",
  "Unlimited scans",
  "Default-branch scanning",
  "Provider change alerts for reviewed rules",
  "Scan history by commit",
  "Slack alerts for breaking findings",
  "Email support",
];

const startupFeatures = [
  "Unlimited repositories",
  "Unlimited scans, subject to fair use",
  "Everything in Developer",
  "Team workspace with shared findings",
  "Review-only migration guidance",
  "Priority email support",
];

const enterpriseFeatures = [
  "Organization-wide repository management",
  "Custom security and compliance requirements",
  "Advanced team and access management",
  "Enterprise-scale scanning and reporting",
  "Dedicated onboarding and support",
  "Custom integration requirements",
];

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="space-y-3 text-sm text-slate-700">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

function ComingSoonButton({ label, href }: { label: string; href?: string }) {
  if (href) return <Link href={href} className="flex min-h-11 w-full items-center justify-center rounded-full border border-slate-300 bg-slate-100 py-3 text-center text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-200">{label}</Link>;
  return <div className="w-full rounded-full border border-slate-300 bg-slate-100 py-3 text-center text-sm font-semibold text-slate-600">{label}</div>;
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] antialiased">
      <LandingNavbar />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl space-y-14 px-4 pb-24 pt-36 sm:px-6 lg:px-8 outline-none">
        <header className="mx-auto max-w-3xl space-y-5 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Free beta available now
          </div>
          <h1 className="font-serif text-5xl font-normal tracking-tight sm:text-6xl">
            Start safely. Scale when you&apos;re ready.
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600">
            Use MY OWL&apos;s read-only compatibility analysis during the free beta. {billingCheckoutAvailability.message}
          </p>
        </header>

        <section aria-labelledby="plans-heading">
          <h2 id="plans-heading" className="sr-only">MY OWL plans</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <article className="flex h-full flex-col justify-between rounded-[32px] border-2 border-emerald-300 bg-white p-7 shadow-sm md:p-8">
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="text-xl font-semibold">Free Beta</h3><p className="mt-1 text-sm text-slate-500">Available now</p></div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">No card</span>
                </div>
                <div><span className="font-serif text-5xl">₹0</span><span className="ml-2 text-sm text-slate-500">forever</span></div>
                <FeatureList features={betaFeatures} />
              </div>
              <Link href="/login" className="mt-8 flex min-h-11 w-full items-center justify-center rounded-full bg-[#000E29] py-3 text-center text-sm font-semibold text-white transition hover:bg-black">Get Started</Link>
            </article>

            <article className="flex h-full flex-col justify-between rounded-[32px] border border-slate-200 bg-white p-7 md:p-8">
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="text-xl font-semibold">MY OWL Developer</h3><p className="mt-1 text-sm text-slate-500">Rolling out</p></div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Coming soon</span>
                </div>
                <div><span className="font-serif text-5xl">₹5,000</span><span className="ml-2 text-sm text-slate-500">/month</span></div>
                <FeatureList features={developerFeatures} />
              </div>
              <ComingSoonButton label={billingCheckoutAvailability.developerLabel} />
            </article>

            <article className="flex h-full flex-col justify-between rounded-[32px] border border-slate-200 bg-white p-7 md:p-8">
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="text-xl font-semibold">MY OWL Startup</h3><p className="mt-1 text-sm text-slate-500">Coming soon</p></div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Not available</span>
                </div>
                <div><span className="font-serif text-5xl">₹15,000</span><span className="ml-2 text-sm text-slate-500">/month</span></div>
                <FeatureList features={startupFeatures} />
              </div>
              <ComingSoonButton label={billingCheckoutAvailability.startupLabel} />
            </article>

            <article className="flex h-full flex-col justify-between rounded-[32px] border border-slate-200 bg-white p-7 md:p-8">
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="text-xl font-semibold">MY OWL Enterprise</h3><p className="mt-1 text-sm text-slate-500">Coming soon</p></div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Not available</span>
                </div>
                <div><span className="font-serif text-5xl">Custom</span><span className="ml-2 text-sm text-slate-500">pricing</span></div>
                <FeatureList features={enterpriseFeatures} />
              </div>
              <ComingSoonButton href="/contact" label="Start an enterprise inquiry" />
            </article>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
