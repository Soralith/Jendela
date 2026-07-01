import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jendela Deep Analyze · AI Data Indonesia",
  description: "Analisis mendalam dengan validasi multi-sumber. Data resmi data.go.id, deteksi kejanggalan via Nemesis, validasi opini publik, dan sintesis AI.",
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var e=localStorage.getItem('jendela-theme');if(e==='dark'||(!e&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`
        }} />
      </head>
      <body className="font-sans antialiased bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
