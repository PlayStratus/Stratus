interface Start {
  type: string;
  request_id: string;
  timestamp: string;
  payload: {
    session_id: string;
    game_id: string;
    width: string;
    height: string;
    session_token: string;
    user_id: string;
    user_name: string;
  }
}

interface HealthCheckMessage {
  type: string;
  timestamp: string;
  payload: {
    hostname: string;
    version: string;
    games: string[];    
    sessions: string[];  
    uptime: number;      
    cpu_load: number;    
    cpu_count: number;
    ram_used: number;    
    ram_total: number;   
    disk_used: number;   
    disk_total: number;  
    temperature: number; 
  };
}

interface Stop  {
  type: string;
  request_id: string;
  timestamp: string;
  payload: {
      session_id: string;
      game_id: string;
      stop_reason: string;
  };
}

interface ConfirmStart  {
  type: string;
  request_id: string;
  timestamp: string;
  payload: {
      session_id: string;
      TLSFingerprint: string;
  };
}
