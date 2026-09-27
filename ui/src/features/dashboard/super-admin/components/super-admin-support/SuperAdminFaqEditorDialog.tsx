import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import type { AdminHelpCenterFaq } from '@/features/dashboard/super-admin/hooks/useHelpCenterFaqsAdmin';
import {
  useCreateHelpCenterFaq,
  useUpdateHelpCenterFaq,
} from '@/features/dashboard/super-admin/hooks/useHelpCenterFaqsAdmin';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type Props = {
  faq: AdminHelpCenterFaq | 'new' | null;
  categories: string[];
  onOpenChange: (open: boolean) => void;
};

export function SuperAdminFaqEditorDialog({ faq, categories, onOpenChange }: Props) {
  const isNew = faq === 'new';
  const editing = faq && faq !== 'new' ? faq : null;

  const [category, setCategory] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const createFaq = useCreateHelpCenterFaq();
  const updateFaq = useUpdateHelpCenterFaq();
  const isPending = createFaq.isPending || updateFaq.isPending;

  useEffect(() => {
    setCategory(editing?.category ?? categories[0] ?? '');
    setQuestion(editing?.question ?? '');
    setAnswer(editing?.answer ?? '');
  }, [editing, categories]);

  const handleSave = async (): Promise<boolean> => {
    if (!category.trim() || !question.trim() || !answer.trim()) {
      toast.error('Category, question, and answer are required');
      return false;
    }
    try {
      if (isNew) {
        await createFaq.mutateAsync({
          category: category.trim(),
          question: question.trim(),
          answer: answer.trim(),
        });
        toast.success('FAQ added');
      } else if (editing) {
        await updateFaq.mutateAsync({
          id: editing.id,
          category: category.trim(),
          question: question.trim(),
          answer: answer.trim(),
        });
        toast.success('FAQ updated');
      }
      onOpenChange(false);
      return true;
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not save FAQ'));
      return false;
    }
  };

  const baseline = [
    editing?.category ?? categories[0] ?? '',
    editing?.question ?? '',
    editing?.answer ?? '',
  ];
  const isDirty =
    Boolean(faq) &&
    (category !== baseline[0] || question !== baseline[1] || answer !== baseline[2]);
  const { onOpenChange: guardedOpenChange, dialogProps } = useGuardedClose({
    open: Boolean(faq),
    onOpenChange,
    isDirty,
    onSave: handleSave,
    onDiscard: () => {
      setCategory(baseline[0]!);
      setQuestion(baseline[1]!);
      setAnswer(baseline[2]!);
    },
  });

  return (
    <>
      <AdminDialogShell
        open={Boolean(faq)}
        onOpenChange={guardedOpenChange}
        title={isNew ? 'Add FAQ' : 'Edit FAQ'}
        sizeClassName="max-w-[min(calc(100vw-1.5rem),32rem)] sm:max-w-lg"
        footer={
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isPending}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Save
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="faq-category">Category</Label>
            <Combobox
              id="faq-category"
              value={category}
              onChange={setCategory}
              options={categories}
              creatable
              maxLength={80}
              placeholder="Select or create a category"
              searchPlaceholder="Search categories…"
              emptyText="Type to create a new category."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="faq-question">Question</Label>
            <Textarea
              id="faq-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={2}
              maxLength={300}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="faq-answer">Answer</Label>
            <Textarea
              id="faq-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={4}
              maxLength={2000}
            />
          </div>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
