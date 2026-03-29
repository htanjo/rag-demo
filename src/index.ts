import { GoogleGenAI } from "@google/genai";
import { MarkdownTextSplitter } from "@langchain/textsplitters";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const splitter = new MarkdownTextSplitter({
  chunkSize: 100,
  chunkOverlap: 50,
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

type SearchResult = Chunk & {
  score: number;
};

const docs = [
  {
    title: "配送方法と配送料について",
    url: "https://example.com/help/shipping",
    content:
      "# 配送について\n\n## 配送業者\n商品は佐川急便またはヤマト運輸にてお届けします。業者の指定は承っておりません。\n\n## 配送料金\n全国一律 550円（税込）です。ただし、1回の注文合計金額が 5,000円（税込）以上の場合は送料無料となります。\n\n## お届け日数\n通常、ご注文確定から2〜5営業日以内に発送いたします。予約商品については商品ページに記載の納期をご確認ください。",
  },
  {
    title: "支払い方法のご案内",
    url: "https://example.com/help/payment",
    content:
      "# お支払いについて\n\n## 利用可能な決済方法\n以下の決済方法がご利用いただけます。\n- クレジットカード（Visa, Master, JCB, Amex）\n- コンビニ決済（前払い）\n- あと払い（Paidy）\n- PayPay\n\n## コンビニ決済の手数料\nコンビニ決済をご利用の場合、一律 220円（税込）の手数料を頂戴しております。",
  },
  {
    title: "返品・交換について",
    url: "https://example.com/help/returns",
    content:
      "# 返品・交換規定\n\n## お客様都合による返品\n商品到着後7日以内であれば返品可能です。ただし、未使用・未開封の商品に限ります。返送時の送料はお客様負担となります。\n\n## 不良品・誤送の場合\n商品の品質には万全を期しておりますが、万一破損や汚れがあった場合は、送料弊社負担にて速やかに交換対応をさせていただきます。到着後14日以内にお問い合わせフォームよりご連絡ください。",
  },
  {
    title: "会員登録とログイン",
    url: "https://example.com/help/account-registration",
    content:
      "# アカウント管理\n\n## 新規登録の手順\nトップページの「新規登録」ボタンから、メールアドレスとパスワードを設定してください。SNSアカウント（Google/LINE）での連携登録も可能です。\n\n## パスワードを忘れた場合\nログイン画面の「パスワードを忘れた方はこちら」より、登録済みのメールアドレスを入力してリセット用URLを発行してください。",
  },
  {
    title: "注文のキャンセル・変更",
    url: "https://example.com/help/order-cancel",
    content:
      "# 注文変更・キャンセル\n\n## キャンセル可能なタイミング\n注文ステータスが「発送準備前」の場合に限り、マイページからご自身でキャンセルが可能です。\n\n## お届け先の変更\n発送作業に入った後の住所変更は承れません。発送完了メールに記載の伝票番号より、直接配送業者へご相談ください。",
  },
  {
    title: "クーポン・ポイントの利用",
    url: "https://example.com/help/rewards",
    content:
      "# お得なご利用方法\n\n## クーポンの使用方法\nご購入手続き画面の「クーポンコード入力」欄にコードを入力し、「適用」ボタンを押してください。\n\n## ポイント制度\nお買い物 100円（税込）につき 1ポイントが貯まります。貯まったポイントは 1ポイント＝1円 として次回以降のお買い物にご利用いただけます。",
  },
  {
    title: "領収書・納品書の発行",
    url: "https://example.com/help/documents",
    content:
      "# 書類の発行について\n\n## 領収書の発行\n商品発送後、マイページの注文履歴より PDF形式でダウンロードいただけます。宛名・但し書きの変更も可能です。\n\n## 納品書について\n当店ではペーパーレス化推進のため、紙の納品書は同梱しておりません。詳細は発送完了メールをご確認ください。",
  },
  {
    title: "ギフトラッピング・のし",
    url: "https://example.com/help/gift",
    content:
      "# ギフト対応\n\n## ラッピングサービス\n1包装につき 330円（税込）で承っております。カート画面で「ギフトラッピングを希望する」にチェックを入れてください。\n\n## メッセージカード\nオリジナルのメッセージカード（最大50文字）を無料でお付けすることが可能です。",
  },
  {
    title: "メールが届かない場合",
    url: "https://example.com/help/email-trouble",
    content:
      "# メールトラブル\n\n## 確認事項\n注文完了メールが届かない場合は、以下の可能性がございます。\n- 迷惑メールフォルダへの振り分け\n- ドメイン指定受信（@example.comを許可してください）\n- 入力したメールアドレスの誤り\n\n解決しない場合は、マイページの注文履歴から注文が確定しているかご確認ください。",
  },
  {
    title: "定期購入コースについて",
    url: "https://example.com/help/subscription",
    content:
      "# 定期便のご案内\n\n## お届けサイクル\n30日、60日、90日のいずれかからお選びいただけます。マイページからいつでも変更可能です。\n\n## 解約について\n次回お届け予定日の10日前までに、マイページまたはお電話にてお手続きください。回数縛り（継続義務）はございません。",
  },
];

const chunks: Chunk[] = [];

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

function mmr(results: SearchResult[], lambda = 0.7, topK = 3) {
  const selected = [];

  while (selected.length < topK && results.length > 0) {
    let best = null;
    let bestScore = -Infinity;

    for (const candidate of results) {
      const relevance = candidate.score;

      const diversity =
        selected.length === 0
          ? 0
          : Math.max(
              ...selected.map((s) => {
                if (!s) {
                  return 0;
                }
                return cosine(candidate.embedding, s.embedding);
              }),
            );

      const mmrScore = lambda * relevance - (1 - lambda) * diversity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        best = candidate;
      }
    }

    if (best) {
      selected.push(best);
      results = results.filter((r) => r !== best);
    }
  }

  return selected;
}

async function search(query: string) {
  const qVec = await embed(query);
  const threshold = 0.6; // 類似度の閾値
  const lambda = 0.7; // MMRのλパラメータ
  const topK = 3; // 上位K件を取得

  const scored = chunks
    .map((chunk) => ({
      ...chunk,
      score: cosine(qVec, chunk.embedding),
    }))
    .filter((c) => c.score >= threshold);

  return mmr(scored, lambda, topK);
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

  const context = docs.map((d) => ({ text: d.content, metadata: d.metadata }));

  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    config: {
      systemInstruction:
        "あなたは優秀なカスタマーサポート担当者です。ユーザーからの質問に対して、参照コンテクストをもとに正確かつ簡潔に回答してください。必要に応じて、参照元のタイトルとURLを明記してください。",
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `質問:\n${query}`,
          },
          {
            text: `参照コンテクスト（JSON）:\n${JSON.stringify(context)}`,
          },
        ],
      },
    ],
  });

  return {
    answer: res.text,
    sources: dedupeSources(docs),
  };
}

async function main() {
  await createChunks();
  const result = await answer("このサービスのおすすめポイントを教えてください");
  console.log("回答:", result.answer);
  console.log("参照元:", result.sources);
}

main().catch((err) => {
  console.error(err);
});
