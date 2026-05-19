import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Price → Impact',
  description: 'What data the Price → Impact extension collects. (Spoiler: none.)',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16 text-zinc-900 dark:text-zinc-50">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Last updated: 2026-05-19
      </p>

      <section className="mt-8 space-y-4 text-base">
        <p>
          The Price → Impact Chrome extension and the price-to-impact web
          app at this domain do not collect, transmit, or store any
          personal data. Everything runs locally in your browser.
        </p>
      </section>

      <h2 className="mt-10 text-xl font-semibold">What the extension does</h2>
      <ul className="mt-3 space-y-2 list-disc pl-6">
        <li>
          Reads prices visible on the page when you visit a supported
          shopping site (currently Amazon.com / .ca / .com.au / .co.uk /
          .de / .fr / .it / .es / .nl).
        </li>
        <li>
          Renders a small badge next to each price showing the
          equivalent impact of that amount donated to a high-impact
          charity.
        </li>
        <li>
          Stores your preferences (selected charity, paused state,
          per-site disable list) in <code>chrome.storage.sync</code>.
          That blob is private to your Chrome profile and synced across
          devices you&apos;re signed into.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold">What the extension does NOT do</h2>
      <ul className="mt-3 space-y-2 list-disc pl-6">
        <li>No analytics, no telemetry, no error reporting service.</li>
        <li>No tracking pixels, no fingerprinting, no third-party requests.</li>
        <li>No data leaves your browser. The extension makes zero network calls.</li>
        <li>No reading of pages outside the host_permissions declared in the manifest.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold">Donation links</h2>
      <p className="mt-3">
        Each impact badge is a hyperlink. Clicking it opens the relevant
        charity&apos;s donation page in a new tab. From that point on
        you are on the charity&apos;s own site; their privacy practices
        apply, not this extension&apos;s.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Contact</h2>
      <p className="mt-3">
        Questions or concerns:{' '}
        <a
          className="text-blue-600 hover:underline dark:text-blue-400"
          href="https://github.com/olitreadwell/price-to-impact/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          open an issue on GitHub
        </a>
        .
      </p>
    </main>
  );
}
