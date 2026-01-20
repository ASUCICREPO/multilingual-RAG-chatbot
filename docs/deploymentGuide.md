# Multilingual RAG Chatbot - Deployment Guide

This guide provides step-by-step instructions to deploy the Multilingual RAG Chatbot in your AWS account. The deployment is done through AWS CloudShell with an automated deployment script.

**Estimated Time:** 20-30 minutes

---

## ⚠️ Important: Complete Prerequisites First

**Before starting deployment, you MUST complete all prerequisites:**

👉 **[Read the Prerequisites Guide](./prerequisites.md)** 👈

The prerequisites guide covers:
- AWS account requirements and region selection (us-east-1 only)
- **Bedrock Model Access** - Automatically enabled for Nova models
- AWS CLI and CDK installation
- IAM permissions for deployment

---

## Deployment Overview

The deployment consists of 4 main phases:

1. **Phase 1:** Create IAM Service Role
2. **Phase 2:** Create Amplify Application for Frontend Hosting
3. **Phase 3:** Create CodeBuild Project for Unified Deployment
4. **Phase 4:** Execute Build (CDK Backend + Next.js Frontend)

After deployment, you'll need to:
- Configure user credentials via AWS Console
- Upload documents to the Knowledge Base
- Trigger a Knowledge Base sync
- Access the application

---

## Phase 1: Create IAM Service Role

### Step 1.1: Open AWS CloudShell

⚠️ **Important**: This project only supports **us-east-1** region.

1. In the AWS Console, **ensure you are in the us-east-1 region** (check top-right corner)
2. Click the **CloudShell icon** (terminal icon in the top navigation bar)
3. Wait for CloudShell to initialize
4. Verify and set your region:
   ```bash
   export AWS_REGION=us-east-1
   echo $AWS_REGION
   ```

### Step 1.2: Clone the Repository

```bash
git clone https://github.com/ASUCICREPO/multilingual-RAG-chatbot.git
cd multilingual-RAG-chatbot
```

### Step 1.3: Make Deploy Script Executable

```bash
chmod +x ./deploy.sh
```

### Step 1.4: Run Deployment Script

```bash
./deploy.sh
```

