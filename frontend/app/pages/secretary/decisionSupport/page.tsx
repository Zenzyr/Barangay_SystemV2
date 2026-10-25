import { redirect } from "next/navigation";

/**
 * Decision Support has been moved into the Analytics page as a tab beside
 * Overview and Community. This route is kept only to redirect old links and
 * bookmarks to the new location.
 */
export default function DecisionSupportRedirect() {
  redirect("/pages/secretary/analytics?tab=decision-support");
}
