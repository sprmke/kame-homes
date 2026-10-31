type Props = {
  title: string;
  description: string;
};

export function HelpSectionIntro({ title, description }: Props) {
  return (
    <div className="px-1 text-center">
      <h2 className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
      <p className="text-muted-foreground mt-1 text-sm leading-snug sm:text-base">{description}</p>
    </div>
  );
}
