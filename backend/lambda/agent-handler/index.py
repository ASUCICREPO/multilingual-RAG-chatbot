"""
Bedrock Chatbot with RetrieveAndGenerate API and Guardrails

This Lambda function uses the RetrieveAndGenerate API with Bedrock Guardrails
for RAG (Retrieval Augmented Generation) capabilities with built-in safety controls.
"""

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from urllib.parse import unquote, urlparse
import base64

import boto3
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(os.getenv('LOG_LEVEL', 'INFO'))

# Initialize AWS clients
bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')
s3_client = boto3.client('s3')

# Environment variables
MODEL_ARN = os.getenv('MODEL_ARN')  # Full ARN passed from CDK (inference profile)
KNOWLEDGE_BASE_ID = os.getenv('KNOWLEDGE_BASE_ID')
GUARDRAIL_ID = os.getenv('GUARDRAIL_ID')
GUARDRAIL_VERSION = os.getenv('GUARDRAIL_VERSION', 'DRAFT')
MAX_TOKENS = int(os.getenv('MAX_TOKENS', '2048'))
TEMPERATURE = float(os.getenv('TEMPERATURE', '0.3'))
USE_KNOWLEDGE_BASE = os.getenv('USE_KNOWLEDGE_BASE', 'true').lower() == 'true'


# Prompt template for RetrieveAndGenerate
# NOTE: $output_format_instructions$ is REQUIRED for citations to be returned
PROMPT_TEMPLATE = """You are a technical assistant. Answer questions using the provided document context.

QUERY TYPE (determine silently, don't output):
- FOLLOW_UP: References previous response ("provide as bullets", "explain more", "summarize that") → Use conversation history from this session.
- TECHNICAL: New question about documents → Use document context.
- CONVERSATIONAL: Greetings/thanks ("hello", "thank you") → Respond briefly and naturally.

STRICT RULES:
1. Keep responses SHORT - maximum 5-6 sentences as a brief summary.
2. Do NOT use headers, bullet points, or long lists unless specifically asked.
3. Use ONLY information from the documents. Do not add external information.
4. If documents don't contain relevant information, say so briefly.

DOCUMENT CONTEXT:
$search_results$

QUESTION: $query$

$output_format_instructions$

BRIEF ANSWER:"""


class ChatRequest:
    """Data model for chat requests"""
    
    def __init__(self, message: str, session_id: Optional[str] = None, user_id: Optional[str] = None, language: Optional[str] = None):
        self.message = message
        self.session_id = session_id or str(uuid.uuid4())
        self.user_id = user_id or 'anonymous'
        self.language = self._validate_language(language)
        
    def _validate_language(self, language: Optional[str]) -> str:
        """Validate language parameter - only accept 'english' or 'spanish'"""
        if not language:
            return 'english'
        
        language = language.lower().strip()
        
        if language in ['english', 'spanish']:
            return language
        
        return 'english'  # Default fallback
        
    @classmethod
    def from_event(cls, event: Dict[str, Any]) -> 'ChatRequest':
        """Create ChatRequest from API Gateway event"""
        try:
            body = json.loads(event.get('body', '{}'))
            return cls(
                message=body.get('message', ''),
                session_id=body.get('sessionId'),
                user_id=event.get('requestContext', {}).get('authorizer', {}).get('userId'),
                language=body.get('language')
            )
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"Failed to parse request: {e}")
            raise ValueError("Invalid request format")


class ChatResponse:
    """Data model for chat responses"""
    
    def __init__(self, response: str, session_id: str, sources: Optional[list] = None, guardrail_action: Optional[str] = None):
        self.response = response
        self.session_id = session_id
        self.sources = sources or []
        self.guardrail_action = guardrail_action
        self.timestamp = datetime.utcnow().isoformat()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = {
            'response': self.response,
            'sessionId': self.session_id,
            'sources': self.sources,
            'timestamp': self.timestamp
        }
        if self.guardrail_action:
            result['guardrailAction'] = self.guardrail_action
        return result


class ErrorResponse:
    """Data model for error responses"""
    
    def __init__(self, error: str, message: str, request_id: str):
        self.error = error
        self.message = message
        self.request_id = request_id
        self.timestamp = datetime.utcnow().isoformat()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'error': self.error,
            'message': self.message,
            'requestId': self.request_id,
            'timestamp': self.timestamp
        }


def validate_request(chat_request: ChatRequest) -> None:
    """Validate chat request parameters"""
    if not chat_request.message or not chat_request.message.strip():
        raise ValueError("Message cannot be empty")
    
    if len(chat_request.message) > 10000:  # Reasonable limit
        raise ValueError("Message too long")


