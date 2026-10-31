type Props = {
  title: string;
  url: string;
  alt: string;
};

export function ImageBlock({ title, url, alt }: Props) {
  if (!url.trim()) return null;

  return (
    <figure className="border-border/60 bg-card space-y-2 overflow-hidden rounded-xl border p-3">
      {title ? (
        <figcaption className="text-foreground text-sm font-semibold">{title}</figcaption>
      ) : null}
      <img
        src={url}
        alt={alt || title || ''}
        width={640}
        height={360}
        className="h-auto w-full max-w-full rounded-lg object-cover"
      />
    </figure>
  );
}
