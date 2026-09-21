export type ParsedByteRange = {
  start: number;
  end: number;
  partial: boolean;
};

export function parseByteRange(rangeHeader: string | null, size: number): ParsedByteRange | null {
  if (!Number.isFinite(size) || size <= 0) return null;
  if (!rangeHeader) return { start: 0, end: size - 1, partial: false };

  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  let start: number;
  let end: number;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1), partial: true };
}
