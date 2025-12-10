import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

const MessageCard = ({ msg, onApprove }) => {
  const [draft, setDraft] = useState(msg.aiDraft || "");
  const [sending, setSending] = useState(false);

  const normalizedIntent = (msg.intent || "").trim().toLowerCase();
  const intentClasses =
    normalizedIntent === "spam"
      ? "bg-red-100 text-red-600"
      : normalizedIntent === "complaint"
      ? "bg-amber-100 text-amber-700"
      : normalizedIntent === "praise"
      ? "bg-emerald-100 text-emerald-700"
      : normalizedIntent === "technical issue"
      ? "bg-blue-100 text-blue-700"
      : normalizedIntent === "question"
      ? "bg-indigo-100 text-indigo-700"
      : "bg-gray-100 text-gray-600";
  const intentLabel = msg.intent || "General";

  const handleClick = async () => {
    if (sending) return;
    setSending(true);
    const success = await onApprove(msg.id, draft);
    if (!success) {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
              {msg.authorName?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">@{msg.authorName}</h3>
              <p className="text-xs text-gray-500">
                {new Date(msg.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${intentClasses}`}>
            {intentLabel}
          </span>
        </div>
        <p className="text-gray-800 text-sm mb-4 bg-gray-50 p-3 rounded-lg">
          "{msg.content}"
        </p>
        <textarea
          className="w-full p-3 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Draft reply..."
          disabled={sending}
        />
      </div>
      <div className="bg-gray-50 px-6 py-3 border-t flex justify-end gap-3">
        <button disabled={sending} className="text-sm text-gray-600 hover:text-red-600 px-3 py-2 font-medium">
          Dismiss
        </button>
        <button
          onClick={handleClick}
          disabled={sending}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2"
        >
          {sending && <RefreshCw className="animate-spin" size={14} />}
          {sending ? "Sending..." : "Approve & Send"}
        </button>
      </div>
    </div>
  );
};

export default MessageCard;
