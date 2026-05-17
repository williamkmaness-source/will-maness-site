export type PipelineId = '311' | 'chess';

export type PipelineStatusValue = 'success' | 'failed' | 'running' | 'unknown';

export type PipelineStatus = {
  pipeline: PipelineId;
  status: PipelineStatusValue;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  recordCount: number | null;
  error: string | null;
};

export type PipelineConnectionState = {
  statuses: PipelineStatus[];
  connected: boolean;
};
