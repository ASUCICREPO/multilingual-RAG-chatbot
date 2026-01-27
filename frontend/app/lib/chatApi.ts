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
    document: string;
    location: string;
    downloadUrl: string | null;
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

  async viewDocument(documentPath: string): Promise<void> {
    try {
      const config = getConfig();
      
      // Get authentication token
      const token = await this.authService.getToken();

      // Make API call to get pre-signed URL
      const response = await fetch(`${config.api.baseUrl}/document?path=${encodeURIComponent(documentPath)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, clear it and retry once
          this.authService.clearToken();
          const newToken = await this.authService.getToken();
          
          const retryResponse = await fetch(`${config.api.baseUrl}/document?path=${encodeURIComponent(documentPath)}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${newToken}`
            }
          });

          if (!retryResponse.ok) {
            throw new Error(`Document access failed after retry: ${retryResponse.status}`);
          }

          const retryData = await retryResponse.json();
          this.openPresignedUrl(retryData);
          return;
        }
        
        throw new Error(`Document access failed: ${response.status}`);
      }

      // Backend returns JSON with pre-signed URL
      const data = await response.json();
      this.openPresignedUrl(data);
    } catch (error) {
      console.error('Document access error:', error);
      throw error;
    }
  }

  private openPresignedUrl(data: { url: string; filename: string; expiresIn: number }): void {
    // Determine if it's a PDF based on filename extension
    const isPdf = data.filename.toLowerCase().endsWith('.pdf');
    
    if (isPdf) {
      // PDF - open in new tab for viewing
      const newWindow = window.open(data.url, '_blank');
      if (!newWindow) {
        // Fallback if popup was blocked
        window.location.href = data.url;
      }
    } else {
      // Other files - open the pre-signed URL (S3 handles download with Content-Disposition)
      window.open(data.url, '_blank');
    }
  }

  async getToken(): Promise<string> {
    return await this.authService.getToken();
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