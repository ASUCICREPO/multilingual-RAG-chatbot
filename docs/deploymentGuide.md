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

After deployment, you'll need to (all via AWS Console):
1. Create user accounts (Cognito)
2. Upload documents to S3 bucket
3. Sync the Knowledge Base (Bedrock)
4. Test and access the application

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

## Post-Deployment Step 1: Create User Accounts

After deployment, create user accounts through the AWS Console. No users are created automatically during deployment.

### Create User via Console

1. **Navigate to Amazon Cognito Console**
   - Go to: https://console.aws.amazon.com/cognito/
   - Ensure you're in the **us-east-1** region

2. **Find Your User Pool**
   - Click **User pools** in the left sidebar
   - Look for `bedrock-chatbot-users-development`
   - Click on the user pool name

3. **Create User**
   - Click **Users** tab → **Create user**
   - Configure the following settings:

   **Invitation message:**
   - Select **"Don't send an invitation"**

   **User name:**
   - Enter a username (e.g., `testuser`) - *Required*

   **Email address:**
   - Enter a valid email address (e.g., `user@example.com`)
   - ⚠️ **Important**: Check the box **"Mark email address as verified"**

   **Temporary password:**
   - Select **"Set a password"**
   - Enter a temporary password (e.g., `TempPass123!`)
   
   - Click **Create user**

4. **First Login - Password Change**
   - When the user logs in for the first time with the temporary password, they will be prompted to set a new permanent password
   - The application handles this automatically with a password change form
   - Password requirements: 8+ characters, uppercase, lowercase, numbers, special characters

---

## Post-Deployment Step 2: Upload Documents to Knowledge Base

Upload documents for the chatbot to reference using the AWS Console.

### Find Your S3 Bucket

1. **Navigate to Amazon S3 Console**
   - Go to: https://console.aws.amazon.com/s3/
   - Ensure you're in the **us-east-1** region

2. **Find the Document Bucket**
   - Look for a bucket named `bedrock-chatbot-documents-development-<account-id>`
   - Click on the bucket name to open it

### Upload Documents

1. **Navigate to the docs folder**
   - Click on the `docs/` folder (create it if it doesn't exist by clicking **Create folder** → name it `docs` → click **Create folder**)

2. **Upload Files**
   - Click **Upload**
   - Click **Add files** or drag and drop your documents
   - Click **Upload** to start the upload

**Supported file formats:**
- PDF files (`.pdf`)
- Word documents (`.docx`)
- Text files (`.txt`)
- Markdown files (`.md`)

---

## Post-Deployment Step 3: Sync Knowledge Base

After uploading documents, sync the Knowledge Base to process and index them.

### Start Knowledge Base Sync

1. **Navigate to Amazon Bedrock Console**
   - Go to: https://console.aws.amazon.com/bedrock/
   - Ensure you're in the **us-east-1** region

2. **Find Your Knowledge Base**
   - In the left sidebar, click **Build** → **Knowledge bases**
   - Look for `bedrock-chatbot-kb-development`
   - Click on the knowledge base name

3. **Start Sync**
   - Scroll down to the **Data source** section
   - Select the data source `bedrock-chatbot-datasource-development`
   - Click **Sync** button

### Check Sync Status

1. **Monitor Progress**
   - The sync status will show as **Syncing** while processing
   - Wait for the status to change to **Available** or **Ready**

2. **View Sync Details**
   - Click on the data source to see sync history
   - Check the number of documents processed and any errors

**Wait for sync to complete before testing the chatbot.**

---

## Post-Deployment Step 4: Verify and Test

### Verify Deployment Success

1. **Frontend:** Access the Frontend URL from deployment summary (e.g., `https://main.d1234abcdef.amplifyapp.com`)

2. **Cognito User Pool:** 
   - Go to **Cognito Console** → **User pools**
   - Verify `bedrock-chatbot-users-development` exists

3. **S3 Bucket:** 
   - Go to **S3 Console**
   - Verify `bedrock-chatbot-documents-development-*` bucket exists
   - Verify `docs/` folder contains your uploaded documents

4. **Knowledge Base:** 
   - Go to **Bedrock Console** → **Build** → **Knowledge bases**
   - Verify `bedrock-chatbot-kb-development` shows status **Available**

5. **API Gateway:**
   - Go to **API Gateway Console**
   - Verify `bedrock-chatbot-api-development` exists

### Test the System

1. Navigate to the **Frontend URL** (e.g., `https://main.d1234abcdef.amplifyapp.com`)
2. You will be redirected to the **Login page**
3. Log in with the user credentials you created in [Post-Deployment Step 1](#post-deployment-step-1-create-user-accounts)
   - If using a temporary password, you'll be prompted to set a new permanent password
4. After login, you'll see the main page with a **red chat bubble** in the bottom-right corner
5. Click the **chat bubble** to open the NASWA Assistant
6. In the chat header, use the **language dropdown** to select English or Español
7. Ask a question about your uploaded documents (or click a sample question)
8. Verify the response includes source document attribution

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

### Issue: Authentication Error - "No ID token received"

**Error:** `Authentication error: Error: No ID token received from Cognito`

**Possible Causes:**
1. User was created without email or email not verified
2. User status is "Force change password" (expected - handled by frontend)

**Solution:**
1. Go to **Cognito Console** → **User pools** → `bedrock-chatbot-users-development`
2. Click **Users** → select your user
3. Verify the user has:
   - Email address set
   - Email marked as verified
4. If you see the password change form on login, enter a new password meeting requirements
5. If issues persist, delete and recreate the user following [Post-Deployment Step 1](#post-deployment-step-1-create-user-accounts)

### Issue: Frontend Shows "Connection Issues"

**Possible Causes:**
1. API Gateway URL not configured correctly
2. CORS not allowing frontend origin
3. Cognito settings incorrect

**Solution:**
1. Open browser Developer Tools (F12) → **Network** tab → check for failed requests
2. Go to **API Gateway Console** → find `bedrock-chatbot-api-development` → verify it exists
3. Check browser console for CORS errors
4. Go to **Cognito Console** → **User pools** → **App integration** → verify callback URLs

### Issue: Knowledge Base Returns No Results

**Possible Causes:**
1. No documents uploaded
2. Knowledge Base sync not complete
3. Documents in wrong S3 folder

**Solution:**
1. Go to **S3 Console** → find `bedrock-chatbot-documents-development-*` bucket
2. Verify documents are in the `docs/` folder (not root)
3. Go to **Bedrock Console** → **Build** → **Knowledge bases** → `bedrock-chatbot-kb-development`
4. Check the data source sync status is **Available**
5. If needed, click **Sync** to re-sync the Knowledge Base

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
