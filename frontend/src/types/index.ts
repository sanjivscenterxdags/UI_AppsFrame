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
