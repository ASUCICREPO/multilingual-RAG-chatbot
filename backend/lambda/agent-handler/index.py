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

import boto3
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(os.getenv('LOG_LEVEL', 'INFO'))

# Initialize AWS clients
bedrock_runtime = boto3.client('bedrock-runtime')
bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

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
        return []
    
    try:
        logger.info(f"Retrieving from Knowledge Base: {KNOWLEDGE_BASE_ID}")
        
        response = bedrock_agent_runtime.retrieve(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            retrievalQuery={
                'text': query
            },
            retrievalConfiguration={
                'vectorSearchConfiguration': {
                    'numberOfResults': 5,  # Adjust as needed
                    'overrideSearchType': 'HYBRID'  # SEMANTIC, HYBRID
                }
            }
        )
        
        sources = []
        for result in response.get('retrievalResults', []):
            sources.append({
                'content': result.get('content', {}).get('text', ''),
                'score': result.get('score', 0.0),
                'location': result.get('location', {}).get('s3Location', {}).get('uri', ''),
                'metadata': result.get('metadata', {})
            })
        
        logger.info(f"Retrieved {len(sources)} sources from Knowledge Base")
        return sources
        
    except ClientError as e:
        logger.error(f"Knowledge Base retrieval error: {e}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error in Knowledge Base retrieval: {e}")
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
    
    context_parts = []
    for i, source in enumerate(sources[:3], 1):  # Use top 3 sources
        content = source['content'][:600]  # Slightly more content for technical context
        context_parts.append(f"Reference {i}:\n{content}")
    
    context = "\n\n".join(context_parts)
    
    rag_prompt = f"""You are a technical assistant for unemployment insurance SMEs and technical professionals. Your users prefer concise, direct responses. Be brief and to-the-point. Avoid verbose explanations. {language_instruction}

CRITICAL INSTRUCTIONS:
- ONLY use information from the Technical References below
- Do NOT add any information not explicitly stated in the references
- If the question cannot be answered from the references, say "This information is not available in the provided sources"
- Be direct and concise
- Focus on key points only
- Cite which reference number you're using

Technical References:
{context}

Question: {user_message}

Provide a brief response using ONLY the information from the references above."""

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
        
        # Format sources for response
        formatted_sources = []
        for source in sources:
            formatted_sources.append({
                'excerpt': source['content'][:200] + '...' if len(source['content']) > 200 else source['content'],
                'score': source['score'],
                'location': source['location'],
                'metadata': source.get('metadata', {})
            })
        
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


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for chat requests
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    request_id = context.aws_request_id
    start_time = datetime.utcnow()
    
    logger.info(f"Processing chat request: {request_id}")
    
    try:
        # Parse and validate request
        chat_request = ChatRequest.from_event(event)
        validate_request(chat_request)
        
        logger.info(f"Chat request - User: {chat_request.user_id}, Session: {chat_request.session_id}")
        
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