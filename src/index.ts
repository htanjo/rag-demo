import { GoogleGenAI } from "@google/genai";
import { MarkdownTextSplitter } from "@langchain/textsplitters";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const splitter = new MarkdownTextSplitter({
  chunkSize: 50,
  chunkOverlap: 10,
});

type Doc = {
  title: string;
  url: string;
  content: string;
};

type Chunk = {
  content: string;
  metadata: {
    title: string;
    url: string;
  };
  embedding: number[];
};

const docs = [
  {
    title: "ログイン仕様",
    url: "https://example.com/login",
    content: `
## ログイン方法
ユーザーはメールアドレスとパスワードでログインする

## パスワードリセット
パスワードを忘れた場合はリセット可能
`,
  },
  {
    title: "アカウント設定",
    url: "https://example.com/account",
    content: `
## メール変更
設定画面から変更可能

## 退会
いつでも退会できる
`,
  },
];

const chunks: Chunk[] = [];

// function split(doc: Doc) {
//   return doc.content
//     .split("\n")
//     .filter((s) => s.trim() !== "")
//     .map((section) => ({
//       content: section,
//       metadata: {
//         title: doc.title,
//         url: doc.url,
//       },
//     }));
// }

async function split(doc: Doc) {
  const sections = await splitter.splitText(doc.content);
  return sections.map((section) => ({
    content: section,
    metadata: {
      title: doc.title,
      url: doc.url,
    },
  }));
}

async function embed(text: string) {
  const res = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });

  if (!res.embeddings || res.embeddings.length === 0) {
    throw new Error("Embedding failed");
  }

  const embedding = res.embeddings[0].values;
  if (!embedding) {
    throw new Error("Failed to extract embedding");
  }
  return embedding;
}

function cosine(a: number[], b: number[]) {
  let dot = 0,
    na = 0,
    nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function createChunks() {
  const allParts: Awaited<ReturnType<typeof split>> = [];

  for (const doc of docs) {
    const parts = await split(doc);
    allParts.push(...parts);
  }

  const embeddings = await Promise.all(allParts.map((p) => embed(p.content)));

  embeddings.forEach((embedding, i) => {
    chunks.push({
      ...allParts[i],
      embedding,
    });
  });
}

async function search(query: string) {
  const qVec = await embed(query);

  return chunks
    .map((c) => ({
      ...c,
      score: cosine(qVec, c.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function dedupeSources(docs: Chunk[]) {
  const map = new Map();

  for (const d of docs) {
    map.set(d.metadata.url, d.metadata);
  }

  return Array.from(map.values());
}

async function answer(query: string) {
  const docs = await search(query);

  if (docs.length === 0) {
    return {
      answer: "該当情報が見つかりませんでした。",
      sources: [],
    };
  }

  const context = docs.map((d) => d.content).join("\n\n");

  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: `
以下の情報を元に回答してください:

${context}

質問: ${query}
`,
  });

  return {
    answer: res.text,
    sources: dedupeSources(docs),
  };
}

async function main() {
  await createChunks();
  const result = await answer("ログイン方法を教えてください");
  console.log("回答:", result.answer);
  console.log("参照元:", result.sources);
}

main().catch((err) => {
  console.error(err);
});
