import type { LanguageMode, Question } from '../types/lesson.js';
import { buildTaskSystemPrompt, type PromptPayload } from './system.js';

export interface EvaluateAnswerPromptInput {
  language: LanguageMode;
  question: Question;
  userAnswer: string;
  material?: string | null;
  previousQuestions?: Question[];
}

function getQuestionSpecificRules(questionType: Question['type'], language: LanguageMode): string {
  const targetLanguage = language === 'ja' ? 'Japanese' : 'English';

  if (questionType === 'translate') {
    return [
      'Question-type evaluation rules for translate:',
      `Judge how well the learner translates the Simplified Chinese prompt into natural ${targetLanguage}.`,
      `Judge meaning accuracy first, then grammar, word choice, and naturalness in ${targetLanguage}.`,
      'A good answer should accurately convey the Simplified Chinese source meaning without important omissions, additions, or distortions.',
      'If the meaning is wrong, incomplete, or reversed, mark that clearly even if parts of the language are fluent.',
      'If the meaning is correct but the wording is awkward, say that it is correct but unnatural.'
    ].join('\n');
  }

  if (questionType === 'paraphrase') {
    return [
      'Question-type evaluation rules for paraphrase:',
      'Judge whether the learner preserves the original meaning while changing wording or sentence structure.',
      'Penalize answers that copy the source wording too closely or only make trivial surface changes.',
      'Reward real rephrasing that keeps the meaning accurate and natural.',
      'If the answer changes key meaning, omits important information, or stays too close to the original wording, state that clearly in the evaluation and issues.'
    ].join('\n');
  }

  return [
    'Question-type evaluation rules for free_expression:',
    'Judge whether the learner clearly answers the prompt with their own idea, opinion, experience, or plan.',
    'Check prompt fulfillment, sufficient content, clarity, grammar, and naturalness.',
    'Penalize answers that mostly repeat the material instead of expressing the learner\'s own idea.',
    'Treat answers as weak or failing when they do not address the prompt, are too short to satisfy the request, are hard to understand, or rely mainly on copied material.',
    `Use the existing output fields to describe this clearly: "evaluation" should summarize whether the response is insufficient, partially successful, correct but unnatural, or clear and natural; "issues" should list the specific content, clarity, grammar, or naturalness problems; "naturalVersion" should show a stronger natural ${targetLanguage} answer that actually fulfills the prompt.`
  ].join('\n');
}

function getEvaluateAnswerRules(language: LanguageMode): string {
  const targetLanguage = language === 'ja' ? 'Japanese' : 'English';

  return [
    'Evaluate the learner answer and return a JSON object with this exact shape:',
    '{',
    '  "evaluation": string,',
    '  "issues": string[],',
    '  "naturalVersion": string,',
    '  "alternatives": string[]',
    '}',
    `The learner is practicing ${targetLanguage}.`,
    '"evaluation" must explicitly state whether the answer is incorrect, partially correct, correct but unnatural, or correct and natural, then briefly explain why in Simplified Chinese.',
    '"issues" must list concrete problems in Simplified Chinese. Use an empty array when there is no issue.',
    `"naturalVersion" must be a corrected, natural ${targetLanguage} answer.`,
    `"alternatives" must be alternative natural ${targetLanguage} expressions. Use an empty array when none are needed.`,
    'Use the evaluation wording that best fits the answer, such as incorrect, partially correct, correct but unnatural, or correct and natural.',
    'If the answer is fully correct but not natural enough, say so explicitly and focus the issues on awkward wording, nuance, or collocation.',
    'If the answer is clearly wrong or does not fulfill the task, say so explicitly and focus the issues on meaning, prompt fulfillment, grammar, clarity, or missing information.',
    'Judge the answer against the current question first, then use the material and prior question context only as support.',
    'Do not include extra fields.'
  ].join('\n');
}

export function buildEvaluateAnswerPrompt(input: EvaluateAnswerPromptInput): PromptPayload {
  const previousQuestions = input.previousQuestions?.length
    ? JSON.stringify(input.previousQuestions, null, 2)
    : '[]';

  return {
    system: buildTaskSystemPrompt(
      input.language,
      'You evaluate learner answers for a language training app.'
    ),
    user: [
      getEvaluateAnswerRules(input.language),
      getQuestionSpecificRules(input.question.type, input.language),
      'Current question:',
      JSON.stringify(input.question, null, 2),
      'Reference material:',
      input.material?.trim() ? input.material.trim() : 'No reference material.',
      'Previous question context:',
      previousQuestions,
      'Learner answer:',
      input.userAnswer.trim() || '(empty answer)'
    ].join('\n\n')
  };
}
