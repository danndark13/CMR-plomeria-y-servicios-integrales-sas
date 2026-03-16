'use server';
/**
 * @fileOverview A GenAI tool to automatically generate concise summaries from detailed service notes.
 *
 * - serviceNoteSummaryGenerator - A function that handles the generation of service note summaries.
 * - ServiceNoteSummaryGeneratorInput - The input type for the serviceNoteSummaryGenerator function.
 * - ServiceNoteSummaryGeneratorOutput - The return type for the serviceNoteSummaryGenerator function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ServiceNoteSummaryGeneratorInputSchema = z.object({
  notes: z
    .string()
    .describe('Detailed service notes to be summarized.'),
});
export type ServiceNoteSummaryGeneratorInput = z.infer<
  typeof ServiceNoteSummaryGeneratorInputSchema
>;

const ServiceNoteSummaryGeneratorOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the service notes.'),
});
export type ServiceNoteSummaryGeneratorOutput = z.infer<
  typeof ServiceNoteSummaryGeneratorOutputSchema
>;

export async function serviceNoteSummaryGenerator(
  input: ServiceNoteSummaryGeneratorInput
): Promise<ServiceNoteSummaryGeneratorOutput> {
  return serviceNoteSummaryGeneratorFlow(input);
}

const summarizeServiceNotesPrompt = ai.definePrompt({
  name: 'summarizeServiceNotesPrompt',
  input: {schema: ServiceNoteSummaryGeneratorInputSchema},
  output: {schema: ServiceNoteSummaryGeneratorOutputSchema},
  prompt: `You are a helpful assistant that summarizes service notes. Summarize the following detailed service notes concisely for quick and efficient review. Focus on key actions taken, problems identified, and resolutions.

Detailed Service Notes:
{{{notes}}}

Concise Summary:`,
});

const serviceNoteSummaryGeneratorFlow = ai.defineFlow(
  {
    name: 'serviceNoteSummaryGeneratorFlow',
    inputSchema: ServiceNoteSummaryGeneratorInputSchema,
    outputSchema: ServiceNoteSummaryGeneratorOutputSchema,
  },
  async input => {
    const {output} = await summarizeServiceNotesPrompt(input);
    return output!;
  }
);
