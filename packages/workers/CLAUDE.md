# packages/workers — CLAUDE.md

`@typedcode/workers` は **Cloudflare Workers の API サーバ**。Turnstile 検証・アテステーション署名・署名済みチェックポイント発行を担当する。

## 責務と境界

- **持つ**: Turnstile API への HTTP 検証、HMAC-SHA256 でのアテステーション署名、ECDSA-P256 での cp 署名、KV を使った per-session のリプレイ防止と冪等処理
- **持たない**: ハッシュチェーン計算 (shared に委譲)、proof の保管 (Workers は stateful な保管庫ではない)、ユーザー個別ストレージ

## 重要な不変条件

1. **`/api/checkpoint/sign` は冪等** ([docs/adr/0003-idempotent-signing-retry.md](../../docs/adr/0003-idempotent-signing-retry.md)): 同一 `sessionId` / `checkpointIndex` で `clientTimestamp` 以外が一致するリクエストには **前回 envelope をそのまま返す**。`isIdempotentSigningRetry` で判定。これがないとネットワーク再送で `previousSignedCheckpointHash` チェーンが破綻する
2. **`CHECKPOINT_SIGNING_KEY_*` シークレット**: 本番では `wrangler secret put` で投入。秘密鍵を git に入れない
3. **公開鍵レジストリは append-only**: `packages/shared/src/checkpointKeys/registry.ts`。失効は `status: 'revoked'` で表現し、削除しない
4. **KV は eventually consistent**: 同一 key への高頻度書き込みは ~1 write/sec の制限あり。cp トリガが頻発しないよう shared 側がハイブリッドトリガを使う ([docs/adr/0001-hybrid-checkpoint-trigger.md](../../docs/adr/0001-hybrid-checkpoint-trigger.md))
5. **CORS のオリジン**: 編集 / 検証アプリのドメインを許可。ワイルドカード禁止
6. **`sessionId` は信用しない**: クライアントが投げる任意の文字列。サーバ側で `firstSeenAt` を KV に保存し改ざんを防ぐ

## ファイル構成

```
src/
├── index.ts        # エントリ:
│                   #   - ルーティング、CORS
│                   #   - Turnstile 検証
│                   #   - アテステーション署名 (HMAC-SHA256)
│                   #   - ヘルスチェック
└── checkpoint.ts   # 署名済み cp:
                    #   - handleSignCheckpoint (POST /api/checkpoint/sign)
                    #   - handlePublicKeys (GET /api/checkpoint/public-keys)
                    #   - 冪等チェック、KV セッション管理
                    #   - ECDSA-P256 鍵のロード
```

## エンドポイント

| Endpoint | Method | 用途 |
|---|---|---|
| `/api/verify-captcha` | POST | Turnstile トークン検証 + アテステーション発行 |
| `/api/verify-attestation` | POST | アテステーション署名の整合性検証 |
| `/api/checkpoint/sign` | POST | 未署名 cp に ECDSA-P256 署名 + `serverTimestamp` 付与 |
| `/api/checkpoint/public-keys` | GET | 公開鍵レジストリ取得 (検証側のキャッシュ用) |
| `/health` | GET | ヘルスチェック |

## エラーコード (`/api/checkpoint/sign`)

| Code | HTTP | 意味 |
|---|---|---|
| `SCHEMA_INVALID` | 400 | リクエスト body のスキーマ違反 |
| `NON_MONOTONIC` | 409 | `checkpointIndex` が単調増加していない |
| `CHECKPOINT_CONFLICT` | 409 | 同一 index で内容不一致 (冪等性が成立しない) |
| `SESSION_LIMIT_EXCEEDED` | 429 | KV の `SESSION_MAX_CHECKPOINTS` 超過 |
| `SIGNING_KEY_NOT_CONFIGURED` | 500 | `CHECKPOINT_SIGNING_KEY_*` 未設定 |
| `SIGNING_KEY_UNKNOWN` | 500 | `keyId` がレジストリに存在しない |
| `SIGNING_ERROR` | 500 | 署名計算で予期しない失敗 |

## KV ネームスペース

| Binding | 内容 | TTL |
|---|---|---|
| `CHECKPOINT_SESSIONS` | `firstSeenAt`, `lastCheckpointIndex`, `lastServerTimestamp`, `signedCount`, `lastEnvelope` (冪等用) | 7 日 |

## ローカル開発のフロー

1. `cp .dev.vars.example .dev.vars` で雛形コピー
2. Turnstile キーを `.dev.vars` に貼り付け
3. `npm run gen-checkpoint-key -w @typedcode/workers` で開発用鍵生成
4. 公開鍵を `packages/shared/src/checkpointKeys/localKeys.ts` に貼り付け、`git update-index --skip-worktree` で隠す
5. 秘密鍵 (`CHECKPOINT_SIGNING_KEY_JWK`) と `CHECKPOINT_SIGNING_KEY_ID` を `.dev.vars` に貼り付け
6. `wrangler kv namespace create CHECKPOINT_SESSIONS` で KV 作成し `wrangler.toml` の ID を置換 (こちらも skip-worktree)
7. `npm run dev` で http://localhost:8787

詳細は [packages/workers/README.md](README.md) を参照。

## よくある罠

- **`.dev.vars` を git に入れない**: `.gitignore` に登録済み。`wrangler.toml` の KV ID は skip-worktree で隠す
- **`compatibility_date` を勝手に動かさない**: 後方互換性のために固定。新機能のために動かす必要があるときは ADR を書く
- **本番 / preview の KV ID 分離**: `wrangler.toml` の `[env.production]` ブロックで本番用 ID を別途指定
- **`gen-checkpoint-key` で出る秘密鍵は JWK の JSON 文字列**: `.dev.vars` に貼るときは改行を含めず 1 行に
