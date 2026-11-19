import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import type { ChatMessage } from '../lib/types';
import { useMe } from '../state/AuthContext';

const SUGGESTIONS = ['How do I report an issue?', 'What do pin colours mean?', 'How are workers paid?', 'How do points work?'];

export function AuraBot() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: `Hi ${me.full_name.split(' ')[0]}! I'm AuraBot. Ask me anything about using Auracity.` },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const reply = await api.aurabot(next.slice(1), me.role);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `Sorry, I couldn't answer that (${e instanceof Error ? e.message : 'error'}).` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="bot-fab" onClick={() => setOpen((o) => !o)} aria-label="Open AuraBot">
        {open ? <X size={22} /> : <Bot size={24} />}
      </button>
      {open && (
        <div className="bot-panel glass">
          <div className="bot-head"><Bot size={18} /> AuraBot</div>
          <div className="bot-body">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>{m.content}</div>
            ))}
            {busy && <div className="bubble assistant typing"><span /><span /><span /></div>}
            {messages.length === 1 && (
              <div className="chips">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form className="bot-input" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask AuraBot…" />
            <button disabled={busy || !input.trim()} aria-label="Send"><Send size={16} /></button>
          </form>
        </div>
      )}
    </>
  );
}
