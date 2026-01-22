# Multilingual RAG Chatbot

An AI-powered multilingual chatbot platform for the National Association of State Workforce Agencies (NASWA) that provides intelligent document retrieval and conversational assistance, powered by AWS Bedrock Knowledge Base and RAG (Retrieval Augmented Generation).

## Demo

<div align="center">
  <img src="./docs/media/demo.gif" alt="NASWA Multilingual RAG Chatbot Demo" width="700">
  <p><em>Multilingual RAG Chatbot in action - English and Spanish support with source attribution</em></p>
</div>

## Index

| Description           | Link                                                  |
| --------------------- | ----------------------------------------------------- |
| Overview              | [Overview](#overview)                                 |
| Architecture          | [Architecture](#architecture-diagram)                 |
| Detailed Architecture | [Detailed Architecture](docs/architectureDeepDive.md) |
| Prerequisites         | [Prerequisites](docs/prerequisites.md)                |
| User Flow             | [User Flow](docs/userGuide.md)                        |
| Deployment            | [Deployment](docs/deploymentGuide.md)                 |
| Credits               | [Credits](#credits)                                   |
| License               | [License](#license)                                   |

## Overview

This application combines AI-powered document processing with intelligent retrieval and multilingual support to deliver comprehensive workforce assistance. Built on a serverless architecture with RAG capabilities, Cognito authentication, and a modern responsive web interface.

### Key Features

- **Multilingual Support** - Full English and Spanish language capabilities for queries and responses
- **RAG-Powered AI System** using AWS Bedrock with Amazon Nova models
- **Intelligent Document Retrieval** via Bedrock Knowledge Base with S3 Vectors
- **Secure Authentication** using Amazon Cognito with JWT authorization
- **Document Source Attribution** with relevance scoring and direct document access
- **Conversation Memory** for context-aware multi-turn conversations
- **Modern Web Interface** with responsive design and real-time chat experience
- **One-Click Deployment** via AWS CDK and CodeBuild automation

### Technology Stack

| Component | Technology |
|-----------|------------|
| **AI/ML** | Amazon Bedrock, Nova 2 Lite, Nova Multimodal Embeddings |
| **Vector Store** | S3 Vectors with Cosine Similarity |
| **Backend** | AWS Lambda (Python 3.12), API Gateway HTTP API |
| **Authentication** | Amazon Cognito User Pools |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS |
| **Infrastructure** | AWS CDK, CloudFormation |
| **Hosting** | AWS Amplify |
| **Document Storage** | Amazon S3 |

## Architecture Diagram

![NASWA Chatbot Architecture Diagram](docs/media/architecture.png)

The application implements a serverless, event-driven architecture with RAG (Retrieval Augmented Generation) at its core, combining secure authentication with intelligent document retrieval and multilingual AI responses.

For a detailed deep dive into the architecture, including core principles, component interactions, data flow, security, and implementation details, see [docs/architectureDeepDive.md](docs/architectureDeepDive.md).

## User Flow

The chatbot provides an intuitive conversational interface with the following flow:

1. **User Authentication** - Login via Cognito for secure access
2. **Language Selection** - Choose between English or Spanish
3. **Query Submission** - Type a question or select from sample questions
4. **RAG Processing** - System retrieves relevant documents and generates response
5. **Response with Sources** - AI response with document attribution and relevance scores
6. **Document Access** - View or download source documents directly

For a detailed overview of the user journey and application workflow, see [docs/userGuide.md](docs/userGuide.md).

## Deployment

### Prerequisites

- **AWS CLI** - Install from [aws.amazon.com/cli](https://aws.amazon.com/cli/)
- **AWS Account** - With permissions to create IAM, Lambda, S3, Cognito, Amplify, and Bedrock resources
- **Git** - For cloning the repository

For detailed prerequisites, see [docs/prerequisites.md](docs/prerequisites.md).

### Quick Start

⚠️ **Region Requirement**: This project only supports **us-east-1** (US East - N. Virginia).

```bash
# Configure AWS CLI
aws configure
# Enter: Access Key, Secret Key, Region: us-east-1, Output: json

# Clone the repository
git clone https://github.com/ASUCICREPO/multilingual-RAG-chatbot.git
cd multilingual-RAG-chatbot

# Run the automated deployment
./deploy.sh
```

The deployment script will:
1. Create IAM service roles
2. Deploy CDK backend infrastructure
3. Build and deploy the frontend to Amplify
4. Configure Cognito authentication
5. Output all necessary URLs and configuration details

For detailed deployment instructions, including prerequisites and step-by-step guides, see [docs/deploymentGuide.md](docs/deploymentGuide.md).

## Infrastructure

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **Amazon Bedrock** | Foundation model inference (Nova 2 Lite) and embeddings |
| **Bedrock Knowledge Base** | RAG document indexing and retrieval |
| **S3 Vectors** | Vector storage for document embeddings |
| **Amazon S3** | Source document storage |
| **AWS Lambda** | Serverless compute for API handlers |
| **API Gateway** | HTTP API with JWT authorization and CORS |
| **Amazon Cognito** | User authentication and JWT authorization |
| **AWS Amplify** | Frontend hosting and deployment |
| **AWS CDK** | Infrastructure as Code |
| **AWS CodeBuild** | CI/CD pipeline automation |

For a detailed overview of the application infrastructure, see [docs/architectureDeepDive.md](docs/architectureDeepDive.md).

## Documentation

- **[Architecture Deep Dive](docs/architectureDeepDive.md)** - Comprehensive architecture documentation
- **[Prerequisites](docs/prerequisites.md)** - Required tools and AWS permissions
- **[Deployment Guide](docs/deploymentGuide.md)** - Step-by-step deployment instructions
- **[User Guide](docs/userGuide.md)** - Frontend usage and features
- **[API Documentation](docs/apiDoc.md)** - Backend API reference

## Project Structure

```
multilingual-RAG-chatbot/
├── backend/
│   ├── bin/                    # CDK app entry point
│   ├── lib/                    # CDK stack definitions
│   │   └── bedrock-chatbot-backend-stack.ts
│   ├── lambda/
│   │   └── agent-handler/      # Lambda function code
│   │       └── index.py
│   ├── cdk.json               # CDK configuration
│   └── package.json           # Backend dependencies
├── frontend/
│   ├── app/
│   │   ├── components/        # React components
│   │   │   ├── ChatBot.tsx    # Main chat interface
│   │   │   ├── Header.tsx     # Navigation header
│   │   │   ├── Hero.tsx       # Hero section
│   │   │   └── ContentCards.tsx
│   │   ├── lib/               # Utilities
│   │   │   ├── auth.ts        # Cognito authentication
│   │   │   ├── chatApi.ts     # API client
│   │   │   └── config.ts      # Configuration
│   │   ├── login/             # Login page
│   │   ├── page.tsx           # Main page
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   ├── next.config.js         # Next.js configuration
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   └── package.json           # Frontend dependencies
├── docs/                      # Documentation
├── deploy.sh                  # Automated deployment script
├── cleanup.sh                 # Resource cleanup script
├── buildspec.yml              # CodeBuild specification
└── README.md                  # This file
```

## Credits

This application was architected and developed by [Sahajpreet Singh](https://www.linkedin.com/in/sahajpreet/), [Apoorv Singh](https://www.linkedin.com/in/apoorv16/), and [Lahari Shakthi Arun](https://www.linkedin.com/in/shakthiarun22/) with solutions architect [Arun Arunachalam](https://www.linkedin.com/in/arunarunachalam/), program manager [Thomas Orr](https://www.linkedin.com/in/thomas-orr/) and product manager [Rachel Hayden](https://www.linkedin.com/in/rachelhayden/). Thanks to the ASU Cloud Innovation Center Technical for their guidance and support.

## License

See [LICENSE](LICENSE) file for details.

---

**Built with AWS Bedrock and deployed on AWS Amplify**
