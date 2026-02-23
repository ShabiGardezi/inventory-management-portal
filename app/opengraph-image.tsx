import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo/site';

export const runtime = 'edge';
export const alt = `${SITE.brandName} OpenGraph Image`;
export const size = {
  width: 1200,
  height: 630,
};

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #0f172a 0%, #111827 45%, #0b1220 100%)',
          color: 'white',
          padding: 72,
          justifyContent: 'space-between',
          flexDirection: 'column',
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.9 }}>{SITE.brandName}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.05 }}>
            Inventory management
            <br />
            for B2B teams
          </div>
          <div style={{ fontSize: 28, opacity: 0.85 }}>
            Multi-warehouse · Approvals · Barcode · Batch/Serial
          </div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.8 }}>Europe · UK · Gulf · Scandinavia</div>
      </div>
    ),
    size
  );
}

