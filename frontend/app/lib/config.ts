// Configuration for the application
// Note: This function-based approach ensures env vars are read at runtime
export function getConfig() {
  return {
    cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
      region: process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1',
      identityProviderUrl: `https://cognito-idp.${process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1'}.amazonaws.com/`,
    },
    api: {
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',
    },
  };
}

// Legacy export for backward compatibility
export const config = getConfig();

// Function to validate configuration at runtime
export function validateConfig() {
  const currentConfig = getConfig();
  const requiredEnvVars = [
    { key: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID', value: currentConfig.cognito.userPoolId },
    { key: 'NEXT_PUBLIC_COGNITO_CLIENT_ID', value: currentConfig.cognito.clientId },
    { key: 'NEXT_PUBLIC_COGNITO_REGION', value: currentConfig.cognito.region },
    { key: 'NEXT_PUBLIC_API_BASE_URL', value: currentConfig.api.baseUrl }
  ];

  const missing = requiredEnvVars.filter(env => !env.value || env.value === '');
  
  if (missing.length > 0) {
    console.error('Environment variables status:', {
      NEXT_PUBLIC_COGNITO_USER_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
      NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
      NEXT_PUBLIC_COGNITO_REGION: process.env.NEXT_PUBLIC_COGNITO_REGION,
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL
    });
    throw new Error(`Missing required environment variables: ${missing.map(env => env.key).join(', ')}`);
  }
  
  return currentConfig;
}