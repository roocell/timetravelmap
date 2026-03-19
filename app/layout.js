import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata = {
  title: "time travel map",
  description: "Historical map layer explorer built with Next.js and Leaflet"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
