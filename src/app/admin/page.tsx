import Link from "next/link";
import { Users, Heart, UserCog, CalendarDays, Image } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardWelcome } from "@/components/admin/DashboardWelcome";

const sections = [
  {
    href: "/admin/individuals",
    title: "Individuals",
    description: "Add, edit, and remove people in the tree.",
    icon: Users,
  },
  {
    href: "/admin/families",
    title: "Families",
    description: "Manage family units and spouse/child links.",
    icon: Heart,
  },
  {
    href: "/admin/events",
    title: "Events",
    description: "Birth, death, marriage, and custom events.",
    icon: CalendarDays,
  },
  {
    href: "/admin/media",
    title: "Media",
    description: "Photos, documents, and other media files.",
    icon: Image,
  },
  {
    href: "/admin/users",
    title: "Users & access",
    description: "Accounts, roles, and permissions for this tree.",
    icon: UserCog,
  },
] as const;

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div className="space-y-3">
        <div className="prose prose-invert prose-evergreen max-w-none">
          <h1 className="font-heading text-base-content">Dashboard</h1>
        </div>
        <DashboardWelcome />
        <div className="prose prose-invert prose-evergreen max-w-none">
          <p className="max-w-2xl text-pretty">
            Pick a section below to work with the tree, media, or who can access this admin site.
          </p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ href, title, description, icon: Icon }) => (
          <Card
            key={href}
            className="group flex flex-col"
          >
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-box bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                <CardDescription className="text-sm leading-snug">
                  {description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
              <Link
                href={href}
                className="btn btn-outline btn-sm border-primary/50 text-primary hover:border-primary hover:bg-primary hover:text-primary-content"
              >
                Open
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
