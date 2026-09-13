"use client";

import { Sliders, Github } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 space-y-1">
        <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
          <Sliders className="w-6 h-6 text-purple-700" />
          Workspace Settings
        </h1>
        <p className="text-xs text-[#686868]">
          Configure analysis preferences, security policies, and GitHub App integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* SECURITY & GITHUB APP SETTINGS */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-5 shadow-xs">
            <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
              <Github className="w-4 h-4 text-[#111111]" />
              GitHub App Connection
            </h3>

            <div className="p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-[#111111]">ravitejabolla756-sys</div>
                <div className="text-[11px] text-[#686868]">Authorized for read-only AST scans & draft PR creation</div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#EEF7F2] text-emerald-800 border border-[#D1EBE0] text-[11px] font-medium">
                Connected
              </span>
            </div>

            <div className="pt-2 border-t border-[#E8E8E5] space-y-4">
              <h4 className="font-semibold text-xs text-[#111111]">Safety Policies</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E8E8E5]">
                  <div>
                    <div className="font-medium text-xs text-[#111111]">Read-only scanning mode</div>
                    <div className="text-[11px] text-[#686868]">APIProof never writes directly to monitored default branches</div>
                  </div>
                  <input type="checkbox" checked disabled className="rounded text-[#111111]" />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E8E8E5]">
                  <div>
                    <div className="font-medium text-xs text-[#111111]">Draft PRs only</div>
                    <div className="text-[11px] text-[#686868]">Pull requests are created as drafts requiring human review</div>
                  </div>
                  <input type="checkbox" checked disabled className="rounded text-[#111111]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* WORKSPACE INFO */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-[24px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-semibold text-[#111111]">Workspace Profile</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#E8E8E5]">
                <span className="text-[#686868]">Workspace:</span>
                <span className="font-semibold text-[#111111]">Demo Workspace</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E8E8E5]">
                <span className="text-[#686868]">Plan:</span>
                <span className="font-semibold text-emerald-700">Developer Preview</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#686868]">AST Engine Version:</span>
                <span className="font-mono text-[#111111]">v2.4.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
