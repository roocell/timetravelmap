import "leaflet/dist/leaflet.css";
import "./globals.css";
import Script from "next/script";
import { StackProvider } from "@stackframe/stack";
import { stackClientApp } from "../stack";

export const metadata = {
  title: "time travel map",
  description: "Historical map layer explorer built with Next.js and Leaflet"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Script
          id="crypto-random-uuid-polyfill"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const cryptoRef = globalThis.crypto;
                if (!cryptoRef || typeof cryptoRef.randomUUID === "function" || typeof cryptoRef.getRandomValues !== "function") {
                  return;
                }

                Object.defineProperty(cryptoRef, "randomUUID", {
                  configurable: true,
                  value() {
                    const bytes = new Uint8Array(16);
                    cryptoRef.getRandomValues(bytes);
                    bytes[6] = (bytes[6] & 0x0f) | 0x40;
                    bytes[8] = (bytes[8] & 0x3f) | 0x80;
                    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
                    return [
                      hex.slice(0, 4).join(""),
                      hex.slice(4, 6).join(""),
                      hex.slice(6, 8).join(""),
                      hex.slice(8, 10).join(""),
                      hex.slice(10, 16).join("")
                    ].join("-");
                  }
                });
              })();
            `
          }}
        />
        <StackProvider app={stackClientApp}>{children}</StackProvider>
      </body>
    </html>
  );
}
