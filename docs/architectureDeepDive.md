# Architecture Deep Dive

![Architecture Diagram](./media/architecture.png)

## System Flow

The Multilingual RAG Chatbot follows an event-driven, serverless architecture that delivers intelligent document retrieval and conversational AI capabilities:

### 1. User Authentication
User navigates to the Amplify-hosted frontend and logs in via Amazon Cognito. Cognito validates credentials and issues JWT tokens (access, ID, refresh) for secure API access.

### 2. Chat Request Initiation
User opens the chatbot widget, selects their preferred language (English/Spanish), and sends a message. The frontend ChatBot component captures the message, session ID, and language preference.

### 3. API Gateway Processing
The HTTP API Gateway receives the request at the `/chat` endpoint. The Cognito JWT Authorizer validates the Bearer token, extracts user claims, and forwards the authenticated request to the Lambda handler.

### 4. Conversation Context Retrieval
The Agent Handler Lambda retrieves conversation memory from the in-memory cache using the session ID. This enables context-aware responses by maintaining the last 5 conversation exchanges.

### 5. Knowledge Base Retrieval (RAG)
The Lambda invokes Amazon Bedrock Agent Runtime to search the Knowledge Base:
- Converts the user query into vector embeddings using Nova Multimodal Embeddings
- Performs cosine similarity search against the S3 Vectors index
- Returns top 5 most relevant document chunks with content and metadata

### 6. RAG Prompt Construction
The Lambda builds an intelligent prompt combining:
- System instructions (language-specific)
- Conversation history context
- Retrieved document chunks with source attribution
- User's current message
- Response formatting instructions (conversational vs. technical)

### 7. Model Invocation
The Lambda invokes Amazon Bedrock with the Nova 2 Lite model:
- Sends the constructed RAG prompt
- Configures inference parameters (1024 max tokens, 0.3 temperature)
- Applies Bedrock Guardrails for content filtering
- Receives streaming response with generated text

### 8. Response Processing
The Lambda processes the model response:
- Extracts response type markers ([CONVERSATIONAL] or [TECHNICAL])
- Formats source documents with relevance scores
- Deduplicates sources by document name (keeps highest scoring chunk)
- Updates conversation memory with the exchange

### 9. Response Delivery
The formatted response returns through API Gateway to the frontend. The ChatBot component renders the response using React Markdown with source document cards showing relevance percentages.

### 10. Document Access
When users click "View" on a source document, the frontend calls the `/document` endpoint. The Lambda retrieves the file from S3 and returns it appropriately (PDFs open in browser, other files download).

## Cloud Services / Technology Stack

- **Amazon S3**: Object storage for documents and vectors
  - `docs/` - Source documents uploaded for Knowledge Base ingestion
  - Vector bucket - S3 Vectors index for embedding storage

- **S3 Vectors**: Specialized vector storage for AI embeddings
  - Index with 3072-dimensional float32 vectors
  - Cosine similarity distance metric for semantic search
  - Metadata configuration for Bedrock integration

- **AWS Lambda Function**:
  - **agent-handler** - Main handler with RAG pipeline, document retrieval, health check, and conversation memory (single Lambda handles all endpoints)

- **Amazon Bedrock Knowledge Base**: RAG document indexing and retrieval
  - Configured with Nova Multimodal Embeddings (3072 dimensions)
  - S3 Vectors storage configuration
  - Supplemental data storage for source document access

- **Amazon Bedrock Data Source**: Document ingestion configuration
  - S3 source with `/docs` prefix filtering
  - Fixed-size chunking (512 tokens, 20% overlap)
  - Bedrock Data Automation parsing strategy

- **Amazon Bedrock (Nova 2 Lite)**: Large Language Model for AI responses
  - Global inference profile for optimal routing
  - Configured with controlled temperature (0.3) for balanced responses
  - Supports both conversational and technical response modes

- **Amazon Bedrock Guardrails**: Content moderation and safety
  - Content filtering (HATE, INSULTS, SEXUAL, VIOLENCE, MISCONDUCT, PROMPT_ATTACK at HIGH strength)
  - Topic denial policies (Politics, Off-Topic-General-Knowledge, Personal-Assistance)
  - Word policy with profanity blocking
  - Custom blocked messages for off-topic queries

- **Amazon Bedrock (Nova Multimodal Embeddings)**: Embedding model
  - 3072-dimensional embeddings for semantic search
  - Supports text and multimodal content
  - Integrated with Knowledge Base for automatic embedding generation

- **Amazon API Gateway (HTTP API)**: RESTful API endpoint
  - Routes: `/chat` (POST), `/document` (GET), `/health` (GET)
  - CORS configuration for frontend access
  - Payload format version 2.0 for Lambda integration

- **Amazon Cognito User Pool**: User authentication and authorization
  - Email-based sign-in with auto-verification
  - Self sign-up enabled for user registration
  - Strong password policy (8+ chars, mixed case, digits, symbols)
  - Optional MFA (SMS, OTP)
  - OAuth 2.0 with authorization code grant flow

- **Amazon Cognito JWT Authorizer**: API security
  - Validates JWT tokens against Cognito issuer
  - Extracts user claims for request context
  - 1-hour token validity with 30-day refresh

