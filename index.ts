import { Message, OpenRouter } from "./OpenRouter.ts";
export const Model = [
  "google/gemini-2.5-pro-exp-03-25:free",
  "google/gemini-2.0-flash-thinking-exp:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "openrouter/optimus-alpha",
] as const;

async function toArray<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const result = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.push(value);
  }
  return result;
}

async function $(comand: string, ...args: string[]) {
  const cmd = new Deno.Command(comand, {
    args,
    stdout: "piped",
    stderr: "piped",
    stdin: "piped",
  });
  const ps = cmd.spawn();
  const result = await ps.output();
  const decoder = new TextDecoder();
  return {
    stdout: decoder.decode(result.stdout),
    stderr: decoder.decode(result.stderr),
    status: result.code,
  }
}

class AiShell {
  currentContext: Message[] = [
    {
      content: `
あなたは日本語のAIアシスタントです。日本語で回答してください。
また、レスポンスにJSONを含めることができ、そのJSONに応じてユーザーのシェルを操作することができます。
JSONは以下の形式で出力してください。
<start>
{ "command": "<シェルコマンド>", "args": ["<引数1>", "<引数2>", ...] }
<end>
以下の注意点を守るようにしてください。
・JSONの出力は必ず<start>と<end>で囲んでください。
・一度のレスポンスにつき、ひとつのJSONしか出力できません。
・ディレクトリ移動をしても、次の実行では元のディレクトリに戻ってきます。必要に応じて、cdコマンドを実行してください。

ユーザーがやりたいことを実現するために、シェルを操作してください。
      `.trim(),
      role: "system",
    }
  ];

  exec(request: string) {
    this.currentContext.push({
      content: request,
      role: "user",
    });
    return this.sendMessage();
  }

  async sendMessage(): Promise<Message[]> {
    const response = await OpenRouter.request({
      model: Model[1],
      messages: this.currentContext,
    });
    const result = await toArray(response);
    const responseText = result.map((r) => r.choices[0].delta.content).join("");
    this.currentContext.push({
      content: responseText,
      role: "assistant",
    });
    if (responseText.includes("<start>")) {
      console.log(responseText);
      const match = responseText.matchAll(/<start>(.*?)<end>/mgs).toArray()[0][1];
      const commandJson = JSON.parse(match) as { command: string; args: string[] };
      const { command, args } = commandJson;
      if (command === "rm") {
        throw new Error("rmコマンドは実行できません。");
      }
      console.log(`executing: "${command} ${args.join(" ")}"`);
      const { stdout, stderr, status } = await $(command, ...args);

      this.currentContext.push({
        content: `
シェルコマンドを実行しました。
"${command} ${args.join(" ")}"。
実行結果は以下のとおりです。
"""
stdout: ${stdout}
stderr: ${stderr}
status: ${status}
"""
ユーザーのやりたいことが実現できていれば、コマンドをレスポンスしなくてもよいです。
もし、まだ実現できていなければ、続けてコマンドを実行してください。
必要に応じて、実現できているかを確認するためのシェルコマンドを実行してください。
        `.trim(),
        role: "user",
      });
      return this.sendMessage();
    } else {
      return this.currentContext;
    }
  }
}

const ai = new AiShell();
const result = await ai.exec("現在のディレクトリでウェブアプリを作ります。雛形はあるので、ReactでHello worldアプリを作って欲しいです。");
console.log(result.map((r) => `${r.role}: ${r.content}`).join("\n\n"));
