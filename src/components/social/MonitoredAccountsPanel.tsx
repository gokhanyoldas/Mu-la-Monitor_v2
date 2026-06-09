import { useState, useEffect } from "react";
import { Twitter, Youtube, Instagram, Facebook, Linkedin, Plus, Trash2, RefreshCw, CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

// ── Helpers ────────────────────────────────────────────────────────────────
function relativeTime(iso: string | null) {
  if (!iso) return "henüz kontrol edilmedi";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins}dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa önce`;
  return `${Math.floor(hrs / 24)}g önce`;
}

// ── Component ──────────────────────────────────────────────────────────────
export const MonitoredAccountsPanel = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPlatform, setNewPlatform] = useState<Platform>("twitter");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from("monitored_accounts")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setAccounts(data as Account[]);
    setIsLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, []);

  const addAccount = async () => {
    if (!newUsername.trim()) return;
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
    await supabase.from("monitored_accounts").update({ is_active: !acc.is_active }).eq("id", acc.id);
    fetchAccounts();
  };

  const deleteAccount = async (id: string) => {
    await supabase.from("monitored_accounts").delete().eq("id", id);
    fetchAccounts();
  };

  if (isLoading) {
    return <div className="text-center py-4 text-[10px] font-mono text-muted-foreground/50">Yükleniyor…</div>;
  }

  const meta = PLATFORM_META[newPlatform];

  return (
    <div className="space-y-3">
      {/* Add new account form */}
      <div className="border border-border/40 rounded-lg p-2.5 space-y-2">
        <div className="text-[9px] font-mono text-muted-foreground font-bold uppercase tracking-wider">
          Yeni Hesap Ekle
        </div>

        {/* Platform selector */}
        <div className="flex flex-wrap gap-1">
          {ACTIVE_PLATFORMS.map((p) => {
            const m = PLATFORM_META[p];
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
                <span className={m.color}>{m.icon}</span>
                {m.label}
              </button>
            );
          })}
          {SOON_PLATFORMS.map((p) => {
            const m = PLATFORM_META[p];
            return (
              <span
                key={p}
                title="Yakında"
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono border border-border/20 bg-muted/5 text-muted-foreground/40 cursor-not-allowed"
              >
                <span>{m.icon}</span>
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

      {/* Account list */}
      {accounts.length === 0 ? (
        <div className="text-center py-4 text-[10px] font-mono text-muted-foreground/50">
          Henüz hesap eklenmedi. Yukarıdan ekleyin.
        </div>
      ) : (
        <div className="space-y-1.5">
          {accounts.map((acc) => {
            const m = PLATFORM_META[acc.platform];
            return (
              <div
                key={acc.id}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                  acc.is_active
                    ? "border-border/30 bg-muted/5"
                    : "border-border/20 bg-muted/5 opacity-50"
                }`}
              >
                {/* Platform icon */}
                <span className={`shrink-0 ${m.color}`}>{m.icon}</span>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-foreground truncate">
                      {acc.display_name || acc.username}
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground">@{acc.username}</span>
                  </div>
                  <div className="text-[8px] font-mono text-muted-foreground/50 flex items-center gap-1.5">
                    <RefreshCw size={7} />
                    {relativeTime(acc.last_checked)}
                    <span>·</span>
                    <span className={m.color}>{m.label}</span>
                  </div>
                </div>

                {/* Toggle active */}
                <button
                  onClick={() => toggleActive(acc)}
                  className={`shrink-0 ${acc.is_active ? "text-green-500" : "text-muted-foreground/40"} hover:opacity-80`}
                  title={acc.is_active ? "İzlemeyi durdur" : "İzlemeyi başlat"}
                >
                  {acc.is_active ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteAccount(acc.id)}
                  className="shrink-0 text-muted-foreground/30 hover:text-red-400 transition-colors"
                  title="Kaldır"
                >
                  <Trash2 size={10} />
                </button>
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
