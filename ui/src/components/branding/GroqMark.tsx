/** Groq brand mark (fallback AI provider). */
export function GroqMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="24" height="24" rx="6" fill="#F55036" />
      <path
        fill="#fff"
        d="M8.2 7.5h7.6c1.8 0 3.1 1.1 3.1 2.7 0 1.1-.6 2-1.6 2.4 1.2.4 2 1.4 2 2.8 0 1.8-1.4 3.1-3.4 3.1H8.2V7.5zm3.4 3.8h3.5c.7 0 1.1-.4 1.1-.9s-.4-.9-1.1-.9h-3.5v1.8zm0 4.5h3.9c.8 0 1.3-.4 1.3-1s-.5-1-1.3-1h-3.9v2z"
      />
    </svg>
  );
}
