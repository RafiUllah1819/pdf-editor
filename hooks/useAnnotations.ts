import { useCallback, useState } from "react";
import type { Annotation } from "@/types";

type UseAnnotationsReturn = {
  annotations: Annotation[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  addAnnotation: (ann: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
};

/**
 * Manages the annotation list and selection state for the annotation editor.
 * All mutations go through these stable callbacks so consumers can safely
 * include them in dependency arrays.
 */
export function useAnnotations(initial: Annotation[]): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<Annotation[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const addAnnotation = useCallback((ann: Annotation) => {
    setAnnotations((prev) => [...prev, ann]);
  }, []);

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  return {
    annotations,
    selectedId,
    setSelectedId,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
  };
}
