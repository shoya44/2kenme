/**
 * 配列を先頭から `chunkSize` 件ずつに区切り、各ブロック内でのみシャッフルする。
 *
 * HotPepperのおすすめ順（評判の良さと近さを反映した順序）を大枠で維持しつつ、
 * 同じ条件で毎回まったく同じ順序にならないようにする（FE-001 §19）。
 *
 * 元の配列は変更しない。
 */
export function shuffleInChunks<T>(items: readonly T[], chunkSize: number): T[] {
  if (chunkSize < 1) {
    throw new Error('chunkSize は1以上である必要があります');
  }

  const result = [...items];

  for (let start = 0; start < result.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, result.length);
    // Fisher-Yates をブロック内だけで回す
    for (let i = end - 1; i > start; i--) {
      const j = start + Math.floor(Math.random() * (i - start + 1));
      [result[i], result[j]] = [result[j] as T, result[i] as T];
    }
  }

  return result;
}
