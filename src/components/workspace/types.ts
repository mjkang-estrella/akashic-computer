export interface Computer {
  id: string;
  name: string;
  role: string;
  state: string;
  status: string;
  memoryTotal?: number;
  memoryAvailable?: number;
  hardware?: string;
  note?: string;
  group?: string;
  observedAt?: number;
  connectorId?: string;
}
export interface Connector {
  id: string;
  name: string;
  lastSeenAt: number;
  revoked?: boolean;
}
export interface Deployment {
  id: string;
  model: string;
  status: string;
  connectorId: string;
  observedAt?: number;
  artifactRepo?: string;
}
export interface Conversation {
  id: string;
  title: string;
  mode: "chat" | "agent";
  deploymentId?: string;
}
export interface Message {
  id: string;
  role: string;
  content: string;
  partial?: boolean;
}
export interface Job {
  id: string;
  status: string;
  output?: string;
  error?: string;
  rounds: number;
  completionTokens: number;
  leaseUntil?: number;
  events?: { tool: string; status: string }[];
}
export interface WorkspaceProps {
  view: "work" | "computers";
  sessions: Conversation[];
  current: Conversation | null;
  messages: Message[];
  jobs: Job[];
  devices: Computer[];
  connectors: Connector[];
  deployments: Deployment[];
  loading?: boolean;
  notice?: string;
  legacy?: boolean;
  preferredDeploymentId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSend: (
    text: string,
    mode: "chat" | "agent",
    deploymentId: string,
    budget: number,
  ) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
  onRevoke?: (id: string) => Promise<void>;
  onShare?: (text: string) => Promise<void>;
  connectionPanel?: React.ReactNode;
}
