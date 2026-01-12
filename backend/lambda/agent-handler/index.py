"""
Bedrock Chatbot with Knowledge Base Handler Lambda Function

This Lambda function uses direct Bedrock API calls with Knowledge Base retrieval
for RAG (Retrieval Augmented Generation) capabilities.
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
bedrock_runtime = boto3.client('bedrock-runtime')
bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')
s3_client = boto3.client('s3')

# Environment variables
MODEL_ID = os.getenv('MODEL_ID', 'global.amazon.nova-2-lite-v1:0')
KNOWLEDGE_BASE_ID = os.getenv('KNOWLEDGE_BASE_ID')
MAX_TOKENS = int(os.getenv('MAX_TOKENS', '2048'))
TEMPERATURE = float(os.getenv('TEMPERATURE', '0.3'))
USE_KNOWLEDGE_BASE = os.getenv('USE_KNOWLEDGE_BASE', 'true').lower() == 'true'


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
    
    def __init__(self, response: str, session_id: str, sources: Optional[list] = None):
        self.response = response
        self.session_id = session_id
        self.sources = sources or []
        self.timestamp = datetime.utcnow().isoformat()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'response': self.response,
            'sessionId': self.session_id,
            'sources': self.sources,
            'timestamp': self.timestamp
        }


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


def retrieve_from_knowledge_base(query: str) -> List[Dict[str, Any]]:
    """Retrieve relevant documents from Knowledge Base"""
    if not USE_KNOWLEDGE_BASE or not KNOWLEDGE_BASE_ID:
        logger.warning("Knowledge Base not configured - USE_KNOWLEDGE_BASE or KNOWLEDGE_BASE_ID missing")
        return []
    
    try:
        logger.info(f"Retrieving from Knowledge Base: {KNOWLEDGE_BASE_ID} with query: {query[:100]}...")
        
        # Simplified retrieval configuration - remove potentially problematic overrideSearchType
        response = bedrock_agent_runtime.retrieve(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            retrievalQuery={
                'text': query
            },
            retrievalConfiguration={
                'vectorSearchConfiguration': {
                    'numberOfResults': 10,  # Increased from 5 to get more results
                }
            }
        )
        
        logger.info(f"Raw retrieval response: {json.dumps(response, default=str)[:500]}...")
        
        sources = []
        retrieval_results = response.get('retrievalResults', [])
        logger.info(f"Found {len(retrieval_results)} retrieval results")
        
        for i, result in enumerate(retrieval_results):
            logger.info(f"Processing result {i}: {json.dumps(result, default=str)[:200]}...")
            
            content_text = ''
            if 'content' in result and 'text' in result['content']:
                content_text = result['content']['text']
            
            location_uri = ''
            if 'location' in result:
                if 's3Location' in result['location'] and 'uri' in result['location']['s3Location']:
                    location_uri = result['location']['s3Location']['uri']
            
            source = {
                'content': content_text,
                'score': result.get('score', 0.0),
                'location': location_uri,
                'metadata': result.get('metadata', {})
            }
            
            logger.info(f"Processed source {i}: content_length={len(content_text)}, score={source['score']}, location={location_uri}")
            sources.append(source)
        
        logger.info(f"Successfully retrieved {len(sources)} sources from Knowledge Base")
        return sources
        
    except ClientError as e:
        logger.error(f"Knowledge Base retrieval ClientError: {e.response['Error']['Code']} - {e.response['Error']['Message']}")
        logger.error(f"Full error response: {e.response}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error in Knowledge Base retrieval: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return []


def build_rag_prompt(user_message: str, sources: List[Dict[str, Any]], language: str = 'english') -> str:
    """Build a RAG prompt with retrieved context for technical users"""
    
    # Language instruction
    language_instruction = ""
    if language == 'spanish':
        language_instruction = "Responde en español. "
    
    if not sources:
        # No sources available - should not answer
        no_source_message = {
            'english': "I can only provide information based on the available source documents. No relevant sources were found for your question. Please try rephrasing your question or ask about topics covered in the knowledge base.",
            'spanish': "Solo puedo proporcionar información basada en los documentos fuente disponibles. No se encontraron fuentes relevantes para su pregunta. Por favor, reformule su pregunta o pregunte sobre temas cubiertos en la base de conocimientos."
        }
        return f"""You must respond with exactly this message: "{no_source_message[language]}" """
    
    # Create a mapping of document names to their content
    doc_content_map = {}
    for source in sources:
        # Extract document name from S3 location
        location = source['location']
        doc_name = 'Unknown Document'
        if location:
            try:
                parsed = urlparse(location)
                if parsed.path:
                    doc_name = parsed.path.split('/')[-1]
                    if '.' in doc_name:
                        doc_name = doc_name.rsplit('.', 1)[0]
            except:
                pass
        
        # Add content to document (combine multiple chunks from same document)
        if doc_name not in doc_content_map:
            doc_content_map[doc_name] = []
        doc_content_map[doc_name].append(source['content'][:600])
    
    # Build context with document names as references
    context_parts = []
    for doc_name, content_chunks in doc_content_map.items():
        combined_content = "\n".join(content_chunks)
        context_parts.append(f"Document: {doc_name}\n{combined_content}")
    
    context = "\n\n".join(context_parts)
    
    rag_prompt = f"""You are a technical assistant for unemployment insurance SMEs and technical professionals. Your users prefer concise, direct responses. Be brief and to-the-point. Avoid verbose explanations. {language_instruction}

