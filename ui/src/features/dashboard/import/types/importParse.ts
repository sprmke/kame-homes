export type ImportParseResult = {
  batchId: string;
  fileName: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  rowCount: number;
};
