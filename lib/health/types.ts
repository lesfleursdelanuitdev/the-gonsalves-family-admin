export type CheckCategory = "data_integrity" | "media" | "community" | "user_hygiene";
export type BatchAction = "delete" | "archive";

export type CheckResult = {
  checkKey: string;
  label: string;
  description: string;
  category: CheckCategory;
  count: number;
  batchAction: BatchAction | null;
};

export type HealthRecord = {
  id: string;
  label: string;
  sublabel?: string;
  meta?: string;
  href?: string;
};

export type SiteHealthRunPayload = {
  id: string;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  results: CheckResult[];
  totalIssues: number;
};

export type CheckRecordsPayload = {
  checkKey: string;
  records: HealthRecord[];
  total: number;
  offset: number;
  limit: number;
};

export type BatchPayload = {
  affected: number;
};
