export const CANONICAL_DISTRICTS = [
  "Bodrum",
  "Datça",
  "Dalaman",
  "Fethiye",
  "Kavaklıdere",
  "Köyceğiz",
  "Marmaris",
  "Menteşe",
  "Milas",
  "Ortaca",
  "Seydikemer",
  "Ula",
  "Yatağan",
] as const;

// 350 unique rows is ~85% of the expected 412-member official roster.
export const MIN_PROTOCOL_MEMBERS = 350;

export interface ProtocolRecord {
  sira: string;
  unvan: string;
  isim: string;
  telefon: string;
  faks: string;
  kategori: string;
  district: string | null;
  role: string | null;
}

export interface ProtocolValidation {
  valid: boolean;
  count: number;
  uniqueCount: number;
  missingKaymakamDistricts: string[];
  reason?: string;
}

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
    ccedil: "ç",
    Ccedil: "Ç",
    ouml: "ö",
    Ouml: "Ö",
    uuml: "ü",
    Uuml: "Ü",
    scedil: "ş",
    Scedil: "Ş",
    gbreve: "ğ",
    Gbreve: "Ğ",
    iuml: "ï",
    Iuml: "Ï",
  };
  return value
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => named[name] ?? match)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function cellText(cell: string): string {
  return decodeEntities(cell.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function extractDistrictAndRole(title: string): Pick<ProtocolRecord, "district" | "role"> {
  const normalizedTitle = ` ${normalize(title)} `;
  const district = CANONICAL_DISTRICTS.find((name) =>
    normalizedTitle.includes(` ${normalize(name)} `)
  ) ?? null;
  const roleText = normalizedTitle.trim();
  const roles: Array<[RegExp, string]> = [
    [/\bkaymakam(?:i|ligi|lik)?\b/, "Kaymakam"],
    [/\bbelediye baskan(?:i|ligi|lik)?\b/, "Belediye Başkanı"],
    [/\bvali yardimcisi\b/, "Vali Yardımcısı"],
    [/\bvali(?:si|ligi)?\b/, "Vali"],
    [/\bcumhuriyet bassavcisi\b/, "Cumhuriyet Başsavcısı"],
    [/\bemniyet muduru\b/, "İl Emniyet Müdürü"],
    [/\bil jandarma komutani\b/, "İl Jandarma Komutanı"],
    [/\bil muduru\b/, "İl Müdürü"],
    [/\bmuftu\b/, "Müftü"],
  ];
  const role = roles.find(([pattern]) => pattern.test(roleText))?.[1] ?? null;
  return { district, role };
}

function findHeaderIndexes(cells: string[]): Record<string, number> | null {
  const headers = cells.map(normalize);
  const find = (pattern: RegExp) => headers.findIndex((header) => pattern.test(header));
  const indexes = {
    sira: find(/^(?:sira|sira no|no)$/),
    unvan: find(/^(?:unvan|unvani|gorev|gorevi|title)$/),
    isim: find(/^(?:ad soyad|adi soyadi|isim|name)$/),
    telefon: find(/(?:telefon|tel)/),
    faks: find(/faks|fax/),
  };
  if (indexes.unvan < 0 || indexes.isim < 0 || (indexes.telefon < 0 && indexes.faks < 0)) {
    return null;
  }
  return indexes;
}

function parseTable(tableHtml: string): ProtocolRecord[] | null {
  const rows = tableHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  let headerIndexes: Record<string, number> | null = null;
  let columnCount = 0;
  let category = "";
  const records: ProtocolRecord[] = [];

  for (const row of rows) {
    const cells = row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) ?? [];
    if (!cells.length) continue;
    const texts = cells.map(cellText);

    if (!headerIndexes) {
      const candidate = findHeaderIndexes(texts);
      if (candidate) {
        headerIndexes = candidate;
        columnCount = cells.length;
      }
      continue;
    }
    if (findHeaderIndexes(texts)) continue;

    if (cells.some((cell) => /\bcolspan\s*=/i.test(cell)) || cells.length < columnCount) {
      const label = texts.filter(Boolean).join(" ");
      if (label) category = label;
      continue;
    }

    const at = (index: number) => (index >= 0 ? texts[index] ?? "" : "");
    const unvan = at(headerIndexes.unvan);
    const isim = at(headerIndexes.isim);
    if (!unvan || !isim) continue;

    const { district, role } = extractDistrictAndRole(unvan);
    records.push({
      sira: at(headerIndexes.sira),
      unvan,
      isim,
      telefon: at(headerIndexes.telefon),
      faks: at(headerIndexes.faks),
      kategori: category,
      district,
      role,
    });
  }
  return headerIndexes ? records : null;
}

export function parseProtocolHtml(html: string): ProtocolRecord[] {
  const tables = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? [];
  const candidates = tables
    .map(parseTable)
    .filter((records): records is ProtocolRecord[] => records !== null);
  if (!candidates.length) throw new Error("Protocol table with recognizable headers not found");
  return candidates.reduce((best, current) => current.length > best.length ? current : best);
}

export function validateProtocolSnapshot(
  members: ProtocolRecord[],
  minimum = MIN_PROTOCOL_MEMBERS
): ProtocolValidation {
  const uniqueCount = new Set(members.map(protocolMemberKey)).size;
  const kaymakamDistricts = new Set(
    members
      .filter((member) => member.role === "Kaymakam" && member.district)
      .map((member) => member.district as string)
  );
  const missingKaymakamDistricts = CANONICAL_DISTRICTS.filter(
    (district) => !kaymakamDistricts.has(district)
  );
  const valid = uniqueCount >= minimum && missingKaymakamDistricts.length === 0;
  return {
    valid,
    count: members.length,
    uniqueCount,
    missingKaymakamDistricts: [...missingKaymakamDistricts],
    ...(valid
      ? {}
      : {
          reason: [
            uniqueCount < minimum
              ? `Only ${uniqueCount} unique members of at least ${minimum} parsed (${members.length} rows)`
              : "",
            missingKaymakamDistricts.length
              ? `Missing Kaymakam roles for: ${missingKaymakamDistricts.join(", ")}`
              : "",
          ].filter(Boolean).join("; "),
        }),
  };
}

export function protocolMemberKey(member: ProtocolRecord): string {
  const title = normalize(member.unvan);
  if (member.district && member.role === "Kaymakam") {
    return `district:${normalize(member.district)}|${member.role}`;
  }
  return `${title}|${normalize(member.isim)}`;
}
