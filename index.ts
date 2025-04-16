import { AI } from "./OpenRouter.ts";
export const Model = [
  "google/gemini-2.5-pro-exp-03-25:free",
  "google/gemini-2.0-flash-thinking-exp:free",
] as const;

const response = await AI.request({
  model: Model[1],
  messages: [
    {
      content: "あなたは誰ですか？Google Gemini 2.5 Proの特徴は何ですか？",
      role: "user",
    }
  ]
})

for await (const chunk of response) {
  Deno.stdout.write(new TextEncoder().encode(chunk.choices.map(it => it.delta.content).join("")));
}
