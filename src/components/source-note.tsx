export function SourceNote({ title, note, url }: { title: string; note: string; url?: string }) {
  return (
    <section className="section">
      <h2>Source</h2>
      <p>
        {url ? (
          <a href={url} rel="noopener noreferrer">
            {title}
          </a>
        ) : (
          <strong>{title}.</strong>
        )}{" "}
        {note}
      </p>
    </section>
  );
}
