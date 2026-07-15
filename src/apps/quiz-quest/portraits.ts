// Pixel-art hero portraits (Design Docs/Quiz Quest/Player Portraits — D&D
// Starter Kit, licensed for use in commercial/non-commercial game products).
// Assigned to players by roster order, so the same seat always gets the same
// look for a given lobby size rather than reshuffling on every render.
export const PORTRAITS = [
  'dwarf_cleric_female_medium', 'dwarf_cleric_female_war', 'dwarf_cleric_male_medium', 'dwarf_cleric_male_war',
  'elf_wizard_female_battlemage', 'elf_wizard_female_robed', 'elf_wizard_male_battlemage', 'elf_wizard_male_robed',
  'halfelf_bard_female_lute', 'halfelf_bard_female_performer', 'halfelf_bard_male_lute', 'halfelf_bard_male_performer',
  'halfling_rogue_female_hooded', 'halfling_rogue_female_leather', 'halfling_rogue_male_hooded', 'halfling_rogue_male_leather',
  'human_fighter_female_chain', 'human_fighter_female_plate', 'human_fighter_male_chain', 'human_fighter_male_plate',
  'human_ranger_female_bow', 'human_ranger_female_woodsman', 'human_ranger_male_bow', 'human_ranger_male_woodsman',
] as const;

export function portraitFor(index: number): string {
  return `/quiz-quest/portraits/${PORTRAITS[index % PORTRAITS.length]}.jpg`;
}
