/** Protocol lists the methodology page shows; a test pins them to the validator's. */

/** The protocol's exclusion reasons (PROTOCOL.md §2): code, meaning, example. */
export const EXCLUSIONS: [string, string, string][] = [
  ['others', 'A duty placed on someone else: citizens, Congress, other countries.', '“I ask you to be citizens.”'],
  ['past', 'A record or past action.', '“We cut taxes for every family.”'],
  ['describe', 'A description, forecast or rhetoric with no commitment.', '“The story goes on.”'],
  ['conditional', 'Hinges on a hypothetical outside the speaker’s term.', '“If our country does not lead the cause of freedom, it will not be led.”'],
  ['attack', 'About the opponent or the predecessor only.', '“She will raise your taxes.”'],
  ['ceremony', 'Thanks, greetings, blessings.', '“God bless America.”'],
];

/** The protocol's fixed topic list (PROTOCOL.md §4). */
export const THEMES = [
  'economy', 'taxes', 'budget', 'trade', 'energy', 'environment', 'health', 'education',
  'immigration', 'defense', 'foreign-policy', 'crime-justice', 'retirement', 'government',
  'rights', 'infrastructure', 'veterans', 'welfare',
];
