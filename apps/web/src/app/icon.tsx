import { ImageResponse } from 'next/og';
import { charities } from '@price-to-impact/charities';

/**
 * Web app favicon. Renders the icon of the active charity (charities[0])
 * at build time, so dragging the bookmarklet from this page captures
 * that icon as the bookmark's favicon in Chrome / Firefox / Safari.
 */

export const size = { width: 32, height: 32 } as const;
export const contentType = 'image/png';

export default function Icon() {
  const icon = charities[0]?.icon ?? '🦟';
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          background: 'transparent',
        }}
      >
        {icon}
      </div>
    ),
    { ...size },
  );
}
