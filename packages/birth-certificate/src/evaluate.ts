import {
  CDC_VITAL_RECORDS_INDEX,
  jurisdictionById,
  USA_GOV_BIRTH_CERTIFICATE,
  type Jurisdiction,
} from "./jurisdictions";
import {
  birthCertificateInputSchema,
  isIsoDate,
  looksLikeIdentificationNumber,
  rejectSensitiveKeys,
  TASK_KEYS,
  type BirthCertificateInput,
  type FieldError,
  type TaskKey,
} from "./schema";

export const TOOL_ID = "us-birth-certificate";
export const TOOL_VERSION = "1.0.0";

const PERSONAL_DATE =
  "A target date is your personal reminder. It is not an official deadline.";

const LIMITATIONS = [
  "This guide does not collect or store Social Security numbers, identity documents, or a copy of the certificate.",
  "Local document requirements, fees, and ID rules stay on the official page. This release does not copy them.",
  PERSONAL_DATE,
];

export type ChecklistTask = {
  key: TaskKey;
  label: string;
  owner: string;
  status: "waiting" | "completed";
  targetDate: string | null;
  deadlineBasis: "personal" | "none";
  deadlineNote: string;
};

export type BirthDestination = {
  kind: "issuing-authority" | "official-lookup";
  coverage: "reviewed-authority" | "official-lookup" | "review-expired";
  title: string;
  authorityName: string | null;
  url: string;
  alsoSee: { title: string; url: string }[];
  review: {
    checkedOn: string | null;
    reviewExpiresOn: string | null;
    sourceReviewedOn: string | null;
    correctionOwner: string;
  };
  withheld: string[];
};

export type BirthSuccess = {
  ok: true;
  toolId: typeof TOOL_ID;
  toolVersion: typeof TOOL_VERSION;
  asOf: string;
  educate: {
    summary: string;
    whyJurisdiction: string;
    assumptions: string[];
    limitations: string[];
    sources: { title: string; url: string; reviewedOn: string; role: string }[];
  };
  sandbox: { missing: { path: string; question: string }[] };
  compare: null | {
    periodLabel: string;
    columns: { id: string; name: string }[];
    rows: { id: string; label: string; cells: Record<string, string> }[];
    narrative: string;
  };
  destination: BirthDestination | null;
  nextStep: {
    key: TaskKey | null;
    text: string;
    owner: string | null;
    status: "waiting" | "completed" | null;
    targetDate: string | null;
    targetDateMeaning: string;
  };
  tasks: ChecklistTask[];
  limitations: string[];
};

export type BirthFailure = {
  ok: false;
  toolId: typeof TOOL_ID;
  toolVersion: typeof TOOL_VERSION;
  errors: FieldError[];
};

export type BirthEvaluation = BirthSuccess | BirthFailure;

export function evaluateBirthCertificate(
  raw: unknown,
  context: { asOf: string },
): BirthEvaluation {
  if (!isIsoDate(context?.asOf)) {
    return failure([{ path: "asOf", message: "Enter the date for this check as YYYY-MM-DD." }]);
  }
  const sensitive = rejectSensitiveKeys(raw);
  if (sensitive) return failure([sensitive]);
  const parsed = birthCertificateInputSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return failure(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "input",
        message: issue.message,
      })),
    );
  }
  const taskErrors = validateTasks(parsed.data);
  if (taskErrors.length > 0) return failure(taskErrors);
  return succeed(parsed.data, context.asOf);
}

function succeed(input: BirthCertificateInput, asOf: string): BirthSuccess {
  const missing: { path: string; question: string }[] = [];
  const birth = resolvePlace(input.birthJurisdictionId, "birthJurisdictionId", missing, asOf);
  const residence = resolvePlace(
    input.residenceJurisdictionId,
    "residenceJurisdictionId",
    missing,
    asOf,
  );
  if (!input.residenceJurisdictionId && birth.destination) {
    missing.push({
      path: "residenceJurisdictionId",
      question:
        "Where do you live now? This does not change the office. It shows why another state is not where you start.",
    });
  }
  const tasks = buildTasks(input, birth.jurisdiction, birth.destination);
  const waiting = tasks.find((task) => task.status === "waiting") ?? null;
  const nextStep = waiting
    ? {
        key: waiting.key,
        text: nextStepText(waiting, birth.destination),
        owner: waiting.owner || null,
        status: waiting.status,
        targetDate: waiting.targetDate,
        targetDateMeaning: PERSONAL_DATE,
      }
    : {
        key: null,
        text: birth.destination
          ? "No step is waiting. You can reopen the official page if you still need the certificate."
          : "Choose where the birth was registered.",
        owner: null,
        status: null,
        targetDate: null,
        targetDateMeaning: PERSONAL_DATE,
      };

  return {
    ok: true,
    toolId: TOOL_ID,
    toolVersion: TOOL_VERSION,
    asOf,
    educate: {
      summary:
        "A replacement starts where the birth was registered. This guide names that office or the official lookup, then tracks your next step.",
      whyJurisdiction:
        "The certificate comes from the place the birth was registered. The state where you live now does not replace a record from somewhere else.",
      assumptions: [
        "You need the city or county of birth only so you can match the right office. Dayfolio does not ask you to store that detail.",
        "National routing uses USAGov. State-by-state directory links use the CDC Where to Write for Vital Records index.",
      ],
      limitations: LIMITATIONS,
      sources: [
        {
          title: USA_GOV_BIRTH_CERTIFICATE.title,
          url: USA_GOV_BIRTH_CERTIFICATE.url,
          reviewedOn: USA_GOV_BIRTH_CERTIFICATE.reviewedOn,
          role: "National routing",
        },
        {
          title: CDC_VITAL_RECORDS_INDEX.title,
          url: CDC_VITAL_RECORDS_INDEX.url,
          reviewedOn: CDC_VITAL_RECORDS_INDEX.reviewedOn,
          role: "Jurisdiction directory",
        },
      ],
    },
    sandbox: { missing },
    compare: buildCompare(birth, residence),
    destination: birth.destination,
    nextStep,
    tasks,
    limitations: LIMITATIONS,
  };
}

