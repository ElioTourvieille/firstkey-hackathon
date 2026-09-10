"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import AuthGate from "@/components/AuthGate";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToggleChip from "@/components/ToggleChip";
import { GENEVA_DISTRICTS } from "@/lib/geneva-districts";

// Same increments as the public feed's rooms filter (app/page.tsx) — kept
// consistent across the app rather than inventing a different scale here.
const ROOM_OPTIONS = [1.5, 2.5, 3.5, 4.5];

export default function ProfilePage() {
  return (
    <AuthGate>
      <ProfileForm />
    </AuthGate>
  );
}

function ProfileForm() {
  const profile = useQuery(api.profiles.myProfile);
  const agencies = useQuery(api.agencies.listPublic);

  if (profile === undefined) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header active="Mon profil" />
        <main className="max-w-6xl mx-auto p-6">
          <p className="text-foreground/50">Chargement du profil…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header active="Mon profil" />
      {/* Keyed by whether a profile already exists: state is seeded once at
          mount from real data (no effect needed — see react-hooks/set-state-in-effect).
          The only time this identity changes is right after the first save
          (null -> a doc), which naturally remounts with the just-saved
          values already in place — no visible flicker. */}
      <ProfileFields key={profile?._id ?? "new"} profile={profile} agencies={agencies} />
    </div>
  );
}

function ProfileFields({
  profile,
  agencies,
}: {
  profile: Doc<"profiles"> | null;
  agencies: { _id: string; name: string }[] | undefined;
}) {
  const upsertMine = useMutation(api.profiles.upsertMine);
  const { user } = useUser();

  const [budgetMax, setBudgetMax] = useState<number | "">(profile?.budgetMax ?? "");
  const [roomsMin, setRoomsMin] = useState<number | null>(profile?.roomsMin ?? null);
  const [surfaceMin, setSurfaceMin] = useState<number | "">(profile?.surfaceMin ?? "");
  const [moveInDate, setMoveInDate] = useState(profile?.moveInDate ?? "");
  const [quartiers, setQuartiers] = useState<Set<string>>(new Set(profile?.quartiers ?? []));
  const [pitch, setPitch] = useState(profile?.pitch ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleQuartier(code: string) {
    setQuartiers((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const requiredFilled = [budgetMax !== "", roomsMin !== null, pitch.trim().length > 0].filter(
    Boolean,
  ).length;
  const completion = Math.round((requiredFilled / 3) * 100);
  const canSave = requiredFilled === 3;

  async function handleSave() {
    if (!canSave || budgetMax === "" || roomsMin === null) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await upsertMine({
        budgetMax: Number(budgetMax),
        roomsMin,
        surfaceMin: surfaceMin === "" ? undefined : Number(surfaceMin),
        quartiers: quartiers.size > 0 ? Array.from(quartiers) : undefined,
        moveInDate: moveInDate || undefined,
        pitch: pitch.trim(),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <main className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
        <div className="flex flex-row items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-wide text-foreground/50 uppercase font-mono">
              Configuration · Genève {profile ? "· Profil enregistré" : "· Profil non créé"}
            </p>
            <h1 className="text-3xl font-semibold mt-1">Mon profil de candidat</h1>
            <p className="text-foreground/60 mt-1 max-w-2xl">
              Paramétrez vos critères de recherche et le pitch envoyé aux régies avec chaque
              candidature.
            </p>
          </div>
          {user && (
            <div className="flex flex-row items-center gap-3 shrink-0">
              {user.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- Clerk-hosted avatar, not a build-time asset
                <img
                  src={user.imageUrl}
                  alt=""
                  className="w-9 h-9 rounded-full border border-border"
                />
              )}
              <div className="text-right">
                <p className="text-sm font-medium">{user.fullName ?? "Mon compte"}</p>
                <p className="text-xs text-status-new font-mono">
                  {requiredFilled}/3 champs requis · {completion}%
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section className="border border-border rounded-sm p-4 flex flex-col gap-4">
            <p className="text-xs uppercase tracking-wide text-foreground/50 font-mono">
              Critères &amp; budget
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-foreground/60">Loyer mensuel maximum (CHF)</span>
              <input
                type="number"
                min={0}
                step={50}
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="ex. 2800"
                className="border border-border rounded-sm p-2 text-sm bg-background font-mono"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-foreground/60">Nombre de pièces minimum</span>
              <div className="flex flex-row flex-wrap gap-1.5">
                {ROOM_OPTIONS.map((n) => (
                  <ToggleChip key={n} active={roomsMin === n} onClick={() => setRoomsMin(n)}>
                    {n}+
                  </ToggleChip>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-foreground/60">Surface minimale (m², optionnel)</span>
              <input
                type="number"
                min={0}
                step={5}
                value={surfaceMin}
                onChange={(e) => setSurfaceMin(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="ex. 65"
                className="border border-border rounded-sm p-2 text-sm bg-background font-mono"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-foreground/60">Entrée souhaitée (optionnel)</span>
              <input
                type="date"
                value={moveInDate}
                onChange={(e) => setMoveInDate(e.target.value)}
                className="border border-border rounded-sm p-2 text-sm bg-background font-mono"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-foreground/60">
                Secteurs prioritaires (optionnel — aucun = tout Genève)
              </span>
              <div className="flex flex-row flex-wrap gap-1.5">
                {Object.entries(GENEVA_DISTRICTS).map(([code, name]) => (
                  <ToggleChip key={code} active={quartiers.has(code)} onClick={() => toggleQuartier(code)}>
                    {name} <span className="opacity-50">({code})</span>
                  </ToggleChip>
                ))}
              </div>
            </div>
          </section>

          <section className="border border-border rounded-sm p-4 flex flex-col gap-3">
            <p className="text-xs uppercase tracking-wide text-foreground/50 font-mono">
              Pitch de présentation aux régies
            </p>
            <p className="text-xs text-foreground/60">
              Texte libre injecté dans chaque candidature rédigée par firstkey — situation,
              disponibilité, ce que vous voulez que la régie sache.
            </p>
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              rows={10}
              placeholder="Madame, Monsieur, je recherche…"
              className="border border-border rounded-sm p-2 text-sm bg-background"
            />
          </section>
        </div>

        <div className="flex flex-row items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="bg-foreground text-background px-4 py-2 rounded-sm text-sm disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer mon profil"}
          </button>
          {!canSave && (
            <p className="text-xs text-foreground/50">
              Loyer, pièces minimum et pitch sont requis avant d&apos;enregistrer.
            </p>
          )}
          {saved && <p className="text-sm text-status-new">Profil enregistré.</p>}
          {error && <p className="text-sm text-accent">{error}</p>}
        </div>
      </main>
      <Footer agencies={agencies} />
    </>
  );
}
