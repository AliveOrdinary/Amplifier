"use client";

import { useEffect } from "react";
import { markSeen } from "../actions";

/** Opening a brief a visitor started on the site clears it from the count on the Briefs tab. */
export function MarkSeen({ id }: { id: string }) {
  useEffect(() => {
    void markSeen(id);
  }, [id]);
  return null;
}
