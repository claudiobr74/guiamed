import { describe, expect, it } from "vitest";
import { clinicalDayRange, clinicalMonthRange, localMidnightUtc } from "@/lib/time/clinical-calendar";

describe("calendário clínico por timezone", () => {
  it("mantém o mesmo dia de Goiânia antes da meia-noite local", () => {
    const range = clinicalDayRange(new Date("2026-09-04T01:00:00.000Z"), "America/Sao_Paulo");
    expect(range.start.toISOString()).toBe("2026-09-03T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-04T03:00:00.000Z");
  });

  it("calcula o mês pelo calendário local e não por UTC", () => {
    const range = clinicalMonthRange(new Date("2026-09-03T12:00:00.000Z"), "America/Sao_Paulo");
    expect(range.start.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("respeita offsets sazonais de outros timezones", () => {
    expect(localMidnightUtc({ year: 2026, month: 7, day: 1 }, "America/New_York").toISOString()).toBe(
      "2026-07-01T04:00:00.000Z",
    );
  });
});
