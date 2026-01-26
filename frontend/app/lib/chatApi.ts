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

      // Make API call to get document (backend will handle view vs download based on file type)
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

          await this.handleDocumentResponse(retryResponse);
          return;
        }
        
        throw new Error(`Document access failed: ${response.status}`);
      }

      await this.handleDocumentResponse(response);
    } catch (error) {
      console.error('Document access error:', error);
      throw error;
    }
  }

  private async handleDocumentResponse(response: Response): Promise<void> {
    const contentDisposition = response.headers.get('Content-Disposition');
    const contentType = response.headers.get('Content-Type') || '';
    
    console.log('Content-Disposition header:', contentDisposition);
    console.log('Content-Type header:', contentType);
    
    // Extract filename from Content-Disposition header
    let filename = 'document';
    if (contentDisposition) {
      // Simple regex to extract filename from: attachment; filename="Requirements.docx"
      const match = contentDisposition.match(/filename="([^"]+)"/);
      console.log('Regex match result:', match);
      if (match && match[1]) {
        filename = match[1];
      }
    }
    
    console.log('Final filename:', filename);
    
    const blob = await response.blob();
    
    // Check if it's a PDF (should open in browser)
    if (contentType.includes('application/pdf') && !contentDisposition?.includes('attachment')) {
      // PDF - open in new tab for viewing
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        // Fallback if popup was blocked
        window.location.href = url;
      }
    } else {
      // Other files (Word docs, etc.) - trigger download with correct filename
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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