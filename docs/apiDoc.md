# Multilingual RAG Chatbot API Documentation

This document describes the APIs provided by the Multilingual RAG Chatbot backend.

## Base URL

After deployment, the API base URL is provided in the deployment summary:

```
https://<api-id>.execute-api.us-east-1.amazonaws.com
```

Get the URL from CloudFormation outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name BedrockChatbotBackendStack \
  --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
  --output text
```

## Authentication

The API uses Amazon Cognito JWT authentication for protected endpoints.

### Getting an Access Token

**Option 1: Programmatic Authentication**
```bash
# Using AWS CLI
TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id <USER_POOL_CLIENT_ID> \
  --auth-parameters USERNAME=testuser,PASSWORD='YourPassword123!' \
  --query 'AuthenticationResult.IdToken' \
  --output text)
```

**Option 2: From Frontend**
```typescript
// Using the AuthService in the frontend
const token = await authService.getToken();
```

### Using the Token

Include the token in the `Authorization` header:
```
Authorization: Bearer <JWT_TOKEN>
```

### Token Configuration

| Parameter | Value |
|-----------|-------|
| Token Type | JWT (ID Token) |
| Validity | 1 hour |
| Refresh Token Validity | 30 days |
| Issuer | `https://cognito-idp.us-east-1.amazonaws.com/<USER_POOL_ID>` |

---

## Endpoints

### 1. Health Check

Check if the API is running and healthy.

#### GET /health

- **Authentication**: None required
- **Purpose**: Monitor API availability and health status

**Request:**
```bash
curl https://<api-url>/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "bedrock-chatbot-backend",
  "timestamp": "abc123-request-id"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Health status ("healthy") |
| `service` | string | Service identifier |
| `timestamp` | string | AWS request ID |

---

### 2. Chat

Send a message and receive an AI-generated response with source attribution.

#### POST /chat

- **Authentication**: JWT required
- **Purpose**: Process user messages through RAG pipeline

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "What are the requirements for UI modernization?",
  "language": "english",
  "sessionId": "session-123456789"
}
```

**Request Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User's question (max 10,000 characters) |
| `language` | string | No | Response language: "english" or "spanish" (default: "english") |
| `sessionId` | string | No | Session ID for conversation continuity |

**Example Request:**
```bash
curl -X POST https://<api-url>/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the requirements for UI modernization?",
    "language": "english"
  }'
```

**Response (200 OK):**
```json
{
  "response": "The requirements for UI modernization include:\n\n1. **Responsive Design**: Support for mobile and desktop devices\n2. **Accessibility**: WCAG 2.1 compliance\n3. **Performance**: Load time under 3 seconds\n4. **Security**: Modern authentication standards",
  "sessionId": "session-1705123456789-abc123def",
  "sources": [
    {
      "document": "UI-Modernization-Requirements",
      "score": 0.95,
      "location": "s3://bedrock-chatbot-documents-development-123456789/docs/requirements.pdf",
      "downloadUrl": "/document?path=s3://bedrock-chatbot-documents-development-123456789/docs/requirements.pdf"
    },
    {
      "document": "Technical-Standards-Guide",
      "score": 0.87,
      "location": "s3://bedrock-chatbot-documents-development-123456789/docs/standards.pdf",
      "downloadUrl": "/document?path=s3://bedrock-chatbot-documents-development-123456789/docs/standards.pdf"
    }
  ],
  "timestamp": "2026-01-20T15:30:00.000Z"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `response` | string | AI-generated response (markdown formatted) |
| `sessionId` | string | Session ID for conversation continuity |
| `sources` | array | Source documents used (empty for conversational responses) |
| `sources[].document` | string | Document name (without extension) |
| `sources[].score` | number | Relevance score (0.0 to 1.0) |
| `sources[].location` | string | S3 URI of the source document |
| `sources[].downloadUrl` | string | Relative URL to download the document |
| `timestamp` | string | ISO 8601 timestamp of response |

**Response Types:**

The API returns two types of responses:

| Type | Description | Sources Included |
|------|-------------|------------------|
| Technical | Questions answered using documents | Yes |
| Conversational | Greetings, thanks, feedback | No (empty array) |

---

### 3. Document Retrieval

Retrieve a source document from S3.

#### GET /document

- **Authentication**: JWT required
- **Purpose**: Download or view source documents referenced in chat responses

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | S3 URI of the document (URL encoded) |

**Example Request:**
```bash
# URL encode the S3 path
ENCODED_PATH=$(python3 -c "import urllib.parse; print(urllib.parse.quote('s3://bucket/docs/file.pdf'))")

curl -X GET "https://<api-url>/document?path=$ENCODED_PATH" \
  -H "Authorization: Bearer $TOKEN" \
  --output document.pdf
