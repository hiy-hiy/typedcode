# 運動学的整合性 (Motor Consistency) 分析基盤

このドキュメントでは、タイピングログから物理的なキーストローク制約を分析するために追加された「運動学的整合性」分析モジュールについて説明します。

## 概要

人間のタイピングは、キーボードの物理的な形状と手の構造（運指、移動距離など）による制約を受けます。例えば、同じ指で遠くのキーを連続して押す場合は時間がかかり、違う指で近くのキーを押す場合は速く打てます。
本モジュールは、記録されたタイピングのログ（Dwell Time, Flight Time）と、QWERTYキーボード上の物理的な距離・運指の相関を抽出し、統計データとして集計する基盤です。

将来的に、このデータを機械学習モデル（回帰分析や異常検知）に入力することで、**「物理的制約を無視した不自然な入力（ボットなどによる自動入力）」** を高精度で検出することを目的としています。

## 追加された主要なファイル群

*   **`packages/shared/src/types/typingPattern.ts`**
    *   `DigraphPhysicalFeatures`: 2キー間（Digraph）の物理特徴量を定義します。
    *   `DigraphObservation` / `TrigraphObservation`: 各打鍵（Digraph/Trigraph）の実測 Flight Time と特徴量を紐づけた観測データセットです。
    *   `MotorConsistencyData`: すべての抽出・集計データを保持するルート型であり、`TypingPatternRawStats` に格納されます。
*   **`packages/shared/src/typingPattern/KeyboardLayout.ts`**
    *   標準的なUS QWERTYキーボードの座標系（行のズレを含む）および、各キーを担当する「手」と「指」の定義 (`QWERTY_LAYOUT`) を保持します。
    *   連続する2文字のキー情報から物理特徴量を算出する `getDigraphFeatures()` を提供します。
*   **`packages/shared/src/typingPattern/MotorConsistencyExtractor.ts`**
    *   `StoredEvent` の配列をパースし、キー入力イベントから Digraph（2文字連続）および Trigraph（3文字連続）の Flight Time を抽出します。
    *   同時に抽出された物理特徴量と組み合わせてリスト化し、平均や標準偏差などの統計集計 (`aggregateDigraphs`, `aggregateTrigraphs`) を行います。

## 抽出される物理特徴量 (Physical Features)

`DigraphPhysicalFeatures` として、以下の情報が抽出されます。
※抽出対象はアルファベット（a-z）、数字、主要記号など「印字可能な文字」同士の連続に限ります。

1.  **キー間距離 (`distance`)**: QWERTY配列特有の「行のズレ（stagger）」を考慮した座標系における、キー間のユークリッド距離。
2.  **左右の手 (`hand1`, `hand2`)**: `left`, `right`, またはスペースキーなどの `both`。
3.  **同一手フラグ (`isSameHand`)**: 連続する2キーが同じ手で押されたかどうか。
4.  **同一指フラグ (`isSameFinger`)**: 連続する2キーが全く同じ指で押されたか（例：e→d など）。
5.  **行移動の有無 (`hasRowChange`)**: 異なる行間での移動を伴うか。

## 将来的な利用方法 (回帰・異常検知)

抽出された観測データ (`MotorConsistencyData.digraphObservations`) は、以下のようなJSONの配列として保存されます。

```json
[
  {
    "digraph": "th",
    "flightTime": 85,
    "features": {
      "distance": 3.16,
      "isSameHand": false,
      "isSameFinger": false,
      "hasRowChange": true,
      "hand1": "left",
      "hand2": "right"
    }
  }
]
```

### 1. 予測モデルの構築 (Regression)
このデータ配列を平坦化（フラットなテーブルに変換）し、`flightTime` を目的変数 (y)、`features` を説明変数 (X) とした重回帰分析や機械学習モデル（ランダムフォレスト等）を構築します。これにより「人間のタイピングにおける物理的制約と速度の相関」をモデル化できます。

### 2. 異常入力の検知 (Anomaly Detection)
検証したいセッションのログに対して、上記の予測モデルを使って「予測される Flight Time」を計算し、実際の `flightTime` との残差（Error）を求めます。
ボット等による機械的な入力の場合、キーの物理的な位置に関係なく一定の速度になったりランダムになったりするため、この残差が著しく大きくなる（または不自然に揃う）傾向が出ます。これを異常スコア（Anomaly Score）として扱うことで、自動入力ツールの検出精度を向上させることができます。
