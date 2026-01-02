#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BedrockChatbotBackendStack } from '../lib/bedrock-chatbot-backend-stack';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new cdk.App();

// Get environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create the main stack
const stack = new BedrockChatbotBackendStack(app, 'BedrockChatbotBackendStack', {
  env,
  description: 'Bedrock Chatbot Backend - Serverless chatbot with Knowledge Base integration',
});

// Apply CDK Nag for security best practices
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

// Add tags for resource management
cdk.Tags.of(stack).add('Project', 'BedrockChatbotBackend');
cdk.Tags.of(stack).add('Environment', process.env.ENVIRONMENT || 'development');
cdk.Tags.of(stack).add('Owner', 'CDK');