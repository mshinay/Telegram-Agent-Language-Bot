import type {
  AgentAdapter,
  EvaluateAnswerInput,
  GenerateLessonPlanInput,
  GenerateSummaryInput
} from './agent-adapter.js';

export class OpenCodeAdapter implements AgentAdapter {
  public async generateLessonPlan(_input: GenerateLessonPlanInput): Promise<never> {
    throw new Error('OpenCodeAdapter is not implemented');
  }

  public async evaluateAnswer(_input: EvaluateAnswerInput): Promise<never> {
    throw new Error('OpenCodeAdapter is not implemented');
  }

  public async generateSummary(_input: GenerateSummaryInput): Promise<never> {
    throw new Error('OpenCodeAdapter is not implemented');
  }
}