def invoke_retrieve_and_generate(chat_request: ChatRequest) -> Dict[str, Any]:
    """
    Invoke Bedrock RetrieveAndGenerate API with Guardrails
    
    This API handles:
    - Knowledge Base retrieval
    - Response generation with the LLM
    - Guardrail enforcement
    - Session/conversation management
    """
    try:
        logger.info(f"Invoking RetrieveAndGenerate for session: {chat_request.session_id}")
        logger.info(f"Knowledge Base ID: {KNOWLEDGE_BASE_ID}, Model ARN: {MODEL_ARN}")
        logger.info(f"Guardrail ID: {GUARDRAIL_ID}, Version: {GUARDRAIL_VERSION}")
        
        # Build input text with language instruction if Spanish
        input_text = chat_request.message
        if chat_request.language == 'spanish':
            input_text = f"[Respond in Spanish] {chat_request.message}"
        
        # Build the RetrieveAndGenerate request
        request_params = {
            'input': {
                'text': input_text
            },
            'retrieveAndGenerateConfiguration': {
                'type': 'KNOWLEDGE_BASE',
                'knowledgeBaseConfiguration': {
                    'knowledgeBaseId': KNOWLEDGE_BASE_ID,
                    'modelArn': MODEL_ARN,
                    'retrievalConfiguration': {
                        'vectorSearchConfiguration': {
                            'numberOfResults': 5,
                        }
                    },
                    'generationConfiguration': {
                        'promptTemplate': {
                            'textPromptTemplate': PROMPT_TEMPLATE
                        },
                        'inferenceConfig': {
                            'textInferenceConfig': {
                                'maxTokens': MAX_TOKENS,
                                'temperature': TEMPERATURE,
                                'topP': 0.9,
                            }
                        },
                        'guardrailConfiguration': {
                            'guardrailId': GUARDRAIL_ID,
                            'guardrailVersion': GUARDRAIL_VERSION,
                        }
                    }
                }
            },
        }
        
        # Only include sessionId if it looks like a valid Bedrock session ID
        # Bedrock session IDs are UUIDs, not custom frontend-generated IDs
        # If sessionId starts with frontend prefix like "session-", it's not a valid Bedrock session
        if chat_request.session_id and not chat_request.session_id.startswith('session-'):
            request_params['sessionId'] = chat_request.session_id
            logger.info(f"Using existing Bedrock session: {chat_request.session_id}")
        else:
            logger.info("No valid Bedrock session - will create new session")
        
        logger.debug(f"RetrieveAndGenerate request: {json.dumps(request_params, default=str)}")
        
        # Call RetrieveAndGenerate API
        response = bedrock_agent_runtime.retrieve_and_generate(**request_params)
        
        logger.info(f"RetrieveAndGenerate response received")
        logger.info(f"Response keys: {list(response.keys())}")
        logger.info(f"Citations present: {'citations' in response}, count: {len(response.get('citations', []))}")
        logger.debug(f"Full response: {json.dumps(response, default=str)[:2000]}...")
        
        # Extract the generated response
        output_text = response.get('output', {}).get('text', '')
        session_id = response.get('sessionId', chat_request.session_id)
        
        # Extract citations/sources
        citations = response.get('citations', [])
        logger.info(f"Raw citations: {json.dumps(citations, default=str)[:500]}")
        sources = extract_sources_from_citations(citations)
        logger.info(f"Extracted {len(sources)} sources from citations")
        
        # Check guardrail action if present
        guardrail_action = None
        if 'guardrailAction' in response:
            guardrail_action = response['guardrailAction']
            logger.info(f"Guardrail action: {guardrail_action}")
        
        return {
            'response': output_text,
            'session_id': session_id,
            'sources': sources,
            'guardrail_action': guardrail_action
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"RetrieveAndGenerate API error: {error_code} - {error_message}")
        
        if error_code == 'ThrottlingException':
            raise Exception("Service temporarily unavailable. Please try again later.")
        elif error_code == 'ValidationException':
            logger.error(f"Validation error details: {e.response}")
            raise ValueError(f"Invalid request: {error_message}")
        elif error_code == 'AccessDeniedException':
            raise Exception("Access denied. Please check permissions.")
        elif 'Guardrail' in error_message:
            # Guardrail blocked the request
            return {
                'response': "I can only help with questions related to NASWA technical documentation. Please ask a question about the uploaded documents.",
                'session_id': chat_request.session_id,
                'sources': [],
                'guardrail_action': 'BLOCKED'
            }
        else:
            raise Exception(f"AI service error: {error_message}")
    
    except Exception as e:
        logger.error(f"Unexpected error in RetrieveAndGenerate: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise Exception("Internal service error")


def extract_sources_from_citations(citations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract and format sources from RetrieveAndGenerate citations
    
    Note: RetrieveAndGenerate API doesn't return relevance scores in citations,
    so we don't include fake scores in the response.
    """
    seen_documents = {}
    
    for citation in citations:
        retrieved_references = citation.get('retrievedReferences', [])
        
        for ref in retrieved_references:
            # Extract location
            location = ref.get('location', {})
            s3_location = location.get('s3Location', {})
            uri = s3_location.get('uri', '')
            
            # Extract document name from URI
            doc_name = 'Unknown Document'
            if uri:
                try:
                    parsed = urlparse(uri)
                    if parsed.path:
                        doc_name = parsed.path.split('/')[-1]
                        if '.' in doc_name:
                            doc_name = doc_name.rsplit('.', 1)[0]
                except:
                    pass
            
            # Deduplicate by document name
            if doc_name not in seen_documents:
                seen_documents[doc_name] = {
                    'document': doc_name,
                    'location': uri,
                    'downloadUrl': f"/document?path={uri}" if uri else None
                }
    
    # Convert to list
    sources = list(seen_documents.values())
    
    return sources


def handle_document_request(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle document requests - generate pre-signed URLs for direct S3 access"""
    try:
        # Get the document path from query parameters
        query_params = event.get('queryStringParameters') or {}
        document_path = query_params.get('path')
        
        if not document_path:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Missing document path parameter'})
            }
        
        # Parse S3 URI
        if not document_path.startswith('s3://'):
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Invalid S3 path'})
            }
        
        # Extract bucket and key from S3 URI
        s3_parts = document_path[5:].split('/', 1)  # Remove 's3://' prefix
        if len(s3_parts) != 2:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Invalid S3 URI format'})
            }
        
        bucket_name, object_key = s3_parts
        
        # Get filename for Content-Disposition
        filename = object_key.split('/')[-1]
        file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
        
        logger.info(f"Generating pre-signed URL for: bucket={bucket_name}, key={object_key}, filename={filename}")
        
        # Determine Content-Disposition based on file type
        # PDFs and Office docs: inline (view in browser/viewer)
        # Others: attachment (download)
        office_extensions = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt']
        
        if file_extension == 'pdf' or file_extension in office_extensions:
            content_disposition = 'inline'
            logger.info(f"{file_extension.upper()} detected - generating URL for browser viewing")
        else:
            content_disposition = f'attachment; filename="{filename}"'
            logger.info(f"Other file type detected - generating URL for download with filename: {filename}")
        
        # Generate pre-signed URL (valid for 60 minutes)
        try:
            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': bucket_name,
                    'Key': object_key,
                    'ResponseContentDisposition': content_disposition
                },
                ExpiresIn=3600  # 60 minutes
            )
            
            logger.info(f"Successfully generated pre-signed URL for {filename}")
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,OPTIONS'
                },
                'body': json.dumps({
                    'url': presigned_url,
                    'filename': filename,
                    'expiresIn': 3600
                })
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'NoSuchKey':
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Document not found'})
                }
            elif error_code == 'AccessDenied':
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Access denied to document'})
                }
            else:
                logger.error(f"S3 error generating pre-signed URL: {e}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Failed to generate document URL'})
                }
                
    except Exception as e:
        logger.error(f"Error handling document request: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Internal server error'})
        }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for chat requests, document downloads, and health checks
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    request_id = context.aws_request_id
    start_time = datetime.utcnow()
    
    # Check the request path
    path = event.get('rawPath') or event.get('path', '')
    
    # Handle health check
    if path == '/health':
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'status': 'healthy',
                'service': 'bedrock-chatbot-backend',
                'timestamp': request_id
            })
        }
    
    # Handle document download request
    if path == '/document':
        return handle_document_request(event)
    
    logger.info(f"Processing chat request: {request_id}")
    logger.info(f"Environment - MODEL_ARN: {MODEL_ARN}, KNOWLEDGE_BASE_ID: {KNOWLEDGE_BASE_ID}, GUARDRAIL_ID: {GUARDRAIL_ID}")
    
    try:
        # Parse and validate request
        chat_request = ChatRequest.from_event(event)
        validate_request(chat_request)
        
        logger.info(f"Chat request - User: {chat_request.user_id}, Session: {chat_request.session_id}, Language: {chat_request.language}")
        logger.info(f"User message: {chat_request.message[:100]}...")
        
        # Invoke RetrieveAndGenerate API
        result = invoke_retrieve_and_generate(chat_request)
        
        # Create response
        chat_response = ChatResponse(
            response=result['response'],
            session_id=result['session_id'],
            sources=result['sources'],
            guardrail_action=result.get('guardrail_action')
        )
        
        # Log success metrics
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"Successfully processed request {request_id} in {processing_time:.2f}s")
        logger.info(f"Response length: {len(chat_response.response)}, Sources count: {len(chat_response.sources)}")
        if chat_response.guardrail_action:
            logger.info(f"Guardrail action: {chat_response.guardrail_action}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            'body': json.dumps(chat_response.to_dict())
        }
        
    except ValueError as e:
        # Client error (400)
        logger.warning(f"Client error in request {request_id}: {e}")
        
        error_response = ErrorResponse('ValidationError', str(e), request_id)
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(error_response.to_dict())
        }
        
    except Exception as e:
        # Server error (500)
        logger.error(f"Server error in request {request_id}: {e}")
        
        error_response = ErrorResponse('InternalError', 'Internal server error', request_id)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(error_response.to_dict())
        }
