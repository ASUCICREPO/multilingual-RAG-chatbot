# Prerequisites

Before deploying the Multilingual RAG Chatbot, ensure you have the following prerequisites in place.

## AWS Account Requirements

### 1. AWS Account Access

You need an AWS account with appropriate permissions to create and manage the following services:

- **Amazon S3** - Object storage for source documents
- **Amazon S3 Vectors** - Vector storage for document embeddings
- **AWS Lambda** - Serverless compute functions
- **Amazon API Gateway** - HTTP API endpoints
- **Amazon Cognito** - User authentication and authorization
- **AWS IAM** - Identity and access management roles and policies
- **AWS Amplify** - Frontend hosting
- **AWS CodeBuild** - CI/CD pipeline
- **Amazon CloudWatch** - Logging and monitoring

### 2. Amazon Bedrock Access

Your AWS account must have access to the following Amazon Bedrock services:

#### Amazon Nova 2 Lite Model Access
- **Model ID**: `global.amazon.nova-2-lite-v1:0`
- **Purpose**: Large language model for chat responses and RAG generation
- **Access**: ✅ **Automatically enabled** - No manual console action required

#### Amazon Nova Multimodal Embeddings Access
- **Model ID**: `amazon.nova-2-multimodal-embeddings-v1:0`
- **Purpose**: Generate 3072-dimensional embeddings for semantic search
- **Access**: ✅ **Automatically enabled** - No manual console action required

> **Note**: As of October 2025, Amazon Bedrock provides [automatic enablement](https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-automatic-enablement-serverless-foundation-models/) for all serverless foundation models. Amazon Nova models are available immediately without manual activation through the console.

#### Bedrock Knowledge Base
- **Purpose**: RAG document indexing and retrieval with S3 Vectors storage
- **Required Permissions**: 
  - `bedrock:CreateKnowledgeBase`
  - `bedrock:Retrieve`
  - `bedrock-agent-runtime:Retrieve`
- **Availability**: Check that Bedrock Knowledge Base is available in your region

#### S3 Vectors Service
- **Purpose**: Specialized vector storage for document embeddings
- **Required Permissions**:
  - `s3vectors:CreateVectorBucket`
  - `s3vectors:CreateIndex`
  - `s3vectors:QueryVectors`
- **Availability**: S3 Vectors is available in select regions (us-east-1, us-west-2)

---

## Verify Bedrock Access

Verify that you can access Bedrock models in your region:

```bash
# List available Nova models
aws bedrock list-foundation-models \
  --by-provider amazon \
  --query 'modelSummaries[?contains(modelId, `nova`)].{ModelId:modelId,Status:modelLifecycle.status}' \
  --output table
```

**Expected output:**
```
--------------------------------------------
|         ListFoundationModels             |
+------------------------------------------+
|  ModelId                     |  Status   |
+------------------------------------------+
|  amazon.nova-2-lite-v1:0     |  ACTIVE   |
|  amazon.nova-2-...-embeddings|  ACTIVE   |
+------------------------------------------+
```

> **Note**: With automatic enablement, Amazon Nova models should be immediately available. If you encounter access issues, verify your IAM permissions include `bedrock:InvokeModel`.

---

## IAM Permissions for Deployment

The user or role running the deployment script needs the following permissions:

