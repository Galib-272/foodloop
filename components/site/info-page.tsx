import { Navbar } from '@/components/site/navbar';
import { Footer } from '@/components/site/footer';

export type InfoSection = { heading: string; body: (string | string[])[] };

export function InfoPage({
  eyebrow,
  title,
  intro,
  sections,
  updated,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: InfoSection[];
  updated?: string;
}) {
  return (
    <>
      <Navbar />
      <main className="bg-grain">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
          <p className="text-sm font-semibold uppercase tracking-wider text-secondary">
            {eyebrow}
          </p>
          <h1 className="text-balance mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{intro}</p>
          {updated && (
            <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
          )}
          <div className="mt-12 space-y-10">
            {sections.map((s) => (
              <section key={s.heading}>
                <h2 className="text-xl font-semibold">{s.heading}</h2>
                <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
                  {s.body.map((b, i) =>
                    Array.isArray(b) ? (
                      <ul key={i} className="list-disc space-y-1.5 pl-5">
                        {b.map((li) => (
                          <li key={li}>{li}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={i}>{b}</p>
                    )
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
