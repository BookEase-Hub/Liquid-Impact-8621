// artifacts/api-server/src/services/providers/base.ts
import { z } from 'zod';
import { AnalysisResponse } from '../schema/analysis.schema';

export interface ProviderCallOptions {
  imageBase64: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<AnalysisResponse>;
  timeoutMs: number;
  requestId?: string;
  [key: string]: any;
}

export interface ProviderResponse {
  raw: any;
  confidence?: number;
  tokens?: { prompt: number; completion: number };
  metadata?: Record<string, any>;
}

export abstract class AIProvider {
  abstract readonly id: string;
  abstract readonly capabilities: {
    vision: boolean;
    jsonSchema: boolean;
    streaming: boolean;
    maxImageSizeMB: number;
    supportsConfidence: boolean;
  };

  abstract call(options: ProviderCallOptions): Promise<ProviderResponse>;

  validateImage(imageBase64: string): { valid: boolean; error?: string } {
    const estimatedBytes = (imageBase64.length * 3) / 4;
    const estimatedMB = estimatedBytes / (1024 * 1024);

    if (estimatedMB > this.capabilities.maxImageSizeMB) {
      return {
        valid: false,
        error: `Image too large: ${estimatedMB.toFixed(1)}MB > ${this.capabilities.maxImageSizeMB}MB limit`,
      };
    }

    return { valid: true };
  }
}
