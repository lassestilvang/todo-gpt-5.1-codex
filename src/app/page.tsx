import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Daily Task Planner — Today",
};

export default function Home() {
  redirect("/today");
}
