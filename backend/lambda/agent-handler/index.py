"""
Bedrock Chatbot Agent Handler Lambda Function

This Lambda function serves as the handler for chat requests, coordinating between
API Gateway and the Bedrock Agent to process user queries and return responses.
"""

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

import boto3
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(os.getenv('LOG_LEVEL', 'INFO'))

# Initialize AWS clients
bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

# Environment variables
BEDROCK_AGENT_ID = os.getenv('BEDROCK_AGENT_ID')
BEDROCK_AGENT_ALIAS_ID = os.getenv('BEDROCK_AGENT_ALIAS_ID')


class ChatRequest:
    """Data model for chat requests"""
    
    def __init__(self, message: str, session_id: Optional[str] = None, user_id: Optional[str] = None):
        self.message = message
        self.session_id = session_id or str(uuid.uuid4())
        self.user_id = user_id or 'anonymous'
        
    @classmethod
    def from_event(cls, event: Dict[str, Any]) -> 'ChatRequest':
        """Create ChatRequest from API Gateway event"""
        try:
            body = json.loads(event.get('body', '{}'))
            return cls(
                message=body.get('message', ''),
                session_id=body.get('sessionId'),
                user_id=event.get('requestContext', {}).get('authorizer', {}).get('userId')
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


def invoke_bedrock_agent(chat_request: ChatRequest) -> Dict[str, Any]:
    """Invoke Bedrock Agent with the user's message"""
    try:
        logger.info(f"Invoking Bedrock Agent for session: {chat_request.session_id}")
        
        response = bedrock_agent_runtime.invoke_agent(
            agentId=BEDROCK_AGENT_ID,
            agentAliasId=BEDROCK_AGENT_ALIAS_ID,
            sessionId=chat_request.session_id,
            inputText=chat_request.message
        )
        
        # Process the streaming response
        agent_response = ""
        sources = []
        
        for event in response['completion']:
            if 'chunk' in event:
                chunk = event['chunk']
                if 'bytes' in chunk:
                    agent_response += chunk['bytes'].decode('utf-8')
            elif 'trace' in event:
                # Extract source information from trace
                trace = event['trace']
                if 'knowledgeBaseLookup' in trace:
                    kb_lookup = trace['knowledgeBaseLookup']
                    if 'retrievedReferences' in kb_lookup:
                        for ref in kb_lookup['retrievedReferences']:
                            sources.append({
                                'title': ref.get('metadata', {}).get('title', 'Unknown'),
                                'excerpt': ref.get('content', {}).get('text', '')[:200] + '...',
                                's3Uri': ref.get('location', {}).get('s3Location', {}).get('uri', ''),
                                'confidence': ref.get('score', 0.0)
                            })
        
        return {
            'response': agent_response.strip(),
            'sources': sources
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"Bedrock Agent error: {error_code} - {e}")
        
        if error_code == 'ThrottlingException':
            raise Exception("Service temporarily unavailable. Please try again later.")
        elif error_code == 'ValidationException':
            raise ValueError("Invalid request parameters")
        else:
            raise Exception("Agent service error. Please try again.")
    
    except Exception as e:
        logger.error(f"Unexpected error invoking Bedrock Agent: {e}")
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
        
        # Invoke Bedrock Agent
        agent_result = invoke_bedrock_agent(chat_request)
        
        # Create response
        chat_response = ChatResponse(
            response=agent_result['response'],
            session_id=chat_request.session_id,
            sources=agent_result['sources']
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