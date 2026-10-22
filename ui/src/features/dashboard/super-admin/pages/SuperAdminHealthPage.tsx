import { Navigate, useParams } from 'react-router-dom';

import { Activity } from 'lucide-react';

import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import { SuperAdminSecondaryNav } from '@/features/dashboard/super-admin/components/shared/SuperAdminSecondaryNav';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { appPageTitle, usePageTitle } from '@/lib/pageTitle';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'usage', label: 'Usage' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const SECTION_SUBTITLES: Record<SectionId, string> = {
  overview: 'Platform checks for configuration, integrations, scheduled jobs, and usage.',
  configuration: 'Edge and UI env vars and production posture.',
  integrations: 'Live credential checks, tenant integrations, and AI reliability.',
  jobs: 'Scheduled job heartbeats, database prerequisites, and cron jobs.',
  usage: 'AI spend, rate limits, and database and storage capacity.',
};

function isSectionId(value: string): value is Exclude<SectionId, 'overview'> {
  return SECTIONS.some((section) => section.id === value && section.id !== 'overview');
}

export function SuperAdminHealthPage() {
  const { section } = useParams<{ section?: string }>();
  const known = !section || isSectionId(section);
  const active: SectionId = section && isSectionId(section) ? section : 'overview';
  const sectionLabel = SECTIONS.find((item) => item.id === active)?.label;

  usePageTitle(
    appPageTitle(active === 'overview' ? 'System health' : `System health - ${sectionLabel}`)
  );

  if (!known) {
    return <Navigate to={superAdminPaths.health} replace />;
  }

  return (
    <SuperAdminPage
      title="System health"
      subtitle={SECTION_SUBTITLES[active]}
      toolbar={
        <SuperAdminSecondaryNav
          ariaLabel="System health sections"
          items={SECTIONS.map((item) => ({
            label: item.label,
            to:
              item.id === 'overview'
                ? superAdminPaths.health
                : superAdminPaths.healthSection(item.id),
            active: item.id === active,
          }))}
        />
      }
    >
      <SuperAdminEmptyState icon={Activity} title="No checks yet" />
    </SuperAdminPage>
  );
}
