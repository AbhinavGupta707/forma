"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Routine } from "@/lib/train/routines";
import { api, errorMessage } from "@/components/client";
import { ErrorNote } from "@/components/ui";
import { Loading } from "@/components/train/kit";
import { RoutineEditor } from "@/components/train/RoutineEditor";

export default function RoutinePage() {
  const { id } = useParams<{ id: string }>();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (id !== "new") api.get<Routine>(`/api/train/routines/${id}`).then(setRoutine).catch((e) => setError(errorMessage(e)));
  }, [id]);
  if (error) return <ErrorNote message={error} />;
  if (id === "new") return <RoutineEditor routine={null} />;
  return routine ? <RoutineEditor routine={routine} /> : <Loading />;
}
