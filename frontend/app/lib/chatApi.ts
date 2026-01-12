import { AuthService } from './auth';
import { getConfig } from './config';

export interface ChatRequest {
  message: string;
  language: 'english' | 'spanish';
  sessionId?: string;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  sources: Array<{
    excerpt: string;
    score: number;
    location: string;
    metadata: any;
  }>;
  timestamp: string;
}

export class ChatAPI {
  private authService: AuthService;

  constructor() {
    this.authService = AuthService.getInstance();
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      const config = getConfig();
      
      // Get authentication token
      const token = await this.authService.getToken();

      // Make API call to backend
      const response = await fetch(`${config.api.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: request.message,
          language: request.language,
          sessionId: request.sessionId
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, clear it and retry once
          this.authService.clearToken();
          const newToken = await this.authService.getToken();
          
          const retryResponse = await fetch(`${config.api.baseUrl}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newToken}`
            },
            body: JSON.stringify({
              message: request.message,
              language: request.language,
              sessionId: request.sessionId
            })
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            throw new Error(`API call failed after retry: ${retryResponse.status} - ${errorText}`);
          }

          return await retryResponse.json();
        }
        
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Chat API error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const config = getConfig();
      const response = await fetch(`${config.api.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}