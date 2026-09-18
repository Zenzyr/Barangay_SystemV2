import { Model } from 'mongoose';
import AccountModel from '../model/account.model';
import AuditLogModel from '../model/auditLog.model';
import BarangaySettingsModel from '../model/barangaySettings.model';
import BusinessModel from '../model/business.model';
import CertificateTemplateModel from '../model/certificateTemplate.model';
import ContractModel from '../model/contract.model';
import DocumentRequestModel from '../model/documentRequest.model';
import DocumentTemplateModel from '../model/documentTemplate.model';
import NotificationModel from '../model/notification.model';
import OfficialModel from '../model/official.model';
import PurokModel from '../model/purok.model';
import RecommendationRuleModel from '../model/recommendationRule.model';
import ResidentCensusModel from '../model/residentCensus.model';
import ReviewModel from '../model/review.model';
import ServiceRequestModel from '../model/serviceRequest.model';
import SystemInfoModel from '../model/systemInfo.model';
import UserActivityModel from '../model/userActivity';
import WorkModel from '../model/work.model';

export interface BackupModelEntry {
  name: string;
  model: Model<any>;
}


export const BACKUP_MODELS: BackupModelEntry[] = [
  { name: 'Accounts', model: AccountModel },
  { name: 'AuditLogs', model: AuditLogModel },
  { name: 'BarangaySettings', model: BarangaySettingsModel },
  { name: 'Business', model: BusinessModel },
  { name: 'CertificateTemplate', model: CertificateTemplateModel },
  { name: 'Contract', model: ContractModel },
  { name: 'Documents', model: DocumentRequestModel },
  { name: 'DocumentTemplate', model: DocumentTemplateModel },
  { name: 'Notification', model: NotificationModel },
  { name: 'Officials', model: OfficialModel },
  { name: 'Puroks', model: PurokModel },
  { name: 'RecommendationRule', model: RecommendationRuleModel },
  { name: 'ResidentCensus', model: ResidentCensusModel },
  { name: 'Review', model: ReviewModel },
  { name: 'ServiceRequest', model: ServiceRequestModel },
  { name: 'SystemInfos', model: SystemInfoModel },
  { name: 'UserActivity', model: UserActivityModel },
  { name: 'Works', model: WorkModel },
];

export const BACKUP_MODEL_NAMES = new Set(BACKUP_MODELS.map((entry) => entry.name));
