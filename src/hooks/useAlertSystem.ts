import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface AlertRule {
  id: string;
  type: "earthquake" | "air_quality" | "weather" | "social";
  condition: string;
  threshold: number;
  enabled: boolean;
  label: string;
}

export interface ActiveAlert {
  id: string;
  ruleId: string;
  message: string;
  severity: "info" | "warning" | "critical";
  timestamp: number;
  dismissed: boolean;
}

const DEFAULT_RULES: AlertRule[] = [
  { id: "eq-high", type: "earthquake", condition: "magnitude_gte", threshold: 4.0, enabled: true, label: "Deprem ≥ 4.0" },
  { id: "eq-critical", type: "earthquake", condition: "magnitude_gte", threshold: 5.0, enabled: true, label: "Deprem ≥ 5.0 (Kritik)" },
  { id: "aqi-unhealthy", type: "air_quality", condition: "aqi_gte", threshold: 100, enabled: true, label: "AQI ≥ 100 (Sağlıksız)" },
  { id: "aqi-hazardous", type: "air_quality", condition: "aqi_gte", threshold: 200, enabled: true, label: "AQI ≥ 200 (Tehlikeli)" },
  { id: "weather-hot", type: "weather", condition: "temp_gte", threshold: 40, enabled: true, label: "Sıcaklık ≥ 40°C" },
  { id: "weather-cold", type: "weather", condition: "temp_lte", threshold: 0, enabled: true, label: "Sıcaklık ≤ 0°C" },
  { id: "social-negative", type: "social", condition: "negative_ratio_gte", threshold: 0.6, enabled: true, label: "Sosyal Medya Negatif ≥ 60%" },
];

export function useAlertSystem() {
  const [rules, setRules] = useState<AlertRule[]>(() => {
    const saved = localStorage.getItem("mugla-alert-rules");
    return saved ? JSON.parse(saved) : DEFAULT_RULES;
  });
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [lastCheck, setLastCheck] = useState<number>(0);
  const { toast } = useToast();

  // Save rules to localStorage
  useEffect(() => {
    localStorage.setItem("mugla-alert-rules", JSON.stringify(rules));
  }, [rules]);

  const checkAlerts = useCallback(async () => {
    const enabledRules = rules.filter(r => r.enabled);
    const newAlerts: ActiveAlert[] = [];

    try {
      // Check earthquakes
      const eqRules = enabledRules.filter(r => r.type === "earthquake");
      if (eqRules.length > 0) {
        const { data } = await supabase.functions.invoke("data-scrape", {
          body: { type: "earthquakes" },
        });
        const earthquakes = data?.data?.earthquakes || [];
        
        for (const rule of eqRules) {
          // Guard: USGS can return features with null/undefined properties
          const recent = earthquakes.filter((eq: any) => {
            if (!eq?.properties?.time || eq.properties.mag == null) return false;
            const age = Date.now() - eq.properties.time;
            return age < 60 * 60 * 1000 && eq.properties.mag >= rule.threshold;
          });

          if (recent.length > 0) {
            const biggest = recent.sort((a: any, b: any) =>
              (b.properties?.mag ?? 0) - (a.properties?.mag ?? 0)
            )[0];
            newAlerts.push({
              id: `${rule.id}-${Date.now()}`,
              ruleId: rule.id,
              message: `🔴 Deprem: M${(biggest.properties?.mag ?? 0).toFixed(1)} - ${biggest.properties?.place ?? "Bilinmeyen konum"}`,
              severity: (biggest.properties?.mag ?? 0) >= 5 ? "critical" : "warning",
              timestamp: Date.now(),
              dismissed: false,
            });
          }
        }
      }

      // Check air quality
      const aqRules = enabledRules.filter(r => r.type === "air_quality");
      if (aqRules.length > 0) {
        const { data } = await supabase.functions.invoke("data-scrape", {
          body: { type: "air_quality" },
        });
        const aqi = data?.data?.european_aqi;

        if (aqi) {
          for (const rule of aqRules) {
            if (rule.condition === "aqi_gte" && aqi >= rule.threshold) {
              newAlerts.push({
                id: `${rule.id}-${Date.now()}`,
                ruleId: rule.id,
                message: `🌫️ Hava Kalitesi: AQI ${aqi} (${aqi >= 200 ? "TEHLİKELİ" : "SAĞLIKSIZ"})`,
                severity: aqi >= 200 ? "critical" : "warning",
                timestamp: Date.now(),
                dismissed: false,
              });
            }
          }
        }
      }

      // Check weather
      const wxRules = enabledRules.filter(r => r.type === "weather");
      if (wxRules.length > 0) {
        const { data } = await supabase.functions.invoke("data-scrape", {
          body: { type: "weather" },
        });
        const temp = data?.data?.temperature;

        if (temp !== undefined) {
          for (const rule of wxRules) {
            if (rule.condition === "temp_gte" && temp >= rule.threshold) {
              newAlerts.push({
                id: `${rule.id}-${Date.now()}`,
                ruleId: rule.id,
                message: `🌡️ Yüksek Sıcaklık: ${temp}°C`,
                severity: temp >= 45 ? "critical" : "warning",
                timestamp: Date.now(),
                dismissed: false,
              });
            }
            if (rule.condition === "temp_lte" && temp <= rule.threshold) {
              newAlerts.push({
                id: `${rule.id}-${Date.now()}`,
                ruleId: rule.id,
                message: `❄️ Düşük Sıcaklık: ${temp}°C`,
                severity: "warning",
                timestamp: Date.now(),
                dismissed: false,
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("Alert check failed:", e);
    }

    // Show toasts for new alerts
    for (const alert of newAlerts) {
      toast({
        title: alert.severity === "critical" ? "⚠️ KRİTİK UYARI" : "⚡ Uyarı",
        description: alert.message,
        variant: alert.severity === "critical" ? "destructive" : "default",
      });
    }

    if (newAlerts.length > 0) {
      setActiveAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
    }
    setLastCheck(Date.now());
  }, [rules, toast]);

  // Auto-check every 5 minutes
  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAlerts]);

  const dismissAlert = (alertId: string) => {
    setActiveAlerts(prev =>
      prev.map(a => a.id === alertId ? { ...a, dismissed: true } : a)
    );
  };

  const toggleRule = (ruleId: string) => {
    setRules(prev =>
      prev.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r)
    );
  };

  const updateThreshold = (ruleId: string, threshold: number) => {
    setRules(prev =>
      prev.map(r => r.id === ruleId ? { ...r, threshold } : r)
    );
  };

  return {
    rules,
    activeAlerts: activeAlerts.filter(a => !a.dismissed),
    allAlerts: activeAlerts,
    lastCheck,
    dismissAlert,
    toggleRule,
    updateThreshold,
    checkNow: checkAlerts,
  };
}
