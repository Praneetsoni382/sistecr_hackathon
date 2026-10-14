// Deterministic Field Similarity & Variance Calculation Engine
// Uses Normalized Levenshtein Distance, Jaccard Token Coherence, and Relative Numeric Delta

export interface FieldSimilarityResult {
  matchScore: number; // 0 to 100
  mismatchScore: number; // 0 to 100
  status: "EXACT_MATCH" | "HIGH_SIMILARITY" | "MINOR_MISMATCH" | "MAJOR_MISMATCH" | "SINGLE_SOURCE" | "NIL_ABSENT";
  statusLabel: string;
  statusColor: string;
  badgeColor: string;
  breakdownText: string;
  isNumeric: boolean;
  deltaDescription?: string;
}

// Compute Levenshtein Edit Distance
export function computeLevenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

// Compute Jaccard Word Token Similarity for Multi-word String Fields
export function computeJaccardTokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().trim().split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.toLowerCase().trim().split(/\s+/).filter(Boolean));

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersection++;
  });

  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

// Clean and Normalize String
function normalizeString(val: string): string {
  return val
    .toLowerCase()
    .replace(/[\s\/-_.,]/g, "")
    .trim();
}

// Extract numeric value from area or numeric field
function extractNumber(val: string): number | null {
  const match = val.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = parseFloat(match[0]);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Deterministically evaluates the percentage similarity and variance between an extracted value
 * and an existing baseline record value.
 */
export function calculateFieldSimilarity(
  extRaw: string | null | undefined,
  existRaw: string | null | undefined,
  fieldKey?: string
): FieldSimilarityResult {
  const isExtNil =
    !extRaw ||
    extRaw.trim() === "" ||
    extRaw.toLowerCase() === "nil" ||
    extRaw.toLowerCase() === "null" ||
    extRaw.toLowerCase() === "n/a" ||
    extRaw.toLowerCase() === "not available" ||
    extRaw.toLowerCase() === "not present";

  const isExistNil =
    !existRaw ||
    existRaw.trim() === "" ||
    existRaw.toLowerCase() === "nil" ||
    existRaw.toLowerCase() === "null" ||
    existRaw.toLowerCase() === "n/a" ||
    existRaw.toLowerCase() === "not available" ||
    existRaw.toLowerCase() === "not present";

  // Case 1: Both values are nil or absent
  if (isExtNil && isExistNil) {
    return {
      matchScore: 100,
      mismatchScore: 0,
      status: "NIL_ABSENT",
      statusLabel: "NIL IN BOTH RECORDS",
      statusColor: "text-muted-foreground italic text-xs",
      badgeColor: "bg-muted text-muted-foreground border-border",
      breakdownText: "Both extraction and registry baseline are unstated (nil).",
      isNumeric: false,
    };
  }

  // Case 2: Present in extracted document, absent in registry baseline
  if (!isExtNil && isExistNil) {
    return {
      matchScore: 100,
      mismatchScore: 0,
      status: "SINGLE_SOURCE",
      statusLabel: "SINGLE SOURCE (EXTRACTION)",
      statusColor: "text-blue-600 dark:text-blue-400 font-semibold",
      badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
      breakdownText: "Field present in extracted document only; baseline is unstated.",
      isNumeric: false,
    };
  }

  // Case 3: Absent in extracted document, present in registry baseline
  if (isExtNil && !isExistNil) {
    return {
      matchScore: 0,
      mismatchScore: 100,
      status: "MINOR_MISMATCH",
      statusLabel: "ABSENT FROM EXTRACTION",
      statusColor: "text-amber-600 dark:text-amber-400 font-semibold",
      badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      breakdownText: "Registry baseline records value, but source deed extraction is nil.",
      isNumeric: false,
    };
  }

  // Case 4: Both values are present — execute deterministic comparison
  const strExt = String(extRaw).trim();
  const strExist = String(existRaw).trim();

  const normExt = normalizeString(strExt);
  const normExist = normalizeString(strExist);

  // Exact Normalized Match
  if (normExt === normExist) {
    return {
      matchScore: 100,
      mismatchScore: 0,
      status: "EXACT_MATCH",
      statusLabel: "VERIFIED MATCH",
      statusColor: "text-emerald-600 dark:text-emerald-400 font-bold",
      badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      breakdownText: "100% exact character-for-character match.",
      isNumeric: false,
      deltaDescription: "0% variance",
    };
  }

  // Check if both are numeric (e.g. area, survey/khasra numbers or registration numbers)
  const numExt = extractNumber(strExt);
  const numExist = extractNumber(strExist);

  const isAreaField = fieldKey === "area" || fieldKey?.toLowerCase().includes("area");

  if (isAreaField && numExt !== null && numExist !== null) {
    const maxVal = Math.max(Math.abs(numExt), Math.abs(numExist));
    const diff = Math.abs(numExt - numExist);
    const relativeVar = maxVal > 0 ? (diff / maxVal) : 0;

    const matchScore = Math.max(0, Math.min(100, Math.round((1 - relativeVar) * 100)));
    const mismatchScore = 100 - matchScore;

    const deltaUnits = (numExt - numExist).toFixed(3);
    const deltaSign = numExt >= numExist ? `+${deltaUnits}` : `${deltaUnits}`;

    if (matchScore >= 95) {
      return {
        matchScore,
        mismatchScore,
        status: "HIGH_SIMILARITY",
        statusLabel: `${matchScore}% MATCH (${mismatchScore}% VAR)`,
        statusColor: "text-emerald-600 dark:text-emerald-400 font-bold",
        badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        breakdownText: `Minor numeric delta of ${deltaSign} ha (${mismatchScore}% variance).`,
        isNumeric: true,
        deltaDescription: `Delta: ${deltaSign} ha`,
      };
    } else if (matchScore >= 75) {
      return {
        matchScore,
        mismatchScore,
        status: "MINOR_MISMATCH",
        statusLabel: `${matchScore}% MATCH (${mismatchScore}% MISMATCH)`,
        statusColor: "text-amber-600 dark:text-amber-400 font-bold",
        badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
        breakdownText: `Area delta of ${deltaSign} ha (${mismatchScore}% difference).`,
        isNumeric: true,
        deltaDescription: `Delta: ${deltaSign} ha`,
      };
    } else {
      return {
        matchScore,
        mismatchScore,
        status: "MAJOR_MISMATCH",
        statusLabel: `${matchScore}% MATCH (${mismatchScore}% MISMATCH)`,
        statusColor: "text-destructive font-bold",
        badgeColor: "bg-destructive/10 text-destructive border-destructive/30",
        breakdownText: `Significant area discrepancy of ${deltaSign} ha (${mismatchScore}% mismatch).`,
        isNumeric: true,
        deltaDescription: `Delta: ${deltaSign} ha`,
      };
    }
  }

  // String Distance Calculation (Levenshtein + Token Similarity)
  const maxLen = Math.max(normExt.length, normExist.length);
  const editDist = computeLevenshteinDistance(normExt, normExist);

  const levenshteinSimilarity = maxLen > 0 ? (1 - editDist / maxLen) : 1.0;
  const tokenSimilarity = computeJaccardTokenSimilarity(strExt, strExist);

  // Combined score giving 70% weight to Levenshtein character distance and 30% to token overlap
  const combinedRatio = (levenshteinSimilarity * 0.70) + (tokenSimilarity * 0.30);
  const matchScore = Math.max(0, Math.min(100, Math.round(combinedRatio * 100)));
  const mismatchScore = 100 - matchScore;

  const charDiff = editDist;
  const charDiffText = charDiff === 1 ? "1 character difference" : `${charDiff} characters difference`;

  if (matchScore >= 85) {
    return {
      matchScore,
      mismatchScore,
      status: "HIGH_SIMILARITY",
      statusLabel: `${matchScore}% MATCH (${mismatchScore}% MISMATCH)`,
      statusColor: "text-emerald-600 dark:text-emerald-400 font-bold",
      badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      breakdownText: `Minor spelling / typography variance (${charDiffText}).`,
      isNumeric: false,
      deltaDescription: `${charDiffText}`,
    };
  } else if (matchScore >= 60) {
    return {
      matchScore,
      mismatchScore,
      status: "MINOR_MISMATCH",
      statusLabel: `${matchScore}% MATCH (${mismatchScore}% MISMATCH)`,
      statusColor: "text-amber-600 dark:text-amber-400 font-bold",
      badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      breakdownText: `Partial match with ${mismatchScore}% character variance (${charDiffText}).`,
      isNumeric: false,
      deltaDescription: `${charDiffText}`,
    };
  } else {
    return {
      matchScore,
      mismatchScore,
      status: "MAJOR_MISMATCH",
      statusLabel: `${matchScore}% MATCH (${mismatchScore}% MISMATCH)`,
      statusColor: "text-destructive font-bold",
      badgeColor: "bg-destructive/10 text-destructive border-destructive/30",
      breakdownText: `High field mismatch of ${mismatchScore}% (${charDiffText}).`,
      isNumeric: false,
      deltaDescription: `${charDiffText}`,
    };
  }
}
