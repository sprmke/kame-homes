/** Telegram brand mark (paper plane). */
export function TelegramMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="#229ED9"
        d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.68 5.64-5.098c.245-.22-.054-.342-.378-.121l-6.97 4.388-3.002-.939c-.653-.204-.666-.653.136-.972l11.566-4.458c.538-.196 1.006.128.832.941z"
      />
    </svg>
  );
}
