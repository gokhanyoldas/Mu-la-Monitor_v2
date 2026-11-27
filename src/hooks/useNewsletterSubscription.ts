import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";

export interface NewsletterSubscriptionRow {
  id?: string;
  user_id: string;
  email: string;
  subscribed: boolean;
  preferred_language: "tr" | "en";
  updated_at?: string;
}

interface NewsletterStoreState {
  loadedUserId: string | null;
  row: NewsletterSubscriptionRow | null;
  isLoading: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  setLoading: (loading: boolean) => void;
  setLoadedRow: (userId: string, row: NewsletterSubscriptionRow | null) => void;
  setSaving: (saving: boolean) => void;
  setRow: (row: NewsletterSubscriptionRow | null) => void;
  setErrorMessage: (message: string | null) => void;
  reset: () => void;
}

const useNewsletterStore = create<NewsletterStoreState>((set) => ({
  loadedUserId: null,
  row: null,
  isLoading: false,
  isSaving: false,
  errorMessage: null,
  setLoading: (isLoading) => set({ isLoading }),
  setLoadedRow: (loadedUserId, row) => set({ loadedUserId, row, isLoading: false }),
  setSaving: (isSaving) => set({ isSaving }),
  setRow: (row) => set({ row }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  reset: () =>
    set({
      loadedUserId: null,
      row: null,
      isLoading: false,
      isSaving: false,
      errorMessage: null,
    }),
}));

export function resetNewsletterSubscriptionState() {
  useNewsletterStore.getState().reset();
}

function normalizeLanguage(lang: string): "tr" | "en" {
  return lang === "en" ? "en" : "tr";
}

export function useNewsletterSubscription() {
  const { user, isAuthenticated } = useAuth();
  const { lang } = useTranslation();

  const loadedUserId = useNewsletterStore((s) => s.loadedUserId);
  const row = useNewsletterStore((s) => s.row);
  const isLoading = useNewsletterStore((s) => s.isLoading);
  const isSaving = useNewsletterStore((s) => s.isSaving);
  const errorMessage = useNewsletterStore((s) => s.errorMessage);

  const userId = isAuthenticated && user?.id ? user.id : null;
  const userEmail = isAuthenticated && user?.email ? user.email.trim().toLowerCase() : null;

  // Oturum kapandığında abonelik durumunu temizle; giriş yapıldığında mevcut tercihi yükle
  useEffect(() => {
    if (!userId) {
      useNewsletterStore.getState().reset();
      return;
    }

    if (useNewsletterStore.getState().loadedUserId === userId) {
      return;
    }

    let cancelled = false;
    useNewsletterStore.getState().setLoading(true);

    supabase
      .from("newsletter_subscribers")
      .select("id, user_id, email, subscribed, preferred_language, updated_at")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          useNewsletterStore.getState().setLoadedRow(userId, null);
          return;
        }
        useNewsletterStore.getState().setLoadedRow(userId, {
          id: data.id,
          user_id: data.user_id,
          email: data.email,
          subscribed: Boolean(data.subscribed),
          preferred_language: normalizeLanguage(data.preferred_language),
          updated_at: data.updated_at,
        });
      })
      .catch(() => {
        if (!cancelled) {
          useNewsletterStore.getState().setLoadedRow(userId, null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const subscribed = Boolean(userId && row?.user_id === userId && row.subscribed);

  const toggleSubscription = useCallback(
    async (explicitNext?: boolean): Promise<boolean> => {
      if (!userId || !userEmail) return false;

      const store = useNewsletterStore.getState();
      const previous = store.row && store.row.user_id === userId ? store.row : null;
      const nextSubscribed =
        typeof explicitNext === "boolean" ? explicitNext : !previous?.subscribed;
      const preferredLanguage = normalizeLanguage(lang);
      const nowIso = new Date().toISOString();

      const optimisticRow: NewsletterSubscriptionRow = {
        id: previous?.id,
        user_id: userId,
        email: userEmail,
        subscribed: nextSubscribed,
        preferred_language: preferredLanguage,
        updated_at: nowIso,
      };

      store.setSaving(true);
      store.setErrorMessage(null);
      store.setLoadedRow(userId, optimisticRow);

      try {
        const { error } = await supabase.from("newsletter_subscribers").upsert(
          {
            user_id: userId,
            email: userEmail,
            subscribed: nextSubscribed,
            preferred_language: preferredLanguage,
            updated_at: nowIso,
          },
          { onConflict: "user_id" }
        );

        if (error) {
          throw error;
        }

        return true;
      } catch {
        useNewsletterStore.getState().setLoadedRow(userId, previous);
        useNewsletterStore.getState().setErrorMessage(
          lang === "en"
            ? "Could not save your briefing preference. Please try again."
            : "Bülten tercihiniz kaydedilemedi. Lütfen tekrar deneyin."
        );
        return false;
      } finally {
        useNewsletterStore.getState().setSaving(false);
      }
    },
    [userId, userEmail, lang]
  );

  return {
    subscribed,
    isLoading: Boolean(userId) && isLoading && loadedUserId !== userId,
    isSaving,
    errorMessage,
    toggleSubscription,
  };
}
