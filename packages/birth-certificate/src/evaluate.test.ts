import { describe, expect, it } from "vitest";
import {
  applyExplicitBirthJurisdiction,
  evaluateBirthCertificate,
  jurisdictions,
} from "./index";

const asOf = { asOf: "2026-11-27" };

describe("US birth certificate routing", () => {
  it("lists every CDC jurisdiction once and stores no fees or ID numbers", () => {
    const ids = jurisdictions.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "oh",
        "tx",
        "ny-state",
        "nyc",
        "dc",
        "pr",
        "gu",
        "canal-zone",
        "foreign",
        "born-abroad",
      ]),
    );
    const serialized = JSON.stringify(jurisdictions);
    expect(serialized).not.toMatch(/\$\d/);
    expect(serialized).not.toMatch(/social security|ssn/i);
    for (const item of jurisdictions) {
      if (item.id === "born-abroad") {
        expect(item.lookup.url).toBe("https://www.usa.gov/birth-certificate");
      } else {
        expect(item.lookup.url).toMatch(
          /^https:\/\/www\.cdc\.gov\/nchs\/w2w\/[a-z_]+\.htm$/,
        );
      }
    }
  });

  it("asks where the birth was registered before it names an office", () => {
    const result = evaluateBirthCertificate({}, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.destination).toBeNull();
    expect(result.compare).toBeNull();
    expect(result.sandbox.missing.map((item) => item.question).join(" ")).toMatch(
      /where the birth was registered/i,
    );
    expect(result.educate.summary).toMatch(/where the birth was registered/i);
    expect(result.educate.whyJurisdiction).toMatch(/live now/i);
    expect(result.limitations.join(" ")).toMatch(/Social Security numbers/i);
    expect(JSON.stringify(result)).not.toMatch(/ssn|document storage/i);
  });

  it("sends a state to the official lookup and withholds local document rules", () => {
    const result = evaluateBirthCertificate({ birthJurisdictionId: "al" }, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.destination?.kind).toBe("official-lookup");
    expect(result.destination?.coverage).toBe("official-lookup");
    expect(result.destination?.authorityName).toBeNull();
    expect(result.destination?.url).toBe("https://www.cdc.gov/nchs/w2w/alabama.htm");
    expect(result.destination?.alsoSee.map((link) => link.url)).toContain(
      "https://www.usa.gov/birth-certificate",
    );
    expect(result.destination?.withheld.join(" ")).toMatch(/local document requirements/i);
    expect(JSON.stringify(result)).not.toMatch(/\$\d/);
    expect(result.nextStep.text).toMatch(/official lookup/i);
  });

  it("names the reviewed New York City office until the review date passes", () => {
    const current = evaluateBirthCertificate({ birthJurisdictionId: "nyc" }, asOf);
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    expect(current.destination?.kind).toBe("issuing-authority");
    expect(current.destination?.authorityName).toBe(
      "New York City Department of Health and Mental Hygiene",
    );
    expect(current.destination?.url).toBe(
      "https://www.nyc.gov/site/doh/services/birth-death-records-birth.page",
    );
    expect(current.destination?.withheld.join(" ")).toMatch(/local document requirements/i);
    expect(JSON.stringify(current)).not.toMatch(/\$15/);
    expect(current.destination?.review.correctionOwner).toBe("Birth certificate editor");
    expect(current.destination?.review.reviewExpiresOn).toBe("2027-11-27");

    const expired = evaluateBirthCertificate(
      { birthJurisdictionId: "nyc" },
      { asOf: "2028-01-01" },
    );
    expect(expired.ok).toBe(true);
    if (!expired.ok) return;
    expect(expired.destination?.kind).toBe("official-lookup");
    expect(expired.destination?.coverage).toBe("review-expired");
    expect(expired.destination?.authorityName).toBeNull();
    expect(expired.destination?.url).toBe(
      "https://www.cdc.gov/nchs/w2w/new_york_city.htm",
    );
    expect(expired.destination?.url).not.toContain("nyc.gov");
    expect(expired.destination?.title).toMatch(/review expired|official lookup/i);
  });

  it("routes a birth abroad to the State Department until that review expires", () => {
    const current = evaluateBirthCertificate(
      { birthJurisdictionId: "born-abroad" },
      asOf,
    );
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    expect(current.destination?.authorityName).toBe("U.S. Department of State");
    expect(current.destination?.url).toBe(
      "https://travel.state.gov/content/travel/en/replace-certify-docs/requesting-a-record/replace-amend-CRBA.html",
    );

    const expired = evaluateBirthCertificate(
      { birthJurisdictionId: "born-abroad" },
      { asOf: "2028-06-01" },
    );
    expect(expired.ok).toBe(true);
    if (!expired.ok) return;
    expect(expired.destination?.coverage).toBe("review-expired");
    expect(expired.destination?.authorityName).toBeNull();
    expect(expired.destination?.url).toBe("https://www.usa.gov/birth-certificate");
  });

  it("asks which New York office before it routes the request", () => {
    const result = evaluateBirthCertificate({ birthJurisdictionId: "ny" }, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.destination).toBeNull();
    expect(result.sandbox.missing.map((item) => item.question).join(" ")).toMatch(
      /New York City/,
    );
    expect(result.sandbox.missing.map((item) => item.question).join(" ")).toMatch(
      /New York State/,
    );
  });

  it("compares the birth jurisdiction with where the person lives now", () => {
    const result = evaluateBirthCertificate(
      { birthJurisdictionId: "oh", residenceJurisdictionId: "tx" },
      asOf,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.compare?.narrative).toMatch(/Ohio/);
    expect(result.compare?.narrative).toMatch(/Texas/);
    expect(result.compare?.narrative).toMatch(/does not issue/i);
    expect(result.compare?.rows[0]?.cells.birth).toMatch(/official lookup/i);
    expect(result.compare?.rows[0]?.cells.residence).toMatch(/does not issue/i);

    const same = evaluateBirthCertificate(
      { birthJurisdictionId: "tx", residenceJurisdictionId: "tx" },
      asOf,
    );
    expect(same.ok).toBe(true);
    if (!same.ok) return;
    expect(same.compare?.narrative).toMatch(/same jurisdiction/i);
  });

  it("tracks owner, status, and a personal target date that is not an official deadline", () => {
    const result = evaluateBirthCertificate(
      {
        birthJurisdictionId: "oh",
        tasks: [
          {
            key: "confirm-birth-jurisdiction",
            owner: "Sam",
            status: "completed",
          },
          {
            key: "open-official-destination",
            owner: "Sam",
            status: "waiting",
            targetDate: "2026-12-15",
          },
        ],
      },
      asOf,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextStep.key).toBe("open-official-destination");
    expect(result.nextStep.owner).toBe("Sam");
    expect(result.nextStep.status).toBe("waiting");
    expect(result.nextStep.targetDate).toBe("2026-12-15");
    expect(result.nextStep.targetDateMeaning).toMatch(/not an official deadline/i);
    const followUp = result.tasks.find((task) => task.key === "follow-office-instructions");
    expect(followUp?.status).toBe("waiting");
    expect(followUp?.owner).toBe("");
    expect(followUp?.deadlineBasis).toBe("none");
    const dated = result.tasks.find((task) => task.key === "open-official-destination");
    expect(dated?.deadlineBasis).toBe("personal");
    expect(dated?.deadlineNote).toMatch(/not an official deadline/i);
    expect(result.tasks.map((task) => task.key)).toEqual([
      "confirm-birth-jurisdiction",
      "open-official-destination",
      "follow-office-instructions",
    ]);
  });

  it("rejects identification numbers and documents without echoing them", () => {
    const extra = evaluateBirthCertificate(
      { birthJurisdictionId: "oh", ssn: "123-45-6789" },
      asOf,
    );
    expect(extra.ok).toBe(false);
    if (extra.ok) return;
    expect(JSON.stringify(extra)).not.toContain("123-45-6789");
    expect(extra.errors.map((error) => error.message).join(" ")).toMatch(
      /identification numbers|documents/i,
    );

    const owner = evaluateBirthCertificate(
      {
        birthJurisdictionId: "oh",
        tasks: [
          {
            key: "confirm-birth-jurisdiction",
            owner: "123-45-6789",
            status: "waiting",
          },
        ],
      },
      asOf,
    );
    expect(owner.ok).toBe(false);
    if (owner.ok) return;
    expect(JSON.stringify(owner)).not.toContain("123-45-6789");
  });

  it("applies a confirmed birth jurisdiction only when the visitor has not typed one", () => {
    const filled = applyExplicitBirthJurisdiction(
      {},
      { key: "birth-jurisdiction", value: "oh", confirmed: true },
    );
    expect(filled.input.birthJurisdictionId).toBe("oh");
    expect(filled.origins.birthJurisdictionId).toBe("explicit-fact");

    const kept = applyExplicitBirthJurisdiction(
      { birthJurisdictionId: "tx" },
      { key: "birth-jurisdiction", value: "oh", confirmed: true },
    );
    expect(kept.input.birthJurisdictionId).toBe("tx");
    expect(kept.origins.birthJurisdictionId).toBe("current-entry");

    const unconfirmed = applyExplicitBirthJurisdiction(
      {},
      { key: "birth-jurisdiction", value: "oh", confirmed: false },
    );
    expect(unconfirmed.input.birthJurisdictionId).toBeUndefined();
    expect(unconfirmed.origins.birthJurisdictionId).toBeUndefined();
  });
});
