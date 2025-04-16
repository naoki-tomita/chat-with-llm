import { Request, Response } from "./ai.ts";
export const Model = [
  "google/gemini-2.5-pro-exp-03-25:free",
  "google/gemini-2.0-flash-thinking-exp:free",
] as const;

class TextTransformStream extends TransformStream<Uint8Array, string> {
  constructor() {
    super({
      transform(chunk, controller) {
        const text = new TextDecoder("utf-8").decode(chunk);
        text.split("\n").forEach(it => controller.enqueue(it));
      }
    });
  }
}

class AIResponseStream extends TransformStream<string, Response> {
  constructor() {
    super({
      transform(chunk, controller) {
        if (chunk.startsWith("data: [DONE]")) {
          controller.terminate();
        } else if (chunk.startsWith("data:")) {
          try {
            controller.enqueue(JSON.parse(chunk.replace("data: ", "")));
          } catch (e) {
            console.error("Failed to parse chunk:", e);
            console.error(`Chunk:, '${chunk}'`);
            controller.error("Failed to parse chunk:");
          }
        }
      }
    });
  }
}

const AI = {
  async request(message: Request): Promise<ReadableStream<Response>> {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + Deno.env.get("OPENROUTER_API_KEY")!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...message,
        stream: true,
      })
    });
    return response.body!
      .pipeThrough(new TextTransformStream())
      .pipeThrough(new AIResponseStream());
  }
};

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
