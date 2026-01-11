'use client';

import { useState, useRef, useEffect } from 'react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import Reasoning from './Reasoning';

type Message = {
  type: 'user' | 'bot' | 'typing' | 'reasoning';
  text: string;
  reasoningContent?: string;
  reasoningDuration?: number;
};

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { type: 'bot', text: "Hello! I'm the NASWA Assistant. How can I help you today?\n\nI can assist with:\n• Unemployment benefits\n• Job search and career services\n• Employer services\n• Technical support" }
  ]);
  const [showButtons, setShowButtons] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const sampleQuestions = [
    "What are your office hours?",
    "How do I file for unemployment?",
    "Check my claim status",
    "When will I receive payment?",
    "Help me find a job",
    "I forgot my password"
  ];

  const getResponse = (input: string): string => {
    const lower = input.toLowerCase();

    if (lower.includes('office hours') || lower.includes('hours') || lower.includes('open')) {
      return "Our office is open Monday through Friday, 8:00 AM to 5:00 PM EST. We are closed on weekends and federal holidays.\n\nFor urgent matters outside business hours:\n📱 Online portal: naswa.gov\n📞 Leave a message: 1-800-555-6279\n📧 Email: support@naswa.org";
    }
    if (lower.includes('file') && lower.includes('unemployment')) {
      return "To file for unemployment benefits:\n\n1. Visit naswa.gov/claims\n2. Create an account or log in\n3. Complete the application (takes about 30 minutes)\n4. Submit required documents\n\nYou'll need:\n✓ Government ID\n✓ Social Security card\n✓ W-2 forms (last 18 months)\n✓ Pay stubs\n✓ Separation notice\n\nFirst payment arrives within 2-4 weeks of approval. Questions? Call 1-800-555-6279";
    }
    if (lower.includes('status') || lower.includes('check')) {
      return "To check your claim status:\n\n1. Log in at naswa.gov/claims\n2. Click 'My Claims'\n3. View current status\n\nStatus meanings:\n• Pending: Under review\n• Approved: Benefits authorized\n• Info Needed: Check messages\n• Paid: Payment processed\n\nYou'll also receive email/SMS updates!";
    }
    if (lower.includes('payment') || lower.includes('paid') || lower.includes('money') || lower.includes('receive')) {
      return "Payment timing after certification:\n\n📅 Certify Sunday → Processed Tuesday\n💳 Direct deposit → Wednesday\n💳 Debit card → Thursday\n📄 Paper check → 7-10 days\n\nFirst payment takes 2-4 weeks after approval. Check status at naswa.gov/payments or call 1-800-555-PAY";
    }
    if (lower.includes('job') || lower.includes('find job') || lower.includes('career')) {
      return "NASWA helps you find jobs!\n\n🔍 Resources:\n• 10,000+ job postings at naswa.gov/jobs\n• Resume builder and templates\n• Skills assessments\n• Job matching\n\n👨🏫 Services:\n• Career counseling\n• Interview prep workshops\n• Networking events\n• Job fairs\n\nVisit our career center or call 1-800-555-6279 to get started!";
    }
    if (lower.includes('password') || lower.includes('forgot') || lower.includes('reset')) {
      return "Reset your password:\n\n1. Go to naswa.gov/login\n2. Click 'Forgot Password?'\n3. Enter your email\n4. Check email for reset link (arrives in 5 min)\n5. Create new password\n\n🔒 Requirements: 8+ characters, 1 uppercase, 1 number, 1 special character\n\nStill stuck? Call 1-800-555-TECH";
    }
    if (lower.includes('training') || lower.includes('program')) {
      return "Available training programs:\n\n💼 IT & Technology\n• Coding bootcamps\n• Cybersecurity\n• Data analysis\n\n🏥 Healthcare\n• CNA certification\n• Pharmacy tech\n\n🔧 Trade Skills\n• HVAC, electrical, plumbing\n\nPrograms are free or low-cost with job placement help. Visit naswa.gov/training or call 1-800-555-TRAIN";
    }
    if (lower.includes('direct deposit')) {
      return "Set up direct deposit:\n\n1. Log in at naswa.gov/claims\n2. Go to 'Payment Settings'\n3. Select 'Direct Deposit'\n4. Enter bank routing & account number\n5. Submit\n\nYou'll need:\n• 9-digit routing number\n• Account number\n• Account type (checking/savings)\n\nFastest payment method (2-3 days)!";
    }
    if (lower.includes('thank') || lower.includes('thanks')) {
      return "You're very welcome! Is there anything else I can help you with today?";
    }
    if (lower.includes('help') || lower.includes('hello') || lower.includes('hi')) {
      return "Hello! I'm the NASWA Assistant. How can I help you today?\n\nI can assist with:\n• Unemployment benefits\n• Job search and career services\n• Employer services\n• Technical support";
    }
    return "I'm not sure I understand. Could you rephrase your question?\n\nYou can ask about:\n• Filing unemployment claims\n• Payment status\n• Job search help\n• Technical support\n\nOr call us at 1-800-555-6279 (Mon-Fri, 8 AM - 5 PM EST)";
  };

  const getReasoningContent = (query: string): string => {
    const lower = query.toLowerCase();

    if (lower.includes('file') && lower.includes('unemployment')) {
      return "Let me break down the unemployment filing process.\n\nFirst, I need to identify the key requirements and steps for filing.\n\nThe user needs to know:\n1. Where to file (naswa.gov/claims)\n2. What documents are required\n3. How long the process takes\n\nI should provide a clear, step-by-step guide with all necessary information.";
    }

    if (lower.includes('payment') || lower.includes('receive')) {
      return "Analyzing the payment timeline question.\n\nI need to consider:\n- Different payment methods (direct deposit, debit card, check)\n- Processing times for each method\n- When certification occurs\n\nThis requires explaining the full payment cycle from certification to receipt.";
    }

    if (lower.includes('status') || lower.includes('check')) {
      return "Understanding the claim status inquiry.\n\nKey points to address:\n- How to access claim status\n- What different statuses mean\n- Where to find status updates\n\nI'll provide clear instructions for checking status online.";
    }

    return "Analyzing this query to provide the most helpful response.\n\nConsidering:\n- The user's specific needs\n- Relevant NASWA services\n- Best path to resolution\n\nGathering the appropriate information to assist.";
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    setShowButtons(false);
    setMessages(prev => [...prev, { type: 'user', text }]);
    setMessage('');

    // Show reasoning animation for complex queries
    const isComplexQuery = text.length > 30 ||
                          text.includes('how') ||
                          text.includes('explain') ||
                          text.includes('why') ||
                          text.includes('file') ||
                          text.includes('payment') ||
                          text.includes('status');

    if (isComplexQuery) {
      const reasoningDuration = Math.floor(Math.random() * 3) + 2; // 2-4 seconds
      const reasoningContent = getReasoningContent(text);

      // Add reasoning message (thinking state)
      setTimeout(() => {
        setMessages(prev => [...prev, {
          type: 'reasoning',
          text: '',
          reasoningContent,
          reasoningDuration
        }]);
      }, 300);

      // Update to completed reasoning with duration
      setTimeout(() => {
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.type === 'reasoning') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              reasoningDuration
            };
          }
          return updated;
        });
      }, reasoningDuration * 1000);

      // Show typing indicator
      setTimeout(() => {
        setMessages(prev => [...prev, { type: 'typing', text: '' }]);
      }, reasoningDuration * 1000 + 100);

      // Show bot response
      setTimeout(() => {
        setMessages(prev => {
          const filtered = prev.filter(m => m.type !== 'typing');
          return [...filtered, { type: 'bot', text: getResponse(text) }];
        });
      }, reasoningDuration * 1000 + 1500);
    } else {
      setTimeout(() => {
        setMessages(prev => [...prev, { type: 'typing', text: '' }]);
      }, 300);

      setTimeout(() => {
        setMessages(prev => {
          const filtered = prev.filter(m => m.type !== 'typing');
          return [...filtered, { type: 'bot', text: getResponse(text) }];
        });
      }, 1800);
    }
  };

  const handleQuestionClick = (question: string) => {
    handleSend(question);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

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
    <div className="fixed bottom-8 right-8 w-96 h-[600px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
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
          <div className="flex gap-2">
            <button className="text-white hover:bg-white/20 rounded p-1 transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="6" r="1.5"/>
                <circle cx="12" cy="12" r="1.5"/>
                <circle cx="12" cy="18" r="1.5"/>
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
        
        <p className="px-4 text-sm text-blue-100 relative z-10">We&apos;re online</p>
        
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
            {msg.type === 'reasoning' ? (
              <Reasoning
                content={msg.reasoningContent || ''}
                duration={msg.reasoningDuration}
                isComplete={!!msg.reasoningDuration}
              />
            ) : msg.type === 'typing' ? (
              <div className="flex justify-start">
                <div className="bg-white px-6 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            ) : (
              <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-3 rounded-2xl whitespace-pre-line ${
                  msg.type === 'user'
                    ? 'bg-[#1e5a8e] text-white rounded-br-sm'
                    : 'bg-white text-gray-700 rounded-bl-sm shadow-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* Sample Question Buttons */}
        {showButtons && messages.length === 1 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {sampleQuestions.map((q, i) => (
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
      <div className="p-4 bg-white border-t border-gray-200 relative">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-20 left-4 z-50">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={320}
              height={400}
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(message)}
              placeholder="Enter your message..."
              className="w-full bg-transparent outline-none text-gray-700 placeholder-gray-400 mb-2"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`transition-colors ${showEmojiPicker ? 'text-[#1e5a8e]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
            </div>
          </div>
          <button
            onClick={() => handleSend(message)}
            className="bg-[#1e5a8e] text-white rounded-full w-14 h-14 flex items-center justify-center hover:bg-[#164a75] transition-colors shadow-lg"
            aria-label="Send message"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}