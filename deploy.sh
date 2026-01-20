#!/bin/bash

# Complete End-to-End Deployment Pipeline for Bedrock Chatbot
# Uses single unified CodeBuild project for backend and frontend

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="bedrock-chatbot"
STACK_NAME="BedrockChatbotBackendStack"
AWS_REGION=${AWS_REGION:-$(aws configure get region || echo "us-east-1")}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AMPLIFY_APP_NAME="BedrockChatbot"
CODEBUILD_PROJECT_NAME="${PROJECT_NAME}-deployment"
REPOSITORY_URL="https://github.com/ASUCICREPO/multilingual-RAG-chatbot.git"

# Global variables
API_GATEWAY_URL=""
AMPLIFY_APP_ID=""
AMPLIFY_URL=""
ROLE_ARN=""
USER_POOL_ID=""
USER_POOL_CLIENT_ID=""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_codebuild() {
    echo -e "${PURPLE}[CODEBUILD]${NC} $1"
}

print_amplify() {
    echo -e "${PURPLE}[AMPLIFY]${NC} $1"
}

# --- Phase 1: Create IAM Service Role ---
print_status "🔐 Phase 1: Creating IAM Service Role..."

ROLE_NAME="${PROJECT_NAME}-service-role"
print_status "Checking for IAM role: $ROLE_NAME"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    print_success "IAM role exists"
    ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
else
    print_status "Creating IAM role: $ROLE_NAME"
    
    TRUST_DOC='{
        "Version":"2012-10-17",
        "Statement":[{
            "Effect":"Allow",
            "Principal":{"Service":"codebuild.amazonaws.com"},
            "Action":"sts:AssumeRole"
        }]
    }'
    
    ROLE_ARN=$(aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document "$TRUST_DOC" \
        --query 'Role.Arn' --output text)
    
    print_status "Attaching custom deployment policy..."
    
    CUSTOM_POLICY='{
        "Version": "2012-10-17",
        "Statement": [{
            "Sid": "FullDeploymentAccess",
            "Effect": "Allow",
            "Action": [
                "cloudformation:*",
                "iam:*",
                "lambda:*",
                "s3:*",
                "s3vectors:*",
                "bedrock:*",
                "bedrock-agent:*",
                "bedrock-agent-runtime:*",
                "amplify:*",
                "codebuild:*",
                "logs:*",
                "apigateway:*",
                "apigatewayv2:*",
                "cognito-idp:*",
                "ssm:*",
                "events:*",
                "ecr:*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "STSAccess",
            "Effect": "Allow",
            "Action": ["sts:GetCallerIdentity", "sts:AssumeRole"],
            "Resource": "*"
        }]
    }'
    
    aws iam put-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name "DeploymentPolicy" \
        --policy-document "$CUSTOM_POLICY"
    
    print_success "IAM role created"
    print_status "Waiting for IAM role to propagate for 10 seconds..."
    sleep 10
fi

# --- Phase 2: Create Amplify App (Static Hosting) ---
print_amplify "🌐 Phase 2: Creating Amplify Application for Static Hosting..."

# Check if app already exists
EXISTING_APP_ID=$(AWS_PAGER="" aws amplify list-apps \
    --query "apps[?name=='$AMPLIFY_APP_NAME'].appId" \
    --output text \
    --region "$AWS_REGION")

if [ -n "$EXISTING_APP_ID" ] && [ "$EXISTING_APP_ID" != "None" ]; then
    print_warning "Amplify app '$AMPLIFY_APP_NAME' already exists with ID: $EXISTING_APP_ID"
    AMPLIFY_APP_ID=$EXISTING_APP_ID
