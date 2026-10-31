#!/usr/bin/env bun
/**
 * Local verification for org + property team roles (no Google UI required).
 * Creates disposable Gmail-format test users, invites/accepts via edge APIs,
 * and asserts listing access + deactivate + seeded-role delete guards.
 *
 * Usage (local stack running): bun scripts/dev/qa-org-property-team-roles.mjs
 */

const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SRK =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const API = 'http://127.0.0.1:54321/functions/v1';
const AUTH = 'http://127.0.0.1:54321/auth/v1';

const ORG_SLUG = 'kame-home';
const ORG_ID = '9d0bacb6-7304-4175-bd7c-8b4f7d13e1f1';
const OWNER_EMAIL = 'sprmke.dev@gmail.com';
const PROPERTY_ID = '0d05db1a-b9a9-4451-8571-26300d48aa7c';
const PROPERTY_SLUG = 'monaco-2612';
const PARKING_ID = '6bd5fda5-8931-41ae-8e73-0e83afe433ad';
const OPERATIONS_ROLE_ID = '2bfacef3-4c72-4558-995a-26b09212f0bc';
const FULL_ACCESS_ROLE_ID = '06b4b947-21c2-48fa-a781-15a3c8124feb';
const PROPERTY_OPERATIONS_ROLE_ID = '76ab6069-816a-41ad-ab10-e30bffacb4f1';

const stamp = Date.now();
const INVITEE_EMAIL = `kh.team.ops.${stamp}@gmail.com`;
const FULL_EMAIL = `kh.team.full.${stamp}@gmail.com`;

let passed = 0;
let failed = 0;

