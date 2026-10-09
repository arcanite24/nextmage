/**
 * English for the About page, which loads with the page. Fan Content Policy wording stays in English in every
 * language (Wizards asks for that exact text); a translation is shown beside it.
 */
export default {
  'about.back': 'Back',
  'about.title': 'About {app}',
  'about.lede': '{app} is a free web client for XMage, the open-source Magic: The Gathering rules engine. Nobody pays to play, and nothing here is for sale.',
  'about.wotc': 'Wizards of the Coast',
  // {policy} is the link to the Fan Content Policy
  'about.wotc.policy': '{app} is unofficial Fan Content permitted under the {policy}. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.',
  'about.wotc.policyLink': 'Fan Content Policy',
  // the policy text in the reader's language; empty in English, where the original above is enough
  'about.wotc.translation': '',
  'about.wotc.trademarks': 'Magic: The Gathering, its card names, mana symbols and card text are trademarks and copyright of Wizards of the Coast.',
  'about.images': 'Card images',
  // {scryfall} is the link to Scryfall
  'about.images.text': 'Card images and card search data come from {scryfall}. {app} is not produced by or endorsed by Scryfall. Images are cached by this server so that Scryfall is asked for each card only once.',
  'about.source': 'XMage and the source',
  // {xmage} and {repository} are links
  'about.source.text': "The rules engine, card implementations and server are {xmage}, by its many contributors, under the MIT licence. {app}'s own code is in {repository}, under the same licence.",
  'about.source.repository': 'its repository',
  'about.type': 'Type and symbols',
  'about.type.barlow': 'Barlow and Barlow Condensed by Jeremy Tribby, SIL Open Font License.',
  'about.type.mana': 'Mana by Andrew Gioia: font under the SIL Open Font License, code under MIT.',
  'about.type.ui': 'Lucide icons, ISC licence. Radix UI primitives, MIT licence.',
  'about.data': 'What this server keeps',
  'about.data.name': 'Your player name, and for an account your email address and a hashed password.',
  'about.data.decks': 'Decks you save to your account, ratings, finished match results, and game replays (deleted after a set number of days).',
  'about.data.reports': 'Reports you file about other players, until a moderator closes them.',
  'about.data.errors': 'Error reports from your browser when something breaks: the message, the screen and the browser, never your password.',
  'about.data.chat': 'Chat is not stored. Friends and ignore lists stay in your browser.',
  'about.backTo': 'Back to {app}',
} as const;
