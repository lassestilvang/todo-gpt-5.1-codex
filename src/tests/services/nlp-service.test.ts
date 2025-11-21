import { describe, expect, it } from "bun:test";

import { parseTaskInput } from "@/server/services/nlp-service";

describe("nlp-service", () => {
  it("extracts title, list slug, labels, schedule, and reminders", () => {
    const result = parseTaskInput(
      "Plan roadmap in Next Quarter #product #q1 remind me 30m before for 2h"
    );

    expect(result.title).toBe("Plan roadmap");
    expect(result.listHint).toEqual({
      slug: "next-quarter",
      name: "Next Quarter",
    });
    expect(result.labels).toEqual(["product", "q1"]);
    expect(result.reminders).toEqual([{ offsetMinutes: 30 }]);
    expect(result.estimateMinutes).toBe(120);
    expect(result.schedule?.start).toBeInstanceOf(Date);
  });

  it("supports explicit list slug and id hints", () => {
    const result = parseTaskInput(
      "Draft contract in list:sales-deals and in list-id:abc123"
    );

    expect(result.listHint).toEqual({ slug: "sales-deals" });
    expect(result.title).toBe("Draft contract");
  });

  it("extracts estimate phrases and durations", () => {
    const result = parseTaskInput("Write summary for 1.5h estimate 30m");
    expect(result.estimateMinutes).toBe(90);
    expect(result.title).toBe("Write summary");
  });

  it("captures hashtag labels and ignores duplicates", () => {
    const result = parseTaskInput("Ship feature #Design #design #ShipIt");
    expect(result.labels).toEqual(["design", "shipit"]);
  });

  it("detects deadlines and reminders", () => {
    const result = parseTaskInput(
      "Send report due tomorrow remind me 2h before"
    );
    expect(result.schedule?.deadline).toBeInstanceOf(Date);
    expect(result.reminders).toEqual([{ offsetMinutes: 120 }]);
  });

  it("handles empty input gracefully", () => {
    const result = parseTaskInput("   ");

    expect(result.title).toBe("");
    expect(result.description).toBe("");
    expect(result.labels).toEqual([]);
    expect(result.reminders).toEqual([]);
  });
});
