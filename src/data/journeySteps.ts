export interface JourneyStep {
  date: string;
  location: string;
  content: string;
}

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    date: "c. 1800",
    location: "Madeira, Portugal",
    content: "Birth of Augustino Gracis.",
  },
  {
    date: "c. 1850s",
    location: "British Guiana",
    content: "Augustino Gracis arrives as an indentured laborer at Buxton Estate and later settles with his wife and children, including Mary Mias Gracis.",
  },
  {
    date: "1861",
    location: "British Guiana",
    content: "Mary Mias Gracis completes her indenture at Enmore Estate and later marries Agus Gonsalves, establishing the Gonsalves family line in Guyana.",
  },
  {
    date: "1900s",
    location: "Worldwide",
    content: "Descendants migrated abroad, forming communities across the global diaspora.",
  },
];