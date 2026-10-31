import { FieldLabel } from '@/components/forms/FieldLabel';

type Props = {
  htmlFor?: string;
  label: string;
  help: string;
  required?: boolean;
  className?: string;
};

/** Verification forms always include help — use `FieldLabel` directly when help is optional. */
export function VerificationFieldLabel(props: Props) {
  return <FieldLabel {...props} />;
}
