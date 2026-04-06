import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Send, Plus, MessageCircle, Loader2, ChevronLeft, Crown } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WILLOW_AVATAR = "https://static.prod-images.emergentagent.com/jobs/bb8d70a7-15ea-4a51-916d-4d6020add402/images/f5d9020ab42e989571006f0e001a83e2817fbeb73070147d7bafbdf608d5f35d.png";

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 mb-4" data-testid="typing-indicator">
      <img src={WILLOW_AVATAR} alt="Willow" className="w-8 h-8 rounded-full flex-shrink-0 mt-1" />
      <div className="bg-gradient-to-br from-[#FFB627]/10 to-[#FF715B]/10 border border-[#FF715B]/20 rounded-3xl rounded-bl-none px-5 py-4">
        <div className="flex gap-1.5">
          <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-start gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`} data-testid={`chat-msg-${msg.role}`}>
      {!isUser && <img src={WILLOW_AVATAR} alt="Willow" className="w-8 h-8 rounded-full flex-shrink-0 mt-1" />}
      <div className={`max-w-[80%] ${isUser
        ? 'bg-[#1E293B] text-white rounded-3xl rounded-br-none'
        : 'bg-gradient-to-br from-[#FFB627]/10 to-[#FF715B]/10 border border-[#FF715B]/20 rounded-3xl rounded-bl-none text-slate-800'
      } px-5 py-4`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        {msg.timestamp && (
          <p className={`text-[10px] mt-2 ${isUser ? 'text-white/40' : 'text-slate-400'}`}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}

export default function WillowChat() {
  const { conversationId: paramConvoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialMessage = location.state?.initialMessage;

  const [conversations, setConversations] = useState([]);
  const [activeConvoId, setActiveConvoId] = useState(paramConvoId || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const messagesEndRef = useRef(null);
  const hasInitSent = useRef(false);

  // Load conversations
  useEffect(() => {
    axios.get(`${API}/chat/conversations`, { withCredentials: true })
      .then((res) => setConversations(res.data))
      .catch(console.error);
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConvoId) { setMessages([]); return; }
    axios.get(`${API}/chat/conversations/${activeConvoId}/messages`, { withCredentials: true })
      .then((res) => setMessages(res.data.messages || []))
      .catch(console.error);
  }, [activeConvoId]);

  // Handle initial message from quick action
  useEffect(() => {
    if (initialMessage && !hasInitSent.current) {
      hasInitSent.current = true;
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendMessage = async (text) => {
    const msgText = text || input.trim();
    if (!msgText || sending) return;
    setInput('');
    setSending(true);

    // Optimistically add user message
    const tempUserMsg = { role: 'user', content: msgText, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await axios.post(`${API}/chat/message`, {
        conversation_id: activeConvoId,
        message: msgText
      }, { withCredentials: true });

      const willowMsg = { role: 'assistant', content: res.data.willow_response, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, willowMsg]);

      if (!activeConvoId) {
        setActiveConvoId(res.data.conversation_id);
        navigate(`/chat/${res.data.conversation_id}`, { replace: true });
      }
      // Refresh conversation list
      const convRes = await axios.get(`${API}/chat/conversations`, { withCredentials: true });
      setConversations(convRes.data);
    } catch (err) {
      console.error('Chat error:', err);
      if (err.response?.status === 403) {
        setLimitReached(true);
        setMessages((prev) => prev.slice(0, -1)); // Remove optimistic user message
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: "I'm sorry, I had a moment there. Could you try again?", timestamp: new Date().toISOString() }]);
      }
    } finally {
      setSending(false);
    }
  };

  const startNewChat = () => {
    setActiveConvoId(null);
    setMessages([]);
    navigate('/chat', { replace: true });
    setShowSidebar(false);
  };

  const selectConversation = (convoId) => {
    setActiveConvoId(convoId);
    navigate(`/chat/${convoId}`, { replace: true });
    setShowSidebar(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-screen" data-testid="willow-chat">
      {/* Sidebar - Conversations */}
      <div className={`${showSidebar ? 'fixed inset-0 z-50 lg:relative lg:inset-auto' : 'hidden'} lg:flex lg:w-72 flex-col bg-white border-r border-slate-100`}>
        {showSidebar && <div className="lg:hidden fixed inset-0 bg-black/20" onClick={() => setShowSidebar(false)} />}
        <div className={`${showSidebar ? 'relative z-10 w-72 h-full' : ''} lg:w-full flex flex-col bg-white`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-['Outfit'] font-semibold text-slate-900">Conversations</h2>
            <button
              onClick={startNewChat}
              className="p-2 rounded-xl bg-[#FF715B]/10 text-[#FF715B] hover:bg-[#FF715B]/20 transition-colors"
              data-testid="new-chat-btn"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.map((c) => (
              <button
                key={c.conversation_id}
                onClick={() => selectConversation(c.conversation_id)}
                className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                  activeConvoId === c.conversation_id
                    ? 'bg-[#FF715B]/10 text-[#FF715B]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                data-testid={`convo-item-${c.conversation_id}`}
              >
                <p className="text-sm font-medium truncate">{c.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{new Date(c.updated_at || c.created_at).toLocaleDateString()}</p>
              </button>
            ))}
            {conversations.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <MessageCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No conversations yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-slate-100 bg-white/80 backdrop-blur-xl flex items-center gap-3" data-testid="chat-header">
          <button onClick={() => setShowSidebar(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-50" data-testid="toggle-sidebar-btn">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <img src={WILLOW_AVATAR} alt="Willow" className="w-9 h-9 rounded-full willow-glow" />
          <div>
            <h3 className="font-['Outfit'] font-semibold text-slate-900 text-sm">Willow</h3>
            <p className="text-[11px] text-[#10B981]">Always here for you</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 chat-scroll" data-testid="messages-area">
          {messages.length === 0 && !sending && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <img src={WILLOW_AVATAR} alt="Willow" className="w-20 h-20 rounded-full willow-glow mb-4 animate-float" />
              <h2 className="font-['Outfit'] text-xl font-bold text-slate-900 mb-2">Hi there! I'm Willow</h2>
              <p className="text-slate-500 max-w-md mb-6">
                I'm here to listen, support, and help however I can. No judgment, no rush — just tell me what's on your mind.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {['How are you today?', "I need to vent", "Help me plan my day"].map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-4 py-2 rounded-full bg-white border border-slate-200 text-sm text-slate-600 hover:border-[#FF715B]/30 hover:text-[#FF715B] transition-all"
                    data-testid={`suggestion-${s.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
          {sending && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 pb-14 border-t border-slate-100 bg-white relative z-50" data-testid="chat-input-area">
          {limitReached ? (
            <div className="flex items-center justify-between bg-gradient-to-r from-[#FF715B]/5 to-[#FFB627]/5 rounded-2xl px-5 py-4 border border-[#FF715B]/10" data-testid="chat-limit-banner">
              <div className="flex items-center gap-3">
                <Crown className="w-5 h-5 text-[#FF715B]" />
                <div>
                  <p className="text-sm font-medium text-slate-800">You've used your free messages for today</p>
                  <p className="text-xs text-slate-500">Upgrade to keep talking with Willow</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/pricing')}
                className="bg-[#FF715B] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#FF573D] transition-all whitespace-nowrap"
                data-testid="chat-upgrade-btn"
              >
                Upgrade
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-2"
            >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Talk to Willow..."
              className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder-slate-400 py-2"
              disabled={sending}
              data-testid="chat-input"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="p-2.5 rounded-xl bg-[#FF715B] text-white disabled:opacity-40 hover:bg-[#FF573D] transition-all disabled:hover:bg-[#FF715B]"
              data-testid="send-message-btn"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