```

**Response (200 OK):**
- **Content-Type**: Based on file type
  - PDF: `application/pdf`
  - Word: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - Other: `application/octet-stream`
- **Content-Disposition**: 
  - PDF: None (opens in browser)
  - Other: `attachment; filename="filename.ext"` (downloads)
- **Body**: Binary file content (Base64 encoded in Lambda response)

**Response Behavior by File Type:**
| File Type | Content-Type | Behavior |
|-----------|--------------|----------|
| PDF (.pdf) | `application/pdf` | Opens in browser |
| Word (.docx) | `application/...wordprocessingml...` | Downloads |
| Other | `application/octet-stream` | Downloads |

---

## Error Responses

All endpoints return consistent error responses.

### Error Response Format

```json
{
  "error": "ErrorType",
  "message": "Human-readable error description",
  "requestId": "abc123-request-id",
  "timestamp": "2026-01-20T15:30:00.000Z"
}
```

### HTTP Status Codes

| Status | Error Type | Description |
|--------|------------|-------------|
| 400 | ValidationError | Invalid request format or parameters |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | AccessDenied | Token valid but access not permitted |
| 404 | NotFound | Document or resource not found |
| 500 | InternalError | Server-side error |

### Common Errors

**400 Bad Request - Empty Message:**
```json
{
  "error": "ValidationError",
  "message": "Message cannot be empty",
  "requestId": "abc123",
  "timestamp": "2026-01-20T15:30:00.000Z"
}
```

**400 Bad Request - Message Too Long:**
```json
{
  "error": "ValidationError",
  "message": "Message too long",
  "requestId": "abc123",
  "timestamp": "2026-01-20T15:30:00.000Z"
}
```

**401 Unauthorized - Missing Token:**
```json
{
  "message": "Unauthorized"
}
```

**404 Not Found - Document:**
```json
{
  "error": "Document not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "InternalError",
  "message": "Internal server error",
  "requestId": "abc123",
  "timestamp": "2026-01-20T15:30:00.000Z"
}
```

---

## Rate Limiting

The API Gateway implements rate limiting to prevent abuse.

| Parameter | Value |
|-----------|-------|
| Rate Limit | 100 requests/second |
| Burst Capacity | 200 requests |

**Rate Limit Exceeded Response (429):**
```json
{
  "message": "Too Many Requests"
}
```

---

## CORS Configuration

The API supports Cross-Origin Resource Sharing (CORS) for browser-based clients.

**Allowed Origins:** `*` (all origins in development)

**Allowed Methods:**
- GET
- POST
- OPTIONS

**Allowed Headers:**
- Content-Type
- Authorization
- X-Amz-Date
- X-Api-Key
- X-Amz-Security-Token

**Exposed Headers:**
- Content-Disposition
- Content-Type

**Max Age:** 86400 seconds (24 hours)

---

## Usage Examples

### Python Example

```python
import requests

API_URL = "https://<api-id>.execute-api.us-east-1.amazonaws.com"
TOKEN = "your-jwt-token"

# Send a chat message
response = requests.post(
    f"{API_URL}/chat",
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    },
    json={
        "message": "What are the UI requirements?",
        "language": "english"
    }
)

result = response.json()
print(f"Response: {result['response']}")
print(f"Sources: {len(result['sources'])} documents")
```

### JavaScript/TypeScript Example

```typescript
const API_URL = "https://<api-id>.execute-api.us-east-1.amazonaws.com";
const TOKEN = "your-jwt-token";

// Send a chat message
const response = await fetch(`${API_URL}/chat`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    message: "What are the UI requirements?",
    language: "english"
  })
});

const result = await response.json();
console.log("Response:", result.response);
console.log("Sources:", result.sources);
```

### cURL Examples

```bash
# Health check
curl https://<api-url>/health

# Chat (English)
curl -X POST https://<api-url>/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the requirements?", "language": "english"}'

# Chat (Spanish)
curl -X POST https://<api-url>/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cuáles son los requisitos?", "language": "spanish"}'

# Download document
curl -X GET "https://<api-url>/document?path=s3%3A%2F%2Fbucket%2Fdocs%2Ffile.pdf" \
  -H "Authorization: Bearer $TOKEN" \
  --output document.pdf
```

---

## Backend Services

### Knowledge Base Retrieval

The `/chat` endpoint uses Amazon Bedrock Knowledge Base for document retrieval:

| Parameter | Value |
|-----------|-------|
| Embedding Model | `amazon.nova-2-multimodal-embeddings-v1:0` |
| Embedding Dimensions | 3072 |
| Distance Metric | Cosine Similarity |
| Results per Query | 5 documents |

### Model Invocation

The `/chat` endpoint uses Amazon Bedrock for response generation:

| Parameter | Value |
|-----------|-------|
| Model | `global.amazon.nova-2-lite-v1:0` |
| Max Tokens | 512 |
| Temperature | 0.5 |
| Top P | 0.7 |

### Conversation Memory

The API maintains conversation context:

| Parameter | Value |
|-----------|-------|
| History Length | Last 5 exchanges |
| Storage | In-memory (Lambda container) |
| Session Scope | Per session ID |

---

## Additional Resources

- **[Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)** - Foundation model access
- **[Amazon Cognito Documentation](https://docs.aws.amazon.com/cognito/)** - Authentication service
- **[API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)** - HTTP API reference
- **[Deployment Guide](./deploymentGuide.md)** - How to deploy the backend
- **[Architecture Deep Dive](./architectureDeepDive.md)** - System architecture details
