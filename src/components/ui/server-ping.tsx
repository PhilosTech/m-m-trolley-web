"use client";

import { useEffect } from "react";
import { API_HEALTH_URL } from "@/lib/api/config";

export function ServerPing() {
  useEffect(() => {
    fetch(API_HEALTH_URL, { method: "GET", cache: "no-store" }).catch(() => {});
  }, []);

  return null;
}
