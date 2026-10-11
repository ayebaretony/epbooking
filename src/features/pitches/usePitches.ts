import { useAsyncData } from "@/lib/useAsyncData";
import { listPitches } from "./pitches.service";

export function usePitches() {
  return useAsyncData(listPitches);
}
