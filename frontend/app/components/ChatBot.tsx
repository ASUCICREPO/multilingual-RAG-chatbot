'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatAPI, ChatRequest } from '../lib/chatApi';
import { getConfig } from '../lib/config';

type Message = {
  type: 'user' | 'bot' | 'typing';
  text: string;
  sources?: Array<{
    document: string;
    location: string;
    downloadUrl: string | null;
  }>;
};

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [language, setLanguage] = useState<'english' | 'spanish'>('english');
  const [messages, setMessages] = useState<Message[]>([]);
  const [showButtons, setShowButtons] = useState(true);
  const [sessionId, setSessionId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAPI = useRef(new ChatAPI());

  const sampleQuestions = {
    english: [
      "What are the requirements for UI modernization?",
      "What are the recommended staffing levels?",
      "What DevOps practices should we follow?"
    ],
    spanish: [
      "¿Cuáles son los requisitos para la modernización de UI?",
      "¿Cuáles son los niveles de personal recomendados?",
      "¿Qué prácticas de DevOps debemos seguir?"
    ]
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    setShowButtons(false);
    setMessages(prev => [...prev, { type: 'user', text }]);
    setMessage('');

    // Show typing indicator
    setTimeout(() => {
      setMessages(prev => [...prev, { type: 'typing', text: '' }]);
    }, 300);

    // Make API call and show bot response
    setTimeout(async () => {
      try {
        const result = await callChatAPI(text, language);
        setMessages(prev => {
          const filtered = prev.filter(m => m.type !== 'typing');
          // console.log('=== DEBUG: Raw AI Response ===');
          // console.log(result.response);
          // console.log('=== End Debug ===');
          return [...filtered, { 
            type: 'bot', 
            text: result.response,
            sources: result.sources
          }];
        });
      } catch (error) {
        setMessages(prev => {
          const filtered = prev.filter(m => m.type !== 'typing');
          return [...filtered, { 
            type: 'bot', 
            text: 'Sorry, I encountered an error. Please try again or contact support.' 
          }];
        });
      }
    }, 1000);
  };

  const handleQuestionClick = (question: string) => {
    handleSend(question);
  };

  const handleDocumentView = async (location: string, documentName: string) => {
    try {
      // Use the ChatAPI method that handles authentication and proper filename
      await chatAPI.current.viewDocument(location);
    } catch (error) {
      console.error('Document view failed:', error);
      alert(`Failed to open ${documentName}. Please try again.`);
    }
  };

  // Function to call the actual chat API
  const callChatAPI = async (message: string, language: 'english' | 'spanish'): Promise<{ response: string; sources?: any[] }> => {
    try {
      const request: ChatRequest = {
        message,
        language,
        sessionId
      };

      const response = await chatAPI.current.sendMessage(request);
      
      // Update session ID if it changed
      if (response.sessionId !== sessionId) {
        setSessionId(response.sessionId);
      }

      return {
        response: response.response,
        sources: response.sources && response.sources.length > 0 ? response.sources : undefined
      };
    } catch (error) {
      console.error('API call failed:', error);
      
      // Return appropriate error message based on language
      const errorMessages = {
        english: "I'm sorry, I'm having trouble connecting to my services right now. Please try again in a moment, or contact support if the issue persists.",
        spanish: "Lo siento, tengo problemas para conectarme a mis servicios en este momento. Por favor, inténtalo de nuevo en un momento, o contacta al soporte si el problema persiste."
      };
      
      return { response: errorMessages[language] };
    }
  };

  // Initialize welcome message based on language and check API connection
  useEffect(() => {
    const welcomeMessages = {
      english: "Hello! I'm the NASWA Assistant. How can I help you today?",
      spanish: "¡Hola! Soy el Asistente de NASWA. ¿Cómo puedo ayudarte hoy?"
    };

    setMessages([{ type: 'bot', text: welcomeMessages[language] }]);
    setShowButtons(true);
    
    // Generate new session ID when language changes
    setSessionId(`session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);
  }, [language]);

  // Check API connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const healthy = await chatAPI.current.healthCheck();
        setIsConnected(healthy);
      } catch (error) {
        setIsConnected(false);
      }
    };

    checkConnection();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 bg-[#c94a3c] text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg hover:bg-[#b43a2c] transition-all hover:scale-110"
        aria-label="Open NASWA Assistant"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 w-[calc(100vw-2rem)] md:w-[480px] max-w-[480px] h-[calc(100vh-2rem)] md:h-[600px] max-h-[600px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">{/* Responsive sizing and positioning */}
      {/* Header with wave */}
      <div className="relative bg-[#1e5a8e] text-white pb-8">
        <div className="p-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-full overflow-hidden flex items-center justify-center">
              <span className="text-2xl">🏛️</span>
            </div>
            <div>
              <p className="text-sm text-blue-200">Chat with</p>
              <h3 className="font-semibold text-lg">NASWA Assistant</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection Status Indicator */}
            {isConnected !== null && (
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} 
                   title={isConnected ? 'Connected' : 'Disconnected'} />
            )}
            
            {/* Language Selector */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'english' | 'spanish')}
              className="bg-white/20 text-white text-sm rounded px-2 py-1 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="english" className="text-gray-800">English</option>
              <option value="spanish" className="text-gray-800">Español</option>
            </select>
            
            {/* Refresh Button */}
            <button
              onClick={() => {
                const welcomeMessages = {
                  english: "Hello! I'm the NASWA Assistant. How can I help you today?",
                  spanish: "¡Hola! Soy el Asistente de NASWA. ¿Cómo puedo ayudarte hoy?"
                };
                setMessages([{ type: 'bot', text: welcomeMessages[language] }]);
                setShowButtons(true);
                setSessionId(`session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);
              }}
              className="text-white hover:bg-white/20 rounded p-1 transition-colors"
              aria-label="Refresh conversation"
              title={language === 'english' ? 'Start new conversation' : 'Iniciar nueva conversación'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 rounded p-1 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <p className="px-4 text-sm text-blue-100 relative z-10">
          {isConnected === null ? 'Connecting...' : isConnected ? 'We\'re online' : 'Connection issues'}
        </p>
        
        {/* Wave SVG */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" className="w-full h-auto">
            <path 
              fill="#ffffff" 
              d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"
            />
          </svg>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-3">
        {messages.map((msg, index) => (
          <div key={index}>
            {msg.type === 'typing' ? (
              <div className="flex justify-start">
                <div className="bg-white px-6 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            ) : (
              <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${
                  msg.type === 'user'
                    ? ''
                    : 'space-y-3'
                }`}>{/* Increased max-width from 75% to 85% */}
                  {/* Main message */}
                  <div className={`px-4 py-3 rounded-2xl ${
                    msg.type === 'user'
                      ? 'bg-[#1e5a8e] text-white rounded-br-sm'
                      : 'bg-white text-gray-700 rounded-bl-sm shadow-sm'
                  }`}>
                    {msg.type === 'bot' ? (
                      <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-strong:text-gray-800 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700 prose-code:text-gray-800 prose-code:bg-gray-100 prose-a:text-blue-600 prose-a:break-all">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <span className="whitespace-pre-line">{msg.text}</span>
                    )}
                  </div>
                  
                  {/* Sources section for bot messages */}
                  {msg.type === 'bot' && msg.sources && msg.sources.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-600">
                          {language === 'english' ? 'Source Documents' : 'Documentos Fuente'} ({msg.sources.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {msg.sources.map((source, sourceIndex) => (
                          <div key={sourceIndex} className="flex items-center justify-between bg-white rounded-lg p-2 border border-gray-100">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{source.document}</p>
                              </div>
                            </div>
                            {source.downloadUrl && (
                              <button
                                onClick={() => handleDocumentView(source.location, source.document)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors flex-shrink-0"
                                title={language === 'english' ? 'View document' : 'Ver documento'}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                {language === 'english' ? 'View' : 'Ver'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* Sample Question Buttons */}
        {showButtons && messages.length === 1 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {sampleQuestions[language].map((q, i) => (
              <button
                key={i}
                onClick={() => handleQuestionClick(q)}
                className="bg-white text-[#1e5a8e] px-3 py-2 rounded-full text-sm border border-blue-200 hover:bg-blue-50 transition-colors shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(message)}
              placeholder={language === 'english' ? 'Enter your message...' : 'Escribe tu mensaje...'}
              className="w-full bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
          <button
            onClick={() => handleSend(message)}
            className="bg-[#1e5a8e] text-white rounded-2xl px-4 py-3 flex items-center justify-center hover:bg-[#164a75] transition-colors shadow-lg min-w-[3rem]"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}