import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

export default function RankingsIndexPage() {
  redirect(routes.ranking("level"));
}