else
    # Create Amplify app for static hosting
    print_status "Creating Amplify app for static hosting: $AMPLIFY_APP_NAME"
    
    AMPLIFY_APP_ID=$(AWS_PAGER="" aws amplify create-app \
        --name "$AMPLIFY_APP_NAME" \
        --description "Bedrock RAG Chatbot with Cognito Authentication" \
        --platform WEB_COMPUTE \
        --query 'app.appId' \
        --output text \
        --region "$AWS_REGION")
    
    if [ -z "$AMPLIFY_APP_ID" ] || [ "$AMPLIFY_APP_ID" = "None" ]; then
        print_error "Failed to create Amplify app"
        exit 1
    fi
    
    print_success "Amplify app created with ID: $AMPLIFY_APP_ID"
fi

# Check if main branch exists
EXISTING_BRANCH=$(AWS_PAGER="" aws amplify get-branch \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name main \
    --query 'branch.branchName' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "None")

if [ "$EXISTING_BRANCH" = "main" ]; then
    print_warning "main branch already exists"
else
    # Create main branch
    print_status "Creating main branch..."
    AWS_PAGER="" aws amplify create-branch \
        --app-id "$AMPLIFY_APP_ID" \
        --branch-name main \
        --description "Main production branch" \
        --stage PRODUCTION \
        --no-enable-auto-build \
        --region "$AWS_REGION" || print_error "Failed to create Amplify branch."
    
    print_success "main branch created"
fi

# --- Phase 3: Create Unified CodeBuild Project ---
print_codebuild "🏗️ Phase 3: Creating Unified CodeBuild Project..."

# Build environment variables for unified deployment
ENV_VARS_ARRAY='{
    "name": "AMPLIFY_APP_ID",
    "value": "'"$AMPLIFY_APP_ID"'",
    "type": "PLAINTEXT"
},
{
    "name": "CDK_DEFAULT_REGION",
    "value": "'"$AWS_REGION"'",
    "type": "PLAINTEXT"
},
{
    "name": "CDK_DEFAULT_ACCOUNT",
    "value": "'"$AWS_ACCOUNT_ID"'",
    "type": "PLAINTEXT"
}'

ENVIRONMENT=$(cat <<EOF
{
    "type": "LINUX_CONTAINER",
    "image": "aws/codebuild/amazonlinux2-x86_64-standard:5.0",
    "computeType": "BUILD_GENERAL1_MEDIUM",
    "privilegedMode": true,
    "environmentVariables": [$ENV_VARS_ARRAY]
}
EOF
)

SOURCE='{
    "type":"GITHUB",
    "location":"'$REPOSITORY_URL'",
    "buildspec":"buildspec.yml"
}'

ARTIFACTS='{"type":"NO_ARTIFACTS"}'
SOURCE_VERSION="main"

print_status "Checking for CodeBuild project '$CODEBUILD_PROJECT_NAME'..."

PROJECT_EXISTS=$(aws codebuild batch-get-projects \
    --names "$CODEBUILD_PROJECT_NAME" \
    --query 'projects[0].name' \
    --output text 2>/dev/null)

if [ "$PROJECT_EXISTS" != "None" ] && [ -n "$PROJECT_EXISTS" ]; then
    print_success "CodeBuild project exists, updating configuration..."
    
    AWS_PAGER="" aws codebuild update-project \
        --name "$CODEBUILD_PROJECT_NAME" \
        --source "$SOURCE" \
        --source-version "$SOURCE_VERSION" \
        --artifacts "$ARTIFACTS" \
        --environment "$ENVIRONMENT" \
        --service-role "$ROLE_ARN" \
        --output json > /dev/null || print_error "Failed to update CodeBuild project."
    
    print_success "CodeBuild project '$CODEBUILD_PROJECT_NAME' updated."
else
    print_status "Creating unified CodeBuild project '$CODEBUILD_PROJECT_NAME'..."
    
    AWS_PAGER="" aws codebuild create-project \
        --name "$CODEBUILD_PROJECT_NAME" \
        --source "$SOURCE" \
        --source-version "$SOURCE_VERSION" \
        --artifacts "$ARTIFACTS" \
        --environment "$ENVIRONMENT" \
        --service-role "$ROLE_ARN" \
        --output json > /dev/null || print_error "Failed to create CodeBuild project."
    
    print_success "Unified CodeBuild project '$CODEBUILD_PROJECT_NAME' created."
