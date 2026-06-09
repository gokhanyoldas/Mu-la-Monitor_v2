import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react";

interface AuthPageProps {
  onAuth: () => void;
}

export const AuthPage = ({ onAuth }: AuthPageProps) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role: "user" },
          },
        });
        if (error) throw error;
        toast({
          title: "Kayıt başarılı",
          description: "E-posta adresinize doğrulama linki gönderildi.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({ title: "Giriş başarılı" });
        onAuth();
      }
    } catch (err: any) {
      toast({
        title: "Hata",
        description: err.message === "Invalid login credentials" 
          ? "E-posta veya şifre hatalı" 
          : err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-primary font-mono font-bold text-2xl">M</span>
          </div>
          <h1 className="font-mono text-lg font-bold tracking-wider">
            <span className="text-primary">MUĞLA</span>
            <span className="text-muted-foreground ml-1.5">MONİTÖR</span>
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            Bölgesel İstihbarat Paneli
          </p>
        </div>

        {/* Auth Form */}
        <div className="bg-secondary/30 border border-border rounded-xl p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 text-[11px] font-mono py-2 rounded-lg border transition-colors ${
                mode === "login"
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-muted/10 text-muted-foreground border-border/30"
              }`}
            >
              GİRİŞ YAP
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 text-[11px] font-mono py-2 rounded-lg border transition-colors ${
                mode === "register"
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-muted/10 text-muted-foreground border-border/30"
              }`}
            >
              KAYIT OL
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-1.5">E-POSTA</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ornek@email.com"
                  className="w-full text-[12px] font-mono pl-9 pr-3 py-2.5 rounded-lg bg-muted/30 border border-border/50 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-1.5">ŞİFRE</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full text-[12px] font-mono pl-9 pr-9 py-2.5 rounded-lg bg-muted/30 border border-border/50 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {mode === "register" && (
                <span className="text-[9px] font-mono text-muted-foreground/60 mt-1 block">Minimum 6 karakter</span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-[11px] font-mono font-bold py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={12} className="animate-spin" />}
              {mode === "login" ? "GİRİŞ YAP" : "KAYIT OL"}
            </button>
          </form>

          {/* Guest access */}
          <div className="mt-4 pt-4 border-t border-border/30 text-center">
            <button
              onClick={onAuth}
              className="text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors"
            >
              Misafir olarak devam et →
            </button>
          </div>
        </div>

        <p className="text-[9px] font-mono text-muted-foreground/40 text-center mt-4">
          Veriler Muğla bölgesine aittir • Ücretsiz API kaynakları
        </p>
      </div>
    </div>
  );
};