function resolvePlace(
  id: string | undefined,
  path: string,
  missing: { path: string; question: string }[],
  asOf: string,
): { jurisdiction: Jurisdiction | null; destination: BirthDestination | null } {
  if (!id) {
    if (path === "birthJurisdictionId") {
      missing.push({
        path,
        question:
          "Choose where the birth was registered. Use the state, city, or territory, not where you live now.",
      });
    }
    return { jurisdiction: null, destination: null };
  }
  if (id === "ny") {
    missing.push({
      path,
      question:
        "Was the birth in New York City (Bronx, Brooklyn, Manhattan, Queens, or Staten Island), or elsewhere in New York State?",
    });
    return { jurisdiction: null, destination: null };
  }
  if (id === "unsure") {
    return {
      jurisdiction: null,
      destination: {
        kind: "official-lookup",
        coverage: "official-lookup",
        title: "Official lookup",
        authorityName: null,
        url: USA_GOV_BIRTH_CERTIFICATE.url,
        alsoSee: [CDC_VITAL_RECORDS_INDEX],
        review: {
          checkedOn: null,
          reviewExpiresOn: null,
          sourceReviewedOn: USA_GOV_BIRTH_CERTIFICATE.reviewedOn,
          correctionOwner: "Birth certificate editor",
        },
        withheld: ["Local document requirements"],
      },
    };
  }
  const jurisdiction = jurisdictionById.get(id);
  if (!jurisdiction) {
    missing.push({ path, question: "Choose a place from the list." });
    return { jurisdiction: null, destination: null };
  }
  return { jurisdiction, destination: destinationForJurisdiction(jurisdiction, asOf) };
}

function destinationFor(jurisdiction: Jurisdiction): BirthDestination {
  const withheld = ["Local document requirements"];
  const authority = jurisdiction.authority;
  const lookupLink = { title: jurisdiction.lookup.title, url: jurisdiction.lookup.url };
  const national = { title: USA_GOV_BIRTH_CERTIFICATE.title, url: USA_GOV_BIRTH_CERTIFICATE.url };
  if (!authority) {
    return {
      kind: "official-lookup",
      coverage: "official-lookup",
      title: `Official lookup for ${jurisdiction.name}`,
      authorityName: null,
      url: jurisdiction.lookup.url,
      alsoSee: jurisdiction.lookup.url === national.url ? [] : [national],
      review: {
        checkedOn: "2026-11-27",
        reviewExpiresOn: null,
        sourceReviewedOn: jurisdiction.lookup.sourceReviewedOn,
        correctionOwner: "Birth certificate editor",
      },
      withheld,
    };
  }
  return {
    kind: "issuing-authority",
    coverage: "reviewed-authority",
    title: authority.name,
    authorityName: authority.name,
    url: authority.url,
    alsoSee: [lookupLink, national].filter((link, index, list) => {
      return list.findIndex((item) => item.url === link.url) === index && link.url !== authority.url;
    }),
    review: {
      checkedOn: authority.checkedOn,
      reviewExpiresOn: authority.reviewExpiresOn,
      sourceReviewedOn: jurisdiction.lookup.sourceReviewedOn,
      correctionOwner: authority.correctionOwner,
    },
    withheld,
  };
}

function destinationForExpired(jurisdiction: Jurisdiction): BirthDestination {
  const current = destinationFor({ ...jurisdiction, authority: undefined });
  return {
    ...current,
    coverage: "review-expired",
    title: "Official lookup. The reviewed office link’s review expired.",
    authorityName: null,
  };
}

