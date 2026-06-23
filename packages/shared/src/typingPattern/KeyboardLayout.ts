import { KeyPosition, DigraphPhysicalFeatures } from '../types/typingPattern.js';

/**
 * 標準的なUS QWERTYキーボードの物理位置マッピング
 * 
 * 行(row)の定義:
 * 0: 数字行 (`1234567890-=`)
 * 1: 上段 (`qwertyuiop[]\`)
 * 2: 中段 (`asdfghjkl;'`)
 * 3: 下段 (`zxcvbnm,./`)
 * 4: スペース行
 * 
 * 列(col)は各行の左端を基準にした実数座標。行ごとのズレ（stagger）を考慮。
 */
export const QWERTY_LAYOUT: Record<string, KeyPosition> = {
  // Row 0 (Numbers)
  '`': { row: 0, col: 0, hand: 'left', finger: 'pinky' },
  '1': { row: 0, col: 1, hand: 'left', finger: 'pinky' },
  '2': { row: 0, col: 2, hand: 'left', finger: 'ring' },
  '3': { row: 0, col: 3, hand: 'left', finger: 'middle' },
  '4': { row: 0, col: 4, hand: 'left', finger: 'index' },
  '5': { row: 0, col: 5, hand: 'left', finger: 'index' },
  '6': { row: 0, col: 6, hand: 'right', finger: 'index' },
  '7': { row: 0, col: 7, hand: 'right', finger: 'index' },
  '8': { row: 0, col: 8, hand: 'right', finger: 'middle' },
  '9': { row: 0, col: 9, hand: 'right', finger: 'ring' },
  '0': { row: 0, col: 10, hand: 'right', finger: 'pinky' },
  '-': { row: 0, col: 11, hand: 'right', finger: 'pinky' },
  '=': { row: 0, col: 12, hand: 'right', finger: 'pinky' },

  // Row 1 (QWERTY)
  'q': { row: 1, col: 1.5, hand: 'left', finger: 'pinky' },
  'w': { row: 1, col: 2.5, hand: 'left', finger: 'ring' },
  'e': { row: 1, col: 3.5, hand: 'left', finger: 'middle' },
  'r': { row: 1, col: 4.5, hand: 'left', finger: 'index' },
  't': { row: 1, col: 5.5, hand: 'left', finger: 'index' },
  'y': { row: 1, col: 6.5, hand: 'right', finger: 'index' },
  'u': { row: 1, col: 7.5, hand: 'right', finger: 'index' },
  'i': { row: 1, col: 8.5, hand: 'right', finger: 'middle' },
  'o': { row: 1, col: 9.5, hand: 'right', finger: 'ring' },
  'p': { row: 1, col: 10.5, hand: 'right', finger: 'pinky' },
  '[': { row: 1, col: 11.5, hand: 'right', finger: 'pinky' },
  ']': { row: 1, col: 12.5, hand: 'right', finger: 'pinky' },
  '\\': { row: 1, col: 13.5, hand: 'right', finger: 'pinky' },

  // Row 2 (ASDF)
  'a': { row: 2, col: 1.75, hand: 'left', finger: 'pinky' },
  's': { row: 2, col: 2.75, hand: 'left', finger: 'ring' },
  'd': { row: 2, col: 3.75, hand: 'left', finger: 'middle' },
  'f': { row: 2, col: 4.75, hand: 'left', finger: 'index' },
  'g': { row: 2, col: 5.75, hand: 'left', finger: 'index' },
  'h': { row: 2, col: 6.75, hand: 'right', finger: 'index' },
  'j': { row: 2, col: 7.75, hand: 'right', finger: 'index' },
  'k': { row: 2, col: 8.75, hand: 'right', finger: 'middle' },
  'l': { row: 2, col: 9.75, hand: 'right', finger: 'ring' },
  ';': { row: 2, col: 10.75, hand: 'right', finger: 'pinky' },
  '\'': { row: 2, col: 11.75, hand: 'right', finger: 'pinky' },

  // Row 3 (ZXCV)
  'z': { row: 3, col: 2.25, hand: 'left', finger: 'pinky' },
  'x': { row: 3, col: 3.25, hand: 'left', finger: 'ring' },
  'c': { row: 3, col: 4.25, hand: 'left', finger: 'middle' },
  'v': { row: 3, col: 5.25, hand: 'left', finger: 'index' },
  'b': { row: 3, col: 6.25, hand: 'left', finger: 'index' },
  'n': { row: 3, col: 7.25, hand: 'right', finger: 'index' },
  'm': { row: 3, col: 8.25, hand: 'right', finger: 'index' },
  ',': { row: 3, col: 9.25, hand: 'right', finger: 'middle' },
  '.': { row: 3, col: 10.25, hand: 'right', finger: 'ring' },
  '/': { row: 3, col: 11.25, hand: 'right', finger: 'pinky' },

  // Row 4 (Space)
  ' ': { row: 4, col: 5.5, hand: 'both', finger: 'thumb' },
};

/**
 * 2つの文字（Digraph）から物理特徴量を計算する
 */
export function getDigraphFeatures(char1: string, char2: string): DigraphPhysicalFeatures | null {
  const c1 = char1.toLowerCase();
  const c2 = char2.toLowerCase();

  const pos1 = QWERTY_LAYOUT[c1];
  const pos2 = QWERTY_LAYOUT[c2];

  if (!pos1 || !pos2) {
    return null;
  }

  // ユークリッド距離
  const distance = Math.sqrt(
    Math.pow(pos1.col - pos2.col, 2) + Math.pow(pos1.row - pos2.row, 2)
  );

  const isSameHand = pos1.hand !== 'both' && pos1.hand === pos2.hand;
  // 親指は左右どちらでも使えるため特殊だが、基本は同じ手・同じ指かどうかを厳密判定
  const isSameFinger = isSameHand && pos1.finger === pos2.finger;
  const hasRowChange = pos1.row !== pos2.row;

  return {
    distance,
    isSameHand,
    isSameFinger,
    hasRowChange,
    hand1: pos1.hand,
    hand2: pos2.hand,
  };
}
