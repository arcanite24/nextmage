/**
 * English for the privacy policy and the terms, which load with their pages. Plain words, not legalese: what the
 * server keeps, why, for how long, who else touches it, and what players may do about it.
 */
export default {
  'legal.updated': 'Last updated {date}.',
  // {contact} is the contact email as a link, or legal.contact.feedback
  'legal.contact': 'Questions, or a request about your data: {contact}.',
  'legal.contact.feedback': "write to the server's staff with Send feedback (in the menu under your name once you're signed in)",

  // privacy policy
  'privacy.title': 'Privacy',
  'privacy.lede': "{app} is run by the Playmat project at deimos.studio. This page says what the server keeps about you, why, for how long, and who else is involved. There are no ads, no trackers and no cookies.",
  'privacy.collect': 'What we keep, and why',
  'privacy.collect.account': 'Your account: its name, your email address and your password, stored only as a salted hash we cannot read back. To sign you in, and to let you recover the account by email.',
  'privacy.collect.addresses': 'Your IP address: in the server logs, and for a short while in memory to limit failed sign-ins and new accounts per address. To keep the server safe from abuse.',
  'privacy.collect.games': 'Your games: results, ratings and replays of finished games. Replays are deleted after 30 days. So you can watch your games again and play fair matches.',
  'privacy.collect.chat': 'Chat: messages go to the players at your table and are not stored. The game log (what was cast, what died) is part of the replay.',
  'privacy.collect.decks': 'Your decks and your Career progress, kept with your account so they follow you to another device.',
  'privacy.collect.reports': 'Reports you file about other players and reports about you, for the moderators. Feedback you send, for the staff.',
  'privacy.collect.errors': 'Error reports from the app when something breaks: the message, the screen, the browser and the app version, with your account name. Never your password.',
  'privacy.collect.payments': 'Coming soon, if you choose to support the project through Ko-fi: the name, email, amount and message Ko-fi sends us with your support, to thank you and match it to your account.',
  'privacy.howLong': 'How long',
  'privacy.howLong.text': 'Your account and what belongs to it stay until you delete the account. Replays go after 30 days. Server logs are kept until they rotate out, which takes a few weeks at most. Nightly backups of the databases are kept for 14 days, so deleted data is fully gone after that.',
  'privacy.others': 'Who else is involved',
  'privacy.others.hetzner': 'Hetzner hosts the server, in Germany.',
  'privacy.others.cloudflare': 'Cloudflare runs our DNS. If the site is attacked, we may route it through Cloudflare for a while, which then carries the traffic.',
  'privacy.others.scryfall': 'Scryfall provides card images and card data. We fetch them through our own cache, so your address is never sent to Scryfall.',
  'privacy.others.mail': 'Our mail provider delivers the emails we send you: codes and account notices, nothing else.',
  'privacy.others.payments': 'Ko-fi, and Stripe or PayPal behind it, handle support payments. We never see card details.',
  'privacy.others.github': 'GitHub, only if you sign in with GitHub: it tells us your GitHub name and verified email.',
  'privacy.others.discord': "Discord, where the server may post public tables and events to the community's channel. Those posts show table names and player names.",
  'privacy.storage': 'On your device',
  'privacy.storage.text': "{app} uses no cookies. Your settings, your sign-in on this device, and your friends and ignore lists are kept in your browser's storage. Without an account, your decks stay there too.",
  'privacy.rights': 'Your rights',
  'privacy.rights.download': 'Download everything we keep about your account: Settings, Account, Download my data.',
  'privacy.rights.delete': 'Delete your account and everything that belongs to it: Settings, Account, Delete my account.',
  'privacy.rights.correct': 'Correct something that is wrong, such as your email address: ask us (below).',

  // terms
  'terms.title': 'Terms',
  'terms.lede': '{app} is a free, unofficial fan project. By playing here you agree to these few rules.',
  'terms.fan': 'A fan project',
  'terms.warranty': 'No promises',
  'terms.warranty.text': 'The server and the app are offered as they are, for free. They may be down, have bugs, or lose data now and then, though we keep backups and try hard not to.',
  'terms.conduct': 'Play nice',
  // {report} is a short description of where the report button is
  'terms.conduct.text': 'Be decent to other players. No harassment, hate, cheating, abusing bugs, bots, spam or pretending to be someone else. If someone breaks these rules, report them: {report}.',
  'terms.conduct.report': "open their profile, or the menu on their name in the lobby's player list, and choose Report",
  'terms.staff': "What staff may do",
  'terms.staff.text': "The server's staff may mute, lock or delete accounts that break these rules, and remove tables. What they do is recorded.",
  'terms.support': 'Supporting the project',
  'terms.support.text': 'Support payments are voluntary donations. They never unlock gameplay: supporters get cosmetic thanks in {app}\'s own art at most, and the game stays free for everyone.',
  'terms.account': 'Your account',
  'terms.account.text': 'One person per account. Keep your password to yourself. You can delete your account whenever you like.',
  'terms.changes': 'Changes',
  'terms.changes.text': 'If these terms or the privacy policy change, this page and its date change too; for a big change we will tell players in the app.',
} as const;
