export type JurisdictionKind =
  | "state"
  | "district"
  | "territory"
  | "city"
  | "historical"
  | "abroad"
  | "other";

export type Jurisdiction = {
  id: string;
  name: string;
  kind: JurisdictionKind;
  lookup: {
    title: string;
    url: string;
    publisher: string;
    sourceReviewedOn: string;
  };
  authority?: {
    name: string;
    url: string;
    checkedOn: string;
    reviewExpiresOn: string;
    correctionOwner: string;
  };
  note?: string;
};

const CDC_DIRECTORY_REVIEWED_ON = "2022-08-15";
const USAGOV_BIRTH = "https://www.usa.gov/birth-certificate";
const USAGOV_UPDATED = "2025-11-17";
const EDITOR = "Birth certificate editor";
const REVIEWED_ON = "2026-11-27";
const REVIEW_EXPIRES = "2027-11-27";

function cdcLookup(name: string, slug: string): Jurisdiction["lookup"] {
  return {
    title: `Where to Write for Vital Records — ${name}`,
    url: `https://www.cdc.gov/nchs/w2w/${slug}.htm`,
    publisher: "CDC National Center for Health Statistics",
    sourceReviewedOn: CDC_DIRECTORY_REVIEWED_ON,
  };
}

function state(id: string, name: string, slug: string): Jurisdiction {
  return { id, name, kind: "state", lookup: cdcLookup(name, slug) };
}

const states: Jurisdiction[] = [
  state("al", "Alabama", "alabama"),
  state("ak", "Alaska", "alaska"),
  state("az", "Arizona", "arizona"),
  state("ar", "Arkansas", "arkansas"),
  state("ca", "California", "california"),
  state("co", "Colorado", "colorado"),
  state("ct", "Connecticut", "connecticut"),
  state("de", "Delaware", "delaware"),
  state("fl", "Florida", "florida"),
  state("ga", "Georgia", "georgia"),
  state("hi", "Hawaii", "hawaii"),
  state("id", "Idaho", "idaho"),
  state("il", "Illinois", "illinois"),
  state("in", "Indiana", "indiana"),
  state("ia", "Iowa", "iowa"),
  state("ks", "Kansas", "kansas"),
  state("ky", "Kentucky", "kentucky"),
  state("la", "Louisiana", "louisiana"),
  state("me", "Maine", "maine"),
  state("md", "Maryland", "maryland"),
  state("ma", "Massachusetts", "massachusetts"),
  state("mi", "Michigan", "michigan"),
  state("mn", "Minnesota", "minnesota"),
  state("ms", "Mississippi", "mississippi"),
  state("mo", "Missouri", "missouri"),
  state("mt", "Montana", "montana"),
  state("ne", "Nebraska", "nebraska"),
  state("nv", "Nevada", "nevada"),
  state("nh", "New Hampshire", "new_hampshire"),
  state("nj", "New Jersey", "new_jersey"),
  state("nm", "New Mexico", "new_mexico"),
  state("ny-state", "New York State", "new_york"),
  state("nc", "North Carolina", "north_carolina"),
  state("nd", "North Dakota", "north_dakota"),
  state("oh", "Ohio", "ohio"),
  state("ok", "Oklahoma", "oklahoma"),
  state("or", "Oregon", "oregon"),
  state("pa", "Pennsylvania", "pennsylvania"),
  state("ri", "Rhode Island", "rhode_island"),
  state("sc", "South Carolina", "south_carolina"),
  state("sd", "South Dakota", "south_dakota"),
  state("tn", "Tennessee", "tennessee"),
  state("tx", "Texas", "texas"),
  state("ut", "Utah", "utah"),
  state("vt", "Vermont", "vermont"),
  state("va", "Virginia", "virginia"),
  state("wa", "Washington", "washington"),
  state("wv", "West Virginia", "west_virginia"),
  state("wi", "Wisconsin", "wisconsin"),
  state("wy", "Wyoming", "wyoming"),
];

const nyc: Jurisdiction = {
  id: "nyc",
  name: "New York City",
  kind: "city",
  lookup: cdcLookup("New York City", "new_york_city"),
  note: "Bronx, Brooklyn, Manhattan, Queens, and Staten Island.",
  authority: {
    name: "New York City Department of Health and Mental Hygiene",
    url: "https://www.nyc.gov/site/doh/services/birth-death-records-birth.page",
    checkedOn: REVIEWED_ON,
    reviewExpiresOn: REVIEW_EXPIRES,
    correctionOwner: EDITOR,
  },
};

const extras: Jurisdiction[] = [
  {
    id: "dc",
    name: "District of Columbia",
    kind: "district",
    lookup: cdcLookup("District of Columbia", "dc"),
  },
  {
    id: "as",
    name: "American Samoa",
    kind: "territory",
    lookup: cdcLookup("American Samoa", "american_samoa"),
  },
  {
    id: "gu",
    name: "Guam",
    kind: "territory",
    lookup: cdcLookup("Guam", "guam"),
  },
  {
    id: "mp",
    name: "Northern Mariana Islands",
    kind: "territory",
    lookup: cdcLookup("Northern Mariana Islands", "northern_mariana_islands"),
  },
  {
    id: "pr",
    name: "Puerto Rico",
    kind: "territory",
    lookup: cdcLookup("Puerto Rico", "puerto_rico"),
  },
  {
    id: "vi",
    name: "U.S. Virgin Islands",
    kind: "territory",
    lookup: cdcLookup("U.S. Virgin Islands", "virgin_islands"),
  },
  {
    id: "canal-zone",
    name: "Canal Zone",
    kind: "historical",
    lookup: cdcLookup("Canal Zone", "canal_zone"),
    note: "The CDC directory still lists historical Panama Canal Zone births.",
  },
  {
    id: "foreign",
    name: "Foreign or high-seas events",
    kind: "other",
    lookup: cdcLookup("Foreign or high-seas events", "foreign"),
    note: "This is not a Consular Report of Birth Abroad. Choose born abroad if that is the record you need.",
  },
  {
    id: "born-abroad",
    name: "Born abroad to a U.S. citizen parent",
    kind: "abroad",
    lookup: {
      title: "How to get a certified copy of a U.S. birth certificate",
      url: USAGOV_BIRTH,
      publisher: "USAGov",
      sourceReviewedOn: USAGOV_UPDATED,
    },
    note: "A Consular Report of Birth Abroad is issued by the U.S. Department of State, not by a state vital records office.",
    authority: {
      name: "U.S. Department of State",
      url: "https://travel.state.gov/content/travel/en/replace-certify-docs/requesting-a-record/replace-amend-CRBA.html",
      checkedOn: REVIEWED_ON,
      reviewExpiresOn: REVIEW_EXPIRES,
      correctionOwner: EDITOR,
    },
  },
];

export const jurisdictions: Jurisdiction[] = [...states, nyc, ...extras].sort((a, b) =>
  a.name.localeCompare(b.name),
);

export const jurisdictionById = new Map(jurisdictions.map((item) => [item.id, item]));

export const USA_GOV_BIRTH_CERTIFICATE = {
  title: "How to get a certified copy of a U.S. birth certificate",
  url: USAGOV_BIRTH,
  reviewedOn: USAGOV_UPDATED,
};

export const CDC_VITAL_RECORDS_INDEX = {
  title: "Where to Write for Vital Records",
  url: "https://www.cdc.gov/nchs/w2w/index.htm",
  reviewedOn: CDC_DIRECTORY_REVIEWED_ON,
};
