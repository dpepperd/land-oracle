// When the "Choose your counties" box should open. Kept separate from the component so it can be tested.
export interface PickerEntitlements {
  tier: string;
  trialActive: boolean;
  needsCountyRepick: boolean;
  allowance: number;
  selectedCount: number;
}

/**
 * A new, unpaid signup has nothing to pick yet (the box used to cover the "choose a plan" page), so it stays closed for
 * free accounts. It opens when a plan is active (or a trial is running) and slots are unfilled, or when a downgrade
 * trimmed the selection and the user must re-pick.
 */
export function shouldOpenCountyPicker(e: PickerEntitlements): boolean {
  if (e.needsCountyRepick) return true;
  const unpaid = e.tier === 'free' && !e.trialActive;
  return !unpaid && e.selectedCount < e.allowance;
}
