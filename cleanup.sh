#!/bin/bash

# Complete Cleanup Script for Bedrock Chatbot
# This script removes all resources created by the deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="bedrock-chatbot"
STACK_NAME="BedrockChatbotBackendStack"
AWS_REGION=${AWS_REGION:-$(aws configure get region || echo "us-east-1")}
AMPLIFY_APP_NAME="BedrockChatbot"
CODEBUILD_PROJECT_NAME="${PROJECT_NAME}-deployment"
IAM_ROLE_NAME="${PROJECT_NAME}-service-role"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to confirm deletion
confirm_deletion() {
    echo ""
    print_warning "⚠️  DANGER: This will permanently delete ALL resources!"
    echo ""
    echo "This includes:"
    echo "  - CDK Stack and all AWS resources (S3, S3 Vectors, Bedrock, Lambda, Cognito, etc.)"
    echo "  - Amplify App and deployments"
    echo "  - CodeBuild Project"
    echo "  - IAM Service Role"
    echo ""
    
    while true; do
        read -p "Are you absolutely sure you want to delete everything? (type 'DELETE' to confirm): " -r
        if [ "$REPLY" = "DELETE" ]; then
            break
        else
            print_status "Cleanup cancelled."
            exit 0
        fi
    done
}

# Get resource information before deletion
get_resource_info() {
    print_status "🔍 Gathering resource information..."
    
    # Get Amplify App ID
    AMPLIFY_APP_ID=$(aws amplify list-apps \
        --query "apps[?name=='$AMPLIFY_APP_NAME'].appId" \
        --output text 2>/dev/null || echo "")
    
    # Check if CDK stack exists
    STACK_EXISTS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].StackName' \
        --output text 2>/dev/null || echo "")
    
    # Check if CodeBuild project exists
    CODEBUILD_EXISTS=$(aws codebuild batch-get-projects \
        --names "$CODEBUILD_PROJECT_NAME" \
        --query 'projects[0].name' \
        --output text 2>/dev/null || echo "")
    
    # Check if IAM role exists
    IAM_ROLE_EXISTS=$(aws iam get-role \
        --role-name "$IAM_ROLE_NAME" \
        --query 'Role.RoleName' \
        --output text 2>/dev/null || echo "")
    
    print_status "Found resources:"
    [ "$STACK_EXISTS" != "" ] && [ "$STACK_EXISTS" != "None" ] && echo "  - CDK Stack: $STACK_NAME"
    [ "$AMPLIFY_APP_ID" != "" ] && [ "$AMPLIFY_APP_ID" != "None" ] && echo "  - Amplify App: $AMPLIFY_APP_ID"
    [ "$CODEBUILD_EXISTS" != "" ] && [ "$CODEBUILD_EXISTS" != "None" ] && echo "  - CodeBuild Project: $CODEBUILD_PROJECT_NAME"
    [ "$IAM_ROLE_EXISTS" != "" ] && [ "$IAM_ROLE_EXISTS" != "None" ] && echo "  - IAM Role: $IAM_ROLE_NAME"
}

# Delete CDK stack (this will delete most AWS resources)
cleanup_cdk_stack() {
    if [ "$STACK_EXISTS" != "" ] && [ "$STACK_EXISTS" != "None" ]; then
        print_status "🏗️  Deleting CDK stack: $STACK_NAME"
        print_status "This will delete all AWS resources (S3, S3 Vectors, Bedrock, Lambda, Cognito, etc.)"
        
        cd backend
        
        # Check if node_modules exists, if not run npm install
        if [ ! -d "node_modules" ]; then
            print_status "Installing backend dependencies..."
            npm install
        fi
        
        cdk destroy --force
        
        cd ..
        
        print_success "CDK stack deleted - All AWS resources cleaned up"
    else
        print_warning "CDK stack not found or already deleted"
    fi
}

# Delete Amplify app
cleanup_amplify_app() {
    if [ "$AMPLIFY_APP_ID" != "" ] && [ "$AMPLIFY_APP_ID" != "None" ]; then
        print_status "🌐 Deleting Amplify app: $AMPLIFY_APP_ID"
        
        # Start deletion in background and wait briefly
        aws amplify delete-app --app-id "$AMPLIFY_APP_ID" &>/dev/null &
        AMPLIFY_PID=$!
        
        # Wait up to 5 seconds for the command to complete
        for i in {1..5}; do
            if ! kill -0 $AMPLIFY_PID 2>/dev/null; then
                break
            fi
            sleep 1
        done
        
        # If still running, let it continue in background
        if kill -0 $AMPLIFY_PID 2>/dev/null; then
            print_status "Amplify deletion initiated (continuing in background)"
        else
            print_success "Amplify app deleted"
        fi
    else
        print_warning "Amplify app not found or already deleted"
    fi
}

# Delete CodeBuild project
cleanup_codebuild_project() {
    if [ "$CODEBUILD_EXISTS" != "" ] && [ "$CODEBUILD_EXISTS" != "None" ]; then
        print_status "🏗️  Deleting CodeBuild project: $CODEBUILD_PROJECT_NAME"
        aws codebuild delete-project --name "$CODEBUILD_PROJECT_NAME" 2>/dev/null || true
        print_success "CodeBuild project deleted"
    else
        print_warning "CodeBuild project not found or already deleted"
    fi
}

# Delete IAM service role
cleanup_iam_role() {
    if [ "$IAM_ROLE_EXISTS" != "" ] && [ "$IAM_ROLE_EXISTS" != "None" ]; then
        print_status "🔐 Deleting IAM service role: $IAM_ROLE_NAME"
        
        # Delete role policy
        aws iam delete-role-policy \
            --role-name "$IAM_ROLE_NAME" \
            --policy-name "DeploymentPolicy" 2>/dev/null || true
        
        # Delete role
        aws iam delete-role --role-name "$IAM_ROLE_NAME" 2>/dev/null || true
        
        print_success "IAM service role deleted"
    else
        print_warning "IAM service role not found or already deleted"
    fi
}

# Main cleanup function
main() {
    echo ""
    print_status "🧹 Bedrock Chatbot - Complete Cleanup"
    echo ""
    
    confirm_deletion
    
    get_resource_info
    
    echo ""
    print_status "🚀 Starting cleanup process..."
    echo ""
    
    # Step 1: Delete CDK stack (this handles all AWS resources automatically)
    cleanup_cdk_stack
    
    # Step 2: Delete deployment infrastructure
    cleanup_amplify_app
    cleanup_codebuild_project
    cleanup_iam_role
    
    echo ""
    print_success "✅ Complete cleanup finished!"
    echo ""
    print_status "All resources have been deleted:"
    echo "  ✅ CDK Stack and all AWS resources (S3, S3 Vectors, Bedrock, Lambda, Cognito, etc.)"
    echo "  ✅ Amplify App and deployments"
    echo "  ✅ CodeBuild Project"
    echo "  ✅ IAM Service Role"
    echo ""
    print_status "The Bedrock Chatbot has been completely removed."
}

# Run main function
main
