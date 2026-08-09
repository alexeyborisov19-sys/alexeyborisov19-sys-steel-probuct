export const pdRoles = ["ADMIN", "PERSONAL_DATA_OFFICER", "MANAGER", "AUDITOR"] as const;
export type PdRole = (typeof pdRoles)[number];

export const pdPermissions = [
  "VIEW_DASHBOARD",
  "VIEW_MASKED_LEADS",
  "VIEW_FULL_LEAD",
  "REVEAL_CONTACTS",
  "SEARCH_CONTACT",
  "SEARCH_TEXT",
  "VIEW_CONSENT",
  "VIEW_ATTACHMENTS",
  "DOWNLOAD_ATTACHMENT",
  "CHANGE_WORKFLOW",
  "ASSIGN_LEAD",
  "ADD_COMMENT",
  "EDIT_OWN_COMMENT",
  "VIEW_ACCESS_LOG",
  "VERIFY_ACCESS_LOG",
  "VIEW_INTEGRITY",
  "REVOKE_SESSIONS",
  "CHANGE_RETENTION",
  "CREATE_SUBJECT_REQUEST",
  "UPDATE_SUBJECT_REQUEST",
  "CREATE_LEGAL_HOLD",
  "RELEASE_LEGAL_HOLD",
  "CREATE_EXPORT_PREVIEW",
  "APPROVE_EXPORT",
  "DOWNLOAD_EXPORT",
  "CREATE_DELETION_JOB",
  "APPROVE_DELETION",
  "VIEW_INCIDENTS",
  "MANAGE_INCIDENTS",
  "VIEW_SYSTEMS_REGISTRY",
  "MANAGE_SYSTEMS_REGISTRY",
  "MANAGE_USERS",
  "CHANGE_ROLES",
  "RUN_INTEGRITY_CHECK",
  "VIEW_BACKUP_STATUS",
] as const;

export type PdPermission = (typeof pdPermissions)[number];

const allPermissions = new Set<PdPermission>(pdPermissions);
const permissionMatrix: Record<PdRole, ReadonlySet<PdPermission>> = {
  ADMIN: allPermissions,
  PERSONAL_DATA_OFFICER: new Set([
    "VIEW_DASHBOARD",
    "VIEW_MASKED_LEADS",
    "VIEW_FULL_LEAD",
    "REVEAL_CONTACTS",
    "SEARCH_CONTACT",
    "SEARCH_TEXT",
    "VIEW_CONSENT",
    "VIEW_ATTACHMENTS",
    "DOWNLOAD_ATTACHMENT",
    "CHANGE_WORKFLOW",
    "ASSIGN_LEAD",
    "ADD_COMMENT",
    "EDIT_OWN_COMMENT",
    "VIEW_ACCESS_LOG",
    "VERIFY_ACCESS_LOG",
    "VIEW_INTEGRITY",
    "CHANGE_RETENTION",
    "CREATE_SUBJECT_REQUEST",
    "UPDATE_SUBJECT_REQUEST",
    "CREATE_LEGAL_HOLD",
    "RELEASE_LEGAL_HOLD",
    "CREATE_EXPORT_PREVIEW",
    "APPROVE_EXPORT",
    "DOWNLOAD_EXPORT",
    "CREATE_DELETION_JOB",
    "APPROVE_DELETION",
    "VIEW_INCIDENTS",
    "MANAGE_INCIDENTS",
    "VIEW_SYSTEMS_REGISTRY",
    "MANAGE_SYSTEMS_REGISTRY",
    "RUN_INTEGRITY_CHECK",
    "VIEW_BACKUP_STATUS",
  ]),
  MANAGER: new Set([
    "VIEW_DASHBOARD",
    "VIEW_MASKED_LEADS",
    "VIEW_FULL_LEAD",
    "REVEAL_CONTACTS",
    "SEARCH_CONTACT",
    "VIEW_ATTACHMENTS",
    "DOWNLOAD_ATTACHMENT",
    "CHANGE_WORKFLOW",
    "ADD_COMMENT",
    "EDIT_OWN_COMMENT",
  ]),
  AUDITOR: new Set([
    "VIEW_DASHBOARD",
    "VIEW_MASKED_LEADS",
    "VIEW_CONSENT",
    "VIEW_ACCESS_LOG",
    "VERIFY_ACCESS_LOG",
    "VIEW_INTEGRITY",
    "VIEW_INCIDENTS",
    "VIEW_SYSTEMS_REGISTRY",
    "VIEW_BACKUP_STATUS",
  ]),
};

export class PdAuthorizationError extends Error {
  readonly code = "PD_FORBIDDEN";

  constructor() {
    super("The requested personal-data operation is not permitted");
    this.name = "PdAuthorizationError";
  }
}

export function hasPdPermission(role: PdRole, permission: PdPermission) {
  return permissionMatrix[role].has(permission);
}

export function assertPdPermission(role: PdRole, permission: PdPermission) {
  if (!hasPdPermission(role, permission)) throw new PdAuthorizationError();
}

export function permissionsForRole(role: PdRole) {
  return [...permissionMatrix[role]].sort();
}
