import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo/site';

export const runtime = 'edge';
export const alt = `${SITE.brandName} Twitter Image`;
export const size = {
  width: 1200,
  height: 675,
};

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #0b1220 0%, #0f172a 55%, #111827 100%)',
          color: 'white',
          padding: 72,
          justifyContent: 'space-between',
          flexDirection: 'column',
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.9 }}>{SITE.brandName}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.05 }}>Inventory management SaaS</div>
          <div style={{ fontSize: 28, opacity: 0.85 }}>
            Controls, traceability, and reporting for B2B operations
          </div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.8 }}>Book a demo · View pricing</div>
      </div>
    ),
    size
  );
}