### Required IAM Policy

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "BedrockChatbotDeploymentPermissions",
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
                "ecr:*",
                "sts:GetCallerIdentity",
                "sts:AssumeRole"
            ],
            "Resource": "*"
        }
    ]
}
```

### Verify Your Permissions

```bash
# Verify AWS CLI is configured
aws sts get-caller-identity
```

**Expected output:**
```json
{
    "UserId": "AIDXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

---

## Development Tools

### Required Tools

Install the following tools on your local machine or use AWS CloudShell:

| Tool | Minimum Version | Installation |
|------|-----------------|--------------|
| AWS CLI | 2.0+ | [AWS CLI Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| Node.js | 18.0+ | [nodejs.org](https://nodejs.org/) |
| npm | 9.0+ | Included with Node.js |
| Git | 2.0+ | [git-scm.com](https://git-scm.com/) |

### Verify Installations

```bash
# Check AWS CLI version
aws --version
# Expected: aws-cli/2.x.x

# Check Node.js version
node --version
# Expected: v18.x.x or higher

# Check npm version
npm --version
# Expected: 9.x.x or higher

# Check Git version
git --version
# Expected: git version 2.x.x
```

### Using AWS CloudShell (Recommended)

AWS CloudShell comes pre-installed with all required tools:
1. Log into AWS Console
2. Click the CloudShell icon (terminal) in the top navigation
3. All tools (AWS CLI, Node.js, Git) are pre-installed
4. No additional configuration needed

---

## AWS Region Requirements

⚠️ **This project currently only supports `us-east-1` (US East - N. Virginia).**

The system requires all of the following services which are currently only available together in us-east-1:
- Amazon Bedrock with Nova models
- Amazon S3 Vectors
- Amazon Bedrock Knowledge Base with S3 Vectors storage

| Region | Name | Support Status |
|--------|------|----------------|
| `us-east-1` | US East (N. Virginia) | ✅ **Supported** |
| Other regions | - | ❌ Not supported |

**Set your region before deployment:**
```bash
export AWS_REGION=us-east-1
```

**Important**: Do not attempt to deploy in other regions as S3 Vectors and Knowledge Base integration may not be available.

---

## CDK Bootstrap (First-Time Only)

If this is your first AWS CDK deployment in the account/region, bootstrap is required:

```bash
# Install CDK CLI
npm install -g aws-cdk

# Bootstrap CDK (first time only)
cdk bootstrap aws://ACCOUNT-NUMBER/REGION

# Example
cdk bootstrap aws://123456789012/us-east-1
```

**Note**: The deployment script automatically runs bootstrap, but you can do it manually if needed.

---

## Pre-Deployment Checklist

Before running the deployment script, verify:

- [ ] AWS account is active with billing enabled
- [ ] AWS CLI is configured with valid credentials (`aws sts get-caller-identity` works)
- [ ] Bedrock model access granted for **Nova Lite** and **Nova Embeddings**
- [ ] S3 Vectors service is available in your target region
- [ ] Node.js 18+ and npm 9+ are installed
- [ ] Git is installed for cloning the repository
- [ ] You have the required IAM permissions for deployment
- [ ] Target region supports all required services

---

## Cost Considerations

Before deployment, understand the cost implications:

### Pay-Per-Use Services

| Service | Pricing Model | Estimated Cost |
|---------|---------------|----------------|
| **Bedrock Nova Lite** | Per 1K input/output tokens | ~$0.0001-0.0004/1K tokens |
| **Bedrock Embeddings** | Per 1K tokens | ~$0.00002/1K tokens |
| **Lambda** | Per request + duration | Free tier: 1M requests/month |
| **API Gateway** | Per million requests | ~$1.00/million requests |
| **S3** | Storage + requests | ~$0.023/GB/month |
| **S3 Vectors** | Storage + queries | Variable |
| **Cognito** | Per MAU | Free tier: 50,000 MAUs |
| **Amplify** | Build minutes + hosting | Free tier available |

### AWS Free Tier

Many services include free tier allowances:
- **Lambda**: 1 million requests/month free
- **API Gateway**: 1 million REST API calls/month free
- **Cognito**: 50,000 MAUs free
- **S3**: 5 GB storage free (first 12 months)
- **CloudWatch**: 5 GB logs ingestion free

### Cost Estimation

For a typical development/testing workload:
- **Monthly cost**: ~$5-20/month
- **Per chat interaction**: ~$0.001-0.01 depending on response length

---

## Support

For questions or issues with prerequisites:

- **AWS Services**: Contact [AWS Support](https://aws.amazon.com/support/) or consult [AWS Documentation](https://docs.aws.amazon.com/)
- **Bedrock Access**: Check [Bedrock Model Access Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)
- **S3 Vectors**: Check [S3 Vectors Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html)
- **Deployment Issues**: Refer to the [Deployment Guide](./deploymentGuide.md) troubleshooting section

---

## Next Steps

Once all prerequisites are met, proceed to the [Deployment Guide](./deploymentGuide.md) to deploy the application.
