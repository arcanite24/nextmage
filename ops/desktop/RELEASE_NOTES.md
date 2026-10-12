Playmat @VERSION@ for your own computer. One download with everything inside, Java included: install it, open
Playmat, and the game opens in your browser. Play the AI and Career on your own, or have friends on the same Wi-Fi
join you.

## Download

| Your computer | Download | |
|---|---|---|
| **Windows** 10 or 11 | [**Playmat-Setup-Windows-x64.exe**](https://github.com/arcanite24/playmat/releases/download/v@VERSION@/Playmat-Setup-Windows-x64.exe) | Run it and press **Install**. |
| **Mac** with Apple silicon (M1 and later) | [**Playmat-macOS-arm64.dmg**](https://github.com/arcanite24/playmat/releases/download/v@VERSION@/Playmat-macOS-arm64.dmg) | Drag Playmat to Applications. |
| **Mac** with an Intel processor | [**Playmat-macOS-x64.dmg**](https://github.com/arcanite24/playmat/releases/download/v@VERSION@/Playmat-macOS-x64.dmg) | Drag Playmat to Applications. |
| **Linux** | Paste in a terminal: `curl -fsSL https://github.com/arcanite24/playmat/releases/latest/download/install.sh \| sh` | Or the `.tar.gz` below. |

Not sure which Mac you have? Apple menu, **About This Mac**: "Chip: Apple M…" is Apple silicon, "Processor: Intel" is Intel.

### The first time

- **Windows** may say "Windows protected your PC". Choose **More info**, then **Run anyway**. Playmat is a free fan
  project and has no paid signing certificate. Or install from PowerShell, which skips that screen:
  `irm https://github.com/arcanite24/playmat/releases/latest/download/install.ps1 | iex`
- **macOS** may say it can't check Playmat for malicious software. Open **System Settings**, **Privacy & Security**,
  scroll down and choose **Open Anyway**. Or install from the Terminal, which skips that step:
  `curl -fsSL https://github.com/arcanite24/playmat/releases/latest/download/install.sh | sh`
- The first start prepares the card database. It takes a few minutes, once.
- Your computer may ask whether Playmat (Java) can accept network connections. **Allow** lets friends on your network
  join; you can play alone either way.

## Playing

- Playmat opens `http://localhost:17170` in your browser. Keep the small Playmat window open while you play; closing
  it stops the game.
- Create an account the first time (it stays on your computer). Accounts unlock Career; untick **Player accounts** in
  the Playmat window to sign in with just a name instead.
- Friends on the same network open the address the Playmat window shows, like `http://192.168.1.20:17170`.
- Card pictures come from Scryfall, so an internet connection helps.
- Your accounts, decks and Career progress are kept when you install a newer version.

`SHA256SUMS.txt` lists the checksums of every file. Questions and bug reports: [Discord](https://discord.gg/SFQKFrTvww)
or [GitHub issues](https://github.com/arcanite24/playmat/issues).

Playmat is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions
of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
