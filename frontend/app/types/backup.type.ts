export interface BackupCollectionCount {
  name: string;
  count: number;
}

export interface BackupMetadata {
  _id: string;
  filename: string;
  sizeBytes: number;
  status: "completed" | "failed";
  collections: BackupCollectionCount[];
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RestoreCollectionResult {
  name: string;
  restored: number;
  error?: string;
}

export interface RestoreResponse {
  collections: RestoreCollectionResult[];
}
