import Head from 'next/head';

type Props = {
  id: string;
  data: Record<string, any>;
};

export function StructuredData({ id, data }: Props) {
  return (
    <Head>
      <script
        key={`structured-data-${id}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
    </Head>
  );
}