- **AWS Amplify**: Frontend hosting and deployment
  - Next.js 16 with React 19 application
  - Automatic HTTPS and CDN distribution
  - Branch-based deployments

- **AWS CodeBuild**: CI/CD automation
  - Unified deployment project for backend and frontend
  - Amazon Linux 2 build environment
  - Automatic CDK deployment and Amplify publishing

- **AWS IAM Roles**:
  - **Bedrock Service Role** - Permissions for S3, S3 Vectors, and Bedrock operations
  - **Lambda Execution Role** - Permissions for Bedrock invoke, Knowledge Base retrieve, S3 read, CloudWatch logs
  - **CodeBuild Service Role** - Full deployment permissions for CDK and Amplify

- **Amazon CloudWatch**: Logging and monitoring
  - Lambda function logs with 1-week retention
  - X-Ray tracing support for distributed tracing
  - Custom metrics for request processing

## Infrastructure as Code

The entire infrastructure is defined using **AWS CDK (Cloud Development Kit)** in TypeScript:

- **bedrock-chatbot-backend-stack.ts** - Main CDK stack defining all resources
  - S3 document source bucket with lifecycle rules
  - S3 Vectors bucket and index configuration
  - Bedrock Knowledge Base with embedding configuration
  - Bedrock Data Source with chunking settings
  - Lambda functions with environment variables
  - API Gateway HTTP API with routes and authorizers
  - Cognito User Pool and Client configuration
  - IAM roles and policies with CDK Nag compliance
  - CloudFormation outputs for deployment configuration

- **deploy.sh** - Automated deployment script
  - Creates IAM service role for CodeBuild
  - Creates Amplify application and branch
  - Creates unified CodeBuild project
  - Executes build and streams logs
  - Outputs deployment summary with URLs

- **buildspec.yml** - CodeBuild specification
  - Installs Node.js dependencies
  - Deploys CDK backend stack
  - Builds Next.js frontend
  - Deploys to Amplify

The CDK approach enables:
- Version-controlled infrastructure
- Repeatable deployments across environments
- Automatic resource dependency management
- Type-safe infrastructure definitions
- CDK Nag security compliance validation

## RAG Pipeline Architecture

The system uses a **RAG (Retrieval Augmented Generation) architecture** with Bedrock's RetrieveAndGenerate API:

### Knowledge Base Integration
- Uses Bedrock `RetrieveAndGenerate` API for unified retrieval and generation
- Automatic session management for conversation continuity
- Integrated guardrails for content filtering

### Knowledge Base Retriever
- Invokes Bedrock Agent Runtime retrieve API
- Configures vector search with result limit
- Extracts content, score, and S3 location from results
- Handles retrieval errors gracefully

### RAG Prompt Builder
- Constructs language-aware system instructions
- Formats retrieved documents with source attribution
- Adds response type markers for post-processing
- Supports both conversational and technical response modes

### Response Processor
- Extracts response type markers from model output
- Removes markers from final response text
- Deduplicates source documents by name
- Sorts sources by relevance score (highest first)
- Conditionally includes sources (technical only)

### Document Handler
- Generates pre-signed S3 URLs for document access
- Sets appropriate Content-Type headers
- Configures Content-Disposition for PDFs (view) vs. other files (download)

## Security & Access Control

- **S3 Buckets**: Block all public access, versioning enabled, SSL enforced, server-side encryption
- **Lambda Functions**: Least-privilege IAM roles with specific resource ARN permissions
- **API Gateway**: Cognito JWT authorization on authenticated endpoints, public health check for monitoring
- **Cognito**: Strong password policy, optional MFA, email verification, secure token handling
- **Knowledge Base**: Scoped IAM permissions for Bedrock service role
- **CDK Nag**: Security compliance validation with documented suppressions
- **CORS**: Configurable origins (development: `*`, production: specific domains)
- **Environment Variables**: Non-sensitive configuration in Lambda environment

## Scalability & Performance

- **Serverless Architecture**: Automatically scales with demand, no server management
- **Lambda Configuration**: 512 MB memory, 60-second timeout for model inference
- **Knowledge Base Optimization**: Fixed-size chunking (512 tokens) with 20% overlap for context preservation
- **S3 Vectors**: Purpose-built vector storage with optimized similarity search
- **Conversation Memory**: Bedrock session management for conversation continuity
- **Response Streaming**: Configurable for real-time response delivery
- **Lifecycle Rules**: Automatic transition to S3 IA after 30 days for cost optimization

## Monitoring & Observability

- **CloudWatch Logs**: All Lambda logs automatically captured with DEBUG level in development
- **CloudWatch Metrics**: Lambda invocations, errors, duration, memory usage, and cold starts
- **X-Ray Tracing**: Distributed tracing support for end-to-end request visibility
- **API Gateway Logs**: Configurable access logging for production environments
- **Health Endpoint**: Public `/health` endpoint for uptime monitoring
- **Connection Status**: Frontend displays real-time connection status indicator
- **Request Logging**: Detailed request/response logging in Lambda with request IDs
- **Error Tracking**: Structured error responses with request IDs for troubleshooting
