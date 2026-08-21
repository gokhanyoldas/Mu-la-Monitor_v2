import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeAlerts(onAlertReceived?: (alert: any) => void) {
  useEffect(() => {
    // .on() metodları tanımlandıktan sonra en son .subscribe() çağrılır
    const channel = supabase
      .channel("realtime-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "monitor_data",
        },
        (payload) => {
          if (onAlertReceived) {
            onAlertReceived(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onAlertReceived]);
}
