"use client";

import { useEffect, useState } from "react";
import { Globe, Mail, Share2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/infra/api";
import { useAdminSiteSettings, useUpdateSiteSettings } from "@/hooks/useAdminSiteSettings";

const SOCIAL_PLATFORMS = ["facebook", "instagram", "twitter", "youtube", "tiktok"] as const;

export default function AdminSiteSettingsPage() {
  const { data, isLoading } = useAdminSiteSettings();
  const updateSettings = useUpdateSiteSettings();

  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteTagline, setSiteTagline] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("");
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const settings = data?.settings;

  useEffect(() => {
    if (!settings) return;
    setPublicBaseUrl(settings.publicBaseUrl ?? "");
    setSiteName(settings.siteName ?? "");
    setSiteTagline(settings.siteTagline ?? "");
    setContactEmail(settings.contactEmail ?? "");
    setDefaultLanguage(settings.defaultLanguage ?? "");
    setSocialLinks((settings.socialLinks as Record<string, string>) ?? {});
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateSettings.mutateAsync({
        publicBaseUrl: publicBaseUrl.trim() || null,
        siteName: siteName.trim() || null,
        siteTagline: siteTagline.trim() || null,
        contactEmail: contactEmail.trim() || null,
        defaultLanguage: defaultLanguage.trim() || null,
        socialLinks: Object.keys(socialLinks).length ? socialLinks : null,
      });
      toast.success("Site settings saved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save settings.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <header>
        <div className="mb-2 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <SlidersHorizontal className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Site settings</h1>
            <p className="text-sm text-muted-foreground">Configure the public-facing family site.</p>
          </div>
        </div>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* Public site */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">Public site</CardTitle>
            </div>
            <CardDescription>URLs and identity shown to visitors.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ss-base-url">Base URL</Label>
              <Input id="ss-base-url" type="url" value={publicBaseUrl} onChange={(e) => setPublicBaseUrl(e.target.value)} placeholder="https://gonsalves.family" />
              <p className="text-xs text-muted-foreground">Used to build absolute links for social sharing and SEO.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ss-site-name">Site name</Label>
              <Input id="ss-site-name" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="The Gonsalves Family" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ss-tagline">Tagline</Label>
              <Input id="ss-tagline" value={siteTagline} onChange={(e) => setSiteTagline(e.target.value)} placeholder="Preserving our heritage, one story at a time." />
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">Contact</CardTitle>
            </div>
            <CardDescription>Email shown on the public contact page.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ss-email">Contact email</Label>
              <Input id="ss-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contact@gonsalves.family" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ss-lang">Default language (BCP 47)</Label>
              <Input id="ss-lang" value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)} placeholder="en" className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">Used for the HTML lang attribute and i18n defaults.</p>
            </div>
          </CardContent>
        </Card>

        {/* Social links */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Share2 className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">Social links</CardTitle>
            </div>
            <CardDescription>Profile URLs shown in the public site footer.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {SOCIAL_PLATFORMS.map((platform) => (
              <div key={platform} className="space-y-2">
                <Label htmlFor={`ss-social-${platform}`} className="capitalize">{platform}</Label>
                <Input
                  id={`ss-social-${platform}`}
                  type="url"
                  value={socialLinks[platform] ?? ""}
                  onChange={(e) =>
                    setSocialLinks((prev) => {
                      const next = { ...prev };
                      if (e.target.value.trim()) {
                        next[platform] = e.target.value.trim();
                      } else {
                        delete next[platform];
                      }
                      return next;
                    })
                  }
                  placeholder={`https://${platform}.com/…`}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <button type="submit" className={cn(buttonVariants())} disabled={submitting}>
            {submitting ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
