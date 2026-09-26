import OpenAI from "openai";
import { resolveSecret } from "./resolve-env";

export type JsonSchemaNative = {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
};

export function openAIJsonSchemaNativeParams(schema: JsonSchemaNative) {
  return {
    response_format: {
      type: "json_schema" as const,
      json_schema: {
        name: schema.name,
        strict: schema.strict ?? true,
        schema: schema.schema,
      },
    },
  };
}

export async function runOpenAIInference(opts: {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  nativeParams?: ReturnType<typeof openAIJsonSchemaNativeParams>;
}): Promise<{
  text: string;
  usage: { input_tokens: number; output_tokens: number; total_tokens: number };
}> {
  const apiKey = await resolveSecret("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY not found. Add it to ~/.env or the skill .env file."
    );
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    max_tokens: opts.maxTokens ?? 3000,
    temperature: opts.temperature ?? 0.7,
    ...(opts.nativeParams ?? {}),
  });

  const text = response.choices[0]?.message?.content ?? "";
  const usage = response.usage;

  return {
    text,
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
    },
  };
}
