
export interface AnalysisResult {
  isAiGenerated: boolean;
  confidenceScore: number;
  verdict: string;
  reasoning: string[];
  artifactsFound: string[];
  technicalDetails: {
    lightingConsistency: string;
    textureQuality: string;
    anatomicalAccuracy?: string;
    metadataAnalysis?: string;
    temporalConsistency?: string;
  };
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface UploadedFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  fileType: string;
  previewUrl: string;
  result: AnalysisResult;
}
