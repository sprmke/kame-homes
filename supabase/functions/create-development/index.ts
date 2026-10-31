/**
 * create-development — POST new platform development (super admin).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  allocateDevelopmentSlug,
  serializeDevelopment,
  type DevelopmentRow,
} from '../_shared/developmentSerialize.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

const DEVELOPMENT_TYPES = new Set([
  'CONDOMINIUM',
  'SUBDIVISION',
  'MIXED_USE',
  'TOWNHOUSE',
  'COMMERCIAL',
]);

serveAuthenticated('create-development', async (req) => {
  requireHttpMethod(req, 'POST');
  await verifySuperAdminJwt(req);

  const body = await readJsonBody(req);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 160) {
    return jsonError(req, 'Development name must be 2–160 characters');
  }

  const type =
    typeof body.type === 'string' && DEVELOPMENT_TYPES.has(body.type) ? body.type : 'CONDOMINIUM';

  const supabase = createServiceClient();

  const { data: existingName } = await supabase
    .from('developments')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  if (existingName) {
    return jsonError(req, 'A development with this name already exists', 409);
  }

  const slug = await allocateDevelopmentSlug(
    supabase,
    name,
    typeof body.slug === 'string' ? body.slug : undefined
  );

  const { data, error } = await supabase
    .from('developments')
    .insert({
      slug,
      name,
      developer_name:
        typeof body.developerName === 'string' ? body.developerName.trim() || null : null,
      type,
      status: 'ACTIVE',
      location: typeof body.location === 'string' ? body.location.trim() || null : null,
      city: typeof body.city === 'string' ? body.city.trim() || null : null,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      settings: {},
    })
    .select('*')
    .single();

  if (error) {
    console.error('[create-development]', error.message);
    throw new Error('Failed to create development');
  }

  return jsonSuccess(req, {
    development: serializeDevelopment(data as DevelopmentRow),
  });
});
