import { useState, useEffect, useRef } from 'react';
import { RefreshCw, MoreVertical, Star, UserPlus, StickyNote, X, CheckCircle, Sparkles, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../api/api';
import { toast } from 'react-hot-toast';

// ============ ACTIONS MENU COMPONENT ============
const ActionsMenu = ({ msg, onUpdate, onClose }) => {
  const [mode, setMode] = useState(null); // null | 'assign' | 'notes'
  const [users, setUsers] = useState([]);
  const [assignSearch, setAssignSearch] = useState('');
  const [notesText, setNotesText] = useState(msg.notes || '');
  const menuRef = useRef(null);

  useEffect(() => {
    // Fetch users for assign dropdown
    const fetchUsers = async () => {
      try {
        const { data } = await api.get('/users/list');
        setUsers(data);
      } catch (e) {
        console.error('Could not load users');
      }
    };
    fetchUsers();

    // Click outside handler
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImportant = async () => {
    try {
      const { data } = await api.put(`/messages/${msg.id}/important`);
      onUpdate({ isImportant: data.isImportant, markedImportantBy: data.markedImportantBy });
      toast.success(data.isImportant ? 'Marked as important' : 'Removed important flag');
      onClose();
    } catch (e) {
      toast.error('Failed to update');
    }
  };

  const handleAssign = async (username) => {
    try {
      const { data } = await api.put(`/messages/${msg.id}/assign`, { assignedTo: username });
      onUpdate({ assignedTo: data.assignedTo, assignedBy: data.assignedBy });
      toast.success(`Assigned to ${username}`);
      onClose();
    } catch (e) {
      toast.error('Failed to assign');
    }
  };

  const handleSaveNotes = async () => {
    try {
      const { data } = await api.put(`/messages/${msg.id}/notes`, { notes: notesText });
      onUpdate({ notes: data.notes, notesAddedBy: data.notesAddedBy });
      toast.success('Notes saved');
      onClose();
    } catch (e) {
      toast.error('Failed to save notes');
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(assignSearch.toLowerCase())
  );

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
    >
      {mode === null && (
        <div className="py-2">
          <button
            onClick={handleImportant}
            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
          >
            <Star size={16} className={msg.isImportant ? 'text-amber-500 fill-current' : 'text-gray-400'} />
            <span>{msg.isImportant ? 'Remove Important' : 'Mark as Important'}</span>
          </button>
          <button
            onClick={() => setMode('assign')}
            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
          >
            <UserPlus size={16} className="text-gray-400" />
            <span>Assign to...</span>
          </button>
          <button
            onClick={() => setMode('notes')}
            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
          >
            <StickyNote size={16} className="text-gray-400" />
            <span>{msg.notes ? 'Edit Notes' : 'Add Notes'}</span>
          </button>
        </div>
      )}

      {mode === 'assign' && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Assign To</span>
            <button onClick={() => setMode(null)} className="p-1 hover:bg-gray-100 rounded">
              <X size={14} className="text-gray-400" />
            </button>
          </div>
          <input
            type="text"
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            placeholder="Search or type username..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
          />
          <div className="max-h-32 overflow-y-auto">
            {filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => handleAssign(user.username)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 rounded-lg flex items-center gap-2"
              >
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span>{user.username}</span>
                <span className="text-xs text-gray-400 ml-auto">{user.role}</span>
              </button>
            ))}
            {assignSearch && !filteredUsers.some(u => u.username === assignSearch) && (
              <button
                onClick={() => handleAssign(assignSearch)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 rounded-lg text-indigo-600"
              >
                Assign to "{assignSearch}"
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'notes' && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Add Notes</span>
            <button onClick={() => setMode(null)} className="p-1 hover:bg-gray-100 rounded">
              <X size={14} className="text-gray-400" />
            </button>
          </div>
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Add notes visible to all team members..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-2 min-h-[80px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
          />
          <button
            onClick={handleSaveNotes}
            className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save Notes
          </button>
        </div>
      )}
    </div>
  );
};

// ============ MAIN MESSAGE CARD ============
const MessageCard = ({ msg, onApprove, onUpdateMessage, onRefresh, isPosted, replies = [], depth = 0, templates = [] }) => {
  // Check if this is our own reply (channel owner reply) - need to check this first for draft init
  const isOwnReplyCheck = msg.approvedBy === 'Channel Owner' || msg.approvedBy === 'Account Owner';

  // For Our Reply cards, use content. For pending comments, use aiDraft only (may be empty)
  const [draft, setDraft] = useState(isOwnReplyCheck ? msg.content : (msg.aiDraft || ""));
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [localMsg, setLocalMsg] = useState(msg);
  const [isEditing, setIsEditing] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  // Slash-command template state
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateFilter, setTemplateFilter] = useState('');
  const textareaRef = useRef(null);

  // Update local state when msg changes
  useEffect(() => {
    setLocalMsg(msg);
    const isOwnReply = msg.approvedBy === 'Channel Owner' || msg.approvedBy === 'Account Owner';
    setDraft(isOwnReply ? msg.content : (msg.aiDraft || ""));
  }, [msg]);

  // Handle draft change with slash-command detection
  const handleDraftChange = (e) => {
    const value = e.target.value;
    setDraft(value);

    // Check for slash command at start or after space
    const lastSlashIndex = value.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      const textAfterSlash = value.slice(lastSlashIndex + 1);
      // Only show if slash is at start or after space, and no space after
      const charBeforeSlash = lastSlashIndex > 0 ? value[lastSlashIndex - 1] : ' ';
      if ((charBeforeSlash === ' ' || charBeforeSlash === '\n' || lastSlashIndex === 0) && !textAfterSlash.includes(' ')) {
        setTemplateFilter(textAfterSlash.toLowerCase());
        setShowTemplates(true);
        return;
      }
    }
    setShowTemplates(false);
  };

  // Insert template content
  const insertTemplate = (template) => {
    // Replace from last / to current position with template content
    const lastSlashIndex = draft.lastIndexOf('/');
    const newDraft = draft.slice(0, lastSlashIndex) + template.content;
    setDraft(newDraft);
    setShowTemplates(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  // Filter templates based on input
  const filteredTemplates = templates.filter(t =>
    t.key.toLowerCase().includes(templateFilter) ||
    t.title.toLowerCase().includes(templateFilter)
  );

  const normalizedIntent = (localMsg.intent || "").trim().toLowerCase();
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
              : normalizedIntent === "pending thread"
                ? "bg-orange-100 text-orange-700"
                : "bg-gray-100 text-gray-600";
  const intentLabel = localMsg.intent || "General";

  const handleClick = async () => {
    if (sending) return;
    setSending(true);
    const success = await onApprove(localMsg.id, draft);
    if (!success) {
      setSending(false);
    }
  };

  const handleEditSave = async () => {
    if (sending) return;
    setSending(true);
    try {
      await api.put(`/messages/${localMsg.id}/edit-reply`, { replyText: draft });
      toast.success("Reply updated!");
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error("Failed to update reply");
    } finally {
      setSending(false);
    }
  };

  const handleUpdate = (updates) => {
    setLocalMsg(prev => ({ ...prev, ...updates }));
    if (onUpdateMessage) {
      onUpdateMessage(localMsg.id, updates);
    }
  };

  const handleDismiss = async () => {
    if (sending) return;
    setSending(true);
    try {
      await api.put(`/messages/${localMsg.id}/reject`);
      toast.success("Comment dismissed");
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error("Failed to dismiss");
    } finally {
      setSending(false);
    }
  };

  const handleGenerateReply = async () => {
    if (generatingAI) return;
    setGeneratingAI(true);
    try {
      const { data } = await api.post(`/messages/${localMsg.id}/generate-reply`);
      setLocalMsg(prev => ({ ...prev, ...data.message }));
      setDraft(data.message.aiDraft || "");
      toast.success("AI reply generated!");
    } catch (e) {
      toast.error("Failed to generate reply");
    } finally {
      setGeneratingAI(false);
    }
  };

  // Check if this is a child comment (has a parent)
  const isChildComment = depth > 0 || localMsg.parentId;
  const hasReplies = replies && replies.length > 0;

  // Check if this is our own reply (from channel owner)
  const isOwnReply = localMsg.approvedBy === 'Channel Owner' || localMsg.approvedBy === 'Account Owner';

  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${localMsg.isImportant ? 'border-amber-300 ring-2 ring-amber-100' :
      isOwnReply ? 'border-indigo-200 bg-indigo-50/30' :
        isPosted ? 'border-green-200' : 'border-gray-200'
      }`}>
      {/* Our Reply Badge (different from user-approved replies) */}
      {isOwnReply && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center gap-2">
          <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
            <CheckCircle size={12} className="text-white" />
          </div>
          <span className="text-indigo-700 text-xs font-medium">
            Our Reply • {new Date(localMsg.createdAt).toLocaleString()}
          </span>
        </div>
      )}

      {/* Posted Badge (for user-approved replies, not own replies) */}
      {isPosted && !isOwnReply && (
        <div className="bg-green-50 border-b border-green-100 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700 text-xs font-medium">
            <CheckCircle size={14} />
            Reply sent{localMsg.approvedBy ? ` by @${localMsg.approvedBy}` : ''}{localMsg.postedAt ? ` on ${new Date(localMsg.postedAt).toLocaleString()}` : ''}
          </div>
          {/* {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              Edit Reply
            </button>
          )} */}
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
              {localMsg.authorName?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">@{localMsg.authorName}</h3>
              <p className="text-xs text-gray-500">
                {new Date(localMsg.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Badges */}
            {localMsg.isImportant && (
              <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-medium">
                <Star size={12} className="fill-current" />
                {localMsg.markedImportantBy}
              </span>
            )}
            {localMsg.assignedTo && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                <UserPlus size={12} />
                {localMsg.assignedTo}
              </span>
            )}

            {/* Intent Badge - hide for Our Reply cards */}
            {!isOwnReply && (
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${intentClasses}`}>
                {intentLabel}
              </span>
            )}

            {/* 3-dot Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <MoreVertical size={18} className="text-gray-400" />
              </button>
              {showMenu && (
                <ActionsMenu
                  msg={localMsg}
                  onUpdate={handleUpdate}
                  onClose={() => setShowMenu(false)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Notes Banner */}
        {localMsg.notes && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <StickyNote size={14} className="text-yellow-600" />
              <span className="text-xs font-medium text-yellow-700">
                Note by @{localMsg.notesAddedBy}
              </span>
            </div>
            <p className="text-sm text-yellow-800">{localMsg.notes}</p>
          </div>
        )}

        {/* Customer Message - HIDE for Our Reply cards (they ARE the reply, not a customer message) */}
        {!isOwnReply && (
          <p className="text-gray-800 text-sm mb-4 bg-gray-50 p-4 rounded-lg">
            "{localMsg.content}"
          </p>
        )}

        {/* AI Draft / Reply Section */}
        {/* For Our Reply cards: show the reply content with edit capability */}
        {/* For pending: show draft editor */}
        {/* For posted parents WITH replies: hide (reply shown in child card) */}
        {(!isPosted || isOwnReply || !hasReplies) && (
          <div className="mb-0">
            {/* Don't show label for Our Reply cards - the badge already says "Our Reply" */}
            {!isOwnReply && (
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                {isPosted ? 'Sent Reply' : (localMsg.aiDraft ? 'AI Generated Reply' : 'Draft Reply')}
              </label>
            )}

            {/* Show Generate Reply button if no AI draft and not posted and not our own reply */}
            {!localMsg.aiDraft && !isPosted && !isOwnReply && (
              <button
                onClick={handleGenerateReply}
                disabled={generatingAI}
                className="mb-3 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-indigo-600 disabled:opacity-70 transition-all"
              >
                {generatingAI ? (
                  <><RefreshCw className="animate-spin" size={14} /> Generating...</>
                ) : (
                  <><Sparkles size={14} /> Generate AI Reply</>
                )}
              </button>
            )}

            {/* Our Reply cards - show content or edit textarea */}
            {isOwnReply ? (
              isEditing ? (
                <textarea
                  className="w-full p-4 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Edit your reply..."
                  disabled={sending}
                  style={{ minHeight: '80px', height: 'auto' }}
                  rows={Math.max(3, Math.ceil(draft.length / 60))}
                />
              ) : (
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-gray-800">
                  {localMsg.content}
                </div>
              )
            ) : (
              /* Regular posted or pending comments */
              isPosted && !isEditing ? (
                <div className="p-4 bg-green-50 border border-green-100 rounded-lg text-sm text-gray-800">
                  {localMsg.aiDraft}
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    className="w-full p-4 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
                    value={draft}
                    onChange={handleDraftChange}
                    placeholder="Draft reply... (type / for templates)"
                    disabled={sending}
                    style={{ minHeight: '80px', height: 'auto' }}
                    rows={Math.max(3, Math.ceil(draft.length / 60))}
                  />

                  {/* Template Dropdown */}
                  {showTemplates && filteredTemplates.length > 0 && (
                    <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                      {filteredTemplates.map(t => (
                        <button
                          key={t.id}
                          onClick={() => insertTemplate(t)}
                          className="w-full px-3 py-2 text-left hover:bg-indigo-50 flex items-center gap-2 text-sm border-b border-gray-100 last:border-0"
                        >
                          <span className="text-indigo-600 font-mono">/{t.key}</span>
                          <span className="text-gray-700 font-medium">{t.title}</span>
                          <span className="text-gray-400 text-xs truncate flex-1">{t.content.slice(0, 40)}...</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Nested Replies Section */}
      {hasReplies && (
        <div className="px-6 pb-4">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 mb-3"
          >
            {showReplies ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <MessageSquare size={14} />
            <span>{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</span>
          </button>

          {showReplies && (
            <div className={`space-y-3 ${depth < 2 ? 'ml-4 pl-4 border-l-2 border-gray-200' : ''}`}>
              {replies.map(reply => (
                <MessageCard
                  key={reply.id}
                  msg={reply}
                  onApprove={onApprove}
                  onUpdateMessage={onUpdateMessage}
                  onRefresh={onRefresh}
                  isPosted={reply.status === 'posted'}
                  replies={reply.replies || []}
                  depth={depth + 1}
                  templates={templates}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer - hide entirely for posted parents that have nested replies */}
      {(!isPosted || isOwnReply || !hasReplies || isEditing) && (
        <div className="bg-gray-50 px-6 py-3 border-t flex justify-end gap-3">
          {/* Editing mode - Cancel & Save */}
          {isEditing ? (
            <>
              <button
                onClick={() => { setIsEditing(false); setDraft(localMsg.aiDraft || localMsg.content || ""); }}
                className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={sending}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2 transition-colors"
              >
                {sending && <RefreshCw className="animate-spin" size={14} />}
                {sending ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : isOwnReply ? (
            /* Our Reply card - show Edit button */
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 px-4 py-2 transition-colors"
            >
              Edit Reply
            </button>
          ) : !isPosted ? (
            /* Pending comments - Dismiss & Approve buttons */
            <>
              <button onClick={handleDismiss} disabled={sending} className="text-sm text-gray-600 hover:text-red-600 px-4 py-2 font-medium transition-colors">
                Dismiss
              </button>
              <button
                onClick={handleClick}
                disabled={sending}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2 transition-colors"
              >
                {sending && <RefreshCw className="animate-spin" size={14} />}
                {sending ? "Sending..." : "Approve & Send"}
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default MessageCard;

