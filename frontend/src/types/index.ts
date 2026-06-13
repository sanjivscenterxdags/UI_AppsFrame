export interface UserSession {
  id: number;
  token: string;
  username: string;
  role: string;
}

export interface SubAgent {
  id: number;
  name: string;
  description?: string;
  group_type: string;
  created_at: string;
  updated_at?: string;
}

export interface ExpertAgent {
  id: number;
  name: string;
  description?: string;
  color_theme: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  specific_sub_agents: SubAgent[];
}

export interface SystemLog {
  id: number;
  created_at: string;
  level: string;
  source: string;
  message: string;
  metadata_json?: string;
}

export type AdminNavView = 'user-mgmt' | 'agent-mgmt' | 'prompt-window' | 'health-status';

export type ViewMode = 'grid' | 'tile';

// ---------------------------------------------------------------------------
// User Management types (Iteration 3)
// ---------------------------------------------------------------------------

export type UserRole =
  | 'superuser' | 'operator'
  | 'admin-data-manager' | 'admin-asset-register-manager'
  | 'admin-asset-risk-manager' | 'admin-change-manager'
  | 'admin-logging-manager' | 'admin-siem-manager'
  | 'admin-reports-manager' | 'general-user' | 'admin';

export const ALL_ROLES: UserRole[] = [
  'superuser', 'operator', 'admin-data-manager',
  'admin-asset-register-manager', 'admin-asset-risk-manager',
  'admin-change-manager', 'admin-logging-manager',
  'admin-siem-manager', 'admin-reports-manager', 'general-user',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  'superuser':                    'Superuser',
  'operator':                     'Operator',
  'admin-data-manager':           'Data Mgr Admin',
  'admin-asset-register-manager': 'Asset Reg Admin',
  'admin-asset-risk-manager':     'Asset Risk Admin',
  'admin-change-manager':         'Change Mgr Admin',
  'admin-logging-manager':        'Logging Admin',
  'admin-siem-manager':           'SIEM Admin',
  'admin-reports-manager':        'Reports Admin',
  'general-user':                 'General User',
  'admin':                        'Admin (Legacy)',
};

export const ROLE_SHORT: Record<string, string> = {
  'superuser':                    'SU',
  'operator':                     'OPR',
  'admin-data-manager':           'DATA',
  'admin-asset-register-manager': 'ASSET-REG',
  'admin-asset-risk-manager':     'ASSET-RISK',
  'admin-change-manager':         'CHG',
  'admin-logging-manager':        'LOG',
  'admin-siem-manager':           'SIEM',
  'admin-reports-manager':        'RPT',
  'general-user':                 'GEN',
};

export interface UserListItem {
  id:           number;
  uid:          string;
  username:     string;
  email:        string;
  role:         UserRole;
  is_active:    boolean;
  corporate_id: string | null;
  created_at:   string;
  updated_at:   string | null;
}

export interface UserCreatePayload {
  username:     string;
  email:        string;
  password:     string;
  role:         UserRole;
  corporate_id?: string;
  is_active?:   boolean;
}

export interface UserUpdatePayload {
  email?:        string;
  role?:         UserRole;
  corporate_id?: string;
  is_active?:    boolean;
}

export interface EaAccessItem {
  id:              number;
  user_id:         number;
  expert_agent_id: number;
}
