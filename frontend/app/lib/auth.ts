import { validateConfig } from './config';

// Simple authentication service for the chatbot
export class AuthService {
  private static instance: AuthService;
  private jwtToken: string | null = null;
  private tokenExpiry: number | null = null;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async getToken(): Promise<string> {
    // Validate configuration when first used
    const config = validateConfig();
    
    // Check if we have a valid token
    if (this.jwtToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.jwtToken;
    }

    // Get new token from AWS Cognito
    try {
      const response = await fetch(config.cognito.identityProviderUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
        },
        body: JSON.stringify({
          ClientId: config.cognito.clientId,
          AuthFlow: 'USER_PASSWORD_AUTH',
          AuthParameters: {
            USERNAME: config.testUser.username,
            PASSWORD: config.testUser.password
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Cognito authentication failed:', errorData);
        throw new Error('Failed to authenticate with Cognito');
      }

      const data = await response.json();
      
      if (!data.AuthenticationResult?.IdToken) {
        throw new Error('No ID token received from Cognito');
      }

      this.jwtToken = data.AuthenticationResult.IdToken;
      
      // Set expiry to 50 minutes (tokens are valid for 1 hour)
      this.tokenExpiry = Date.now() + (50 * 60 * 1000);
      
      if (!this.jwtToken) {
        throw new Error('Failed to store JWT token');
      }
      
      return this.jwtToken;
    } catch (error) {
      console.error('Authentication error:', error);
      this.clearToken();
      throw new Error('Authentication failed');
    }
  }

  clearToken(): void {
    this.jwtToken = null;
    this.tokenExpiry = null;
  }

  isTokenValid(): boolean {
    return !!(this.jwtToken && this.tokenExpiry && Date.now() < this.tokenExpiry);
  }
}