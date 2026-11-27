export const birthCertificateManifest = {
  id: "us-birth-certificate" as const,
  version: "1.0.0" as const,
  domain: "life-administration",
  question: "How do I replace a U.S. birth certificate?",
  summary:
    "Find the office for the place a birth was registered, then track the next step.",
  aliases: [
    "birth certificate",
    "replace birth certificate",
    "vital record",
    "birth record",
    "born in another state",
  ],
  targets: ["educate", "sandbox", "compare"] as const,
  geographicCoverage: "United States",
  actions: ["compare", "create-task"] as const,
  factBindings: [
    {
      key: "birth-jurisdiction",
      scope: "person",
      type: "jurisdiction",
      required: false,
      apply: "explicit-only",
    },
  ] as const,
  units: [] as const,
};

export const sampleBirthInput = {
  birthJurisdictionId: "oh",
  residenceJurisdictionId: "tx",
};
