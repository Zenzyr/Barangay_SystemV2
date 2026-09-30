import { Router } from "express";
import accountRoute from "./account.route";
import documentRequestRoute from "./documentRequest.route";
import residentCensusRoute from "./residentCensus.route";
import communityAnalyticsRoute from "./communityAnalytics.route";
import analyticsRoute from "./analytics.route";
import recommendationRuleRoute from "./recommendationRule.route";
import serviceRequestRoute from "./serviceRequest.route";
import contractRoute from "./contract.route";
import reviewRoute from "./review.route";
import businessRoute from "./business.route";
import workRoute from "./work.route";
import barangaySettingsRoute from "./barangaySettings.route";
import notificationRoute from "./notification.route";
import certificateTemplateRoute from "./certificateTemplate.route";
import documentTemplateRoute from "./documentTemplate.route";
import docxTemplateRoute from "./docxTemplate.route";
import publicRoute from "./public.route";
import backupRoute from "./backup.route";
import decisionSupportRoute from "./decisionSupport.route";
import analyticsSnapshotRoute from "./analyticsSnapshot.route";
import eventRoute from "./event.route";

const routes = Router();

routes.use("/account", accountRoute);
routes.use("/document-request", documentRequestRoute);
routes.use("/resident-census", residentCensusRoute);
// Both analytics route groups mount on "/analytics" with distinct sub-paths:
// communityAnalyticsRoute: /overview, /employment, /education, /seniors, etc.
// analyticsRoute: /summary, /insights
routes.use("/analytics", communityAnalyticsRoute);
routes.use("/analytics", analyticsRoute);
routes.use("/recommendation-rules", recommendationRuleRoute);
routes.use("/service-requests", serviceRequestRoute);
routes.use("/contracts", contractRoute);
routes.use("/reviews", reviewRoute);
routes.use("/business", businessRoute);
routes.use("/work", workRoute);
routes.use("/barangay", barangaySettingsRoute);
routes.use("/notification", notificationRoute);
routes.use("/certificate-templates", certificateTemplateRoute);
// New data-driven document template system (visual editor + PDF generation)
routes.use("/document-templates", documentTemplateRoute);

routes.use("/document-templates-docx", docxTemplateRoute);
routes.use("/public", publicRoute);
routes.use("/backup", backupRoute);
routes.use("/decision-support", decisionSupportRoute);
routes.use("/analytics-snapshots", analyticsSnapshotRoute);
routes.use("/events", eventRoute);

export default routes;
