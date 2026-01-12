import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3vectors from 'aws-cdk-lib/aws-s3vectors';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NagSuppressions } from 'cdk-nag';

export class BedrockChatbotBackendStack extends cdk.Stack {
  // ⚠️  WARNING: ALL RESOURCES HAVE DESTROY REMOVAL POLICY
  // This stack is configured for easy cleanup - all resources will be DESTROYED on stack deletion
  // This includes S3 buckets, Bedrock Knowledge Bases, vector embeddings, and user data
  // Use with caution in production environments!
  
  // Public properties for cross-stack references
  public readonly documentSourceBucket: s3.Bucket;
  public readonly vectorBucket: s3vectors.CfnVectorBucket;
  public readonly vectorIndex: s3vectors.CfnIndex;
  public readonly bedrockServiceRole: iam.Role;
  public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  public readonly dataSource: bedrock.CfnDataSource;

  public readonly agentHandlerFunction: lambda.Function;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly httpApi: apigateway.HttpApi;
  public readonly cognitoAuthorizer: authorizers.HttpJwtAuthorizer;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Environment configuration
    const environment = this.node.tryGetContext('environment') || 'development';
    const isDevelopment = environment === 'development';

    // ========================================
    // S3 INFRASTRUCTURE
    // ========================================

    // Document Source Bucket - stores source documents for processing
    this.documentSourceBucket = new s3.Bucket(this, 'DocumentSourceBucket', {
      bucketName: `bedrock-chatbot-documents-${environment}-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
        {
          id: 'TransitionToIA',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Always destroy for easy cleanup
      autoDeleteObjects: true, // Always auto-delete objects
    });

    // ========================================
    // S3 VECTORS INFRASTRUCTURE
    // ========================================

    // S3 Vector Bucket - specialized bucket for vector embeddings
    this.vectorBucket = new s3vectors.CfnVectorBucket(this, 'VectorBucket', {
      vectorBucketName: `bedrock-chatbot-vectors-${environment}-${this.account}`,
    });

    // Apply DESTROY removal policy to S3 Vector Bucket
    this.vectorBucket.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // S3 Vector Index - index for the vector bucket used by Bedrock Knowledge Base
    this.vectorIndex = new s3vectors.CfnIndex(this, 'VectorIndex', {
      vectorBucketArn: this.vectorBucket.attrVectorBucketArn,
      indexName: `bedrock-chatbot-index-${environment}`,
      dataType: 'float32', // Standard data type for embeddings (lowercase)
      dimension: 3072,
      distanceMetric: 'cosine', // Cosine similarity for semantic search (lowercase)
      metadataConfiguration: {
        nonFilterableMetadataKeys: [
          "AMAZON_BEDROCK_METADATA",
          "AMAZON_BEDROCK_TEXT",
        ]
      }
    });

    // Apply DESTROY removal policy to S3 Vector Index
    this.vectorIndex.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // ========================================
    // IAM ROLES AND POLICIES
    // ========================================

    // Bedrock Service Role - allows Bedrock services to access S3 buckets and S3 Vectors
    this.bedrockServiceRole = new iam.Role(this, 'BedrockServiceRole', {
      roleName: `BedrockChatbotServiceRole-${environment}`,
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Service role for Bedrock to access S3 buckets, S3 Vectors, and other AWS services',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
      ],
    });

    // Apply DESTROY removal policy to Bedrock Service Role
    this.bedrockServiceRole.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Create a comprehensive managed policy for S3 Vectors and S3 access
    const bedrockServicePolicy = new iam.ManagedPolicy(this, 'BedrockServicePolicy', {
      managedPolicyName: `BedrockChatbotServicePolicy-${environment}`,
      description: 'Comprehensive policy for Bedrock service to access all required resources',
      statements: [
        // S3 Vectors permissions
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3vectors:*'],
          resources: ['*'],
        }),
        // Document source bucket permissions (read and write for supplemental data storage)
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket',
            's3:GetBucketLocation',
            's3:GetObjectVersion',
            's3:PutObjectAcl',
            's3:GetBucketVersioning',
          ],
          resources: [
            this.documentSourceBucket.bucketArn,
            `${this.documentSourceBucket.bucketArn}/*`,
          ],
        }),
        // Bedrock model and service permissions
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock:*',
          ],
          resources: ['*'],
        }),
      ],
    });

    // Apply DESTROY removal policy to Bedrock Service Policy
    bedrockServicePolicy.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Attach the managed policy to the role
    this.bedrockServiceRole.addManagedPolicy(bedrockServicePolicy);

    // ========================================
    // BEDROCK KNOWLEDGE BASE
    // ========================================

    // Knowledge Base with S3 Vectors storage
    this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
      name: `bedrock-chatbot-kb-${environment}`,
      description: 'Knowledge Base for chatbot with document retrieval using S3 Vectors and Nova embeddings',
      roleArn: this.bedrockServiceRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`,
          embeddingModelConfiguration: {
            bedrockEmbeddingModelConfiguration: {
              dimensions: 3072,
            },
          },
          supplementalDataStorageConfiguration: {
            supplementalDataStorageLocations: [
              {
                supplementalDataStorageLocationType: "S3",
                s3Location: {
                  uri: `s3://${this.documentSourceBucket.bucketName}/`,
                },
              },
            ],
          },
        },
      },
      storageConfiguration: {
        type: 'S3_VECTORS',
        s3VectorsConfiguration: {
          vectorBucketArn: this.vectorBucket.attrVectorBucketArn,
          indexArn: this.vectorIndex.attrIndexArn,
        },
      },
    });

    // Apply DESTROY removal policy to Knowledge Base
    this.knowledgeBase.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Add explicit dependencies to ensure proper creation order
    this.knowledgeBase.addDependency(this.vectorBucket);
    this.knowledgeBase.addDependency(this.vectorIndex);
    this.knowledgeBase.node.addDependency(this.bedrockServiceRole);
    this.knowledgeBase.node.addDependency(bedrockServicePolicy);

    // Data Source for the Knowledge Base
    this.dataSource = new bedrock.CfnDataSource(this, 'DataSource', {
      knowledgeBaseId: this.knowledgeBase.attrKnowledgeBaseId,
      name: `bedrock-chatbot-datasource-${environment}`,
      description: 'S3 data source for document ingestion with Bedrock Data Automation',
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: this.documentSourceBucket.bucketArn,
          inclusionPrefixes: ['docs/'], // Only process documents in /docs prefix
        },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: 'FIXED_SIZE',
          fixedSizeChunkingConfiguration: {
            maxTokens: 512,
            overlapPercentage: 20,
          },
        },
        parsingConfiguration: {
          parsingStrategy: 'BEDROCK_DATA_AUTOMATION',
        },
      },
    });

    // Apply DESTROY removal policy to Data Source
    this.dataSource.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // ========================================
    // LAMBDA AGENT HANDLER
    // ========================================

    // Lambda function for handling chat requests with direct Bedrock API + Knowledge Base
    this.agentHandlerFunction = new lambda.Function(this, 'AgentHandlerFunction', {
      functionName: `bedrock-chatbot-handler-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('lambda/agent-handler'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        MODEL_ID: 'global.amazon.nova-2-lite-v1:0',
        KNOWLEDGE_BASE_ID: this.knowledgeBase.attrKnowledgeBaseId,
        USE_KNOWLEDGE_BASE: 'true',
        MAX_TOKENS: '2048',
        TEMPERATURE: '0.3',  // Lower temperature for more focused, direct responses
        LOG_LEVEL: isDevelopment ? 'DEBUG' : 'INFO',
      },
      logGroup: new logs.LogGroup(this, 'AgentHandlerLogGroup', {
        logGroupName: `/aws/lambda/bedrock-chatbot-handler-${environment}`,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY, // Always destroy for easy cleanup
      }),
      description: 'Lambda function for processing chat requests through direct Bedrock API with Knowledge Base',
    });

    // Apply DESTROY removal policy to Lambda function
    this.agentHandlerFunction.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Grant Lambda permissions to invoke Bedrock models and retrieve from Knowledge Base
    this.agentHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:Retrieve',  // Add this permission for Knowledge Base retrieval
          'bedrock-agent-runtime:Retrieve',
        ],
        resources: [
          // Global inference profile
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/global.amazon.nova-2-lite-v1:0`,
          // Foundation model (what the global profile resolves to)
          `arn:aws:bedrock:::foundation-model/amazon.nova-2-lite-v1:0`,
          // All Nova models
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-*`,
          // Knowledge Base
          this.knowledgeBase.attrKnowledgeBaseArn,
        ],
      })
    );

    // Grant Lambda permissions to read documents from S3 for proxy downloads
    this.agentHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:GetObjectVersion',
        ],
        resources: [
          `${this.documentSourceBucket.bucketArn}/*`,
        ],
      })
    );

    // Grant Lambda permissions to emit CloudWatch logs only
    this.agentHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    // Enable X-Ray tracing for Lambda function
    this.agentHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
        ],
        resources: ['*'],
      })
    );

    // CDK Nag suppressions for Lambda function
    NagSuppressions.addResourceSuppressions(
      this.agentHandlerFunction,
      [
        {
          id: 'AwsSolutions-L1',
          reason: 'Python 3.12 is the latest available runtime for Lambda at the time of implementation',
        },
      ],
    );

    // ========================================
    // COGNITO AUTHENTICATION
    // ========================================

    // Cognito User Pool for authentication
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `bedrock-chatbot-users-${environment}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true, // Required for CDK Nag compliance
      },
      mfa: cognito.Mfa.OPTIONAL, // Enable MFA for security
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Always destroy for easy cleanup
    });

    // Cognito User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `bedrock-chatbot-client-${environment}`,
      generateSecret: false, // For web applications
      authFlows: {
        userSrp: true,
        userPassword: isDevelopment, // Allow username/password flow in development for testing
        adminUserPassword: false,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: ['http://localhost:3000/callback'],
        logoutUrls: ['http://localhost:3000'],
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // Create a test user in development environment
    if (isDevelopment) {
      new cognito.CfnUserPoolUser(this, 'TestUser', {
        userPoolId: this.userPool.userPoolId,
        username: 'testuser',
        userAttributes: [
          {
            name: 'email',
            value: 'test@example.com',
          },
          {
            name: 'email_verified',
            value: 'true',
          },
        ],
        messageAction: 'SUPPRESS', // Don't send welcome email in development
      });
    }

    // CDK Nag suppressions for Cognito
    NagSuppressions.addResourceSuppressions(
      this.userPool,
      [
        {
          id: 'AwsSolutions-COG2',
          reason: 'MFA is set to optional to balance security with user experience. Can be enforced in production if needed.',
        },
        {
          id: 'AwsSolutions-COG3',
          reason: 'AdvancedSecurityMode is deprecated by AWS. Using MFA and strong password policies for security instead.',
        },
      ],
    );

    // ========================================
    // HTTP API WITH AUTHENTICATION
    // ========================================

    // HTTP API Gateway
    this.httpApi = new apigateway.HttpApi(this, 'HttpApi', {
      apiName: `bedrock-chatbot-api-${environment}`,
      description: 'HTTP API for Bedrock Chatbot with Cognito authentication',
      corsPreflight: {
        allowOrigins: ['*'], // Allow all origins for easier development and testing
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        exposeHeaders: [
          'Content-Disposition',
          'Content-Type',
        ],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Cognito JWT Authorizer
    this.cognitoAuthorizer = new authorizers.HttpJwtAuthorizer('CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
      {
        jwtAudience: [this.userPoolClient.userPoolClientId],
      }
    );

    // Lambda Integration
    const lambdaIntegration = new integrations.HttpLambdaIntegration(
      'AgentHandlerIntegration',
      this.agentHandlerFunction,
      {
        payloadFormatVersion: apigateway.PayloadFormatVersion.VERSION_2_0,
      }
    );

    // Health check function
    const healthCheckFunction = new lambda.Function(this, 'HealthCheckFunction', {
      functionName: `bedrock-chatbot-health-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json

def handler(event, context):
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'status': 'healthy',
            'service': 'bedrock-chatbot-backend',
            'timestamp': context.aws_request_id
        })
    }
      `),
      timeout: cdk.Duration.seconds(10),
      description: 'Health check endpoint for the chatbot API',
    });

    // Apply DESTROY removal policy to Health Check function
    healthCheckFunction.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Chat endpoint with authentication
    this.httpApi.addRoutes({
      path: '/chat',
      methods: [apigateway.HttpMethod.POST],
      integration: lambdaIntegration,
      authorizer: this.cognitoAuthorizer,
    });

    // Document download endpoint with authentication
    this.httpApi.addRoutes({
      path: '/document',
      methods: [apigateway.HttpMethod.GET],
      integration: lambdaIntegration,
      authorizer: this.cognitoAuthorizer,
    });

    // Health check endpoint (no authentication required)
    this.httpApi.addRoutes({
      path: '/health',
      methods: [apigateway.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'HealthCheckIntegration',
        healthCheckFunction
      ),
    });

    // CDK Nag suppressions for API Gateway and Health Check
    NagSuppressions.addResourceSuppressions(
      this.httpApi,
      [
        {
          id: 'AwsSolutions-APIG1',
          reason: 'Access logging is not required for this development/demo API. Can be enabled in production if needed.',
        },
      ],
    );

    NagSuppressions.addResourceSuppressions(
      healthCheckFunction,
      [
        {
          id: 'AwsSolutions-L1',
          reason: 'Python 3.12 is the latest available runtime for Lambda at the time of implementation',
        },
      ],
    );

    // Suppress authorization warning for health check endpoint
    const healthRoute = this.httpApi.node.findChild('GET--health') as apigateway.HttpRoute;
    NagSuppressions.addResourceSuppressions(
      healthRoute,
      [
        {
          id: 'AwsSolutions-APIG4',
          reason: 'Health check endpoint intentionally does not require authentication for monitoring purposes',
        },
      ],
    );

    // Suppress access logging warning for API Gateway stage
    const defaultStage = this.httpApi.node.findChild('DefaultStage');
    if (defaultStage) {
      NagSuppressions.addResourceSuppressions(
        defaultStage,
        [
          {
            id: 'AwsSolutions-APIG1',
            reason: 'Access logging is not required for this development/demo API. Can be enabled in production if needed.',
          },
        ],
      );
    }

    // ========================================
    // CDK NAG SUPPRESSIONS
    // ========================================

    // Add specific CDK Nag suppressions for S3 Vectors and IAM resources
    NagSuppressions.addResourceSuppressions(
      this.bedrockServiceRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard permissions are necessary for Bedrock service to access S3 Vectors, S3 objects and foundation models',
        },
      ],
    );

    NagSuppressions.addResourceSuppressions(
      [this.documentSourceBucket],
      [
        {
          id: 'AwsSolutions-S1',
          reason: 'Access logging is not required for this use case as this is an internal service bucket',
        },
      ],
    );

    // Add basic CDK Nag suppressions for the stack
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWS managed policies are acceptable for this use case and provide necessary permissions',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions are necessary for some AWS service integrations and are scoped appropriately',
      },
    ]);

    // ========================================
    // OUTPUTS
    // ========================================

    new cdk.CfnOutput(this, 'DocumentSourceBucketName', {
      value: this.documentSourceBucket.bucketName,
      description: 'Name of the S3 bucket for source documents',
      exportName: `${this.stackName}-DocumentSourceBucket`,
    });

    new cdk.CfnOutput(this, 'DocumentSourceBucketArn', {
      value: this.documentSourceBucket.bucketArn,
      description: 'ARN of the S3 bucket for source documents',
    });

    new cdk.CfnOutput(this, 'VectorBucketName', {
      value: this.vectorBucket.vectorBucketName || `bedrock-chatbot-vectors-${environment}-${this.account}`,
      description: 'Name of the S3 Vector bucket for vector storage',
      exportName: `${this.stackName}-VectorBucket`,
    });

    new cdk.CfnOutput(this, 'VectorBucketArn', {
      value: this.vectorBucket.attrVectorBucketArn,
      description: 'ARN of the S3 Vector bucket for vector storage',
    });

    new cdk.CfnOutput(this, 'VectorIndexArn', {
      value: this.vectorIndex.attrIndexArn,
      description: 'ARN of the S3 Vector index for Bedrock Knowledge Base',
      exportName: `${this.stackName}-VectorIndex`,
    });

    new cdk.CfnOutput(this, 'BedrockServiceRoleArn', {
      value: this.bedrockServiceRole.roleArn,
      description: 'ARN of the Bedrock service role',
      exportName: `${this.stackName}-BedrockServiceRole`,
    });

    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: this.knowledgeBase.attrKnowledgeBaseId,
      description: 'ID of the Bedrock Knowledge Base',
      exportName: `${this.stackName}-KnowledgeBase`,
    });

    new cdk.CfnOutput(this, 'KnowledgeBaseArn', {
      value: this.knowledgeBase.attrKnowledgeBaseArn,
      description: 'ARN of the Bedrock Knowledge Base',
    });

    new cdk.CfnOutput(this, 'DataSourceId', {
      value: this.dataSource.attrDataSourceId,
      description: 'ID of the Bedrock Data Source',
    });

    new cdk.CfnOutput(this, 'AgentHandlerFunctionName', {
      value: this.agentHandlerFunction.functionName,
      description: 'Name of the Lambda Agent Handler function',
      exportName: `${this.stackName}-AgentHandler`,
    });

    new cdk.CfnOutput(this, 'AgentHandlerFunctionArn', {
      value: this.agentHandlerFunction.functionArn,
      description: 'ARN of the Lambda Agent Handler function',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'ID of the Cognito User Pool',
      exportName: `${this.stackName}-UserPool`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'ID of the Cognito User Pool Client',
      exportName: `${this.stackName}-UserPoolClient`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'ARN of the Cognito User Pool',
    });

    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'URL of the HTTP API Gateway',
      exportName: `${this.stackName}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'HttpApiId', {
      value: this.httpApi.httpApiId,
      description: 'ID of the HTTP API Gateway',
    });

    new cdk.CfnOutput(this, 'ChatEndpoint', {
      value: `${this.httpApi.apiEndpoint}/chat`,
      description: 'Full URL of the chat endpoint',
    });

    new cdk.CfnOutput(this, 'LogGroupName', {
      value: `/aws/lambda/bedrock-chatbot-handler-${environment}`,
      description: 'CloudWatch Log Group for Lambda function',
    });

    // Output important values
    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
      description: 'Name of the deployed stack',
    });

    new cdk.CfnOutput(this, 'Environment', {
      value: environment,
      description: 'Deployment environment',
    });
  }
}