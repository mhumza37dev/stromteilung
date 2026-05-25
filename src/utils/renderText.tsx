import { type ReactNode } from 'react';

/**
 * Translation strings can contain `{spans}` that need to be styled differently
 * — usually bold inside informational popups, or rendered as anchors inside
 * legal sentences. These helpers parse the string once and return a ReactNode
 * list ready to drop into JSX.
 *
 * Example:
 *   t('popup1')  // "Schauen Sie auf Ihre {Stromrechnung} oder den..."
 *   renderBold(...) → ["Schauen Sie auf Ihre ", <strong>Stromrechnung</strong>, " oder den..."]
 */

const SPAN_PATTERN = /\{([^}]+)\}/g;

/** Wrap every `{span}` in a `<strong>` element. */
export function renderBold(str: string): ReactNode[] {
  return str.split(SPAN_PATTERN).map((segment, i) =>
    i % 2 === 1 ? <strong key={i}>{segment}</strong> : segment,
  );
}

/** Wrap every `{span}` in a brand-styled anchor that does not navigate. */
export function renderLinks(str: string): ReactNode[] {
  return str.split(SPAN_PATTERN).map((segment, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href="#"
        onClick={(e) => e.preventDefault()}
        className="text-brand-700 underline font-medium"
      >
        {segment}
      </a>
    ) : (
      segment
    ),
  );
}
