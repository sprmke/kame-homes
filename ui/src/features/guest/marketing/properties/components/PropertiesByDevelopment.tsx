import { Home } from 'lucide-react';

import type { Development } from '@/features/guest/marketing/developments/types';

import { PropertiesLocationRow } from './PropertiesLocationRow';
import { groupPropertiesByDevelopment } from '../lib/groupPropertiesByDevelopment';

import type { Property } from './PropertyCard';

interface PropertiesByDevelopmentProps {
  developments: Development[];
  properties: Property[];
}

export function PropertiesByDevelopment({
  developments,
  properties,
}: PropertiesByDevelopmentProps) {
  const groups = groupPropertiesByDevelopment(developments, properties);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-muted mb-4 rounded-full p-5">
          <Home className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="text-foreground text-lg font-semibold">No properties found</h3>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-7 md:space-y-12">
      {groups.map((group) => (
        <PropertiesLocationRow
          key={group.development.id}
          title={group.title}
          viewAllTo={group.viewAllTo}
          properties={group.properties}
        />
      ))}
    </div>
  );
}
