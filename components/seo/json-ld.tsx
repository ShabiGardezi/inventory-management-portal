import React from 'react';

type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

