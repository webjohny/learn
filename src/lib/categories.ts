/**
 * Категорія = ситуація, в якій фразу вимовляють. Деталізація живе в тегах,
 * тому дрібні категорії зведені в 10 великих — інакше фільтр перетворюється
 * на довгий горизонтальний скрол.
 */
export const CATEGORY_MERGES: Record<string, string> = {
  'Work & Slack': 'Work & Communication',
  'Business & Work': 'Work & Communication',
  'Work & Small Talk': 'Work & Communication',
  'Wrapping Up': 'Work & Communication',
  Meetings: 'Meetings & Calls',
  'Weekend Discussions': 'Weekend & Plans',
  'Feelings & Reactions': 'Opinions & Reactions',
  'Agree & Disagree': 'Opinions & Reactions',
  'Conversation Support': 'Opinions & Reactions',
  'Food & Lunch': 'Small Talk',
  'Family & Baby Prep': 'Family & Personal',
}

export const CATEGORIES = [
  'Morning & Coffee',
  'Small Talk',
  'Opinions & Reactions',
  'Work & Communication',
  'Meetings & Calls',
  'Tech & Engineering',
  'IT Humor',
  'Weekend & Plans',
  'Family & Personal',
  'Job Search',
] as const

/** Приводить назву категорії до канонічної; невідомі лишає як є. */
export function canonicalCategory(name: string): string {
  return CATEGORY_MERGES[name] ?? name
}