The deployment will begin automatically. User credentials will be configured after deployment via the AWS Console (see [User Configuration](#user-configuration-via-console) section).

### Step 1.5: IAM Service Role Creation

The script automatically creates an IAM service role for CodeBuild:

- **Role Name:** `bedrock-chatbot-service-role`
- **Permissions:** CloudFormation, Lambda, S3, S3 Vectors, Bedrock, Amplify, CodeBuild, API Gateway, Cognito, and more

**What happens:**
1. Script checks if role already exists
2. If not, creates role with CodeBuild trust policy
3. Attaches custom deployment policy with required permissions
4. Waits 10 seconds for IAM propagation

**Expected output:**
```
[INFO] 🔐 Phase 1: Creating IAM Service Role...
[INFO] Checking for IAM role: bedrock-chatbot-service-role
[INFO] Creating IAM role: bedrock-chatbot-service-role
[INFO] Attaching custom deployment policy...
[SUCCESS] IAM role created
[INFO] Waiting for IAM role to propagate for 10 seconds...
```

---

## Phase 2: Create Amplify Application

The script automatically creates an AWS Amplify application for frontend hosting.

### Step 2.1: Amplify App Creation

**What happens:**
1. Script checks if app named `BedrockChatbot` already exists
2. If not, creates new Amplify app with WEB_COMPUTE platform
3. Creates `main` branch for production deployment

**Expected output:**
```
[AMPLIFY] 🌐 Phase 2: Creating Amplify Application for Static Hosting...
[INFO] Creating Amplify app for static hosting: BedrockChatbot
[SUCCESS] Amplify app created with ID: d1234abcdef
[INFO] Creating main branch...
[SUCCESS] main branch created
```

### Step 2.2: Verify Amplify App (Optional)

You can verify the app was created:

1. Go to **AWS Amplify Console**: https://console.aws.amazon.com/amplify/
2. Look for app named `BedrockChatbot`
3. Verify `main` branch exists

---

## Phase 3: Create CodeBuild Project

The script creates a unified CodeBuild project that deploys both backend and frontend.

### Step 3.1: CodeBuild Project Creation

**What happens:**
1. Script creates/updates CodeBuild project named `bedrock-chatbot-deployment`
2. Configures environment variables:
   - `AMPLIFY_APP_ID` - For frontend deployment
   - `CDK_DEFAULT_REGION` - AWS region
   - `CDK_DEFAULT_ACCOUNT` - AWS account ID
3. Links to GitHub repository and `buildspec.yml`

**Expected output:**
```
[CODEBUILD] 🏗️ Phase 3: Creating Unified CodeBuild Project...
[INFO] Checking for CodeBuild project 'bedrock-chatbot-deployment'...
[INFO] Creating unified CodeBuild project 'bedrock-chatbot-deployment'...
[SUCCESS] Unified CodeBuild project 'bedrock-chatbot-deployment' created.
```

---

## Phase 4: Execute Unified Deployment

The script starts the CodeBuild job which deploys all infrastructure.

### Step 4.1: Build Execution

**What happens:**
1. Script starts CodeBuild job
2. Streams logs showing deployment progress
3. Monitors build status until completion

**Expected output:**
```
[CODEBUILD] 🚀 Phase 4: Starting Unified Deployment (Backend + Frontend)...
[INFO] Starting deployment build for project 'bedrock-chatbot-deployment'...
[SUCCESS] Deployment build started successfully. Build ID: bedrock-chatbot-deployment:abc123
[INFO] Streaming deployment logs...
[INFO] Monitoring build progress...
```

### Step 4.2: Build Phases

The CodeBuild job executes these phases:

**Install Phase:**
- Installs Node.js 20
- Installs AWS CDK CLI globally
- Installs zip utility

**Pre-Build Phase:**
- Changes to backend directory
- Installs backend npm dependencies
- Bootstraps CDK for your account/region

**Build Phase:**
- Deploys CDK stack (`BedrockChatbotBackendStack`)
- Extracts API Gateway URL and Cognito details
- Creates frontend `.env.local` with backend configuration
- Builds Next.js application
- Creates deployment zip package

**Post-Build Phase:**
- Deploys frontend to Amplify
- Completes deployment

### Step 4.3: Wait for Deployment

**This will take approximately 10-15 minutes.**

You can also monitor the build in AWS Console:
1. Go to **AWS CodeBuild Console**: https://console.aws.amazon.com/codesuite/codebuild/
2. Click on project `bedrock-chatbot-deployment`
3. Click on the running build
4. Click **Tail logs** to see real-time output

### Step 4.4: Deployment Complete

When deployment succeeds, you'll see:

```
[INFO] Deployment build status: SUCCEEDED
[SUCCESS] Complete deployment finished successfully!

==========================================================================
DEPLOYMENT SUMMARY
==========================================================================

Backend Infrastructure:
   API Gateway URL: https://abc123xyz.execute-api.us-east-1.amazonaws.com
   Knowledge Base ID: XXXXXXXXXX
   User Pool ID: us-east-1_XXXXXXXXX
   User Pool Client ID: XXXXXXXXXXXXXXXXXXXXXXXXXX
   CDK Stack: BedrockChatbotBackendStack
   AWS Region: us-east-1

Frontend:
   Amplify App ID: d1234abcdef
   Frontend URL: https://main.d1234abcdef.amplifyapp.com

What was deployed:
   ✅ CDK backend infrastructure via CodeBuild
   ✅ Amazon Bedrock Knowledge Base with S3 Vectors
   ✅ Amazon Bedrock Agent with Nova 2 Lite model
   ✅ API Gateway with Lambda functions
   ✅ Cognito User Pool for authentication
   ✅ S3 bucket for document storage
   ✅ Frontend built and deployed to Amplify

==========================================================================
```

### Step 4.5: Save Deployment Information

**Copy and save these values** from the deployment summary:

```bash
API_GATEWAY_URL=<value>
KNOWLEDGE_BASE_ID=<value>
USER_POOL_ID=<value>
USER_POOL_CLIENT_ID=<value>
AMPLIFY_APP_ID=<value>
FRONTEND_URL=<value>
```

---

## Post-Deployment: Upload Documents to Knowledge Base

After deployment, you need to upload documents for the chatbot to reference.

### Step 5.1: Get S3 Bucket Name

```bash
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name BedrockChatbotBackendStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DocumentSourceBucketName`].OutputValue' \
  --output text)

echo "Bucket Name: $BUCKET_NAME"
```

### Step 5.2: Upload Documents

Upload your documents to the `/docs` prefix:

```bash
# Upload a single document
aws s3 cp your-document.pdf s3://$BUCKET_NAME/docs/

# Upload multiple documents
aws s3 cp ./documents/ s3://$BUCKET_NAME/docs/ --recursive

# Verify upload
aws s3 ls s3://$BUCKET_NAME/docs/
```

**Supported file formats:**
- PDF files (`.pdf`)
- Word documents (`.docx`)
- Text files (`.txt`)
- Markdown files (`.md`)

### Step 5.3: Start Knowledge Base Ingestion

Trigger the ingestion job to process uploaded documents:

```bash
# Get Data Source ID
DS_ID=$(aws cloudformation describe-stacks \
  --stack-name BedrockChatbotBackendStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DataSourceId`].OutputValue' \
  --output text)

# Get Knowledge Base ID
KB_ID=$(aws cloudformation describe-stacks \
  --stack-name BedrockChatbotBackendStack \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' \
  --output text)

# Start ingestion job
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID
```

### Step 5.4: Check Ingestion Status

```bash
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID \
  --query 'ingestionJobSummaries[0].{Status:status,Documents:statistics.numberOfDocumentsScanned}'
```

**Wait for status to be `COMPLETE` before testing the chatbot.**

---

## Verification

### Verify Deployment Success

1. **Frontend:** Access the Frontend URL from deployment summary
2. **Health Check:** Test the API health endpoint:
   ```bash
   curl $API_GATEWAY_URL/health
   ```
   Expected response:
   ```json
   {"status": "healthy", "service": "bedrock-chatbot-backend", "timestamp": "..."}
   ```
3. **Cognito:** Verify user pool exists in Cognito console
4. **S3 Bucket:** Verify bucket exists with `/docs` prefix
5. **Knowledge Base:** Verify Knowledge Base is in "Ready" state

### Test the System

1. Navigate to the **Frontend URL**
2. Click the **chat bubble** (bottom-right corner)
3. Log in with your user credentials (see [User Configuration](#user-configuration-via-console))
4. Select language (English or Spanish)
5. Ask a question about your uploaded documents
6. Verify response includes source document attribution

---

## User Configuration via Console

After deployment, create user accounts through the AWS Console. No users are created automatically during deployment.

### Create Users via Console

1. **Navigate to Amazon Cognito Console**
   - Go to: https://console.aws.amazon.com/cognito/
   - Ensure you're in the **us-east-1** region

2. **Find Your User Pool**
   - Click **User pools** in the left sidebar
   - Look for `bedrock-chatbot-users-development`
   - Click on the user pool name

3. **Create User**
   - Click **Users** tab → **Create user**
   - **User name**: Enter username (e.g., `testuser`)
   - **Email address**: Enter email
   - **Temporary password**: Set initial password
   - Check **Mark email as verified**
   - Click **Create user**

4. **Set Permanent Password**
   - Click on the new user
   - Click **Actions** → **Set password**
   - Enter a password meeting requirements:
     - At least 8 characters
     - Uppercase and lowercase letters
     - Numbers and special characters
   - Select **Set as permanent password**
   - Click **Set password**

### Create Users via CLI (Alternative)

```bash
# Get User Pool ID
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name BedrockChatbotBackendStack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

# Create new user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username newuser \
  --user-attributes Name=email,Value=newuser@example.com Name=email_verified,Value=true \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username newuser \
  --password "YourSecurePassword123!" \
  --permanent
```

---

## Complete Deployment Reference

### Resources Created

| Resource | Name/ID |
|----------|---------|
| CDK Stack | `BedrockChatbotBackendStack` |
| S3 Document Bucket | `bedrock-chatbot-documents-development-<account>` |
| S3 Vector Bucket | `bedrock-chatbot-vectors-development-<account>` |
| Knowledge Base | `bedrock-chatbot-kb-development` |
| Lambda Function | `bedrock-chatbot-handler-development` |
| API Gateway | `bedrock-chatbot-api-development` |
| Cognito User Pool | `bedrock-chatbot-users-development` |
| Amplify App | `BedrockChatbot` |
| CodeBuild Project | `bedrock-chatbot-deployment` |
| IAM Role | `bedrock-chatbot-service-role` |

### Environment Variables in Lambda

| Variable | Value | Description |
|----------|-------|-------------|
| `MODEL_ID` | `global.amazon.nova-2-lite-v1:0` | Bedrock model identifier |
| `KNOWLEDGE_BASE_ID` | (from deployment) | Knowledge Base ID for RAG |
| `USE_KNOWLEDGE_BASE` | `true` | Enable RAG retrieval |
| `MAX_TOKENS` | `2048` | Max tokens (env var) |
| `TEMPERATURE` | `0.3` | Temperature (env var) |
| `LOG_LEVEL` | `DEBUG` | Logging verbosity |

**Note:** Actual inference uses optimized values: `maxTokens=512`, `temperature=0.5`, `topP=0.7` for concise responses.

---

## Troubleshooting

### Issue: CodeBuild Fails with Permission Error

**Error:** `User is not authorized to perform: iam:CreateRole`

**Solution:**
1. Ensure your AWS user has IAM permissions
2. Check the IAM policy attached to your user/role
3. Request admin to grant required permissions

### Issue: Bedrock Model Access Denied

**Error:** `AccessDeniedException: You don't have access to the model`

**Solution:**
As of October 2025, Amazon Nova models are automatically enabled. If you see this error:

1. **Check IAM permissions** - Ensure your role has `bedrock:InvokeModel` permission
2. **Verify region** - Ensure you're in us-east-1 where all services are available
3. **Check the model ID** - Verify the model ID is correct: `global.amazon.nova-2-lite-v1:0`

```bash
# Test model access
aws bedrock list-foundation-models \
  --by-provider amazon \
  --query 'modelSummaries[?contains(modelId, `nova`)]'
```

### Issue: S3 Vectors Not Available

**Error:** `S3 Vectors service is not available in this region`

**Solution:**
This project only supports **us-east-1**. Redeploy in us-east-1:
```bash
# Switch to us-east-1 in AWS Console
export AWS_REGION=us-east-1

# If you deployed in wrong region, delete resources first
aws cloudformation delete-stack --stack-name BedrockChatbotBackendStack --region <wrong-region>

# Then redeploy in us-east-1
./deploy.sh
```

### Issue: CDK Bootstrap Required

**Error:** `This stack uses assets, so the toolkit stack must be deployed`

**Solution:**
The buildspec automatically bootstraps CDK. If it fails:
```bash
cd backend
cdk bootstrap aws://<account-id>/<region>
```

### Issue: Amplify Deployment Fails

**Error:** `Deployment failed with status: FAILED`

**Solution:**
1. Check CodeBuild logs for specific error
2. Verify frontend builds locally:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
3. Check for missing environment variables

### Issue: Frontend Shows "Connection Issues"

**Possible Causes:**
1. API Gateway URL not configured correctly
2. CORS not allowing frontend origin
3. Cognito settings incorrect

**Solution:**
1. Verify API health: `curl $API_GATEWAY_URL/health`
2. Check browser console for CORS errors
3. Verify Cognito callback URLs include your frontend URL

### Issue: Knowledge Base Returns No Results

**Possible Causes:**
1. No documents uploaded
2. Ingestion job not complete
3. Documents in wrong S3 prefix

**Solution:**
1. Upload documents to `s3://bucket/docs/` (note the `/docs` prefix)
2. Start ingestion job and wait for completion
3. Check ingestion status for errors

---

## Clean Up

To delete all resources:

```bash
# Run the cleanup script
chmod +x ./cleanup.sh
./cleanup.sh
```

Or manually:

```bash
# Delete CDK stack (this deletes most resources)
cd backend
cdk destroy

# Delete Amplify app
aws amplify delete-app --app-id <your-app-id>

# Delete CodeBuild project
aws codebuild delete-project --name bedrock-chatbot-deployment

# Delete IAM role
aws iam delete-role-policy --role-name bedrock-chatbot-service-role --policy-name DeploymentPolicy
aws iam delete-role --role-name bedrock-chatbot-service-role
```

---

## Support

For issues or questions:

- Check the [Architecture Deep Dive](./architectureDeepDive.md) for technical details
- Review the [User Guide](./userGuide.md) for frontend usage
- Check CloudWatch Logs for detailed error messages:
  ```bash
  aws logs tail /aws/lambda/bedrock-chatbot-handler-development --follow
  ```

---

**Deployment Complete!** Your Multilingual RAG Chatbot is now ready to use.
