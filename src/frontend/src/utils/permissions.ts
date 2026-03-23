export type RoleSections = Record<string, string[]>;

const normalizePerms = (perms?: string[]) => (perms || []).map((p) => String(p).toLowerCase());

export const getSectionPermissions = (sections: RoleSections | null | undefined, section: string) => {
  if (!sections) return [];
  if (sections['*']) {
    return normalizePerms(sections['*']);
  }
  return normalizePerms(sections[section] || []);
};

export const hasSectionPermission = (
  sections: RoleSections | null | undefined,
  section: string,
  action: 'get' | 'post' | 'patch' | 'delete' = 'get'
) => {
  const perms = getSectionPermissions(sections, section);
  if (perms.includes('*')) return true;
  if (action === 'get') {
    return perms.includes('get') || perms.includes('own') || perms.includes('dep');
  }
  return perms.includes(action);
};

export const getSectionScope = (sections: RoleSections | null | undefined, section: string) => {
  const perms = getSectionPermissions(sections, section);
  if (perms.includes('*')) return 'all';
  if (perms.includes('dep')) return 'dep';
  if (perms.includes('own')) return 'own';
  if (perms.some((p) => ['get', 'post', 'patch', 'delete'].includes(p))) return 'all';
  return null;
};
