export interface Pillar {
  title: string;
  subtitle: string;
  content: string;
  linkLabel: string;
  href: string;
}

export const PILLARS: Pillar[] = [
  {
    subtitle: "people",
    title: "Find Family",
    content:
      "Discover ancestors, relatives, and the branches that shape our family.",
    linkLabel: "Find",
    href: "/people",
  },
  {
    subtitle: "stories",
    title: "Read Histories",
    content:
      "Step into the lives, journeys, and experiences of those who came before us.",
    linkLabel: "Read",
    href: "/stories",
  },
  {
    subtitle: "archives",
    title: "View Media",
    content:
      "View the photos, videos, and recordings that hold our family's memories.",
    linkLabel: "View",
    href: "/archive",
  },
];
