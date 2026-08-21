// DemoDataButton — mock-data-injector edge function'ını tetikler.
// Enjekte sonrası ilgili react-query cache'leri invalidate edilir; harita,
// filtreler ve özet paneller anında dolar. 'Temizle' modu yalnızca
// sentiment_method='mock' işaretli kayıtları siler (gerçek veriye dokunmaz).

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function DemoDataButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState<"inject" | "clear" | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  async function run(mode: "inject" | "clear") {
    setBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("mock-data-injector", {
        body: mode === "inject" ? { mode, perDistrict: 12, hours: 24 } : { mode },
      });
      if (error) throw error;
      // Tüm canlı görünümleri tazele
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["incident-points"] }),
        qc.invalidateQueries({ queryKey: ["incident-export"] }),
        qc.invalidateQueries({ queryKey: ["live-data"] }),
        qc.invalidateQueries({ queryKey: ["executive-report"] }),
      ]);
      toast({
        title: mode === "inject" ? "Demo veri yüklendi" : "Demo veri temizlendi",
        description: mode === "inject"
          ? `${data?.inserted ?? 0} gönderi + ${data?.alertsInserted ?? 0} kritik uyarı eklendi (13 ilçe).`
          : `${data?.postsDeleted ?? 0} gönderi, ${data?.alertsDeleted ?? 0} uyarı silindi.`,
      });
    } catch (err) {
      toast({
        title: "Demo veri işlemi başarısız",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        onClick={() => run("inject")}
        disabled={busy !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
      >
        <FlaskConical className={cn("w-3 h-3", busy === "inject" && "animate-pulse")} />
        {busy === "inject" ? "Yükleniyor…" : "Demo Veri Yükle"}
      </button>
      <button
        onClick={() => run("clear")}
        disabled={busy !== null}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-mono text-muted-foreground border border-border/40 hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-50"
        title="Yalnızca demo kayıtlarını siler"
      >
        <Trash2 className="w-3 h-3" />
        {busy === "clear" ? "…" : "Temizle"}
      </button>
    </div>
  );
}
