"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Settings,
  LogOut,
  LayoutDashboard,
  Mailbox,
  Megaphone,
  Mail,
  Contact2,
  BarChart3,
  Code2,
  Scale,
} from "lucide-react";
import { signOut, useAuthSession } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Campaigns", url: "/dashboard/campaigns", icon: Megaphone },
  { title: "Contacts", url: "/dashboard/contacts", icon: Contact2 },
  { title: "Inbox", url: "/dashboard/inbox", icon: Mail },
  { title: "Mailboxes", url: "/dashboard/mailboxes", icon: Mailbox },
  { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useAuthSession();
  const sourceUrl = process.env.NEXT_PUBLIC_SOURCE_URL;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <Sidebar
      variant="inset"
      className="border-r border-slate-200 bg-slate-50 font-[family-name:var(--font-plus-jakarta)]"
    >
      {/* ── Brand ── */}
      <SidebarHeader className="mb-10 border-b-0 px-6 pb-0 pt-6">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5]">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold leading-none tracking-tight text-indigo-700">
              Samrian
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Scale Outreach
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* ── Navigation ── */}
      <SidebarContent className="flex-1 px-4">
        <nav className="flex flex-col space-y-1">
          {navItems.map((item) => {
            const isExact = pathname === item.url;
            const isNested = pathname.startsWith(`${item.url}/`);
            const isActive = isExact || (item.url !== "/dashboard" && isNested);

            return (
              <Link
                key={item.title}
                href={item.url}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-200 ${
                  isActive
                    ? "border-r-2 border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                }`}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="mt-auto border-t border-slate-200 px-4 pb-5 pt-6">
        <div className="flex flex-col gap-1">
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-slate-500 transition-colors hover:bg-slate-100"
            >
              <Code2 className="h-[18px] w-[18px]" />
              <span>Source</span>
            </a>
          ) : null}
          <Link
            href="/licensing"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-slate-500 transition-colors hover:bg-slate-100"
          >
            <Scale className="h-[18px] w-[18px]" />
            <span>License</span>
          </Link>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-slate-500 transition-colors hover:bg-slate-100"
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* User card */}
        <div className="mt-4 flex items-center gap-3 px-3">
          <Avatar className="h-8 w-8 overflow-hidden rounded-full border border-slate-300 bg-slate-200">
            <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || "User"} />
            <AvatarFallback className="bg-slate-200 text-[10px] font-bold text-slate-500">
              {session?.user?.name?.substring(0, 2).toUpperCase() || "ME"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-800">
              {session?.user?.name || "Loading…"}
            </span>
            <span className="text-[10px] text-slate-400">{session?.user?.email || "…"}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