CRITICAL INSTRUCTIONS:
- ONLY use information from the Documents below
- Do NOT add any information not explicitly stated in the documents
- If the question cannot be answered from the documents, say "This information is not available in the provided sources"
- Be direct and concise
- Focus on key points only
- When citing information, use the document name in parentheses, like: (Document Name)

Documents:
{context}

Question: {user_message}

Provide a brief response using ONLY the information from the documents above. Cite document names when referencing specific information."""

    return rag_prompt


def invoke_bedrock_model(chat_request: ChatRequest) -> Dict[str, Any]:
    """Invoke Bedrock model with optional Knowledge Base retrieval"""
    try:
        # Retrieve from Knowledge Base if enabled
        sources = retrieve_from_knowledge_base(chat_request.message)
        
        # Build the prompt (with or without RAG context) including language preference
        if sources:
            prompt = build_rag_prompt(chat_request.message, sources, chat_request.language)
            logger.info(f"Using RAG prompt with {len(sources)} technical references, language: {chat_request.language}")
        else:
            # No sources - use the no-source prompt from build_rag_prompt
            prompt = build_rag_prompt(chat_request.message, sources, chat_request.language)
            logger.info(f"No sources available for query, language: {chat_request.language}")
        
        logger.info(f"Invoking Bedrock model {MODEL_ID}")
        
        # Prepare the request body for Nova 2 Lite - optimized for concise technical responses
        request_body = {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "inferenceConfig": {
                "maxTokens": 1024,  # Reduced from 2048 to encourage brevity
                "temperature": 0.2,  # Reduced from 0.3 for more focused responses
                "topP": 0.8,  # Reduced from 0.9 for more focused sampling
            }
        }
        
        # Invoke the model
        response = bedrock_runtime.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps(request_body),
            contentType='application/json',
            accept='application/json'
        )
        
        # Parse the response
        response_body = json.loads(response['body'].read())
        
        # Extract the generated text
        if 'output' in response_body and 'message' in response_body['output']:
            generated_text = response_body['output']['message']['content'][0]['text']
        else:
            # Fallback for different response formats
            generated_text = str(response_body)
        
        # Format sources for response - cleaner format without excerpts and deduplicated by document
        formatted_sources = []
        seen_documents = {}
        
        for source in sources:
            # Extract document name from S3 location
            location = source['location']
            doc_name = 'Unknown Document'
            if location:
                try:
                    # Parse S3 URI to get document name
                    parsed = urlparse(location)
                    if parsed.path:
                        doc_name = parsed.path.split('/')[-1]
                        # Remove file extension for cleaner display
                        if '.' in doc_name:
                            doc_name = doc_name.rsplit('.', 1)[0]
                except:
                    pass
            
            # Only keep the highest scoring chunk per document
            if doc_name not in seen_documents or source['score'] > seen_documents[doc_name]['score']:
                seen_documents[doc_name] = {
                    'document': doc_name,
                    'score': round(source['score'], 3),
                    'location': location,
                    'downloadUrl': f"/document?path={location}" if location else None
                }
        
        # Convert to list and sort by score (highest first)
        formatted_sources = list(seen_documents.values())
        formatted_sources.sort(key=lambda x: x['score'], reverse=True)
        
        return {
            'response': generated_text.strip(),
            'sources': formatted_sources
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"Bedrock API error: {error_code} - {e}")
        
        if error_code == 'ThrottlingException':
            raise Exception("Service temporarily unavailable. Please try again later.")
        elif error_code == 'ValidationException':
            raise ValueError("Invalid request parameters")
        elif error_code == 'ModelNotReadyException':
            raise Exception("Model is not ready. Please try again later.")
        else:
            raise Exception("AI service error. Please try again.")
    
    except Exception as e:
        logger.error(f"Unexpected error invoking Bedrock model: {e}")
        raise Exception("Internal service error")


def handle_document_request(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle document requests - view PDFs in browser, download Word docs"""
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
        
        # Get the document from S3
        try:
            response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
            content = response['Body'].read()
            content_type = response.get('ContentType', 'application/octet-stream')
            
            # Get filename for download
            filename = object_key.split('/')[-1]
            file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
            
            logger.info(f"Document request - object_key: {object_key}, filename: {filename}, extension: {file_extension}")
            
            # Determine headers based on file type
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,OPTIONS'
            }
            
            # PDFs: View in browser (no download header)
            if file_extension == 'pdf':
                headers['Content-Type'] = 'application/pdf'
                logger.info(f"PDF detected - serving for browser viewing")
                # No Content-Disposition header = view in browser
            
            # Word docs and other files: Force download
            else:
                headers['Content-Type'] = content_type
                headers['Content-Disposition'] = f'attachment; filename="{filename}"'
                logger.info(f"Non-PDF detected - serving for download with filename: {filename}")
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': base64.b64encode(content).decode('utf-8'),
                'isBase64Encoded': True
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
                logger.error(f"S3 error retrieving document: {e}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Failed to retrieve document'})
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
    Main Lambda handler for chat requests and document downloads
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    request_id = context.aws_request_id
    start_time = datetime.utcnow()
    
    # Check if this is a document download request
    path = event.get('rawPath') or event.get('path', '')
    if path == '/document':
        return handle_document_request(event)
    
    logger.info(f"Processing chat request: {request_id}")
    logger.info(f"Environment variables - MODEL_ID: {MODEL_ID}, KNOWLEDGE_BASE_ID: {KNOWLEDGE_BASE_ID}, USE_KNOWLEDGE_BASE: {USE_KNOWLEDGE_BASE}")
    
    try:
        # Parse and validate request
        chat_request = ChatRequest.from_event(event)
        validate_request(chat_request)
        
        logger.info(f"Chat request - User: {chat_request.user_id}, Session: {chat_request.session_id}, Language: {chat_request.language}")
        logger.info(f"User message: {chat_request.message[:100]}...")
        
        # Invoke Bedrock model directly
        model_result = invoke_bedrock_model(chat_request)
        
        # Create response
        chat_response = ChatResponse(
            response=model_result['response'],
            session_id=chat_request.session_id,
            sources=model_result['sources']
        )
        
        # Emit success metrics - just log for now
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"Successfully processed request {request_id} in {processing_time:.2f}s")
        logger.info(f"Response length: {len(chat_response.response)}, Sources count: {len(chat_response.sources)}")
        
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