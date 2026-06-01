"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  CalendarDays,
  ChefHat,
  Columns3,
  BarChart3,
  Mail,
  Settings,
  Bot,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Accueil", href: "/", icon: Home },
  { name: "Événements", href: "/evenements", icon: CalendarDays },
  { name: "Pipeline", href: "/pipeline", icon: Columns3 },
  { name: "Prospection", href: "/prospection", icon: Mail },
  { name: "Rapports", href: "/rapports", icon: BarChart3 },
  { name: "Calendrier", href: "/calendrier", icon: CalendarDays },
  { name: "Archives", href: "/archives", icon: Archive },
  { name: "Agents", href: "/agents", icon: Bot },
  { name: "Paramètres", href: "/parametres", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Logo / titre */}
      <div className="flex h-14 items-center gap-2 border-b border-zinc-800 px-4">
        <ChefHat className="h-6 w-6 text-amber-500" />
        <span className="text-sm font-semibold tracking-tight">
          Foires & Marchés
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navigation.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <p className="text-xs text-zinc-500">WinCorp Foires v0.1</p>
      </div>
    </aside>
  );
}
