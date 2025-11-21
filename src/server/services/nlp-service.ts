import {
  Chrono,
  casual as chronoCasual,
  parse as chronoParse,
  type ParsingResult,
} from "chrono-node";
import Fraction from "fraction.js";

export type ListHint = {
  slug?: string;
  id?: string;
  name?: string;
};

export type ParsedReminder = {
  offsetMinutes?: number;
  at?: Date;
};

export type ParsedSchedule = {
  start?: Date | null;
  end?: Date | null;
  deadline?: Date | null;
};

export type ParsedTaskInput = {
  title: string;
  description: string;
  listHint?: ListHint;
  labels: string[];
  schedule?: ParsedSchedule;
  reminders: ParsedReminder[];
  estimateMinutes?: number | null;
};

const chronoInstance = (chronoCasual as Chrono | undefined) ?? new Chrono();

const HASH_REGEX = /#([\p{L}\p{N}_-]+)/gu;
const LIST_SLUG_REGEX = /\bin\s+list:([a-z0-9_-]+)/i;
const LIST_ID_REGEX = /\bin\s+list-id:([a-z0-9_-]+)/i;
const LIST_NAME_REGEX =
  /\bin\s+([^\n#@]+?)(?=(?:\s+#|\s+remind|\s+for|\s+estimate|\s+est\b|$))/i;
const REMINDER_OFFSET_REGEX =
  /remind me\s+([\d\s\/.]+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\s+before/gi;
const ESTIMATE_REGEXPS = [
  /\bfor\s+([\d\s\/.]+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|d|day|days)\b/gi,
  /\best(?:imate)?\s+([\d\s\/.]+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|d|day|days)\b/gi,
];

export function parseTaskInput(raw: string): ParsedTaskInput {
  const description = raw.trim();
  if (!description) {
    return {
      title: "",
      description: "",
      labels: [],
      reminders: [],
      estimateMinutes: null,
    };
  }

  const removals: TextRange[] = [];
  const labels = extractLabels(description, removals);
  const listHint = extractListHint(description, removals);
  const estimateMinutes = extractEstimate(description, removals);
  const reminders = extractReminders(description, removals);
  const schedule = extractSchedule(description);

  const cleanedTitle = buildTitle(description, removals);
  const title = cleanedTitle || description;

  return {
    title,
    description,
    listHint,
    labels,
    schedule,
    reminders,
    estimateMinutes: estimateMinutes ?? null,
  };
}

type TextRange = {
  start: number;
  end: number;
};

function extractLabels(input: string, removals: TextRange[]): string[] {
  const seen = new Set<string>();
  for (const match of input.matchAll(HASH_REGEX)) {
    const label = match[1]?.toLowerCase();
    if (label && !seen.has(label)) {
      seen.add(label);
    }
    if (typeof match.index === "number") {
      removals.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return Array.from(seen);
}

function extractListHint(
  input: string,
  removals: TextRange[]
): ListHint | undefined {
  resetRegex(LIST_SLUG_REGEX);
  resetRegex(LIST_ID_REGEX);
  resetRegex(LIST_NAME_REGEX);

  const slugMatch = LIST_SLUG_REGEX.exec(input);
  const idMatch = LIST_ID_REGEX.exec(input);
  const nameMatch = LIST_NAME_REGEX.exec(input);

  if (nameMatch?.[1] && typeof nameMatch.index === "number") {
    removals.push({
      start: nameMatch.index,
      end: nameMatch.index + nameMatch[0].length,
    });
  }

  if (slugMatch?.[1] && typeof slugMatch.index === "number") {
    removals.push({
      start: slugMatch.index,
      end: slugMatch.index + slugMatch[0].length,
    });
  }

  if (idMatch?.[1] && typeof idMatch.index === "number") {
    removals.push({
      start: idMatch.index,
      end: idMatch.index + idMatch[0].length,
    });
  }

  if (slugMatch?.[1]) {
    return { slug: slugMatch[1].trim().toLowerCase() };
  }

  if (idMatch?.[1]) {
    return { id: idMatch[1].trim() };
  }

  if (nameMatch?.[1]) {
    const name = nameMatch[1].trim();
    if (!name) return undefined;
    return { slug: kebabCase(name), name };
  }

  return undefined;
}

function extractEstimate(
  input: string,
  removals: TextRange[]
): number | undefined {
  let minutesResult: number | undefined;
  for (const regex of ESTIMATE_REGEXPS) {
    resetRegex(regex);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(input))) {
      if (typeof match.index !== "number") continue;
      const minutes = convertToMinutes(match[1], match[2]);
      removals.push({ start: match.index, end: match.index + match[0].length });
      if (
        minutesResult == null &&
        typeof minutes === "number" &&
        Number.isFinite(minutes)
      ) {
        minutesResult = Math.max(1, Math.round(minutes));
      }
    }
  }
  return minutesResult;
}

function extractReminders(
  input: string,
  removals: TextRange[]
): ParsedReminder[] {
  const reminders: ParsedReminder[] = [];
  resetRegex(REMINDER_OFFSET_REGEX);
  for (const match of input.matchAll(REMINDER_OFFSET_REGEX)) {
    if (typeof match.index !== "number") continue;
    const minutes = convertToMinutes(match[1], match[2]);
    removals.push({ start: match.index, end: match.index + match[0].length });
    if (typeof minutes === "number" && Number.isFinite(minutes)) {
      reminders.push({ offsetMinutes: Math.max(1, Math.round(minutes)) });
    }
  }
  return reminders;
}

function extractSchedule(input: string): ParsedSchedule | undefined {
  const results = parseChronoResults(input);
  if (!results.length) return undefined;

  let start: Date | undefined;
  let end: Date | undefined;
  let deadline: Date | undefined;

  for (const result of results) {
    const context = getContextWindow(input, result.index ?? 0);
    if (!deadline && /\b(due|deadline|by)\b/.test(context)) {
      deadline = result.start?.date() ?? deadline;
      continue;
    }

    if (!start) {
      start = result.start?.date() ?? start;
      end = result.end?.date() ?? end;
    }
  }

  if (!start && !end && !deadline) {
    return undefined;
  }

  return { start: start ?? null, end: end ?? null, deadline: deadline ?? null };
}

function buildTitle(input: string, removals: TextRange[]) {
  if (!removals.length) {
    return collapseWhitespace(input);
  }

  const merged = mergeRanges(removals);
  let cursor = 0;
  let output = "";
  for (const range of merged) {
    if (range.start > cursor) {
      output += input.slice(cursor, range.start);
    }
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < input.length) {
    output += input.slice(cursor);
  }

  return collapseWhitespace(output);
}

function resetRegex(regex: RegExp) {
  regex.lastIndex = 0;
}

function mergeRanges(ranges: TextRange[]): TextRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TextRange[] = [];
  for (const range of sorted) {
    if (!merged.length || range.start > merged[merged.length - 1].end) {
      merged.push({ ...range });
    } else {
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        range.end
      );
    }
  }
  return merged;
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getContextWindow(source: string, index: number) {
  const start = Math.max(0, index - 12);
  return source.slice(start, index).toLowerCase();
}

function convertToMinutes(rawValue: string, unit: string) {
  const amount = parseFlexibleNumber(rawValue);
  if (amount == null) return undefined;

  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit.startsWith("m")) {
    return amount;
  }
  if (normalizedUnit.startsWith("h")) {
    return amount * 60;
  }
  if (normalizedUnit.startsWith("d")) {
    return amount * 60 * 24;
  }
  return undefined;
}

function parseFlexibleNumber(value: string) {
  const cleaned = value.replace(/,/g, " ").trim();
  if (!cleaned) return undefined;
  try {
    return new Fraction(cleaned).valueOf();
  } catch {
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
}

function kebabCase(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseChronoResults(input: string): ParsingResult[] {
  try {
    if (typeof chronoInstance.parse === "function") {
      return chronoInstance.parse(input) as ParsingResult[];
    }
  } catch {
    // ignore and fall through
  }

  try {
    if (typeof chronoParse === "function") {
      return chronoParse(input) as ParsingResult[];
    }
  } catch {
    // ignore and fall through
  }

  try {
    const fallback = new Chrono();
    return fallback.parse(input) as ParsingResult[];
  } catch {
    return [];
  }
}