fi

# --- Phase 4: Start Unified Build ---
print_codebuild "🚀 Phase 4: Starting Unified Deployment (Backend + Frontend)..."

print_status "Starting deployment build for project '$CODEBUILD_PROJECT_NAME'..."

BUILD_ID=$(AWS_PAGER="" aws codebuild start-build \
    --project-name "$CODEBUILD_PROJECT_NAME" \
    --query 'build.id' \
    --output text)

if [ $? -ne 0 ]; then
    print_error "Failed to start the deployment build"
fi

print_success "Deployment build started successfully. Build ID: $BUILD_ID"

# Stream logs
print_status "Streaming deployment logs..."
print_status "Build ID: $BUILD_ID"
echo ""

# Extract log group and stream from build ID
LOG_GROUP="/aws/codebuild/$CODEBUILD_PROJECT_NAME"
LOG_STREAM=$(echo "$BUILD_ID" | cut -d':' -f2)

# Wait a few seconds for logs to start
sleep 5

# Stream logs
BUILD_STATUS="IN_PROGRESS"
LAST_TOKEN=""

print_status "Monitoring build progress..."
echo ""

while [ "$BUILD_STATUS" = "IN_PROGRESS" ]; do
    # Get logs
    if [ -z "$LAST_TOKEN" ]; then
        LOG_OUTPUT=$(AWS_PAGER="" aws logs get-log-events \
            --log-group-name "$LOG_GROUP" \
            --log-stream-name "$LOG_STREAM" \
            --start-from-head \
            --output json 2>/dev/null)
    else
        LOG_OUTPUT=$(AWS_PAGER="" aws logs get-log-events \
            --log-group-name "$LOG_GROUP" \
            --log-stream-name "$LOG_STREAM" \
            --next-token "$LAST_TOKEN" \
            --output json 2>/dev/null)
    fi
    
    # Display logs
    if [ -n "$LOG_OUTPUT" ]; then
        echo "$LOG_OUTPUT" | jq -r '.events[]?.message' 2>/dev/null | while IFS= read -r line; do
            # Show important lines
            if [[ "$line" =~ "BACKEND DEPLOYMENT" ]] || \
               [[ "$line" =~ "FRONTEND DEPLOYMENT" ]] || \
               [[ "$line" =~ "Deploying CDK stack" ]] || \
               [[ "$line" =~ "Building Next.js" ]] || \
               [[ "$line" =~ "Outputs:" ]] || \
               [[ "$line" =~ "BedrockChatbotBackendStack" ]] || \
               [[ "$line" =~ "ERROR" ]] || \
               [[ "$line" =~ "successfully" ]]; then
                echo "$line"
            fi
        done
        
        LAST_TOKEN=$(echo "$LOG_OUTPUT" | jq -r '.nextForwardToken' 2>/dev/null)
    fi
    
    # Check build status
    BUILD_STATUS=$(AWS_PAGER="" aws codebuild batch-get-builds \
        --ids "$BUILD_ID" \
        --query 'builds[0].buildStatus' \
        --output text)
    
    sleep 3
done

echo ""
print_status "Deployment build status: $BUILD_STATUS"

if [ "$BUILD_STATUS" != "SUCCEEDED" ]; then
    print_error "Deployment build failed with status: $BUILD_STATUS"
    print_status "Check CodeBuild logs for details: https://console.aws.amazon.com/codesuite/codebuild/projects/$CODEBUILD_PROJECT_NAME/build/$BUILD_ID/"
    exit 1
fi

print_success "Complete deployment finished successfully!"

# Extract deployment information from CloudFormation
print_status "Extracting deployment information..."

