import type { Metadata } from "next";
import { SettingsPage } from "./Settings";

export const metadata: Metadata = { title: "Ajustes · Appear Writer" };

export default function Page() {
  return <SettingsPage />;
}
