import fs from 'fs';
import path from 'path';
import BackupMetadataModel from '../model/backupMetadata.model';
import { BACKUP_MODELS, BACKUP_MODEL_NAMES } from '../utils/backupModels';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export interface RestoreCollectionResult {
  name: string;
  restored: number;
  error?: string;
}

export class BackupService {
  static async createBackup(createdBy?: { id?: string; name?: string }) {
    const timestamp = new Date();
    const stamp = timestamp
      .toISOString()
      .replace(/[:.]/g, '-'); 
    const filename = `barangay_backup_${stamp}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    const collections: { name: string; count: number }[] = [];
    const dump: Record<string, unknown[]> = {};

    for (const { name, model } of BACKUP_MODELS) {
      const docs = await model.find({}).lean();
      dump[name] = docs;
      collections.push({ name, count: docs.length });
    }

    const payload = {
      meta: {
        createdAt: timestamp.toISOString(),
        source: 'Barangay System — full backup',
      },
      collections: dump,
    };

    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf-8');
    const { size } = fs.statSync(filePath);

    const metadata = await BackupMetadataModel.create({
      filename,
      sizeBytes: size,
      status: 'completed',
      collections,
      createdBy: createdBy?.id || undefined,
      createdByName: createdBy?.name || '',
    });

    return metadata;
  }

  static async listBackups() {
    return BackupMetadataModel.find({}).sort({ createdAt: -1 }).lean();
  }

  static async getBackupById(id: string) {
    return BackupMetadataModel.findById(id).lean();
  }


  static async resolveBackupFilePath(id: string): Promise<{ filePath: string; filename: string } | null> {
    const metadata = await this.getBackupById(id);
    if (!metadata) return null;
    const filePath = path.join(BACKUP_DIR, path.basename(metadata.filename));
    if (!fs.existsSync(filePath)) return null;
    return { filePath, filename: metadata.filename };
  }

  static async restoreFromBuffer(buffer: Buffer): Promise<RestoreCollectionResult[]> {
    let parsed: any;
    try {
      parsed = JSON.parse(buffer.toString('utf-8'));
    } catch {
      throw new Error('The uploaded file is not valid JSON');
    }

    const collectionsPayload = parsed?.collections;
    if (!collectionsPayload || typeof collectionsPayload !== 'object' || Array.isArray(collectionsPayload)) {
      throw new Error('The uploaded file is not a recognized backup (missing "collections")');
    }

    const keys = Object.keys(collectionsPayload);
    const unknownKeys = keys.filter((k) => !BACKUP_MODEL_NAMES.has(k));
    if (unknownKeys.length) {
      throw new Error(`The uploaded file contains unrecognized collections: ${unknownKeys.join(', ')}`);
    }
    if (!keys.length) {
      throw new Error('The uploaded file has no data to restore');
    }

    const results: RestoreCollectionResult[] = [];

    for (const { name, model } of BACKUP_MODELS) {
      const records = collectionsPayload[name];
      if (!Array.isArray(records)) continue;
      try {
        await model.deleteMany({});
        if (records.length) {
          await model.insertMany(records, { ordered: false });
        }
        results.push({ name, restored: records.length });
      } catch (error: any) {
        results.push({ name, restored: 0, error: error?.message || 'Failed to restore this collection' });
      }
    }

    return results;
  }
}