API_GATEWAY_URL=$(AWS_PAGER="" aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey==\`HttpApiUrl\`].OutputValue" \
    --output text --region "$AWS_REGION")

USER_POOL_ID=$(AWS_PAGER="" aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey==\`UserPoolId\`].OutputValue" \
    --output text --region "$AWS_REGION")

USER_POOL_CLIENT_ID=$(AWS_PAGER="" aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey==\`UserPoolClientId\`].OutputValue" \
    --output text --region "$AWS_REGION")

KB_ID=$(AWS_PAGER="" aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey==\`KnowledgeBaseId\`].OutputValue" \
    --output text --region "$AWS_REGION")

# Get Amplify URL
AMPLIFY_URL=$(AWS_PAGER="" aws amplify get-app \
    --app-id "$AMPLIFY_APP_ID" \
    --query 'app.defaultDomain' \
    --output text \
    --region "$AWS_REGION")

if [ -z "$AMPLIFY_URL" ] || [ "$AMPLIFY_URL" = "None" ]; then
    AMPLIFY_URL="$AMPLIFY_APP_ID.amplifyapp.com"
fi

# --- Final Summary ---
print_success "COMPLETE DEPLOYMENT SUCCESSFUL!"
echo ""
echo "=========================================================================="
echo "DEPLOYMENT SUMMARY"
echo "=========================================================================="
echo ""
echo "Backend Infrastructure:"
echo "   API Gateway URL: $API_GATEWAY_URL"
echo "   Knowledge Base ID: $KB_ID"
echo "   User Pool ID: $USER_POOL_ID"
echo "   User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "   CDK Stack: $STACK_NAME"
echo "   AWS Region: $AWS_REGION"
echo ""
echo "Frontend:"
echo "   Amplify App ID: $AMPLIFY_APP_ID"
echo "   Frontend URL: https://main.$AMPLIFY_URL"
echo ""
echo "What was deployed:"
echo "   ✅ CDK backend infrastructure via CodeBuild"
echo "   ✅ Amazon Bedrock Knowledge Base with S3 Vectors"
echo "   ✅ Amazon Bedrock Agent with Nova 2 Lite model"
echo "   ✅ API Gateway with Lambda functions"
echo "   ✅ Cognito User Pool for authentication"
echo "   ✅ S3 bucket for document storage"
echo "   ✅ Frontend built and deployed to Amplify"
echo ""
echo "=========================================================================="
echo "NEXT STEPS"
echo "=========================================================================="
echo ""
echo "1. Configure test user password via AWS Console:"
echo "   - Go to Amazon Cognito Console: https://console.aws.amazon.com/cognito/"
echo "   - Select User Pool: bedrock-chatbot-users-development"
echo "   - Go to Users > testuser > Actions > Set password"
echo ""
echo "2. Upload documents to Knowledge Base:"
echo ""
echo "   BUCKET_NAME=\$(aws cloudformation describe-stacks \\"
echo "     --stack-name $STACK_NAME \\"
echo "     --query 'Stacks[0].Outputs[?OutputKey==\`DocumentSourceBucketName\`].OutputValue' \\"
echo "     --output text)"
echo ""
echo "   aws s3 cp your-document.pdf s3://\$BUCKET_NAME/docs/"
echo ""
echo "3. Start ingestion job:"
echo ""
echo "   DS_ID=\$(aws cloudformation describe-stacks \\"
echo "     --stack-name $STACK_NAME \\"
echo "     --query 'Stacks[0].Outputs[?OutputKey==\`DataSourceId\`].OutputValue' \\"
echo "     --output text)"
echo ""
echo "   aws bedrock-agent start-ingestion-job \\"
echo "     --knowledge-base-id $KB_ID \\"
echo "     --data-source-id \$DS_ID"
echo ""
echo "4. Access the application:"
echo "   Frontend: https://main.$AMPLIFY_URL"
echo "   Health Check: curl $API_GATEWAY_URL/health"
echo ""
echo "=========================================================================="