function destinationForJurisdiction(jurisdiction: Jurisdiction, asOf: string): BirthDestination {
  const authority = jurisdiction.authority;
  if (authority && asOf <= authority.reviewExpiresOn) return destinationFor(jurisdiction);
  if (authority) return destinationForExpired(jurisdiction);
  return destinationFor(jurisdiction);
}

function buildTasks(
  input: BirthCertificateInput,
  jurisdiction: Jurisdiction | null,
  destination: BirthDestination | null,
): ChecklistTask[] {
  const overlays = new Map((input.tasks ?? []).map((task) => [task.key, task]));
  const place = jurisdiction?.name;
  const labels: Record<TaskKey, string> = {
    "confirm-birth-jurisdiction": place
      ? `Confirm the birth was registered in ${place}, not where you live now.`
      : "Confirm where the birth was registered.",
    "open-official-destination":
      destination?.kind === "issuing-authority"
        ? "Open the issuing authority’s page and start the request there."
        : "Open the official lookup and start the request there.",
    "follow-office-instructions":
      "Follow the office’s current instructions. Do not send an ID number or a document to Dayfolio.",
  };
  return TASK_KEYS.map((key) => {
    const overlay = overlays.get(key);
    const targetDate = overlay?.targetDate ?? null;
    return {
      key,
      label: labels[key],
      owner: overlay?.owner?.trim() ?? "",
      status: overlay?.status ?? "waiting",
      targetDate,
      deadlineBasis: targetDate ? "personal" : "none",
      deadlineNote: PERSONAL_DATE,
    };
  });
}

function nextStepText(task: ChecklistTask, destination: BirthDestination | null): string {
  if (!destination) return task.label;
  const where =
    destination.kind === "official-lookup" ? "the official lookup" : destination.authorityName;
  return `${task.label} Destination: ${where}.`;
}

function buildCompare(
  birth: { jurisdiction: Jurisdiction | null; destination: BirthDestination | null },
  residence: { jurisdiction: Jurisdiction | null; destination: BirthDestination | null },
): BirthSuccess["compare"] {
  if (!birth.destination || !birth.jurisdiction || !residence.jurisdiction) return null;
  const same = birth.jurisdiction.id === residence.jurisdiction.id;
  const birthCell =
    birth.destination.kind === "official-lookup"
      ? "Official lookup"
      : (birth.destination.authorityName ?? "Issuing authority");
  return {
    periodLabel: "Where to start a replacement",
    columns: [
      { id: "birth", name: "Where the birth was registered" },
      { id: "residence", name: "Where you live now" },
    ],
    rows: [
      {
        id: "destination",
        label: "Who can issue this certificate",
        cells: {
          birth: birthCell,
          residence: same ? "Same office" : "Does not issue this certificate",
        },
      },
    ],
    narrative: same
      ? `You live in the same jurisdiction where the birth was registered. Start with ${birth.jurisdiction.name}.`
      : `Start the request in ${birth.jurisdiction.name}. Living in ${residence.jurisdiction.name} does not move the record. ${residence.jurisdiction.name} does not issue this certificate.`,
  };
}

function validateTasks(input: BirthCertificateInput): FieldError[] {
  const errors: FieldError[] = [];
  const seen = new Set<string>();
  for (const task of input.tasks ?? []) {
    if (seen.has(task.key)) {
      errors.push({ path: "tasks", message: "Each checklist step can appear only once." });
    }
    seen.add(task.key);
    const owner = task.owner?.trim() ?? "";
    if (owner && looksLikeIdentificationNumber(owner)) {
      errors.push({
        path: "tasks.owner",
        message: "Enter a name or role for the owner. Do not enter an identification number.",
      });
    }
    if (task.targetDate && !isIsoDate(task.targetDate)) {
      errors.push({
        path: "tasks.targetDate",
        message: "Enter your target date as YYYY-MM-DD. It is a personal reminder, not an official deadline.",
      });
    }
  }
  return errors;
}

function failure(errors: FieldError[]): BirthFailure {
  return { ok: false, toolId: TOOL_ID, toolVersion: TOOL_VERSION, errors };
}

export function applyExplicitBirthJurisdiction(
  input: BirthCertificateInput,
  fact: { key: string; value: string; confirmed: boolean },
): {
  input: BirthCertificateInput;
  origins: { birthJurisdictionId?: "explicit-fact" | "current-entry" };
} {
  if (fact.key !== "birth-jurisdiction") return { input, origins: {} };
  if (input.birthJurisdictionId !== undefined) {
    return { input, origins: { birthJurisdictionId: "current-entry" } };
  }
  if (!fact.confirmed) return { input, origins: {} };
  return {
    input: { ...input, birthJurisdictionId: fact.value },
    origins: { birthJurisdictionId: "explicit-fact" },
  };
}
