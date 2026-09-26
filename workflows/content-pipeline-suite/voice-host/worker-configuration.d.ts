interface Env {
  SESSION: DurableObjectNamespace;
  INDEX: DurableObjectNamespace;
  SERIES: DurableObjectNamespace;
  ASSETS?: Fetcher;
  RETELL_API_KEY?: string;
  OWNER_INTERVIEW_HOST_TOKEN?: string;
  RETELL_WEBHOOK_KEY?: string;
  RETELL_AGENT_ID: string;
  RETELL_EXPERT_AGENT_ID?: string;
  RETELL_VOICE_AGENT_ID?: string;
  VOICE_LINK_EXPIRY_DAYS?: string;
  LINK_EXPIRY_DAYS: string;
  RETENTION_DAYS: string;
  START_CAP: string;
  EXPERT_START_CAP?: string;
  PUBLIC_ORIGIN?: string;
}
