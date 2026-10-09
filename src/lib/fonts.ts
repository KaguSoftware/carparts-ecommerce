import { Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";

/** Display / headings. Condensed, machined, a little aggressive. */
export const fontDisplay = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--ff-display",
  display: "swap",
});

/** Body / UI / data. Latin-ext is required for Turkish (ğ ş ı İ). */
export const fontSans = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--ff-sans",
  display: "swap",
});

/** Third voice: part numbers, specs, dimensions, order numbers. Slashed zero keeps 0 and O apart on a data plate. */
export const fontMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-mono",
  display: "swap",
});

export const fontVariables = `${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`;
