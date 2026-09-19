// One policy for the existing identity provider, HTTP routes and domain handlers.
// Role names are read only from the provider's verified account responses.
const providerRoles = { 'turnli-cleaner': 'cleaner', 'turnli-host': 'host' };
const rolePermissions = {
 cleaner: ['completion.submit','workspace.read','workspace.setup','cleaning.work','calendar.read','calendar.manage','cleaner.view','jobs.assigned','guide.assigned','preferences'],
 host: ['completion.review','jobs.manage','guide.read','guide.write','host.view','workspace.read','workspace.setup','calendar.read','calendar.manage','preferences'],
};
const hostSections = {
 properties: 'Properties',
 reservations: 'Reservations',
 'cleaning-jobs': 'Cleaning jobs',
 'cleaning-setup': 'Cleaning setup',
 settings: 'Account & settings',
};
function resolveRole(providerUser, tenantId) {
 // Tenant roles cannot grant access in a different tenant or personal workspace.
 const names = tenantId
  ? providerUser.userTenants?.find(t => t.tenantId === tenantId)?.roleNames
  : providerUser.roleNames;
 if (names !== undefined && (!Array.isArray(names) || names.some(n => typeof n !== 'string'))) return null;
 const roles = [...new Set((names || []).filter(n => n.startsWith('turnli-')))];
 if (!roles.length) return 'cleaner'; // Preserve existing accounts and invitations.
 if (roles.length !== 1) return null;
 return Object.hasOwn(providerRoles,roles[0]) ? providerRoles[roles[0]] : null;
}
function can(user, permission) {
 return !!user?.workspaceId && Object.hasOwn(rolePermissions, user.role) && rolePermissions[user.role].includes(permission);
}
// A Cleaner administers their personal workspace, never a Host tenant merely
// because the provider also lists them as a member. Assigned work uses job scope.
function managedWorkspace(user) {
 if (!user?.id) return null;
 return can(user,'host.view') ? user.workspaceId : can(user,'cleaner.view') ? 'user:'+user.id : null;
}
function home(user) { return can(user,'host.view') ? '/app/host' : can(user,'cleaner.view') ? '/app' : null; }
function workspaceRoute(user, path) {
 const destination = home(user);
 if (!destination) return {status:403,error:'Workspace role unavailable or unsupported. Contact your workspace administrator.'};
 if (path === '/app') return destination === path ? {status:200} : {status:303,location:destination};
 if (path === '/app/host' || path.startsWith('/app/host/')) {
  if (!can(user,'host.view')) return {status:403,error:'You do not have access to the Host Workspace.'};
  const section = path.slice('/app/host/'.length);
  return path === '/app/host' || Object.hasOwn(hostSections, section) ? {status:200} : {status:404,error:'Workspace page not found.'};
 }
 return {status:404,error:'Workspace page not found.'};
}
function dashboardPermission(action) {
 if (action === 'preferences') return 'preferences';
 if (['check','reset','legacy-progress'].includes(action)) return 'cleaning.work';
 return 'workspace.setup';
}
module.exports={resolveRole,can,home,workspaceRoute,hostSections,dashboardPermission,managedWorkspace};
