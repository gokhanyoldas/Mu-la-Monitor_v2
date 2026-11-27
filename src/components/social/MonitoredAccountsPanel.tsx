import { useState, useEffect, useCallback } from "react";
import { Twitter, Youtube, Instagram, Facebook, Linkedin, Plus, Trash2, RefreshCw, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { formatRelativeTime } from "@/lib/time-utils";

// ── Types ──────────────────────────────────────────────────────────────────
type Platform = "twitter" | "youtube" | "instagram" | "facebook" | "linkedin";

interface Account {
  id: string;
  platform: Platform;
  username: string;
  display_name: string | null;
  channel_id: string | null;
  is_active: boolean;
  last_checked: string | null;
}

// ── Platform Profile URL Helper ────────────────────────────────────────────
export function getPlatformUrl(platform: Platform, username: string): string {
  const clean = username.trim().replace(/^@/, "");
  switch (platform) {
    case "twitter":
      return `https://x.com/${clean}`;
    case "youtube":
      if (clean.startsWith("UC")) {
        return `https://www.youtube.com/channel/${clean}`;
      }
      return `https://www.youtube.com/@${clean}`;
    case "instagram":
      return `https://www.instagram.com/${clean}`;
    case "facebook":
      return `https://www.facebook.com/${clean}`;
    case "linkedin":
      if (clean.startsWith("company/")) {
        return `https://www.linkedin.com/${clean}`;
      }
      return `https://www.linkedin.com/in/${clean}`;
    default:
      return `https://x.com/${clean}`;
  }
}

// ── Pre-configured Muğla Protocol & Media Pack ──────────────────────────────
export const VERIFIED_MUGLA_PACK = [
  // Kamu & Protokol (X / Twitter)
  { platform: "twitter" as const, username: "mugla_valiligi", display_name: "Muğla Valiliği" },
  { platform: "twitter" as const, username: "MuglaBuyuksehir", display_name: "Muğla Büyükşehir Belediyesi" },
  { platform: "twitter" as const, username: "MuglaEmniyet", display_name: "Muğla İl Emniyet Müdürlüğü" },
  { platform: "twitter" as const, username: "MuglaJandarma", display_name: "Muğla İl Jandarma Komutanlığı" },
  { platform: "twitter" as const, username: "BodrumBelediyesi", display_name: "Bodrum Belediyesi" },
  { platform: "twitter" as const, username: "FethiyeBelediye", display_name: "Fethiye Belediyesi" },
  { platform: "twitter" as const, username: "marmarisbld", display_name: "Marmaris Belediyesi" },
  { platform: "twitter" as const, username: "MenteseBel", display_name: "Menteşe Belediyesi" },
  { platform: "twitter" as const, username: "MilasBelediyesi", display_name: "Milas Belediyesi" },
  { platform: "twitter" as const, username: "datcabelediyesi", display_name: "Datça Belediyesi" },
  // Yerel Basın & Haber Portalları (X / Twitter)
  { platform: "twitter" as const, username: "muglagazetesi", display_name: "Muğla Gazetesi" },
  { platform: "twitter" as const, username: "hamlegazetesi", display_name: "Hamle Gazetesi" },
  { platform: "twitter" as const, username: "kenttv", display_name: "Bodrum Kent TV" },
  // Görsel & Video Üreticileri (YouTube Kanalları)
  { platform: "youtube" as const, username: "UCMuglaHaber", display_name: "Muğla Haber TV (YouTube)" },
  { platform: "youtube" as const, username: "UCBodrumKentTV", display_name: "Kent TV Bodrum (YouTube)" },
  { platform: "youtube" as const, username: "UCMuglaBuyuksehir", display_name: "Muğla Büyükşehir TV (YouTube)" },
];

// ── Constants ──────────────────────────────────────────────────────────────
const PLATFORM_META: Record<Platform, {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  color: string;
  note: string;
}> = {
  twitter: {
    label: "X (Twitter)",
    icon: <Twitter size={12} />,
    placeholder: "kullanici_adi (@ olmadan)",
    color: "text-sky-400",
    note: "Nitter üzerinden public tweetler · API gerektirmez",
  },
  youtube: {
    label: "YouTube",
    icon: <Youtube size={12} />,
    placeholder: "UCxxxxxxxxxx (Kanal ID)",
    color: "text-red-400",
    note: "Kanal RSS üzerinden · API gerektirmez",
  },
  instagram: {
    label: "Instagram",
    icon: <Instagram size={12} />,
    placeholder: "kullanici_adi",
    color: "text-pink-400",
    note: "Yakında · Public profil izleme",
  },
  facebook: {
    label: "Facebook",
    icon: <Facebook size={12} />,
    placeholder: "sayfa_adi",
    color: "text-blue-500",
    note: "Yakında · Public sayfa izleme",
  },
  linkedin: {
    label: "LinkedIn",
    icon: <Linkedin size={12} />,
    placeholder: "company/adi veya in/kullanici",
    color: "text-blue-400",
    note: "Yakında · Public profil izleme",
  },
};

const ACTIVE_PLATFORMS: Platform[] = ["twitter", "youtube"];
const SOON_PLATFORMS: Platform[] = ["instagram", "facebook", "linkedin"];

// ── Component ──────────────────────────────────────────────────────────────
export const MonitoredAccountsPanel = () => {
  const { lang } = useTranslation();
  const { canManageData } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPlatform, setNewPlatform] = useState<Platform>("twitter");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchAccounts = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("monitored_accounts")
        .select("*")
        .order("created_at", { ascending: true });

      let currentAccounts = (data as Account[]) || [];

      const existing = new Set(currentAccounts.map((a) => `${a.platform}:${a.username.toLowerCase()}`));
      const missingPack = VERIFIED_MUGLA_PACK.filter(
        (p) => !existing.has(`${p.platform}:${p.username.toLowerCase()}`)
      );

      if (missingPack.length > 0) {
        if (canManageData) {
          const missingToAutoAdd = missingPack.map((p) => ({
            platform: p.platform,
            username: p.username,
            display_name: p.display_name,
            is_active: true,
          }));
          const { data: inserted } = await supabase
            .from("monitored_accounts")
            .insert(missingToAutoAdd)
            .select("*");
          if (inserted && inserted.length > 0) {
            currentAccounts = [...currentAccounts, ...(inserted as Account[])];
          }
        } else {
          // Salt-okunur modda RLS INSERT hatası üretmeden yerel doğrulanmış paketi göster
          const readOnlyPack: Account[] = missingPack.map((p, idx) => ({
            id: `readonly-${p.platform}-${idx}`,
            platform: p.platform,
            username: p.username,
            display_name: p.display_name,
            channel_id: null,
            is_active: true,
            last_checked: null,
          }));
          currentAccounts = [...currentAccounts, ...readOnlyPack];
        }
      }

      setAccounts(currentAccounts);
    } catch {
      // sessiz devam
    } finally {
      setIsLoading(false);
    }
  }, [canManageData]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const addAccount = async () => {
    if (!canManageData || !newUsername.trim()) return;
    setIsSaving(true);
    const row = {
      platform: newPlatform,
      username: newUsername.trim().replace(/^@/, ""),
      display_name: newDisplayName.trim() || null,
      is_active: true,
    };
    const { error } = await supabase.from("monitored_accounts").insert([row]);
    if (error) {
      toast({ title: "Hesap eklenemedi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Hesap eklendi", description: `${row.username} izlemeye alındı` });
      setNewUsername("");
      setNewDisplayName("");
      fetchAccounts();
    }
    setIsSaving(false);
  };

  const toggleActive = async (acc: Account) => {
    if (!canManageData) return;
    await supabase.from("monitored_accounts").update({ is_active: !acc.is_active }).eq("id", acc.id);
    fetchAccounts();
  };

  const deleteAccount = async (id: string) => {
    if (!canManageData) return;
    await supabase.from("monitored_accounts").delete().eq("id", id);
    fetchAccounts();
  };

  if (isLoading) {
    return <div className="text-center py-4 text-[10px] font-mono text-muted-foreground/50">Yükleniyor…</div>;
  }

  const getSafePlatformMeta = (rawPlatform: unknown) => {
    const key = String(rawPlatform ?? "twitter").trim().toLowerCase() as Platform;
    return PLATFORM_META[key] ?? PLATFORM_META.twitter;
  };

  const meta = getSafePlatformMeta(newPlatform);

  return (
    <div className="space-y-3">
      {/* Add new account form (admin/analyst only) */}
      {canManageData ? (
        <div className="border border-border/40 rounded-lg p-2.5 space-y-2">
          <div className="text-[9px] font-mono text-muted-foreground font-bold uppercase tracking-wider">
            Yeni Hesap Ekle (Opsiyonel / Özel Hesap)
          </div>

          {/* Platform selector */}
          <div className="flex flex-wrap gap-1">
            {ACTIVE_PLATFORMS.map((p) => {
              const m = getSafePlatformMeta(p);
              return (
                <button
                  key={p}
                  onClick={() => setNewPlatform(p)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                    newPlatform === p
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/30 bg-muted/5 text-muted-foreground hover:bg-muted/10"
                  }`}
                >
                  <span className={m.color}>{m?.icon}</span>
                  {m.label}
                </button>
              );
            })}
            {SOON_PLATFORMS.map((p) => {
              const m = getSafePlatformMeta(p);
              return (
                <span
                  key={p}
                  title="Yakında"
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono border border-border/20 bg-muted/5 text-muted-foreground/40 cursor-not-allowed"
                >
                  <span>{m?.icon}</span>
                  {m.label}
                  <span className="text-[8px] opacity-60">yakında</span>
                </span>
              );
            })}
          </div>

          {/* Helper note */}
          <div className="text-[8px] font-mono text-muted-foreground/60 italic">{meta.note}</div>

          {/* Inputs */}
          <div className="flex gap-1.5">
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAccount()}
              placeholder={meta.placeholder}
              className="flex-1 min-w-0 px-2 py-1 text-[10px] font-mono bg-muted/10 border border-border/40 rounded focus:outline-none focus:border-primary/50"
            />
            <input
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Görünen ad (opsiyonel)"
              className="flex-1 min-w-0 px-2 py-1 text-[10px] font-mono bg-muted/10 border border-border/40 rounded focus:outline-none focus:border-primary/50"
            />
            <button
              onClick={addAccount}
              disabled={isSaving || !newUsername.trim()}
              className="px-2 py-1 bg-primary/90 hover:bg-primary text-primary-foreground rounded text-[10px] font-mono flex items-center gap-1 disabled:opacity-50"
            >
              <Plus size={10} />
              {isSaving ? "…" : "Ekle"}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-[9px] font-mono text-muted-foreground/70 px-2 py-1 rounded border border-border/30 bg-muted/10">
          Hesap yönetimi için yetkili oturum gereklidir.
        </div>
      )}

      {/* Account list */}
      {accounts.length === 0 ? (
        <div className="text-center py-4 text-[10px] font-mono text-muted-foreground/50">
          Henüz hesap eklenmedi. Yukarıdan ekleyin.
        </div>
      ) : (
        <div className="space-y-1.5">
          {accounts.map((acc) => {
            const m = getSafePlatformMeta(acc.platform);
            const profileUrl = getPlatformUrl(acc.platform, acc.username);

            return (
              <div
                key={acc.id}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                  acc.is_active
                    ? "border-border/30 bg-muted/5 hover:border-primary/40 hover:bg-muted/10"
                    : "border-border/20 bg-muted/5 opacity-50"
                }`}
              >
                {/* Platform icon */}
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`shrink-0 ${m.color} hover:opacity-80 transition-opacity`}
                  title={`${m.label} profiline git ↗`}
                >
                  {m?.icon}
                </a>

                {/* Name + meta (Clickable link to external profile) */}
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 group cursor-pointer block"
                  title={`${acc.display_name || acc.username} profilini ${m.label} üzerinde aç (yeni sekme)`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-foreground group-hover:text-primary transition-colors truncate">
                      {acc.display_name || acc.username}
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground group-hover:text-foreground/80 transition-colors">
                      @{acc.username}
                    </span>
                    <ExternalLink size={9} className="text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                  <div className="text-[8px] font-mono text-muted-foreground/50 flex items-center gap-1.5 mt-0.5">
                    <RefreshCw size={7} />
                    {formatRelativeTime(acc.last_checked, lang, {
                      fallback: lang === "en" ? "not checked yet" : "henüz kontrol edilmedi",
                    })}
                    <span>·</span>
                    <span className={m.color}>{m.label}</span>
                    <span className="text-[7.5px] text-primary/60 group-hover:text-primary font-mono ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                      Profile git ↗
                    </span>
                  </div>
                </a>

                {canManageData && (
                  <>
                    {/* Toggle active */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleActive(acc); }}
                      className={`shrink-0 ${acc.is_active ? "text-green-500" : "text-muted-foreground/40"} hover:opacity-80 p-0.5`}
                      title={acc.is_active ? "İzlemeyi durdur" : "İzlemeyi başlat"}
                    >
                      {acc.is_active ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAccount(acc.id); }}
                      className="shrink-0 text-muted-foreground/30 hover:text-red-400 transition-colors p-0.5"
                      title="Kaldır"
                    >
                      <Trash2 size={10} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="text-[8px] font-mono text-muted-foreground/40 pt-1 leading-relaxed">
        Aktif hesapların public post'ları keyword eşleşmesiyle her "Topla" döngüsünde Canlı Feed'e eklenir.
      </div>
    </div>
  );
};
