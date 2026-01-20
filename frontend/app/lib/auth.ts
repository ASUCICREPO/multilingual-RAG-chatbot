import { validateConfig } from './config';

// Simple authentication service for the chatbot
export class AuthService {
  private static instance: AuthService;
  private jwtToken: string | null = null;
  private tokenExpiry: number | null = null;
  private username: string | null = null;
  private password: string | null = null;

  private constructor() {
    // Try to restore session from sessionStorage
    if (typeof window !== 'undefined') {
      const storedToken = sessionStorage.getItem('jwt_token');
      const storedExpiry = sessionStorage.getItem('token_expiry');
      const storedUsername = sessionStorage.getItem('username');
      const storedPassword = sessionStorage.getItem('password');
      
      if (storedToken && storedExpiry && parseInt(storedExpiry) > Date.now()) {
        this.jwtToken = storedToken;
        this.tokenExpiry = parseInt(storedExpiry);
        this.username = storedUsername;
        this.password = storedPassword;
      }
    }
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async login(username: string, password: string): Promise<void> {
    const config = validateConfig();
    
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
            USERNAME: username,
            PASSWORD: password
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Cognito authentication failed:', errorData);
        
        if (errorData.__type === 'NotAuthorizedException') {
          throw new Error('Incorrect username or password');
        }
        throw new Error('Authentication failed');
      }

      const data = await response.json();
      
      // Handle challenge responses (e.g., NEW_PASSWORD_REQUIRED)
      if (data.ChallengeName) {
        if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
          throw new Error('Password change required. Please set a permanent password via AWS Console: Go to Cognito > User Pools > Users > Select user > Actions > Set password > Check "Set as permanent password"');
        }
        throw new Error(`Authentication challenge: ${data.ChallengeName}. Please contact administrator.`);
      }
      
      if (!data.AuthenticationResult?.IdToken) {
        console.error('Unexpected Cognito response:', data);
        throw new Error('No ID token received from Cognito. Please verify user is confirmed and has a permanent password.');
      }

      this.jwtToken = data.AuthenticationResult.IdToken;
      this.username = username;
      this.password = password;
      
      // Set expiry to 50 minutes (tokens are valid for 1 hour)
      this.tokenExpiry = Date.now() + (50 * 60 * 1000);
      
      // Store in sessionStorage (cleared when browser closes)
      if (typeof window !== 'undefined' && this.jwtToken) {
        sessionStorage.setItem('jwt_token', this.jwtToken);
        sessionStorage.setItem('token_expiry', this.tokenExpiry.toString());
        sessionStorage.setItem('username', username);
        sessionStorage.setItem('password', password);
      }
      
    } catch (error) {
      console.error('Authentication error:', error);
      this.clearToken();
      throw error;
    }
  }

  async getToken(): Promise<string> {
    // Check if we have a valid token
    if (this.jwtToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.jwtToken;
    }

    // If we have stored credentials, try to refresh the token
    if (this.username && this.password) {
      await this.login(this.username, this.password);
      if (this.jwtToken) {
        return this.jwtToken;
      }
    }

    throw new Error('Not authenticated. Please log in.');
  }

  logout(): void {
    this.clearToken();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('jwt_token');
      sessionStorage.removeItem('token_expiry');
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('password');
      window.location.href = '/login';
    }
  }

  clearToken(): void {
    this.jwtToken = null;
    this.tokenExpiry = null;
    this.username = null;
    this.password = null;
  }

  isAuthenticated(): boolean {
    return !!(this.jwtToken && this.tokenExpiry && Date.now() < this.tokenExpiry);
  }
}