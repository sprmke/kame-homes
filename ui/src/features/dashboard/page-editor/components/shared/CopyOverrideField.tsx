import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type CopyValue = {
  heading?: string;
  subheading?: string;
  body?: string;
};

type Props = {
  value: CopyValue;
  onChange: (value: CopyValue) => void;
  headingMax?: number;
  subheadingMax?: number;
  bodyMax?: number;
  showHeading?: boolean;
  showSubheading?: boolean;
  showBody?: boolean;
  /** Prefix for input ids when multiple section panels exist. */
  idPrefix?: string;
};

export function CopyOverrideField({
  value,
  onChange,
  headingMax = 120,
  subheadingMax = 200,
  bodyMax = 2000,
  showHeading = true,
  showSubheading = true,
  showBody = true,
  idPrefix = 'showcase-copy',
}: Props) {
  if (!showHeading && !showSubheading && !showBody) return null;

  return (
    <div className="space-y-3">
      {showHeading ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-heading`}>Heading</Label>
          <Input
            id={`${idPrefix}-heading`}
            value={value.heading ?? ''}
            maxLength={headingMax}
            onChange={(event) => onChange({ ...value, heading: event.target.value })}
          />
          <p className="text-muted-foreground text-[11px]">
            {(value.heading ?? '').length}/{headingMax}
          </p>
        </div>
      ) : null}
      {showSubheading ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-subheading`}>Subheading</Label>
          <Input
            id={`${idPrefix}-subheading`}
            value={value.subheading ?? ''}
            maxLength={subheadingMax}
            onChange={(event) => onChange({ ...value, subheading: event.target.value })}
          />
          <p className="text-muted-foreground text-[11px]">
            {(value.subheading ?? '').length}/{subheadingMax}
          </p>
        </div>
      ) : null}
      {showBody ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-body`}>Body</Label>
          <Textarea
            id={`${idPrefix}-body`}
            value={value.body ?? ''}
            maxLength={bodyMax}
            rows={4}
            onChange={(event) => onChange({ ...value, body: event.target.value })}
          />
          <p className="text-muted-foreground text-[11px]">
            {(value.body ?? '').length}/{bodyMax}
          </p>
        </div>
      ) : null}
    </div>
  );
}
