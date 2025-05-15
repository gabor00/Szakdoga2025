"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Rocket, GitBranch, BarChart } from "lucide-react"

const navItems = [
  {
    name: "Deployments",
    href: "/",
    icon: Rocket,
  },
  {
    name: "Releases",
    href: "/releases",
    icon: GitBranch,
  },
  {
    name: "Traffic Management",
    href: "/traffic",
    icon: BarChart,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-background border-r h-screen flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">Deployment Tool</h1>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.name}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  pathname === item.href ? "bg-muted font-medium" : "hover:bg-muted/50"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-4 border-t">
        <div className="text-xs text-muted-foreground">Version 1.0.0</div>
      </div>
    </div>
  )
}
