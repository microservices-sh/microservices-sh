import { extractionDraftSchema } from "../schemas";
import { averageConfidence } from "../service";
import type { ExtractionDraft, ExtractionNormalizer, ExtractionNormalizerInput } from "../types";

export interface CompletionClient {
  complete(input: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string; provider?: string; model?: string }>;
}

export interface GemmaNormalizerOptions {
  client: CompletionClient;
  model?: string;
  maxTokens?: number;
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function fallbackDraft(input: ExtractionNormalizerInput): Omit<ExtractionDraft, "model" | "warnings"> {
  const field = { name: "rawText", value: input.rawText, confidence: 0.35, needsReview: true, source: { text: input.rawText.slice(0, 500) } };
  return {
    schemaId: input.schemaId,
    targetType: input.targetType,
    fields: [field],
    tables: [],
    rawText: input.rawText,
    confidence: averageConfidence([field]),
    runtime: input.runtime,
  };
}

export function createGemmaExtractionNormalizer(options: GemmaNormalizerOptions): ExtractionNormalizer {
  return {
    async normalize(input) {
      const fieldsHint = input.fieldsHint?.length ? `\nExpected fields: ${input.fieldsHint.join(", ")}` : "";
      const response = await options.client.complete({
        maxTokens: options.maxTokens ?? 2048,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              "You convert OCR text from scanned business documents into strict JSON.",
              "Return only JSON with: schemaId, targetType, fields, tables, rawText, summary, confidence, runtime, model, warnings.",
              "Every field must include name, value, confidence, and needsReview when uncertain.",
              "Do not invent values; use null with low confidence when the source is unclear."
            ].join(" ")
          },
          {
            role: "user",
            content: `Schema: ${input.schemaId}\nTarget type: ${input.targetType}\nRuntime: ${input.runtime}${fieldsHint}\nDocument: ${input.documentName ?? "unknown"}\n\nOCR text:\n${input.rawText}`
          }
        ]
      });

      try {
        return extractionDraftSchema.parse({
          ...parseJsonObject(response.text),
          schemaId: input.schemaId,
          targetType: input.targetType,
          runtime: input.runtime,
          model: response.model ?? options.model
        });
      } catch (error) {
        return {
          ...fallbackDraft(input),
          model: response.model ?? options.model,
          warnings: [`Gemma normalizer parse failed: ${error instanceof Error ? error.message : "unknown error"}`]
        };
      }
    }
  };
}
