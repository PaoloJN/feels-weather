"use client";

import dynamic from "next/dynamic";

// Settings live in localStorage, so this view only renders in the browser.
const Weather = dynamic(() => import("./Weather"), { ssr: false });

export default function WeatherLoader() {
  return <Weather />;
}
