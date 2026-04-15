import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { minidenticon } from 'minidenticons';
import { useWallet } from '../hooks/useWallet.js';
import { useProfile } from '../hooks/useProfile.js';
import { apiGet, apiPost, apiDelete } from '../lib/api.js';
import styles from './CommentSection.module.css';

const VALID_REASONS = ['spam', 'harassment', 'illegal', 'other'];
const REASON_LABELS = { spam: 'Spam', harassment: 'Harassment', illegal: 'Illegal content', other: 'Other' };

function formatRelative(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function truncAddr(a) {
  if (!a) return '';
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function linkify(text) {
  if (!text) return text;
  const urlRe = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRe);
  return parts.map((part, i) =>
    urlRe.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={styles.link}>{part}</a>
      : part
  );
}

function Identicon({ wallet, size = 40 }) {
  const svg = minidenticon(wallet?.toLowerCase() || '');
  return (
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt="" width={size} height={size} className={styles.identicon}
    />
  );
}

function Avatar({ url, wallet, size = 40 }) {
  const [errored, setErrored] = useState(false);
  if (!url || errored) return <Identicon wallet={wallet} size={size} />;
  return (
    <img
      src={url} alt="" width={size} height={size}
      className={styles.avatar}
      onError={() => setErrored(true)}
    />
  );
}

function PositionTag({ position, sideAName, sideBName }) {
  if (!position) return null;
  const isA = position === 'A';
  const name = isA ? sideAName : sideBName;
  return (
    <span
      className={isA ? styles.posTagA : styles.posTagB}
      title={`Holds ${name} position`}
    >
      {name}
    </span>
  );
}

function Comment({ comment, sideAName, sideBName, currentWallet, onReply, onDelete, depth = 0 }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportStatus, setReportStatus] = useState(null); // 'sending' | 'sent' | 'error'
  const [reportError, setReportError] = useState('');

  const isDeleted = comment.deleted_at !== null && comment.body === null;
  const isHidden = comment.hidden === true;
  const isOwn = currentWallet && comment.author?.wallet_address === currentWallet.toLowerCase();

  const handleReport = async () => {
    setReportStatus('sending');
    setReportError('');
    try {
      await apiPost(`/comments/${comment.id}/report`, { reason: reportReason });
      setReportStatus('sent');
      setReportOpen(false);
    } catch (err) {
      if (err.code === 'ALREADY_REPORTED') {
        setReportError('Already reported');
        setReportStatus('error');
      } else {
        setReportError(err.message || 'Failed to report');
        setReportStatus('error');
      }
    }
  };

  const handleDelete = async () => {
    try {
      await apiDelete(`/comments/${comment.id}`);
      if (onDelete) onDelete();
    } catch {}
  };

  if (isDeleted) {
    return (
      <div className={depth > 0 ? styles.replyWrap : styles.commentWrap}>
        <p className={styles.deletedText}>[Comment deleted]</p>
        {comment.replies?.map((r) => (
          <Comment key={r.id} comment={r} sideAName={sideAName} sideBName={sideBName}
            currentWallet={currentWallet} onDelete={onDelete} depth={1} />
        ))}
      </div>
    );
  }

  if (isHidden) {
    return (
      <div className={depth > 0 ? styles.replyWrap : styles.commentWrap}>
        <p className={styles.deletedText}>[Comment hidden pending review]</p>
      </div>
    );
  }

  return (
    <div className={depth > 0 ? styles.replyWrap : styles.commentWrap}>
      <div className={styles.commentRow}>
        {comment.author?.username ? (
          <Link to={`/u/${comment.author.username}`}>
            <Avatar url={comment.author?.avatar_url} wallet={comment.author?.wallet_address} size={depth > 0 ? 32 : 40} />
          </Link>
        ) : (
          <Avatar url={comment.author?.avatar_url} wallet={comment.author?.wallet_address} size={depth > 0 ? 32 : 40} />
        )}
        <div className={styles.commentBody}>
          <div className={styles.authorRow}>
            {comment.author?.username ? (
              <Link to={`/u/${comment.author.username}`} className={styles.authorLink}>
                <span className={styles.displayName}>
                  {comment.author?.display_name || truncAddr(comment.author?.wallet_address)}
                </span>
              </Link>
            ) : (
              <span className={styles.displayName}>
                {comment.author?.display_name || truncAddr(comment.author?.wallet_address)}
              </span>
            )}
            {comment.author?.username && (
              <Link to={`/u/${comment.author.username}`} className={styles.authorLink}>
                <span className={styles.username}>@{comment.author.username}</span>
              </Link>
            )}
            <PositionTag position={comment.author_position} sideAName={sideAName} sideBName={sideBName} />
            <span className={styles.time}>{formatRelative(comment.created_at)}</span>
          </div>

          <p className={styles.bodyText}>{linkify(comment.body)}</p>

          <div className={styles.actions}>
            {depth === 0 && onReply && (
              <button className={styles.actionBtn} onClick={() => onReply(comment.id)}>Reply</button>
            )}
            {!reportStatus && (
              <button className={styles.actionBtn} onClick={() => setReportOpen(!reportOpen)}>Report</button>
            )}
            {reportStatus === 'sent' && <span className={styles.actionDim}>Reported</span>}
            {isOwn && (
              <button className={styles.actionBtn} onClick={handleDelete}>Delete</button>
            )}
          </div>

          {reportOpen && (
            <div className={styles.reportBox}>
              {VALID_REASONS.map((r) => (
                <label key={r} className={styles.reportLabel}>
                  <input type="radio" name={`report-${comment.id}`} value={r}
                    checked={reportReason === r} onChange={() => setReportReason(r)} />
                  {REASON_LABELS[r]}
                </label>
              ))}
              {reportError && <p className={styles.reportError}>{reportError}</p>}
              <div className={styles.reportActions}>
                <button className={styles.reportSubmit} onClick={handleReport}
                  disabled={reportStatus === 'sending'}>
                  {reportStatus === 'sending' ? 'Sending...' : 'Submit'}
                </button>
                <button className={styles.reportCancel} onClick={() => setReportOpen(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.map((r) => (
        <Comment key={r.id} comment={r} sideAName={sideAName} sideBName={sideBName}
          currentWallet={currentWallet} onDelete={onDelete} depth={1} />
      ))}
      {comment.replies_has_more && (
        // TODO Phase 2: fetch full reply thread via GET /api/comments/:id/replies
        <button className={styles.moreReplies}>View more replies</button>
      )}
    </div>
  );
}

function SkeletonComment() {
  return (
    <div className={styles.skeletonWrap}>
      <div className={styles.skeletonAvatar} />
      <div className={styles.skeletonBody}>
        <div className={styles.skeletonLine1} />
        <div className={styles.skeletonLine2} />
      </div>
    </div>
  );
}

export default function CommentSection({ marketAddress, sideAName, sideBName, onNeedProfile }) {
  const { account, authenticated } = useWallet();
  const { profile } = useProfile();
  const { connect } = useWallet();

  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(0);
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [replyTo, setReplyTo] = useState(null); // comment id
  const [replyBody, setReplyBody] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);
  const textareaRef = useRef(null);

  const addr = marketAddress?.toLowerCase();

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!addr) return;
    try {
      const data = await apiGet(`/markets/${addr}/comments`);
      setComments(data.comments || []);
      // Count: top-level + all replies
      let count = 0;
      for (const c of (data.comments || [])) {
        count++;
        if (c.replies) count += c.replies.length;
      }
      setCommentCount(count);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || 'Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  }, [addr]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Poll every 30s when visible
  useEffect(() => {
    if (!addr) return;
    let interval = null;

    const start = () => {
      if (interval) return;
      interval = setInterval(fetchComments, 30000);
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') { fetchComments(); start(); }
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [addr, fetchComments]);

  // Auto-resize textarea
  const handleBodyChange = (e) => {
    setBody(e.target.value.slice(0, 500));
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  // Post comment
  const handlePost = async () => {
    if (!body.trim()) return;
    setPosting(true);
    setPostError('');
    try {
      await apiPost(`/markets/${addr}/comments`, { body: body.trim() });
      setBody('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      fetchComments();
    } catch (err) {
      if (err.code === 'RATE_LIMITED') {
        setPostError(`Slow down. Try again in ${err.body?.retry_after_seconds || 60} seconds.`);
      } else if (err.code === 'PROFILE_REQUIRED') {
        if (onNeedProfile) onNeedProfile();
      } else if (err.status === 401) {
        setPostError('Sign in again to post.');
      } else {
        setPostError(err.message || 'Failed to post comment.');
      }
    } finally {
      setPosting(false);
    }
  };

  // Post reply
  const handleReply = async () => {
    if (!replyBody.trim() || !replyTo) return;
    setReplyPosting(true);
    try {
      await apiPost(`/markets/${addr}/comments`, { body: replyBody.trim(), parent_comment_id: replyTo });
      setReplyBody('');
      setReplyTo(null);
      fetchComments();
    } catch (err) {
      if (err.code === 'PROFILE_REQUIRED' && onNeedProfile) onNeedProfile();
    } finally {
      setReplyPosting(false);
    }
  };

  // Composer button state
  let btnText = 'Post';
  let btnAction = handlePost;
  let btnDisabled = posting || !body.trim();
  if (!authenticated) {
    btnText = 'Sign in to comment';
    btnAction = connect;
    btnDisabled = false;
  } else if (profile === false) {
    btnText = 'Set up profile to comment';
    btnAction = () => { if (onNeedProfile) onNeedProfile(); };
    btnDisabled = false;
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h3 className={styles.heading}>Discussion</h3>
        {commentCount > 0 && <span className={styles.count}>({commentCount})</span>}
      </div>

      {/* Composer */}
      <div className={styles.composer}>
        {postError && <div className={styles.composerError}>{postError}</div>}
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Share your take"
          value={body}
          onChange={handleBodyChange}
          maxLength={500}
          rows={2}
          disabled={!authenticated || profile === false}
        />
        <div className={styles.composerFooter}>
          <span className={body.length >= 500 ? styles.counterRed : styles.counter}>
            {body.length} / 500
          </span>
          <button className={styles.postBtn} onClick={btnAction} disabled={btnDisabled}>
            {posting ? 'Posting...' : btnText}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loadingComments && (
        <div className={styles.skeletons}>
          <SkeletonComment />
          <SkeletonComment />
          <SkeletonComment />
        </div>
      )}

      {/* Error */}
      {loadError && !loadingComments && (
        <div className={styles.loadError}>
          <p>Couldn't load comments.</p>
          <button className={styles.retryBtn} onClick={() => { setLoadingComments(true); setLoadError(null); fetchComments(); }}>
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loadingComments && !loadError && comments.length === 0 && (
        <p className={styles.empty}>No comments yet. Start the discussion.</p>
      )}

      {/* Comments list */}
      {!loadingComments && !loadError && comments.length > 0 && (
        <div className={styles.list}>
          {comments.map((c) => (
            <div key={c.id}>
              <Comment
                comment={c}
                sideAName={sideAName}
                sideBName={sideBName}
                currentWallet={account}
                onReply={(id) => { setReplyTo(replyTo === id ? null : id); setReplyBody(''); }}
                onDelete={fetchComments}
              />
              {/* Inline reply composer */}
              {replyTo === c.id && (
                <div className={styles.replyComposer}>
                  <textarea
                    className={styles.replyTextarea}
                    placeholder={`Reply to ${c.author?.display_name || truncAddr(c.author?.wallet_address)}...`}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value.slice(0, 500))}
                    maxLength={500}
                    rows={2}
                    autoFocus
                  />
                  <div className={styles.replyActions}>
                    <button className={styles.replySubmitBtn} onClick={handleReply}
                      disabled={replyPosting || !replyBody.trim()}>
                      {replyPosting ? 'Posting...' : 'Reply'}
                    </button>
                    <button className={styles.replyCancelBtn} onClick={() => { setReplyTo(null); setReplyBody(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
