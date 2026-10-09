import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";

export interface TraceStepInput {
  correlationId: string;
  stepNumber: number;
  label: string;
  from: string;
  to: string;
  details?: Record<string, unknown> | string;
}

export class SequenceTracer {
  /**
   * Records a sequence diagram step both in DB and console.
   */
  async step(input: TraceStepInput): Promise<void> {
    const formattedDetails =
      typeof input.details === "object"
        ? JSON.stringify(input.details)
        : input.details ?? null;

    try {
      await prisma.traceLog.create({
        data: {
          correlationId: input.correlationId,
          stepNumber: input.stepNumber,
          messageLabel: input.label,
          fromEntity: input.from,
          toEntity: input.to,
          timestamp: clock.now(),
          details: formattedDetails,
        },
      });
    } catch (err) {
      // In testing environments or before DB reset, ensure logging doesn't crash the flow
      console.warn(`[SequenceTracer] Failed to persist step ${input.stepNumber}:`, err);
    }
  }

  /**
   * Generates a new correlation ID for a user flow.
   */
  generateCorrelationId(prefix = "flow"): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }
}

export const trace = new SequenceTracer();
