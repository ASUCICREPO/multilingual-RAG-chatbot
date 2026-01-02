# Bedrock Chatbot Backend - Deployment Guide

## Prerequisites

1. **AWS CLI configured** with appropriate credentials
2. **Node.js 18+** installed
3. **AWS CDK CLI** installed globally: `npm install -g aws-cdk`
4. **Required AWS permissions** for deploying Bedrock, S3, Lambda, API Gateway, and Cognito resources

## Environment Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Bootstrap CDK (First time only)
```bash
npm run bootstrap
```

### 3. Validate Configuration
```bash
npm run validate
```

## Deployment Commands

### Deploy the Stack
```bash
# Deploy the chatbot backend
npm run deploy

# Check differences before deployment
npm run diff

# Destroy the stack (when needed)
npm run destroy
```

## Stack Configuration

The stack is configured with sensible defaults:

- **Environment**: Development-friendly settings
- **Removal Policy**: DESTROY (resources deleted when stack is destroyed)
- **Auto Delete Objects**: Enabled for S3 buckets for easy cleanup
- **Rate Limiting**: 100 requests/second, 200 burst capacity
- **CORS Origins**: `http://localhost:3000`, `https://localhost:3000` (update for production)
- **Test User**: Created automatically (`testuser` / `test@example.com`)
- **Log Level**: DEBUG for detailed logging

## Post-Deployment Configuration

### 1. Update CORS Origins for Production Use
If deploying for production, update the following in `lib/bedrock-chatbot-backend-stack.ts`:
```typescript
allowOrigins: ['https://your-actual-domain.com']
callbackUrls: ['https://your-actual-domain.com/callback']
logoutUrls: ['https://your-actual-domain.com']
```

Then redeploy:
```bash
npm run deploy
```

### 2. Upload Sample Documents
Upload documents to the S3 bucket under the `/docs` prefix:
```bash
# Get the bucket name from CDK outputs
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name BedrockChatbotBackendStack --query 'Stacks[0].Outputs[?OutputKey==`DocumentSourceBucketName`].OutputValue' --output text)

# Upload documents
aws s3 cp sample-document.pdf s3://$BUCKET_NAME/docs/
```

### 3. Trigger Knowledge Base Sync
After uploading documents, trigger a sync job:
```bash
# Get the Knowledge Base and Data Source IDs from CDK outputs
KB_ID=$(aws cloudformation describe-stacks --stack-name BedrockChatbotBackendStack --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)
DS_ID=$(aws cloudformation describe-stacks --stack-name BedrockChatbotBackendStack --query 'Stacks[0].Outputs[?OutputKey==`DataSourceId`].OutputValue' --output text)

# Start ingestion job
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID
```

## Testing the Deployment

### 1. Health Check
```bash
# Get the API URL from CDK outputs
API_URL=$(aws cloudformation describe-stacks --stack-name BedrockChatbotBackendStack --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' --output text)

# Test health endpoint
curl $API_URL/health
```

### 2. Authentication Setup
The stack creates a test user for immediate testing:
- **Username**: `testuser`
- **Email**: `test@example.com`
- **Temporary Password**: Set via Cognito console

### 3. Chat Endpoint Testing
```bash
# You'll need a valid JWT token from Cognito to test the chat endpoint
curl -X POST $API_URL/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how can you help me?"}'
```

## Monitoring and Troubleshooting

### CloudWatch Dashboard
Access the monitoring dashboard using the URL from CDK outputs:
```bash
aws cloudformation describe-stacks --stack-name BedrockChatbotBackendStack --query 'Stacks[0].Outputs[?OutputKey==`DashboardUrl`].OutputValue' --output text
```

### Lambda Logs
View Lambda function logs:
```bash
aws logs tail /aws/lambda/bedrock-chatbot-handler-development --follow
```

### Common Issues

1. **Bedrock Model Access**: Ensure you have access to Nova models in your region
2. **S3 Vectors**: Verify S3 Vectors service is available in your region
3. **IAM Permissions**: Check that the Bedrock service role has proper permissions
4. **Cognito Configuration**: Verify callback URLs match your frontend domain

## Security Considerations

### CDK Nag Compliance
The stack includes CDK Nag for security validation. All suppressions are documented with justifications.

### IAM Least Privilege
- Bedrock service role has minimal required permissions
- Lambda execution role follows least privilege principle
- API Gateway uses Cognito JWT authorization

### Data Encryption
- S3 buckets use server-side encryption
- Lambda environment variables are encrypted
- API Gateway enforces HTTPS

## Cleanup

To completely remove the stack and all resources:
```bash
npm run destroy
```

Note: This will delete all data including uploaded documents and conversation history.

## Support

For issues or questions:
1. Check CloudWatch logs for error details
2. Review CDK synthesis output for configuration issues
3. Verify AWS service quotas and limits
4. Ensure all required AWS services are available in your region