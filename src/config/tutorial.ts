/** Sector 1 acoustic onboarding — short HUD strings, no separate scene. */
export function tutorialHint(sectorIndex: number, missionTime: number, zombiesAlerted: number, firedLoud: boolean): string | null {
  if (sectorIndex !== 0) return null;
  if (missionTime < 8) return 'TIP: Unsuppressed gunfire travels — watch the NOISE ring at your feet.';
  if (missionTime < 20 && !firedLoud) return 'TIP: Try sneaking (hold sneak) past dormant infected.';
  if (firedLoud && zombiesAlerted === 0 && missionTime < 45) return 'TIP: Loud shots can wake the whole sector — suppressors shrink the radius.';
  if (zombiesAlerted > 0 && missionTime < 90) return 'TIP: Audio stalkers hunt by sound — go dark or reposition.';
  return null;
}
