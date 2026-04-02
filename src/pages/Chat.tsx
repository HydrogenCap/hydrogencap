import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  Plus,
  Trash2,
  MessageSquare,
  Wrench,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useConversations, useDeleteConversation } from '@/hooks/useConversations';
import { useChatMessages, type ChatMessage, type ToolCall } from '@/hooks/useChatMessages';
import { useChat, getToolLabel } from '@/hooks/useChat';
import { cn } from '@/lib/utils';

const suggestedActions = [
  { label: 'Show compliance summary', message: 'Generate a compliance summary report for my portfolio' },
  { label: 'Calculate portfolio yield', message: "What's the gross and net yield across my portfolio?" },
  { label: 'Find expiring certificates', message: 'Which properties have compliance certificates expiring in the next 90 days?' },
  { label: 'Portfolio snapshot', message: 'Give me a portfolio snapshot with key financial metrics' },
  { label: 'Search by postcode', message: 'Show me all my properties in London' },
];

export default function Chat() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const { data: conversations, isLoading: conversationsLoading } = useConversations();
  const { data: messages, isLoading: messagesLoading } = useChatMessages(activeConversationId);
  const deleteConversation = useDeleteConversation();
  const { sendMessage: sendChatMessage, isLoading, activeTools, optimisticMessages } = useChat();

  // Combine persisted messages with optimistic messages
  const displayMessages = [
    ...(messages ?? []).filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content)),
    ...optimisticMessages,
  ];

  // Build a map of tool call results for display
  const toolCallMessages = (messages ?? []).filter((m) => m.role === 'assistant' && m.tool_calls);
  const toolResultMessages = (messages ?? []).filter((m) => m.role === 'tool');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [displayMessages.length, isLoading]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;
    setInput('');

    const result = await sendChatMessage(messageText, activeConversationId);
    if (result) {
      setActiveConversationId(result.conversationId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation.mutate(id);
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Conversation Sidebar */}
        {sidebarOpen && (
          <div className="w-72 border-r flex flex-col bg-muted/30">
            <div className="p-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm">Conversations</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startNewConversation}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(false)}>
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : conversations && conversations.length > 0 ? (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors',
                        activeConversationId === conv.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => setActiveConversationId(conv.id)}
                    >
                      <MessageSquare className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate flex-1">{conv.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No conversations yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">TenureIQ AI</h1>
              <p className="text-sm text-muted-foreground">
                Your portfolio assistant — ask questions, run reports, create tasks
              </p>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 px-6" ref={scrollRef}>
            <div className="max-w-3xl mx-auto py-6 space-y-6">
              {displayMessages.length === 0 && !isLoading ? (
                <EmptyState onSend={sendMessage} />
              ) : (
                <>
                  {displayMessages.map((message, idx) => (
                    <MessageBubble key={message.id ?? idx} message={message} />
                  ))}

                  {/* Tool call visualization */}
                  {isLoading && <ToolCallIndicator activeTools={activeTools} />}

                  {/* Show tool call cards from history */}
                  {!isLoading && toolCallMessages.length > 0 && (
                    <ToolCallHistory toolCallMessages={toolCallMessages} toolResultMessages={toolResultMessages} />
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          {/* Suggested Actions */}
          {displayMessages.length === 0 && !isLoading && (
            <div className="px-6 pb-2">
              <div className="max-w-3xl mx-auto flex flex-wrap gap-2 justify-center">
                {suggestedActions.map((action, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => sendMessage(action.message)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t px-6 py-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your portfolio..."
                  className="min-h-[52px] max-h-32 resize-none bg-input"
                  disabled={isLoading}
                  rows={1}
                />
                <Button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-[52px] w-[52px]"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ onSend }: { onSend: (msg: string) => void }) {
  return (
    <div className="text-center py-12">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Bot className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-lg font-medium mb-2">Welcome to TenureIQ AI</h2>
      <p className="text-muted-foreground mb-4 max-w-md mx-auto">
        I can query your portfolio data, calculate metrics, generate reports, and create compliance tasks.
        Ask me anything about your properties.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div
      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {message.role === 'assistant' && (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <Card
        className={cn(
          'px-4 py-3 max-w-[80%]',
          message.role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {message.role === 'assistant' ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}
      </Card>
      {message.role === 'user' && (
        <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function ToolCallIndicator({ activeTools }: { activeTools: string[] }) {
  const isThinking = activeTools.length === 0 || (activeTools.length === 1 && activeTools[0] === 'thinking');

  return (
    <div className="flex gap-3 justify-start">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <Card className="px-4 py-3 bg-muted">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isThinking ? (
            <span className="text-sm">Thinking...</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {activeTools.map((tool) => (
                <Badge key={tool} variant="secondary" className="text-xs gap-1">
                  <Wrench className="h-3 w-3" />
                  {getToolLabel(tool)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function ToolCallHistory({
  toolCallMessages,
  toolResultMessages,
}: {
  toolCallMessages: ChatMessage[];
  toolResultMessages: ChatMessage[];
}) {
  // Only show the most recent set of tool calls (not all historical ones in the message area)
  // This is rendered separately as a collapsible section
  if (toolCallMessages.length === 0) return null;

  const lastToolMsg = toolCallMessages[toolCallMessages.length - 1];
  const toolCalls = lastToolMsg.tool_calls ?? [];

  return (
    <div className="flex gap-3 justify-start">
      <div className="h-8 w-8 flex-shrink-0" /> {/* Spacer for alignment */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground h-7 px-2">
            <Wrench className="h-3 w-3" />
            {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''} used
            <ChevronDown className="h-3 w-3" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 mt-2">
            {toolCalls.map((tc: ToolCall) => {
              const result = toolResultMessages.find(
                (m) => m.tool_call_id === tc.id
              );
              return (
                <ToolCallCard key={tc.id} toolCall={tc} result={result?.content ?? null} />
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ToolCallCard({ toolCall, result }: { toolCall: ToolCall; result: string | null }) {
  const [open, setOpen] = useState(false);

  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments);
  } catch {
    // ignore
  }

  return (
    <Card className="px-3 py-2 bg-muted/50 border-dashed">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-xs text-muted-foreground w-full text-left">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Wrench className="h-3 w-3" />
            <span className="font-medium">{getToolLabel(toolCall.function.name)}</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-2 text-xs">
            {Object.keys(parsedArgs).length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground">Input:</span>
                <pre className="mt-1 p-2 bg-background rounded text-[11px] overflow-x-auto">
                  {JSON.stringify(parsedArgs, null, 2)}
                </pre>
              </div>
            )}
            {result && (
              <div>
                <span className="font-medium text-muted-foreground">Result:</span>
                <pre className="mt-1 p-2 bg-background rounded text-[11px] overflow-x-auto max-h-40 overflow-y-auto">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(result), null, 2);
                    } catch {
                      return result;
                    }
                  })()}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
