import { describe, expect, it } from "vitest";
import {
  CANONICAL_DISTRICTS,
  extractDistrictAndRole,
  MIN_PROTOCOL_MEMBERS,
  parseProtocolHtml,
  validateProtocolSnapshot,
} from "../../supabase/functions/protocol-scrape/protocol-parser";

const memberHtml = (district: string, index: number) => {
  const title = district === "Menteşe"
    ? "Vali Yardımcısı V. / Menteşe Kaymakamı"
    : `${district} Kaymakamı`;
  return `<tr><td>${index}</td><td>${title}</td><td>Kaymakam ${index}</td><td>252 000 ${index}</td><td>252 001 ${index}</td></tr>`;
};

function createCompleteFixture(count: number): string {
  const districtRows = CANONICAL_DISTRICTS.map((district, index) => memberHtml(district, index + 1));
  const otherRows = Array.from({ length: count - districtRows.length }, (_, index) =>
    `<tr><td>${index + 14}</td><td>İl Müdürü</td><td>Üye ${index + 14}</td><td>212 0000</td><td></td></tr>`
  );
  return `
    <table><tr><th>Başlık</th><th>Değer</th></tr><tr><td>Yanlış tablo</td><td>Örnek</td></tr></table>
    <table>
      <tr><th>Sıra</th><th>Ünvanı</th><th>Adı Soyadı</th><th>İş Tel</th><th>Faks Tel</th></tr>
      <tr><td colspan="5">İlçe Kaymakamları</td></tr>
      ${districtRows.join("")}
      <tr><td colspan="5">Diğer yöneticiler</td></tr>
      ${otherRows.join("")}
    </table>`;
}

describe("protocol-scrape parser and safety gate", () => {
  it("selects the table by normalized headers and parses canonical district/compound titles", () => {
    const protocol = parseProtocolHtml(createCompleteFixture(13));

    expect(protocol).toHaveLength(13);
    expect(protocol[0]).toMatchObject({
      sira: "1",
      unvan: "Bodrum Kaymakamı",
      isim: "Kaymakam 1",
      telefon: "252 000 1",
      kategori: "İlçe Kaymakamları",
      district: "Bodrum",
      role: "Kaymakam",
    });
    expect(protocol.find((member) => member.district === "Menteşe")).toMatchObject({
      unvan: "Vali Yardımcısı V. / Menteşe Kaymakamı",
      district: "Menteşe",
      role: "Kaymakam",
    });
    expect(validateProtocolSnapshot(protocol, 13).valid).toBe(true);
  });

  it("recognizes canonical district roles in compound Kaymakam and Belediye titles", () => {
    for (const district of CANONICAL_DISTRICTS) {
      expect(extractDistrictAndRole(`Vali Yardımcısı V. / ${district} Kaymakamı`)).toEqual({
        district,
        role: "Kaymakam",
      });
      expect(extractDistrictAndRole(`${district} Belediye Başkanı`)).toEqual({
        district,
        role: "Belediye Başkanı",
      });
    }
  });

  it("classifies provincial and institution leadership roles", () => {
    expect(extractDistrictAndRole("Muğla Valisi")).toEqual({ district: null, role: "Vali" });
    expect(extractDistrictAndRole("Muğla Vali Yardımcısı")).toEqual({
      district: null,
      role: "Vali Yardımcısı",
    });
    expect(extractDistrictAndRole("Milas İlçe Belediye Başkanlığı")).toEqual({
      district: "Milas",
      role: "Belediye Başkanı",
    });
    expect(extractDistrictAndRole("Bodrum İlçe Emniyet Müdürü")).toEqual({
      district: "Bodrum",
      role: "İl Emniyet Müdürü",
    });
  });

  it("ignores repeated header rows instead of counting them as member records", () => {
    const html = createCompleteFixture(13).replace(
      "</tr><tr><td colspan=\"5\">Diğer yöneticiler",
      "</tr><tr><th>Sıra</th><th>Ünvanı</th><th>Adı Soyadı</th><th>İş Tel</th><th>Faks Tel</th></tr><tr><td colspan=\"5\">Diğer yöneticiler"
    );

    expect(parseProtocolHtml(html)).toHaveLength(13);
  });

  it("rejects snapshots below the member threshold even if all district roles are present", () => {
    const protocol = parseProtocolHtml(createCompleteFixture(MIN_PROTOCOL_MEMBERS - 1));
    const result = validateProtocolSnapshot(protocol);

    expect(result.valid).toBe(false);
    expect(result.count).toBe(MIN_PROTOCOL_MEMBERS - 1);
    expect(result.missingKaymakamDistricts).toEqual([]);
    expect(result.reason).toContain(`at least ${MIN_PROTOCOL_MEMBERS}`);
  });

  it("rejects a full-sized but partial scrape when any canonical Kaymakam role is missing", () => {
    const protocol = parseProtocolHtml(createCompleteFixture(MIN_PROTOCOL_MEMBERS))
      .filter((member) => member.district !== "Datça");
    const result = validateProtocolSnapshot(protocol);

    expect(result.valid).toBe(false);
    expect(result.missingKaymakamDistricts).toEqual(["Datça"]);
  });

  it("accepts a complete snapshot once both minimum size and all 13 district roles are met", () => {
    const protocol = parseProtocolHtml(createCompleteFixture(MIN_PROTOCOL_MEMBERS));

    expect(validateProtocolSnapshot(protocol)).toMatchObject({
      valid: true,
      count: MIN_PROTOCOL_MEMBERS,
      uniqueCount: MIN_PROTOCOL_MEMBERS,
      missingKaymakamDistricts: [],
    });
  });

  it("does not let duplicate rows satisfy the minimum unique-member threshold", () => {
    const uniqueMembers = parseProtocolHtml(createCompleteFixture(14));
    const repeatedRows = [
      ...uniqueMembers,
      ...Array.from({ length: MIN_PROTOCOL_MEMBERS - uniqueMembers.length }, () => uniqueMembers[13]),
    ];
    const result = validateProtocolSnapshot(repeatedRows);

    expect(result.count).toBe(MIN_PROTOCOL_MEMBERS);
    expect(result.uniqueCount).toBe(14);
    expect(result.valid).toBe(false);
  });

  it("fails closed when no table has recognizable protocol column headings", () => {
    expect(() => parseProtocolHtml("<table><tr><td>Unrelated content</td></tr></table>"))
      .toThrow("Protocol table with recognizable headers not found");
  });
});
