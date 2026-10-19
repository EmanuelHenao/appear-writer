import type { Metadata } from "next";
import { BookStudio } from "./BookStudio";

export const metadata: Metadata = { title: "Libros · Appear Writer" };

export default function Page() {
  return <BookStudio />;
}