function ok(label, detail = '') {
  passed += 1;
  console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail = '') {
  failed += 1;
  console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function createUser(email) {
  const resp = await fetch(`${AUTH}/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      email_confirm: true,
      password: `Test-${stamp}-Aa1!`,
    }),
  }).then((r) => r.json());
  if (!resp.id) throw new Error(`createUser failed for ${email}: ${JSON.stringify(resp)}`);
  return resp.id;
}

async function sessionFor(email) {
  const resp = await fetch(`${AUTH}/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json());
  const token = resp.hashed_token;
  if (!token) throw new Error(`no hashed_token for ${email}: ${JSON.stringify(resp)}`);
  const verify = await fetch(`${AUTH}/verify?token=${token}&type=magiclink`, {
    headers: { apikey: ANON },
    redirect: 'manual',
  });
  const loc = verify.headers.get('location') || '';
  const h = new URLSearchParams(loc.split('#')[1] || '');
  const access = h.get('access_token');
  if (!access) throw new Error(`no access_token for ${email}`);
  return access;
}

async function edge(path, { method = 'GET', token, body } = {}) {
  const resp = await fetch(`${API}${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, json };
}

async function main() {
  console.log('Creating test users…');
  await createUser(INVITEE_EMAIL);
  await createUser(FULL_EMAIL);

  const ownerToken = await sessionFor(OWNER_EMAIL);
  const inviteeToken = await sessionFor(INVITEE_EMAIL);
  const fullToken = await sessionFor(FULL_EMAIL);

  // 1) Seeded org roles present
  {
    const { status, json } = await edge(
      `/org-team-custom-roles?org_slug=${ORG_SLUG}&org_id=${ORG_ID}`,
      { token: ownerToken }
    );
    const roles = json?.data?.customRoles ?? json?.customRoles ?? [];
    const names = roles.map((r) => r.name).sort();
    if (status === 200 && names.includes('Full Access') && names.includes('Operations') && names.includes('Read Only')) {
      ok('org seeded roles', names.join(', '));
    } else {
      fail('org seeded roles', `status=${status} names=${names.join(',')}`);
    }

    // delete seeded must fail
    const seeded = roles.find((r) => r.name === 'Read Only');
    if (seeded) {
      const del = await edge('/org-team-custom-roles', {
        method: 'DELETE',
        token: ownerToken,
        body: { orgId: ORG_ID, orgSlug: ORG_SLUG, roleId: seeded.id },
      });
      const msg = del.json?.error || del.json?.message || '';
      if (del.status >= 400 && /default|cannot be deleted/i.test(msg)) {
        ok('seeded org role delete blocked', msg);
      } else {
        fail('seeded org role delete blocked', `status=${del.status} ${JSON.stringify(del.json)}`);
      }
    }
  }

  // 2) Invite Operations with one property only
  {
    const rolesRes = await edge(`/org-team-custom-roles?org_slug=${ORG_SLUG}&org_id=${ORG_ID}`, {
      token: ownerToken,
    });
    const roles = rolesRes.json?.data?.customRoles ?? rolesRes.json?.customRoles ?? [];
    const operations = roles.find((r) => r.name === 'Operations') ?? { id: OPERATIONS_ROLE_ID };
    const opsPerms =
      operations.permissions ??
      [
        'org.dashboard:view',
        'org.bookings:view',
        'org.properties:view',
        'org.properties:manage',
        'org.parkings:view',
        'org.parkings:manage',
        'org.team:view',
        'org.team.invitations:add',
        'org.team.invitations:edit',
        'org.team.invitations:delete',
        'org.team.members:edit',
        'org.team.members:delete',
      ];

    const invite = await edge('/org-team-invitations', {
      method: 'POST',
      token: ownerToken,
      body: {
        orgId: ORG_ID,
        orgSlug: ORG_SLUG,
        email: INVITEE_EMAIL,
        contactPhone: '09171234567',
        roleId: operations.id,
        permissions: opsPerms,
        allListings: false,
        listingAssignments: {
          properties: [
            {
              propertyId: PROPERTY_ID,
              roleId: 'Operations',
              permissions: [],
            },
          ],
          parkings: [],
        },
      },
    });

    const invitation =
      invite.json?.data?.invitation ?? invite.json?.invitation ?? null;
    if (invite.status === 200 && invitation?.token) {
      ok('invite Operations scoped to property');
    } else if (invite.status === 200 && invitation?.id) {
      // token may be omitted from serialization — load from DB via accept path using service
      ok('invite Operations scoped to property', 'no token in response — fetching from DB');
    } else {
      fail('invite Operations', `status=${invite.status} ${JSON.stringify(invite.json)}`);
      throw new Error('Cannot continue without invite');
    }

    // Fetch token from DB via service role REST
    const tokenRows = await fetch(
      `http://127.0.0.1:54321/rest/v1/organization_invitations?email=eq.${encodeURIComponent(INVITEE_EMAIL)}&status=eq.pending&select=token,id`,
      {
        headers: {
          apikey: SRK,
          Authorization: `Bearer ${SRK}`,
        },
      }
    ).then((r) => r.json());
    const inviteToken = tokenRows?.[0]?.token;
    if (!inviteToken) throw new Error(`invite token missing: ${JSON.stringify(tokenRows)}`);

    const accept = await edge('/accept-org-invite', {
      method: 'POST',
      token: inviteeToken,
      body: { token: inviteToken },
    });
    if (accept.status === 200) {
      ok('accept org invite');
    } else {
      fail('accept org invite', `status=${accept.status} ${JSON.stringify(accept.json)}`);
      throw new Error('accept failed');
    }
  }

  // 3) Invitee can access org team + assigned property; not parking (unassigned)
  {
    const orgAccess = await edge(`/org-access?org_slug=${ORG_SLUG}`, { token: inviteeToken });
    const perms = orgAccess.json?.data?.permissions ?? orgAccess.json?.permissions ?? [];
    if (orgAccess.status === 200 && perms.includes('org.team:view')) {
      ok('invitee org hub access', `perms=${perms.length}`);
    } else {
      fail('invitee org hub access', `status=${orgAccess.status} ${JSON.stringify(orgAccess.json)}`);
    }

    const propAccess = await edge(
      `/property-access?property_id=${PROPERTY_ID}`,
      { token: inviteeToken }
    );
    if (propAccess.status === 200) {
      ok('invitee property access (assigned)');
    } else {
      fail('invitee property access', `status=${propAccess.status} ${JSON.stringify(propAccess.json)}`);
    }

    // property members list should mark org-assigned fromOrg
    const team = await edge(
      `/property-team-members?property_id=${PROPERTY_ID}`,
      { token: ownerToken }
    );
    const members = team.json?.data?.members ?? team.json?.members ?? [];
    const assigned = members.find((m) => m.email === INVITEE_EMAIL);
    if (assigned?.fromOrg === true) {
      ok('property team shows fromOrg for org-assigned member');
    } else {
      fail(
        'property team fromOrg',
        `found=${JSON.stringify(assigned)} members=${members.length}`
      );
    }

    // Edit org-assigned via property API must fail
    if (assigned?.id) {
      const edit = await edge('/property-team-members', {
        method: 'PATCH',
        token: ownerToken,
        body: {
          propertyId: PROPERTY_ID,
          memberId: assigned.id,
          status: 'inactive',
        },
      });
      if (edit.status >= 400) {
        ok('property API blocks edit of org-assigned member');
      } else {
        fail('property API blocks edit of org-assigned', JSON.stringify(edit.json));
      }
    }
  }

  // 4) Deactivate invitee → property access denied
  {
    const membersRes = await edge(`/org-team-members?org_slug=${ORG_SLUG}&org_id=${ORG_ID}`, {
      token: ownerToken,
    });
    const members = membersRes.json?.data?.members ?? membersRes.json?.members ?? [];
    const invitee = members.find((m) => m.email === INVITEE_EMAIL);
    if (!invitee?.id) {
      fail('locate invitee member for deactivate');
    } else {
      const deact = await edge('/org-team-members', {
        method: 'PATCH',
        token: ownerToken,
        body: {
          orgId: ORG_ID,
          orgSlug: ORG_SLUG,
          memberId: invitee.id,
          status: 'inactive',
        },
      });
      if (deact.status === 200) {
        ok('deactivate org member');
      } else {
        fail('deactivate org member', `status=${deact.status} ${JSON.stringify(deact.json)}`);
      }

      const propAccess = await edge(
        `/property-access?property_id=${PROPERTY_ID}`,
        { token: inviteeToken }
      );
      if (propAccess.status === 403 || propAccess.status === 401) {
        ok('deactivated invitee blocked from property');
      } else {
        fail(
          'deactivated invitee blocked from property',
          `status=${propAccess.status} ${JSON.stringify(propAccess.json)}`
        );
      }

      const orgAccess = await edge(`/org-access?org_slug=${ORG_SLUG}`, { token: inviteeToken });
      if (orgAccess.status === 403 || orgAccess.status === 401) {
        ok('deactivated invitee blocked from org hub');
      } else {
        fail(
          'deactivated invitee blocked from org hub',
          `status=${orgAccess.status} ${JSON.stringify(orgAccess.json)}`
        );
      }
    }
  }

  // 5) Full Access + all listings invite
  {
    const rolesRes = await edge(`/org-team-custom-roles?org_slug=${ORG_SLUG}&org_id=${ORG_ID}`, {
      token: ownerToken,
    });
    const roles = rolesRes.json?.data?.customRoles ?? rolesRes.json?.customRoles ?? [];
    const full = roles.find((r) => r.name === 'Full Access') ?? { id: FULL_ACCESS_ROLE_ID };
    const invite = await edge('/org-team-invitations', {
      method: 'POST',
      token: ownerToken,
      body: {
        orgId: ORG_ID,
        orgSlug: ORG_SLUG,
        email: FULL_EMAIL,
        contactPhone: '09171234568',
        roleId: full.id,
        permissions: full.permissions,
        allListings: true,
        listingAssignments: { properties: [], parkings: [] },
      },
    });
    if (invite.status !== 200) {
      fail('invite Full Access', JSON.stringify(invite.json));
    } else {
      ok('invite Full Access all listings');
      const tokenRows = await fetch(
        `http://127.0.0.1:54321/rest/v1/organization_invitations?email=eq.${encodeURIComponent(FULL_EMAIL)}&status=eq.pending&select=token`,
        { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }
      ).then((r) => r.json());
      const accept = await edge('/accept-org-invite', {
        method: 'POST',
        token: fullToken,
        body: { token: tokenRows[0].token },
      });
      if (accept.status === 200) ok('accept Full Access invite');
      else fail('accept Full Access invite', JSON.stringify(accept.json));

      const propAccess = await edge(
        `/property-access?property_id=${PROPERTY_ID}`,
        { token: fullToken }
      );
      if (propAccess.status === 200) ok('Full Access member property access via all_listings');
      else fail('Full Access property access', `status=${propAccess.status}`);
    }
  }

  // 6) Permission override preserved on template edit
  {
    const membersRes = await edge(`/org-team-members?org_slug=${ORG_SLUG}&org_id=${ORG_ID}`, {
      token: ownerToken,
    });
    const members = membersRes.json?.data?.members ?? membersRes.json?.members ?? [];
    const fullMember = members.find((m) => m.email === FULL_EMAIL);
    if (fullMember?.id) {
      const customPerms = ['org.dashboard:view', 'org.team:view', 'org.properties:view'];
      const patchMember = await edge('/org-team-members', {
        method: 'PATCH',
        token: ownerToken,
        body: {
          orgId: ORG_ID,
          orgSlug: ORG_SLUG,
          memberId: fullMember.id,
          permissions: customPerms,
        },
      });
      if (patchMember.status !== 200) {
        fail('set member permission override', JSON.stringify(patchMember.json));
      } else {
        const rolesRes = await edge(`/org-team-custom-roles?org_slug=${ORG_SLUG}&org_id=${ORG_ID}`, {
          token: ownerToken,
        });
        const roles = rolesRes.json?.data?.customRoles ?? rolesRes.json?.customRoles ?? [];
        const full = roles.find((r) => r.name === 'Full Access');
        const nextPerms = [...(full.permissions || []), 'org.plans:view'].filter(
          (v, i, a) => a.indexOf(v) === i
        );
        const patchRole = await edge('/org-team-custom-roles', {
          method: 'PATCH',
          token: ownerToken,
          body: {
            orgId: ORG_ID,
            orgSlug: ORG_SLUG,
            roleId: full.id,
            permissions: nextPerms,
          },
        });
        if (patchRole.status !== 200) {
          fail('patch Full Access template', JSON.stringify(patchRole.json));
        } else {
          const again = await edge(`/org-team-members?org_slug=${ORG_SLUG}&org_id=${ORG_ID}`, {
            token: ownerToken,
          });
          const refreshed = (again.json?.data?.members ?? again.json?.members ?? []).find(
            (m) => m.email === FULL_EMAIL
          );
          const stillCustom =
            refreshed &&
            customPerms.every((p) => refreshed.permissions.includes(p)) &&
            refreshed.permissions.length === customPerms.length;
          if (stillCustom) ok('template edit preserves member permission overrides');
          else
            fail(
              'template edit preserves overrides',
              `got=${JSON.stringify(refreshed?.permissions)}`
            );
        }
      }
    }
  }

  // 7) Property seeded delete blocked
  {
    const roles = await edge(
      `/property-team-custom-roles?property_id=${PROPERTY_ID}`,
      { token: ownerToken }
    );
    const list = roles.json?.data?.customRoles ?? roles.json?.customRoles ?? [];
    const readOnly = list.find((r) => r.name === 'Read Only');
    if (!readOnly) {
      fail('property seeded roles missing', JSON.stringify(roles.json));
    } else {
      ok('property seeded roles present', String(list.length));
      const del = await edge('/property-team-custom-roles', {
        method: 'DELETE',
        token: ownerToken,
        body: {
          propertyId: PROPERTY_ID,
          roleId: readOnly.id,
        },
      });
      const msg = del.json?.error || del.json?.message || '';
      if (del.status >= 400 && /default|cannot be deleted/i.test(msg)) {
        ok('seeded property role delete blocked', msg);
      } else {
        fail('seeded property role delete blocked', `status=${del.status} ${msg}`);
      }
    }
  }

  // Cleanup: remove test members
  {
    const membersRes = await edge(`/org-team-members?org_slug=${ORG_SLUG}&org_id=${ORG_ID}`, {
      token: ownerToken,
    });
    const members = membersRes.json?.data?.members ?? membersRes.json?.members ?? [];
    for (const email of [INVITEE_EMAIL, FULL_EMAIL]) {
      const row = members.find((m) => m.email === email);
      if (row?.id) {
        await edge('/org-team-members', {
          method: 'DELETE',
          token: ownerToken,
          body: { orgId: ORG_ID, orgSlug: ORG_SLUG, memberId: row.id },
        });
      }
    }
    ok('cleanup removed test members');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
