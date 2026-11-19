import { useState } from 'react';
import { api } from '../lib/api';
import { MOODS } from '../lib/rules';
import { useLive } from '../state/useLive';
import type { Mood } from '../lib/types';

export function MoodWidget({ canVote = true }: { canVote?: boolean }) {
  const { data, reload } = useLive(async () => ({ summary: await api.cityMood(), mine: canVote ? await api.myMood() : null }));
  const [busy, setBusy] = useState(false);
  if (!data) return <div className="glass mood skeleton" />;
  const { summary, mine } = data;
  const top = MOODS.find((m) => m.mood === summary.majority);

  const vote = async (m: Mood) => {
    setBusy(true);
    try {
      await api.voteMood(m);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass mood">
      <div className="mood-head">
        <div>
          <div className="eyebrow">City Mood · last 2 hours</div>
          <div className="mood-now">
            {top ? <><span className="big-emoji">{top.emoji}</span> Mostly {top.label.toLowerCase()}</> : 'No votes yet'}
          </div>
        </div>
        <div className="muted small">{summary.total} vote{summary.total === 1 ? '' : 's'}</div>
      </div>
      <div className="mood-bar">
        {MOODS.map((m) =>
          summary.counts[m.mood] ? (
            <span key={m.mood} style={{ flex: summary.counts[m.mood], background: m.color }} title={`${m.label}: ${summary.counts[m.mood]}`} />
          ) : null,
        )}
      </div>
      {canVote && (
        <div className="mood-votes">
          {MOODS.map((m) => (
            <button key={m.mood} className={`mood-btn ${mine === m.mood ? 'active' : ''}`} disabled={busy} onClick={() => vote(m.mood)} title={m.label}>
              <span>{m.emoji}</span>
              <small>{m.label}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
