import { getActivePopups } from "@/lib/queries/banners";
import PopupLayer from "./PopupLayer";

export default async function HomePopups() {
  const popups = await getActivePopups();
  if (popups.length === 0) return null;
  return <PopupLayer popups={popups} />;
}