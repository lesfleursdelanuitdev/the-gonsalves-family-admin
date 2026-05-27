import type { Metadata, Viewport } from "next";
import { Playfair_Display, Cormorant_Garamond, Inter, Geist } from "next/font/google";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { AppHeightSync } from "@/components/AppHeightSync";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const playfair = Playfair_Display({
  variable: "--font-heading-raw",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-accent-raw",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-body-raw",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/** Runs before paint; must stay in sync with `ThemeProvider` / `getInitialTheme` keys. */
const INLINE_THEME_BOOTSTRAP = `(function(){
  try {
    var k = 'gonsalves-theme';
    var map = { dark: 'business', parchment: 'parchment', verdure: 'verdure', stone: 'stone' };
    var darkThemes = ['dark'];
    var t = localStorage.getItem(k);
    if (t === 'light') { t = 'parchment'; localStorage.setItem(k, 'parchment'); }
    if (!t || !(t in map)) { t = 'dark'; localStorage.setItem(k, t); }
    var wantDark = darkThemes.indexOf(t) !== -1;
    document.documentElement.classList.toggle('dark', wantDark);
    document.documentElement.setAttribute('data-theme', map[t]);
    document.documentElement.style.colorScheme = wantDark ? 'dark' : 'light';
  } catch(e) {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'business');
  }
})();`;

/**
 * Chunk-load failures can happen right after deploy when a stale tab references old hashed JS files.
 * Attach global handlers so we can self-heal even when the error occurs before React error boundaries mount.
 */
const INLINE_CHUNK_RECOVERY = `(function(){
  try {
    if (typeof window === 'undefined') return;
    if (window.location.search.indexOf('__chunk_load=1') !== -1) return;
    if (sessionStorage.getItem('__chunk_load_recovering') === '1') return;
    var isChunkMessage = function(msg){
      if (!msg) return false;
      var s = String(msg);
      return /Loading chunk \\d+ failed/i.test(s) || /ChunkLoadError/i.test(s);
    };
    var recover = function(){
      try {
        sessionStorage.setItem('__chunk_load_recovering', '1');
        var url = new URL(window.location.href);
        url.searchParams.set('__chunk_load', '1');
        window.location.replace(url.toString());
      } catch(_e) {}
    };
    window.addEventListener('error', function(event){
      var err = event && event.error;
      var name = err && err.name ? String(err.name) : '';
      var message = err && err.message ? String(err.message) : (event && event.message ? String(event.message) : '');
      if (name === 'ChunkLoadError' || isChunkMessage(message)) recover();
    });
    window.addEventListener('unhandledrejection', function(event){
      var reason = event && event.reason;
      var name = reason && reason.name ? String(reason.name) : '';
      var message = reason && reason.message ? String(reason.message) : String(reason || '');
      if (name === 'ChunkLoadError' || isChunkMessage(message)) recover();
    });
  } catch(_e) {}
})();`;

export const metadata: Metadata = {
  title: "Gonsalves Family Admin",
  description: "Administration for The Gonsalves Family tree",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-visual",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="business"
      className={cn("dark", "font-sans", geist.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: INLINE_THEME_BOOTSTRAP }} />
        {/* Production only: webpack HMR in dev emits transient "Loading chunk N failed" errors that trigger reload loops. */}
        {process.env.NODE_ENV === "production" ? (
          <script dangerouslySetInnerHTML={{ __html: INLINE_CHUNK_RECOVERY }} />
        ) : null}
      </head>
      <body
        className={`${playfair.variable} ${cormorant.variable} ${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <QueryProvider>
            <AppHeightSync />
            <Toaster position="top-center" richColors closeButton />
            <div className="min-w-0 w-full max-w-full min-h-screen overflow-x-clip flex flex-col" data-viewport-constrain>
              {children}
            </div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
