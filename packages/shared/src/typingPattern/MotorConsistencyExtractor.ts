import { StoredEvent, KeystrokeDynamicsData } from '../types/index.js';
import {
  MotorConsistencyData,
  DigraphObservation,
  TrigraphObservation,
  DigraphStats,
  TrigraphStats,
} from '../types/typingPattern.js';
import { getDigraphFeatures, QWERTY_LAYOUT } from './KeyboardLayout.js';

/**
 * 運動学的整合性 (Motor Consistency) のデータを抽出・集計するクラス
 */
export class MotorConsistencyExtractor {
  /**
   * イベントリストから Digraph / Trigraph の観測データと統計を抽出する
   */
  public extract(events: StoredEvent[]): MotorConsistencyData {
    const digraphObservations: DigraphObservation[] = [];
    const trigraphObservations: TrigraphObservation[] = [];

    // 直近に入力されたキー履歴 (最大3つ)
    const history: { key: string; timestamp: number; flightTime: number }[] = [];

    for (const event of events) {
      if (event.type === 'keyDown') {
        const data = event.data as KeystrokeDynamicsData | null;
        if (!data || typeof data !== 'object') continue;

        const key = data.key;
        if (!key) continue;

        // アルファベット（a-z）のみ対象
        const char = key.toLowerCase();
        if (!/^[a-z]$/.test(char) || !QWERTY_LAYOUT[char]) {
          // 対象外のキー（空白、数字、記号、修飾キー等）が挟まった場合は
          // 物理的な連続性が途切れるか、思考のノイズが入りやすいため履歴をリセットする
          history.length = 0;
          continue;
        }

        const flightTime = data.flightTime;
        // Flight timeが取得できない、または異常値(10秒以上など)の場合はスキップして履歴リセット
        if (flightTime === undefined || flightTime < 0 || flightTime > 10000) {
          history.length = 0;
          // 現キーは次のDigraphの起点になり得るため追加
          history.push({ key: char, timestamp: event.timestamp, flightTime: 0 });
          continue;
        }

        history.push({ key: char, timestamp: event.timestamp, flightTime });

        // Digraphの抽出 (最新2文字)
        if (history.length >= 2) {
          const prev = history[history.length - 2]!;
          const curr = history[history.length - 1]!;
          const digraphStr = prev.key + curr.key;

          const features = getDigraphFeatures(prev.key, curr.key);
          if (features) {
            digraphObservations.push({
              digraph: digraphStr,
              flightTime: curr.flightTime,
              features,
            });
          }
        }

        // Trigraphの抽出 (最新3文字)
        if (history.length >= 3) {
          const prev2 = history[history.length - 3]!;
          const prev1 = history[history.length - 2]!;
          const curr = history[history.length - 1]!;
          const trigraphStr = prev2.key + prev1.key + curr.key;

          trigraphObservations.push({
            trigraph: trigraphStr,
            flightTime1: prev1.flightTime,
            flightTime2: curr.flightTime,
            totalFlightTime: prev1.flightTime + curr.flightTime,
          });
        }

        // 履歴は直近3文字あれば十分
        if (history.length > 3) {
          history.shift();
        }
      }
    }

    return {
      digraphObservations,
      trigraphObservations,
      digraphStats: this.aggregateDigraphs(digraphObservations),
      trigraphStats: this.aggregateTrigraphs(trigraphObservations),
    };
  }

  private aggregateDigraphs(obs: DigraphObservation[]): Record<string, DigraphStats> {
    const grouped: Record<string, DigraphObservation[]> = {};
    for (const o of obs) {
      if (!grouped[o.digraph]) grouped[o.digraph] = [];
      grouped[o.digraph]!.push(o);
    }

    const stats: Record<string, DigraphStats> = {};
    for (const [digraph, list] of Object.entries(grouped)) {
      const times = list.map((o) => o.flightTime).sort((a, b) => a - b);
      stats[digraph] = {
        digraph,
        count: list.length,
        meanFlightTime: this.mean(times),
        medianFlightTime: this.median(times),
        stdFlightTime: this.std(times),
        minFlightTime: Math.min(...times),
        maxFlightTime: Math.max(...times),
        features: list[0]!.features,
      };
    }
    return stats;
  }

  private aggregateTrigraphs(obs: TrigraphObservation[]): Record<string, TrigraphStats> {
    const grouped: Record<string, TrigraphObservation[]> = {};
    for (const o of obs) {
      if (!grouped[o.trigraph]) grouped[o.trigraph] = [];
      grouped[o.trigraph]!.push(o);
    }

    const stats: Record<string, TrigraphStats> = {};
    for (const [trigraph, list] of Object.entries(grouped)) {
      const totalTimes = list.map((o) => o.totalFlightTime).sort((a, b) => a - b);
      stats[trigraph] = {
        trigraph,
        count: list.length,
        meanTotalFlightTime: this.mean(totalTimes),
        medianTotalFlightTime: this.median(totalTimes),
        stdTotalFlightTime: this.std(totalTimes),
        minTotalFlightTime: Math.min(...totalTimes),
        maxTotalFlightTime: Math.max(...totalTimes),
      };
    }
    return stats;
  }

  private mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    if (arr.length % 2 === 0) {
      return (arr[mid - 1]! + arr[mid]!) / 2;
    }
    return arr[mid]!;
  }

  private std(arr: number[]): number {
    if (arr.length < 2) return 0;
    const m = this.mean(arr);
    const sum = arr.reduce((a, b) => a + Math.pow(b - m, 2), 0);
    return Math.sqrt(sum / arr.length);
  }
}
