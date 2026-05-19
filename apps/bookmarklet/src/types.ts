/**
 * Shared type contracts for the bookmarklet runtime.
 *
 * The detector and renderer talk to each other through these types so that
 * mock detectors, per-site detectors, and the pill renderer can evolve
 * independently.
 */

/** A single price found on the page, ready to be annotated. */
export interface DetectedPrice {
  /** Price normalised to USD. Detectors are responsible for conversion. */
  readonly priceUsd: number;
  /** The element after which a pill should be inserted. */
  readonly anchorEl: Element;
}

/**
 * A site-specific (or generic) price detector. Implementations should be
 * pure functions of the DOM — no side effects, no mutation of `root`.
 */
export interface Detector {
  /** Stable identifier used for logging and feature flagging. */
  readonly id: string;
  /** True if this detector should run on the given URL. */
  matches(url: URL): boolean;
  /** Return every price-anchor pair this detector recognises in `root`. */
  detect(root: ParentNode): readonly DetectedPrice[];
}
