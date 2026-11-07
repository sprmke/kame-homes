import { AlertTriangle, HelpCircle } from 'lucide-react';

import {
  TELEGRAM_BOT_TOKEN_HELP,
  TELEGRAM_CHAT_ID_HELP,
  type TelegramHelpSection,
} from '@/features/dashboard/bookings/lib/telegramHelpContent';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from '@/components/ui/responsive-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type TelegramHelpTab = 'bot-token' | 'chat-id';

type Props = {
  defaultTab?: TelegramHelpTab;
  triggerLabel?: string;
  variant?: 'text' | 'icon';
  className?: string;
};

function TelegramHelpSections({ sections }: { sections: TelegramHelpSection[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section, sectionIndex) => (
        <section key={section.heading ?? sectionIndex} className="space-y-4">
          {section.heading ? (
            <h3 className="text-foreground text-sm font-semibold tracking-tight sm:text-[15px]">
              {section.heading}
            </h3>
          ) : null}
          <ol className="space-y-4">
            {section.steps.map((step, stepIndex) => (
              <li key={step.title} className="flex gap-3.5 sm:gap-4">
                <span
                  className="bg-muted text-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums sm:size-8 sm:text-sm"
                  aria-hidden
                >
                  {stepIndex + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-foreground text-sm font-medium leading-snug sm:text-[15px]">
                    {step.title}
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed sm:text-[15px] sm:leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {section.note ? (
            <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
              <p className="text-xs leading-relaxed text-amber-950 sm:text-sm dark:text-amber-100">
                {section.note}
              </p>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export function TelegramHelpDialog({
  defaultTab = 'bot-token',
  triggerLabel = 'Help',
  variant = 'text',
  className,
}: Props) {
  const helpLabel =
    defaultTab === 'chat-id' ? 'Setup guide: chat ID' : 'Setup guide: bot token';

  return (
    <ResponsiveModal>
      <ResponsiveModalTrigger asChild>
        {variant === 'icon' ? (
          <button
            type="button"
            aria-label={helpLabel}
            className={cn(
              'text-muted-foreground hover:text-foreground focus-visible:ring-ring relative inline-flex size-4 shrink-0 items-center justify-center rounded-sm transition-colors before:absolute before:-inset-2.5 before:content-[""] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              className
            )}
          >
            <HelpCircle className="size-3.5 shrink-0" aria-hidden />
          </button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'text-muted-foreground hover:text-foreground h-8 gap-1 px-2 text-xs font-medium',
              className
            )}
          >
            <HelpCircle className="size-3.5 shrink-0" aria-hidden />
            {triggerLabel}
          </Button>
        )}
      </ResponsiveModalTrigger>
      <ResponsiveModalContent
        sheetLayout="split"
        className="flex max-h-[min(92dvh,52rem)] min-h-0 flex-col overflow-hidden sm:max-w-[min(92vw,42rem)]"
      >
        <ResponsiveModalHeader className="shrink-0 max-lg:px-4">
          <ResponsiveModalTitle>Telegram setup guide</ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 pb-3 max-lg:px-4">
            <TabsList className="bg-muted/45 grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1">
              <TabsTrigger
                value="bot-token"
                className="min-h-[44px] rounded-lg px-2 text-xs font-semibold sm:min-h-[40px] sm:px-3 sm:text-sm"
              >
                How to get bot token
              </TabsTrigger>
              <TabsTrigger
                value="chat-id"
                className="min-h-[44px] rounded-lg px-2 text-xs font-semibold sm:min-h-[40px] sm:px-3 sm:text-sm"
              >
                How to get chat ID
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 max-lg:px-4">
            <TabsContent value="bot-token" className="mt-0 focus-visible:outline-none">
              <TelegramHelpSections sections={TELEGRAM_BOT_TOKEN_HELP} />
            </TabsContent>
            <TabsContent value="chat-id" className="mt-0 focus-visible:outline-none">
              <TelegramHelpSections sections={TELEGRAM_CHAT_ID_HELP} />
            </TabsContent>
          </div>
        </Tabs>

        <ResponsiveModalFooter className="shrink-0 max-lg:px-4 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <ResponsiveModalClose asChild>
            <Button type="button" variant="secondary" size="sm">
              Close
            </Button>
          </ResponsiveModalClose>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
