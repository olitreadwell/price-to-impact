# Chrome Web Store listing — copy-paste source of truth

Every field the Web Store dashboard asks for, with the exact text to
paste and the exact file paths to upload. Use this if the Playwright
auto-fill script fails partway through, or just to verify what got
filled.

---

## Before you start

- [ ] You're signed in at **https://chrome.google.com/webstore/devconsole**
- [ ] You paid the one-time **$5 USD** developer registration fee
- [ ] You've confirmed your identity (name, address, country) with Google

If any of those isn't done, do it first — the form is gated behind it.

---

## Step 1. Create the new item

Dashboard → **New item** (top right).

Upload the zip:

```
/Users/olitreadwell/code/price-to-impact/apps/extension/releases/p2i-extension-v0.0.1.zip
```

Wait for "Upload successful" → you'll land on the item's edit page.

---

## Step 2. Store listing → Product details

### Name (max 75)

```
Price → Impact: see prices as charity impact
```

### Summary (max 132, shown under the name in search)

```
Annotates Amazon prices with what they could buy in high-impact charity. Round-up jar, 1-click donations, no tracking.
```

### Description (max 16000)

```
Price → Impact turns every Amazon price you see into a small badge showing the equivalent in high-impact charity giving. A $24.99 USB-C cable becomes "≈ 4.5 mosquito nets via Against Malaria Foundation." Click the badge to land on a 1-click donation page with the amount pre-filled.

Features:
• Annotates prices on amazon.com / .ca / .com.au / .co.uk / .de / .fr / .it / .es / .nl
• Choose between four GiveWell-cited charities: Against Malaria Foundation, Helen Keller Intl (Vitamin A), New Incentives (Vaccination), GiveDirectly
• Round-up jar: every viewed price adds its round-up cents (the "change" to the next dollar) to a jar. When the jar reaches $10/$20/$50/$100 (your choice), every badge turns green for a 1-click donation of the threshold
• Donation history (intent log) — see what you've intended to give, with a running total
• Share what you donated via the system share sheet or clipboard
• Optional "Add to Cart / Buy Now" prompt — opt in, get a non-blocking toast asking to round up your purchase
• Hover any badge to see the charity, the math, the cost basis, and a "Click to donate" CTA
• Pause globally or disable per-site

Privacy:
• No tracking, no analytics, no third-party requests
• Your preferences sync via chrome.storage.sync (private to your Chrome profile)
• No data ever leaves your browser
• Open source: https://github.com/olitreadwell/price-to-impact

Cost figures are GiveWell-derived approximations with visible "as of" dates. FX rates are approximate. Donation pages use Every.org (for AMF, Helen Keller, New Incentives) and GiveDirectly's native donate flow — clicking a badge takes you straight to the card-confirm step with the amount filled.
```

### Category

```
Productivity
```

### Language

```
English
```

---

## Step 3. Store listing → Graphic assets

### Store icon

Already inside the uploaded zip (`icons/icon-128.png`). The dashboard
auto-extracts it. If asked to re-upload:

```
/Users/olitreadwell/code/price-to-impact/apps/extension/icons/icon-128.png
```

### Screenshots (upload all 4, in order)

```
/Users/olitreadwell/code/price-to-impact/docs/store-screenshots/01-hero.png
/Users/olitreadwell/code/price-to-impact/docs/store-screenshots/02-popup.png
/Users/olitreadwell/code/price-to-impact/docs/store-screenshots/03-options.png
/Users/olitreadwell/code/price-to-impact/docs/store-screenshots/04-threshold.png
```

All four are exactly 1280×800 PNG, as the Web Store requires.

### Promo tiles

Optional. Skip for now.

---

## Step 4. Privacy practices

### Privacy policy URL

```
https://olitreadwell.github.io/price-to-impact/privacy.html
```

(Already live — `curl -I` returned HTTP 200.)

### Single-purpose statement

```
Annotate prices on shopping websites with equivalent charity impact, and provide one-click donation links.
```

### Permission justifications

The dashboard will list every permission from the manifest. Paste the
matching justification.

**`storage`**

```
Persists user preferences locally via chrome.storage.sync: which charity to display impact in, the round-up jar balance and threshold, the donation history (intent log), per-site disable list, and the opt-in for purchase-prompt. No data is transmitted anywhere — chrome.storage.sync is private to the user's Chrome profile.
```

**`activeTab`**

```
Read the URL of the active tab so the popup can show the "Enabled on this site" toggle for the user's current page. Used only when the popup is open; no background access.
```

**Host permissions** (`*://*.amazon.com/*` and the eight other Amazon TLDs)

```
The content script annotates prices on Amazon shopping pages. Each TLD listed (.com, .ca, .com.au, .co.uk, .de, .fr, .it, .es, .nl) is a separate Amazon locale where users see shopping prices. The script only reads the page DOM and adds visual badges — no network requests, no data leaves the page.
```

### Are you collecting data? (yes/no checkboxes)

Tick **None of the above** in every category. The privacy page already
states no data collection.

### Certifications

- "I do not sell user data to third parties." → ✓
- "I do not use or transfer user data for purposes unrelated to the
  item's single purpose." → ✓
- "I do not use or transfer user data to determine creditworthiness or
  for lending purposes." → ✓

---

## Step 5. Distribution

### Visibility

`Public` if you want anyone to install. `Unlisted` if you want only
people with a direct link.

### Country availability

`All regions` unless you have a reason to restrict.

### Pricing

`Free`.

---

## Step 6. Save vs Submit

- **Save draft** at any time → comes back to your dashboard, no review fired.
- **Submit for review** → Google reviews. 1–3 business days for first-time
  developers. They'll email if they need clarification.

**Do not** submit until you've reviewed every field above. The Playwright
script stops at save-draft on purpose.

---

## Things that often get listings rejected

- Missing privacy policy URL → we have it
- Permission justification that's too vague → ours are specific
- Screenshots not 1280×800 → ours are exact
- Description mentions features the extension doesn't actually do → ours is accurate
- Manifest version mismatch → manifest.json says `0.0.1`, the zip name says `v0.0.1` ✓
