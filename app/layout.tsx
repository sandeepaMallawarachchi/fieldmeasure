import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_Sinhala } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { APP_NAME } from "@/config/app";
import { t } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Geist has no Sinhala letters. The browser falls back to this font for those letters only.
const notoSansSinhala = Noto_Sans_Sinhala({
  variable: "--font-noto-sinhala",
  subsets: ["sinhala"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} — ${t.appTagline}`,
  description:
    "Measure land area and perimeter by walking around a boundary with your phone's GPS. No account needed.",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#08752E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${notoSansSinhala.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
