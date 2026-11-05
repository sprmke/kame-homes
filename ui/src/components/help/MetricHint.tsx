import { InfoHint } from '@/components/help/InfoHint';
import { METRIC_DEFINITIONS, type MetricDefinitionKey } from '@/lib/help/metricDefinitions';

type MetricHintProps = {
  /** Key into the shared `METRIC_DEFINITIONS`. */
  metric: MetricDefinitionKey;
  /** Accessible name, matching the card title. */
  label: string;
  className?: string;
};

/** `i` hint for a dashboard KPI, backed by one shared definition. */
export function MetricHint({ metric, label, className }: MetricHintProps) {
  return (
    <InfoHint
      label={label}
      text={METRIC_DEFINITIONS[metric].text}
      variant="metric"
      className={className}
    />
  );
}
