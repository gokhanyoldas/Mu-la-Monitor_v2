// M15: Kullanıcı Profil & Kişiselleştirme Paneli
// Supabase Auth + user_preferences tablosu (localStorage fallback konuk kullanıcılar için)
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { User, Settings, Bell, MapPin, Eye, EyeOff, Check, ChevronDown } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DISTRICTS } from "@/data/districts";

interface UserPreferences {
  home_district: string;        // Favori ilçe
  default_tab: string;          // Açılış sekmesi
  hide_sections: string[];      // Gizlenecek bölümler
  alert_threshold_mag: number;  // Deprem eşiği (2.5 / 3.0 / 4.0)
  show_data_source_badges: boolean;
  compact_mode: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  home_district: "",
  default_tab: "genel",
  hide_sections: [],
  alert_threshold_mag: 3.0,
  show_data_source_badges: true,
  compact_mode: false,
};

const PREFS_LOCAL_KEY = "mugla-user-prefs";
const SECTION_OPTIONS = [
  { id: "ekonomi",  label: "Ekonomi" },
  { id: "cevre",    label: "Çevre" },
  { id: "turizm",   label: "Turizm" },
  { id: "ulasim",   label: "Ulaşım" },
  { id: "gvenlik",  label: "Güvenlik" },
  { id: "sosyal",   label: "Sosyal" },
  { id: "protokol", label: "Protokol" },
];
const TAB_OPTIONS = ["genel", "ekonomi", "cevre", "turizm", "ulasim", "gvenlik", "sosyal"];

export const UserProfilePanel = () => {
  const { user, isGuest } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadPrefs = async () => {
      if (user) {
        // Load from Supabase user_preferences
        const { data } = await supabase
          .from("user_preferences")
          .select("preferences")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.preferences) {
          setPrefs({ ...DEFAULT_PREFS, ...(data.preferences as Partial<UserPreferences>) });
          return;
        }
      }
      // Fallback: localStorage (guest mode)
      try {
        const stored = localStorage.getItem(PREFS_LOCAL_KEY);
        if (stored) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      } catch {}
    };
    loadPrefs();
  }, [user]);

  const savePrefs = async (next: UserPreferences) => {
    setIsSaving(true);
    localStorage.setItem(PREFS_LOCAL_KEY, JSON.stringify(next));

    if (user) {
      await supabase.from("user_preferences").upsert(
        { user_id: user.id, preferences: next as any, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    }

    // Apply preferences globally
    if (next.compact_mode) {
      document.documentElement.classList.add("compact-mode");
    } else {
      document.documentElement.classList.remove("compact-mode");
    }

    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (patch: Partial<UserPreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  const toggleSection = (id: string) => {
    const hidden = prefs.hide_sections.includes(id)
      ? prefs.hide_sections.filter(s => s !== id)
      : [...prefs.hide_sections, id];
    update({ hide_sections: hidden });
  };

  return (
    <DashboardPanel title="Profil & Kişiselleştirme" icon={<User size={14} />}>
      {/* Account status */}
      <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded bg-muted/20">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
          user ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        }`}>
          {user ? user.email?.[0]?.toUpperCase() ?? "U" : "G"}
        </div>
        <div>
          <p className="text-[10px] font-mono font-bold">
            {user ? user.email : "Misafir Kullanıcı"}
          </p>
          <p className="text-[8px] font-mono text-muted-foreground">
            {user ? "Tercihler buluta kaydediliyor" : "Tercihler yalnızca bu cihazda saklanıyor"}
          </p>
        </div>
        {saved && (
          <span className="ml-auto flex items-center gap-0.5 text-[9px] font-mono text-green-400">
            <Check size={10} /> Kaydedildi
          </span>
        )}
      </div>

      {/* Preferences sections */}
      <div className="space-y-4">
        {/* Home district */}
        <div>
          <label className="flex items-center gap-1 text-[10px] font-mono font-bold text-foreground/70 mb-1.5">
            <MapPin size={10} /> Ana İlçe
          </label>
          <select
            value={prefs.home_district}
            onChange={e => update({ home_district: e.target.value })}
            className="w-full text-[10px] font-mono bg-muted/30 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary"
          >
            <option value="">İlçe seçin (isteğe bağlı)</option>
            {DISTRICTS.map(d => (
              <option key={d.slug} value={d.slug}>
                {d.emoji} {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Default tab */}
        <div>
          <label className="flex items-center gap-1 text-[10px] font-mono font-bold text-foreground/70 mb-1.5">
            <Settings size={10} /> Açılış Sekmesi
          </label>
          <div className="flex flex-wrap gap-1">
            {TAB_OPTIONS.map(tab => (
              <button
                key={tab}
                onClick={() => update({ default_tab: tab })}
                className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${
                  prefs.default_tab === tab
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-muted/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Alert threshold */}
        <div>
          <label className="flex items-center gap-1 text-[10px] font-mono font-bold text-foreground/70 mb-1.5">
            <Bell size={10} /> Deprem Uyarı Eşiği
          </label>
          <div className="flex gap-1">
            {[2.5, 3.0, 4.0].map(mag => (
              <button
                key={mag}
                onClick={() => update({ alert_threshold_mag: mag })}
                className={`flex-1 py-1 rounded text-[9px] font-mono transition-colors ${
                  prefs.alert_threshold_mag === mag
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-muted/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                M{mag}+
              </button>
            ))}
          </div>
        </div>

        {/* Hide sections */}
        <div>
          <label className="flex items-center gap-1 text-[10px] font-mono font-bold text-foreground/70 mb-1.5">
            <Eye size={10} /> Gizlenecek Bölümler
          </label>
          <div className="grid grid-cols-2 gap-1">
            {SECTION_OPTIONS.map(s => {
              const hidden = prefs.hide_sections.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSection(s.id)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono transition-colors ${
                    hidden
                      ? "bg-muted/10 text-muted-foreground/50 border border-dashed border-border/50"
                      : "bg-muted/20 text-foreground hover:bg-muted/30"
                  }`}
                >
                  {hidden ? <EyeOff size={9} /> : <Eye size={9} />}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact mode toggle */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20">
          <label className="text-[10px] font-mono text-foreground cursor-pointer">
            Kompakt Mod (Daha az boşluk)
          </label>
          <button
            onClick={() => update({ compact_mode: !prefs.compact_mode })}
            className={`w-10 h-5 rounded-full transition-colors flex items-center ${
              prefs.compact_mode ? "bg-primary/60" : "bg-muted/40"
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform ${
              prefs.compact_mode ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        {/* Data source badges toggle */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20">
          <label className="text-[10px] font-mono text-foreground cursor-pointer">
            Veri Kaynak Rozetleri (Canlı/Tahmin)
          </label>
          <button
            onClick={() => update({ show_data_source_badges: !prefs.show_data_source_badges })}
            className={`w-10 h-5 rounded-full transition-colors flex items-center ${
              prefs.show_data_source_badges ? "bg-primary/60" : "bg-muted/40"
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform ${
              prefs.show_data_source_badges ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>
      </div>
    </DashboardPanel>
  );
};
