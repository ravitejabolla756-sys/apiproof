import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { Check, ArrowUpRight } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F4] text-[#111111] font-sans selection:bg-[#111111] selection:text-white">
      <LandingNavbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-12 md:py-20 space-y-16">

        {/* HEADER */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E8E8E5] text-[11px] font-semibold uppercase tracking-wider text-[#686868]">
            PRICING
          </div>
          <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-[#111111]">
            Simple, Transparent Access
          </h1>
          <p className="text-base text-[#686868]">
            APIProof is currently in private developer preview. Early engineering teams access read-only scans and verified migration generation.
          </p>
        </div>

        {/* PRICING CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* DEVELOPER PREVIEW ($0) */}
          <div className="rounded-[28px] bg-white border-2 border-[#111111] p-8 space-y-6 shadow-md relative flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[#111111]">Developer Preview</h3>
                <span className="px-3 py-1 rounded-full bg-[#EEF7F2] text-emerald-800 border border-[#D1EBE0] text-xs font-medium">
                  Active Beta
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-4xl font-bold text-[#111111]">$0</div>
                <div className="text-xs text-[#686868]">During private beta</div>
              </div>

              <p className="text-xs text-[#686868] leading-relaxed">
                Full read-only repository scanning and verified migration draft PR generation for developer testing.
              </p>

              <div className="border-t border-[#E8E8E5] pt-4 space-y-2.5 text-xs text-[#111111]">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>1 workspace & 2 repositories</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Read-only AST scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Reviewed API intelligence (Stripe, Twilio)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>4-gate migration verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>GitHub Draft PR creation</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link href="/dashboard">
                <Button size="lg" className="w-full font-medium">
                  <span>GET STARTED FREE</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* TEAM (COMING SOON) */}
          <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-8 space-y-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[#111111]">Team</h3>
                <span className="px-3 py-1 rounded-full bg-[#F6F6F4] text-zinc-600 border border-[#E8E8E5] text-xs font-medium">
                  Coming Soon
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-3xl font-semibold text-[#111111]">Custom</div>
                <div className="text-xs text-[#686868]">For growing engineering organizations</div>
              </div>

              <p className="text-xs text-[#686868] leading-relaxed">
                Automated continuous scanning across unlimited repositories with priority API intelligence updates.
              </p>

              <div className="border-t border-[#E8E8E5] pt-4 space-y-2.5 text-xs text-[#686868]">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Unlimited repositories</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Scheduled daily compatibility scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Slack & Webhook notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Custom API breaking change rules</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link href="/contact">
                <Button size="lg" variant="outline" className="w-full font-medium">
                  JOIN TEAM WAITLIST
                </Button>
              </Link>
            </div>
          </div>

          {/* ENTERPRISE (CONTACT) */}
          <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-8 space-y-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[#111111]">Enterprise</h3>
                <span className="px-3 py-1 rounded-full bg-[#F6F6F4] text-zinc-600 border border-[#E8E8E5] text-xs font-medium">
                  Contact
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-3xl font-semibold text-[#111111]">Contact Us</div>
                <div className="text-xs text-[#686868]">For enterprise security & governance</div>
              </div>

              <p className="text-xs text-[#686868] leading-relaxed">
                Self-hosted AST analysis runners, custom security reviews, and dedicated SLA support.
              </p>

              <div className="border-t border-[#E8E8E5] pt-4 space-y-2.5 text-xs text-[#686868]">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Self-hosted / On-prem AST engine</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>SOC2 & SSO SAML compliance</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Dedicated security review</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Custom migration engine plugins</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link href="/contact">
                <Button size="lg" variant="outline" className="w-full font-medium">
                  CONTACT SALES
                </Button>
              </Link>
            </div>
          </div>

        </div>

        {/* COMPARISON TABLE */}
        <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-8 md:p-12 space-y-6 shadow-xs">
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold text-[#111111]">Feature Comparison</h3>
            <p className="text-xs text-[#686868]">Detailed breakdown of capabilities across plans.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-[#E8E8E5] text-[#686868] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 font-semibold">Capability</th>
                  <th className="py-3 px-4 font-semibold">Developer Preview</th>
                  <th className="py-3 px-4 font-semibold">Team</th>
                  <th className="py-3 px-4 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E5] text-[#111111]">
                <tr>
                  <td className="py-3 px-4 font-medium">Repository AST Scanning</td>
                  <td className="py-3 px-4 text-emerald-700 font-medium">Read-only</td>
                  <td className="py-3 px-4">Continuous</td>
                  <td className="py-3 px-4">Continuous / On-Prem</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">API Deprecation Intelligence</td>
                  <td className="py-3 px-4 text-emerald-700 font-medium font-mono">Stripe & Twilio</td>
                  <td className="py-3 px-4 font-mono">Full Provider Registry</td>
                  <td className="py-3 px-4 font-mono">Full + Custom Rules</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Verification Invariants</td>
                  <td className="py-3 px-4 text-emerald-700 font-medium">4/4 Gates</td>
                  <td className="py-3 px-4">4/4 Gates</td>
                  <td className="py-3 px-4">Custom Pipeline Integration</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">GitHub PR Generation</td>
                  <td className="py-3 px-4 text-emerald-700 font-medium">Draft PR Only</td>
                  <td className="py-3 px-4">Draft PR Only</td>
                  <td className="py-3 px-4">Draft PR Only</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Automated Merging</td>
                  <td className="py-3 px-4 text-rose-700 font-medium">Disabled (Human review required)</td>
                  <td className="py-3 px-4 text-rose-700 font-medium">Disabled</td>
                  <td className="py-3 px-4 text-rose-700 font-medium">Disabled</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </main>

      <LandingFooter />
    </div>
  );
}
