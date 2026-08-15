import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity as RNTouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

const TouchableOpacity = (props) => (
  <RNTouchableOpacity {...props} delayPressIn={0} activeOpacity={0.7} />
);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;
const POST_LIMIT = 30;
const MAX_POST_CHARS = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAvatarLabel(user) {
  const base = user?.display_name || user?.username || 'U';
  return base.split(/\s+/).map((p) => p[0] || '').join('').slice(0, 2).toUpperCase() || 'U';
}

function extractHashtags(content = '') {
  return (content.match(/#[\w-]+/g) || []).map((t) => t.toLowerCase());
}

function extractMentions(content = '') {
  return (content.match(/@[\w-]+/g) || []).map((m) => m.slice(1).toLowerCase());
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString();
}

function renderContentWithMentions(content, users, onProfilePress) {
  const parts = content.split(/(@[\w-]+)/g);
  return (
    <Text style={styles.postText}>
      {parts.map((part, i) => {
        if (/^@[\w-]+$/.test(part)) {
          const username = part.slice(1).toLowerCase();
          const user = users.find((u) => u.username.toLowerCase() === username);
          if (user) {
            return (
              <Text key={i} style={styles.mentionText} onPress={() => onProfilePress(user.id)}>
                {part}
              </Text>
            );
          }
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

// ─── Badge components ─────────────────────────────────────────────────────────

function VerifiedBadge() {
  return (
    <View style={styles.verifiedBadge}>
      <Text style={styles.verifiedBadgeText}>✓</Text>
    </View>
  );
}

function GoldBadge() {
  return (
    <View style={styles.goldBadge}>
      <Text style={styles.goldBadgeText}>★</Text>
    </View>
  );
}

function UserBadges({ user }) {
  if (!user) return null;
  return (
    <>
      {user.verified ? <VerifiedBadge /> : null}
      {user.premium ? <GoldBadge /> : null}
    </>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user, size = 40, onPress }) {
  const r = size / 2;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[styles.avatar, { width: size, height: size, borderRadius: r }]}
    >
      {user?.profile_image ? (
        <Image source={{ uri: user.profile_image }} style={{ width: size, height: size, borderRadius: r }} />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{getAvatarLabel(user)}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── ComposeCard ─────────────────────────────────────────────────────────────

const ComposeCard = memo(function ComposeCard({ authUser, onSubmit }) {
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [picking, setPicking] = useState(false);
  const remaining = MAX_POST_CHARS - text.length;

  const pickImage = async () => {
    setPicking(true);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setPicking(false); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });
    setPicking(false);
    if (result.canceled) return;
    const asset = result.assets[0];
    setImageUri(`data:image/jpeg;base64,${asset.base64}`);
  };

  const submit = () => {
    if (text.length > MAX_POST_CHARS) return;
    if (onSubmit(text, imageUri)) {
      setText('');
      setImageUri('');
    }
  };

  return (
    <View style={styles.composeCard}>
      <View style={styles.composeRow}>
        <Avatar user={authUser} size={36} />
        <TextInput
          style={[styles.composeInput, { flex: 1 }]}
          multiline
          placeholder="What's on your mind?"
          placeholderTextColor="#4b5563"
          value={text}
          onChangeText={setText}
          maxLength={MAX_POST_CHARS + 10}
        />
      </View>
      {imageUri ? (
        <View style={styles.composeImageWrap}>
          <Image source={{ uri: imageUri }} style={styles.composeImagePreview} />
          <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri('')}>
            <Text style={styles.removeImageBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.composeActions}>
        <TouchableOpacity style={styles.imageAttachBtn} onPress={pickImage} disabled={picking}>
          <Text style={styles.imageAttachBtnText}>📷</Text>
        </TouchableOpacity>
        <Text style={[styles.charCount, remaining < 50 && { color: remaining < 0 ? '#ef4444' : '#f59e0b' }]}>
          {remaining}
        </Text>
        <TouchableOpacity
          style={[styles.postBtn, (text.trim().length === 0 || remaining < 0) && styles.postBtnDisabled]}
          onPress={submit}
          disabled={text.trim().length === 0 || remaining < 0}
        >
          <Text style={styles.postBtnText}>Post</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── FeedPost ─────────────────────────────────────────────────────────────────

const FeedPost = memo(function FeedPost({
  post, comments, users, authUser, likes,
  isBookmarked, onToggleBookmark, onAddComment,
  onLike, onDelete, onViewPost, onProfilePress, blocks,
}) {
  const [draft, setDraft] = useState('');
  const [showComment, setShowComment] = useState(false);
  const remaining = 280 - draft.length;

  const author = users.find((u) => u.id === post.user_id);
  const isBlocked = blocks.some(
    (b) => (b.blocker_id === authUser?.id && b.blocked_id === post.user_id) ||
           (b.blocker_id === post.user_id && b.blocked_id === authUser?.id)
  );
  if (isBlocked) return null;

  const postComments = comments.filter((c) => c.post_id === post.id);
  const likeCount = likes.filter((l) => l.post_id === post.id).length;
  const isLiked = likes.some((l) => l.post_id === post.id && l.user_id === authUser?.id);
  const isOwn = post.user_id === authUser?.id;

  const submitComment = async () => {
    if (!draft.trim() || remaining < 0) return;
    const ok = await onAddComment(post.id, draft.trim());
    if (ok) { setDraft(''); setShowComment(false); }
  };

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Avatar user={author} size={40} onPress={() => onProfilePress(author?.id)} />
        <View style={{ flex: 1 }}>
          <View style={styles.inlineRow}>
            <TouchableOpacity onPress={() => onProfilePress(author?.id)}>
              <Text style={styles.postAuthor}>{author?.display_name || 'Unknown'}</Text>
            </TouchableOpacity>
            <UserBadges user={author} />
          </View>
          <Text style={styles.userMetaText}>@{author?.username || '?'} · {timeAgo(post.created_at)}</Text>
        </View>
        {isOwn && (
          <TouchableOpacity onPress={() => onDelete(post.id)} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity onPress={() => onViewPost(post.id)} activeOpacity={0.9}>
        {renderContentWithMentions(post.content, users, onProfilePress)}
        {post.image_url ? (
          <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" />
        ) : null}
      </TouchableOpacity>

      <View style={[styles.inlineRow, { marginTop: 12, gap: 6 }]}>
        <TouchableOpacity style={[styles.actionBtn, isLiked && styles.actionBtnActive]} onPress={() => onLike(post.id)}>
          <Text style={[styles.actionBtnText, isLiked && styles.actionBtnTextActive]}>
            ♥ {likeCount > 0 ? likeCount : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => { setShowComment(!showComment); onViewPost(post.id); }}>
          <Text style={styles.actionBtnText}>💬 {postComments.length > 0 ? postComments.length : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, isBookmarked && styles.actionBtnActive]} onPress={() => onToggleBookmark(post.id)}>
          <Text style={[styles.actionBtnText, isBookmarked && styles.actionBtnTextActive]}>
            {isBookmarked ? '🔖' : '🔖'}
          </Text>
        </TouchableOpacity>
      </View>

      {postComments.slice(0, 2).map((c) => {
        const ca = users.find((u) => u.id === c.user_id);
        return (
          <View key={c.id} style={styles.commentBox}>
            <View style={styles.inlineRow}>
              <TouchableOpacity onPress={() => onProfilePress(ca?.id)}>
                <Text style={styles.commentAuthor}>{ca?.display_name || '?'}</Text>
              </TouchableOpacity>
              <UserBadges user={ca} />
              <Text style={styles.userMetaText}> · {timeAgo(c.created_at)}</Text>
            </View>
            <Text style={styles.commentText}>{c.text}</Text>
          </View>
        );
      })}
      {postComments.length > 2 && (
        <TouchableOpacity onPress={() => onViewPost(post.id)}>
          <Text style={styles.viewMoreText}>View all {postComments.length} replies →</Text>
        </TouchableOpacity>
      )}

      {showComment && (
        <View style={{ marginTop: 8 }}>
          <TextInput
            style={styles.commentInput}
            placeholder="Write a reply…"
            placeholderTextColor="#6b7280"
            value={draft}
            onChangeText={setDraft}
            maxLength={290}
          />
          <View style={styles.inlineRow}>
            <Text style={[styles.charCount, remaining < 20 && { color: '#f59e0b' }]}>{remaining}</Text>
            <TouchableOpacity style={styles.smallButton} onPress={submitComment}>
              <Text style={styles.smallButtonText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
});

// ─── PostDetailView ───────────────────────────────────────────────────────────

function PostDetailView({ post, comments, users, authUser, likes, isBookmarked,
  onBack, onLike, onToggleBookmark, onAddComment, onDeleteComment, onProfilePress, blocks }) {
  const [draft, setDraft] = useState('');
  const remaining = 280 - draft.length;

  if (!post) return null;
  const author = users.find((u) => u.id === post.user_id);
  const postComments = comments.filter((c) => c.post_id === post.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const likeCount = likes.filter((l) => l.post_id === post.id).length;
  const isLiked = likes.some((l) => l.post_id === post.id && l.user_id === authUser?.id);

  const submit = async () => {
    if (!draft.trim() || remaining < 0) return;
    const ok = await onAddComment(post.id, draft.trim());
    if (ok) setDraft('');
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.postHeader}>
        <Avatar user={author} size={44} onPress={() => onProfilePress(author?.id)} />
        <View style={{ flex: 1 }}>
          <View style={styles.inlineRow}>
            <TouchableOpacity onPress={() => onProfilePress(author?.id)}>
              <Text style={styles.postAuthor}>{author?.display_name || 'Unknown'}</Text>
            </TouchableOpacity>
            <UserBadges user={author} />
          </View>
          <Text style={styles.userMetaText}>@{author?.username || '?'} · {timeAgo(post.created_at)}</Text>
        </View>
      </View>

      {renderContentWithMentions(post.content, users, onProfilePress)}
      {post.image_url ? (
        <Image source={{ uri: post.image_url }} style={[styles.postImage, { marginTop: 10 }]} resizeMode="cover" />
      ) : null}

      <View style={[styles.inlineRow, { marginTop: 14, marginBottom: 14, gap: 6 }]}>
        <TouchableOpacity style={[styles.actionBtn, isLiked && styles.actionBtnActive]} onPress={() => onLike(post.id)}>
          <Text style={[styles.actionBtnText, isLiked && styles.actionBtnTextActive]}>♥ {likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, isBookmarked && styles.actionBtnActive]} onPress={() => onToggleBookmark(post.id)}>
          <Text style={[styles.actionBtnText, isBookmarked && styles.actionBtnTextActive]}>🔖 {isBookmarked ? 'Saved' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />
      <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>{postComments.length} Replies</Text>

      {postComments.map((c) => {
        const ca = users.find((u) => u.id === c.user_id);
        const isOwnComment = c.user_id === authUser?.id;
        return (
          <View key={c.id} style={styles.commentBoxFull}>
            <View style={[styles.inlineRow, { justifyContent: 'space-between' }]}>
              <View style={styles.inlineRow}>
                <Avatar user={ca} size={30} onPress={() => onProfilePress(ca?.id)} />
                <View>
                  <View style={styles.inlineRow}>
                    <TouchableOpacity onPress={() => onProfilePress(ca?.id)}>
                      <Text style={styles.commentAuthor}>{ca?.display_name || '?'}</Text>
                    </TouchableOpacity>
                    <UserBadges user={ca} />
                  </View>
                  <Text style={styles.userMetaText}>{timeAgo(c.created_at)}</Text>
                </View>
              </View>
              {isOwnComment && (
                <TouchableOpacity onPress={() => onDeleteComment(c.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.commentText, { marginTop: 6, marginLeft: 38 }]}>{c.text}</Text>
          </View>
        );
      })}

      <View style={{ marginTop: 14 }}>
        <TextInput
          style={styles.commentInput}
          placeholder="Write a reply…"
          placeholderTextColor="#6b7280"
          value={draft}
          onChangeText={setDraft}
          maxLength={290}
        />
        <View style={[styles.inlineRow, { justifyContent: 'flex-end', gap: 10 }]}>
          <Text style={[styles.charCount, remaining < 20 && { color: '#f59e0b' }]}>{remaining}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={submit}>
            <Text style={styles.primaryButtonText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [users, setUsers]                     = useState([]);
  const [posts, setPosts]                     = useState([]);
  const [comments, setComments]               = useState([]);
  const [bookmarks, setBookmarks]             = useState([]);
  const [follows, setFollows]                 = useState([]);
  const [notifications, setNotifications]     = useState([]);
  const [directMessages, setDMs]              = useState([]);
  const [communities, setCommunities]         = useState([]);
  const [communityMembers, setCommunityMembers] = useState([]);
  const [communityPosts, setCommunityPosts]   = useState([]);
  const [likes, setLikes]                     = useState([]);
  const [blocks, setBlocks]                   = useState([]);

  const [authUser, setAuthUser]               = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [refreshing, setRefreshing]           = useState(false);
  const [authMode, setAuthMode]               = useState('signin');
  const [authForm, setAuthForm]               = useState({ username: '', password: '', displayName: '' });
  const [searchQuery, setSearchQuery]         = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [viewMode, setViewMode]               = useState('feed');
  const [feedTab, setFeedTab]                 = useState('forYou'); // 'forYou' | 'following'
  const [settingsForm, setSettingsForm]       = useState({ displayName: '', username: '', password: '', profileImage: '', bannerImage: '', bio: '', email: '' });
  const [selectedChatUserId, setSelectedChatUserId] = useState(null);
  const [dmSearch, setDmSearch]               = useState('');
  const [messageDraft, setMessageDraft]       = useState('');
  const [selectedPostId, setSelectedPostId]   = useState(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [newCommunityForm, setNewCommunityForm] = useState({ name: '', description: '' });
  const [postPage, setPostPage]               = useState(1);
  const [hasMorePosts, setHasMorePosts]       = useState(true);
  const [feedback, setFeedback]               = useState('Sign in to continue.');

  const PREMIUM_LINK = 'https://buy.stripe.com/test_14AeVf2sG1Ei8jubIj53O00';

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  const realtimeRef = useRef(null);

  const setupRealtime = useCallback(() => {
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);

    realtimeRef.current = supabase
      .channel('knot-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        setPosts((prev) => {
          if (prev.find((p) => p.id === payload.new.id)) return prev;
          return [{ ...payload.new, image_url: payload.new.image_url || '' }, ...prev];
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        setComments((prev) => {
          if (prev.find((c) => c.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, (payload) => {
        setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {
        setLikes((prev) => {
          if (prev.find((l) => l.user_id === payload.new.user_id && l.post_id === payload.new.post_id)) return prev;
          return [...prev, payload.new];
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'likes' }, (payload) => {
        setLikes((prev) => prev.filter((l) => !(l.user_id === payload.old.user_id && l.post_id === payload.old.post_id)));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        setDMs((prev) => {
          if (prev.find((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifications((prev) => {
          if (prev.find((n) => n.id === payload.new.id)) return prev;
          return [payload.new, ...prev];
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, (payload) => {
        setCommunityPosts((prev) => {
          if (prev.find((cp) => cp.id === payload.new.id)) return prev;
          return [payload.new, ...prev];
        });
      })
      .subscribe();
  }, []);

  useEffect(() => {
    setLoading(false);
    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, []);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadAllData = async (page = 1) => {
    const offset = (page - 1) * POST_LIMIT;
    const [
      { data: u }, { data: p }, { data: c }, { data: b },
      { data: f }, { data: n }, { data: d }, { data: cm }, { data: cmm },
      { data: l }, { data: bl }, { data: cp },
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('posts').select('*').order('created_at', { ascending: false }).range(offset, offset + POST_LIMIT - 1),
      supabase.from('comments').select('*').order('created_at', { ascending: true }),
      supabase.from('bookmarks').select('*'),
      supabase.from('follows').select('*'),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }),
      supabase.from('direct_messages').select('*').order('created_at', { ascending: true }),
      supabase.from('communities').select('*'),
      supabase.from('community_members').select('*'),
      supabase.from('likes').select('*'),
      supabase.from('blocks').select('*'),
      supabase.from('community_posts').select('*').order('created_at', { ascending: false }),
    ]);
    setUsers(u || []);
    if (page === 1) {
      setPosts(p || []);
    } else {
      setPosts((prev) => {
        const ids = new Set(prev.map((x) => x.id));
        return [...prev, ...(p || []).filter((x) => !ids.has(x.id))];
      });
    }
    setHasMorePosts((p || []).length === POST_LIMIT);
    setComments(c || []);
    setBookmarks(b || []);
    setFollows(f || []);
    setNotifications(n || []);
    setDMs(d || []);
    setCommunities(cm || []);
    setCommunityMembers(cmm || []);
    setLikes(l || []);
    setBlocks(bl || []);
    setCommunityPosts(cp || []);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPostPage(1);
    await loadAllData(1);
    setRefreshing(false);
  }, []);

  const loadMorePosts = async () => {
    if (!hasMorePosts) return;
    const next = postPage + 1;
    setPostPage(next);
    await loadAllData(next);
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const selectedProfile = useMemo(
    () => users.find((u) => u.id === selectedProfileId) || authUser,
    [users, selectedProfileId, authUser]
  );

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) || null,
    [posts, selectedPostId]
  );

  const visibleUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users.filter((u) => u.id !== authUser?.id).slice(0, 6);
    return users.filter((u) =>
      `${u.username} ${u.display_name}`.toLowerCase().includes(q)
    );
  }, [searchQuery, users, authUser]);

  const followingIds = useMemo(
    () => new Set(follows.filter((f) => f.follower_id === authUser?.id).map((f) => f.following_id)),
    [follows, authUser]
  );

  const orderedPosts = useMemo(() => {
    let base = [...posts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (feedTab === 'following') {
      base = base.filter((p) => followingIds.has(p.user_id) || p.user_id === authUser?.id);
    }
    // filter blocked
    base = base.filter((p) => !blocks.some(
      (bl) => (bl.blocker_id === authUser?.id && bl.blocked_id === p.user_id) ||
               (bl.blocker_id === p.user_id && bl.blocked_id === authUser?.id)
    ));
    return base;
  }, [posts, feedTab, followingIds, authUser, blocks]);

  const selectedProfilePosts = useMemo(() =>
    posts
      .filter((p) => p.user_id === selectedProfile?.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [posts, selectedProfile]
  );

  const notificationsForUser = useMemo(
    () => notifications.filter((n) => n.user_id === authUser?.id),
    [notifications, authUser]
  );

  const unreadNotifCount = useMemo(
    () => notificationsForUser.filter((n) => !n.read).length,
    [notificationsForUser]
  );

  const bookmarkedPosts = useMemo(() => {
    if (!authUser) return [];
    const ids = new Set(bookmarks.filter((b) => b.user_id === authUser.id).map((b) => b.post_id));
    return posts.filter((p) => ids.has(p.id));
  }, [bookmarks, posts, authUser]);

  const trendingTags = useMemo(() => {
    const counts = new Map();
    posts.forEach((p) => extractHashtags(p.content).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
  }, [posts]);

  const isFollowing = useCallback(
    (userId) => follows.some((f) => f.follower_id === authUser?.id && f.following_id === userId),
    [follows, authUser]
  );

  const isBlocking = useCallback(
    (userId) => blocks.some((b) => b.blocker_id === authUser?.id && b.blocked_id === userId),
    [blocks, authUser]
  );

  const selectedChatUser = useMemo(
    () => users.find((u) => u.id === selectedChatUserId) || null,
    [users, selectedChatUserId]
  );

  const conversationMessages = useMemo(() => {
    if (!authUser || !selectedChatUser) return [];
    return directMessages.filter((m) =>
      (m.sender_id === authUser.id && m.recipient_id === selectedChatUser.id) ||
      (m.sender_id === selectedChatUser.id && m.recipient_id === authUser.id)
    );
  }, [directMessages, authUser, selectedChatUser]);

  const unreadDMCount = useMemo(() => {
    if (!authUser) return 0;
    return directMessages.filter((m) => m.recipient_id === authUser.id && !m.read).length;
  }, [directMessages, authUser]);

  const isCommunityMember = (communityId) =>
    communityMembers.some((m) => m.community_id === communityId && m.user_id === authUser?.id);

  const followerCount  = (userId) => follows.filter((f) => f.following_id === userId).length;
  const followingCount = (userId) => follows.filter((f) => f.follower_id  === userId).length;

  const selectedCommunity = useMemo(
    () => communities.find((c) => c.id === selectedCommunityId) || null,
    [communities, selectedCommunityId]
  );

  const selectedCommunityPostsFiltered = useMemo(() => {
    if (!selectedCommunityId) return [];
    return communityPosts
      .filter((cp) => cp.community_id === selectedCommunityId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [communityPosts, selectedCommunityId]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const navTo = useCallback((mode, extra = {}) => {
    setViewMode(mode);
    setFeedback('');
    if (extra.profileId !== undefined) setSelectedProfileId(extra.profileId);
    if (extra.postId !== undefined) setSelectedPostId(extra.postId);
    if (extra.communityId !== undefined) setSelectedCommunityId(extra.communityId);
  }, []);

  const onProfilePress = useCallback((userId) => {
    if (!userId) return;
    setSelectedProfileId(userId);
    setViewMode('profile');
    setFeedback('');
  }, []);

  const onViewPost = useCallback((postId) => {
    setSelectedPostId(postId);
    setViewMode('postDetail');
    setFeedback('');
  }, []);

  const markNotifsRead = useCallback(async () => {
    if (!authUser) return;
    const unread = notificationsForUser.filter((n) => !n.read).map((n) => n.id);
    if (!unread.length) return;
    await supabase.from('notifications').update({ read: true }).in('id', unread);
    setNotifications((prev) => prev.map((n) => unread.includes(n.id) ? { ...n, read: true } : n));
  }, [authUser, notificationsForUser]);

  const markDMsRead = useCallback(async () => {
    if (!authUser || !selectedChatUser) return;
    const unread = conversationMessages
      .filter((m) => m.recipient_id === authUser.id && !m.read)
      .map((m) => m.id);
    if (!unread.length) return;
    await supabase.from('direct_messages').update({ read: true }).in('id', unread);
    setDMs((prev) => prev.map((m) => unread.includes(m.id) ? { ...m, read: true } : m));
  }, [authUser, selectedChatUser, conversationMessages]);

  useEffect(() => {
    if (viewMode === 'notifications') markNotifsRead();
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'messages' && selectedChatUserId) markDMsRead();
  }, [viewMode, selectedChatUserId]);

  // ── Auth ───────────────────────────────────────────────────────────────────

  const handleSignIn = async () => {
    const username = authForm.username.trim().toLowerCase();
    const password = authForm.password.trim();
    if (!username || !password) { setFeedback('Enter your username and password.'); return; }
    setFeedback('Signing in…');
    try {
      const { data: rows, error } = await supabase
        .from('users').select('*').eq('username', username).eq('password', password).limit(1);
      if (error) throw error;
      const data = rows?.[0];
      if (!data) { setFeedback('No matching account. Check your username and password.'); return; }
      if (data.banned) { setFeedback('This account has been banned.'); return; }
      setAuthUser(data);
      setSelectedProfileId(data.id);
      setSettingsForm({
        displayName: data.display_name, username: data.username,
        password: data.password, profileImage: data.profile_image || '',
        bannerImage: data.banner_image || '', bio: data.bio || '', email: data.email || '',
      });
      setFeedback('');
      await loadAllData(1);
      setupRealtime();
    } catch (e) {
      setFeedback('Sign in failed. Please try again.');
    }
  };

  const handleSignUp = async () => {
    const username    = authForm.username.trim().toLowerCase();
    const password    = authForm.password.trim();
    const displayName = authForm.displayName.trim() || username;
    if (!username || !password) { setFeedback('Enter a username and password.'); return; }
    if (username.length < 3) { setFeedback('Username must be at least 3 characters.'); return; }
    if (password.length < 6) { setFeedback('Password must be at least 6 characters.'); return; }
    setFeedback('Creating account…');
    try {
      const { data: rows } = await supabase.from('users').select('id').eq('username', username).limit(1);
      if (rows?.length > 0) { setFeedback('That username is already taken.'); return; }
      const newUser = {
        id: `user-${uid()}`, username, password, display_name: displayName,
        role: 'user', verified: false, banned: false, premium: false,
        profile_image: '', banner_image: '', bio: 'New to Knot Social.', email: '',
      };
      const { error } = await supabase.from('users').insert(newUser);
      if (error) throw error;
      setUsers((prev) => [newUser, ...prev]);
      setAuthUser(newUser);
      setSelectedProfileId(newUser.id);
      setSettingsForm({ displayName, username, password, profileImage: '', bannerImage: '', bio: 'New to Knot Social.', email: '' });
      setFeedback('');
      await loadAllData(1);
      setupRealtime();
    } catch (e) {
      setFeedback('Sign up failed. Please try again.');
    }
  };

  const handleSignOut = useCallback(() => {
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    setAuthUser(null);
    setSelectedChatUserId(null);
    setPosts([]);
    setComments([]);
    setLikes([]);
    setBlocks([]);
    setNotifications([]);
    setDMs([]);
    setFeedback('Signed out.');
  }, []);

  // ── Settings ───────────────────────────────────────────────────────────────

  const handleUpdateSettings = async () => {
    if (!authUser) return;
    const username    = settingsForm.username.trim().toLowerCase();
    const displayName = settingsForm.displayName.trim();
    const password    = settingsForm.password.trim();
    const bio         = settingsForm.bio.trim();
    const email       = settingsForm.email.trim();
    if (!username || !password || !displayName) { setFeedback('Fill out all required fields.'); return; }
    if (username.length < 3) { setFeedback('Username must be at least 3 characters.'); return; }
    if (password.length < 6) { setFeedback('Password must be at least 6 characters.'); return; }
    const dup = users.find((u) => u.id !== authUser.id && u.username.toLowerCase() === username);
    if (dup) { setFeedback('Username already in use.'); return; }
    const updates = {
      username, password, display_name: displayName, bio, email,
      profile_image: settingsForm.profileImage.trim(),
      banner_image: settingsForm.bannerImage.trim(),
    };
    const { error } = await supabase.from('users').update(updates).eq('id', authUser.id);
    if (error) { setFeedback('Could not save settings. Try again.'); return; }
    const updated = { ...authUser, ...updates };
    setUsers((prev) => prev.map((u) => u.id === authUser.id ? updated : u));
    setAuthUser(updated);
    setFeedback('Profile updated.');
  };

  const handlePickProfileImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setFeedback('Camera roll permission is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setSettingsForm((p) => ({ ...p, profileImage: `data:image/jpeg;base64,${asset.base64}` }));
    setFeedback('Image selected — tap Save to apply.');
  };

  const handlePickBannerImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setFeedback('Camera roll permission is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [3, 1], quality: 0.7, base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setSettingsForm((p) => ({ ...p, bannerImage: `data:image/jpeg;base64,${asset.base64}` }));
    setFeedback('Banner selected — tap Save to apply.');
  };

  // ── Posts ──────────────────────────────────────────────────────────────────

  const handleCreatePost = useCallback((text, imageUri = '') => {
    if (!authUser) return false;
    const content = (text || '').trim();
    if (!content) { setFeedback('Write something before posting.'); return false; }
    if (content.length > MAX_POST_CHARS) { setFeedback('Post is too long.'); return false; }
    const newPost = {
      id: `post-${uid()}`, user_id: authUser.id, content,
      image_url: imageUri || '', created_at: new Date().toISOString(),
    };
    supabase.from('posts').insert(newPost).then(({ error }) => {
      if (error) setFeedback('Post failed. Try again.');
    });
    setPosts((prev) => [newPost, ...prev]);
    return true;
  }, [authUser]);

  const handleDeletePost = useCallback(async (postId) => {
    if (!authUser) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.user_id !== authUser.id && authUser.role !== 'admin' && authUser.role !== 'owner') return;
    await supabase.from('posts').delete().eq('id', postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (viewMode === 'postDetail' && selectedPostId === postId) setViewMode('feed');
    setFeedback('Post deleted.');
  }, [authUser, posts, viewMode, selectedPostId]);

  // ── Comments ───────────────────────────────────────────────────────────────

  const handleAddComment = useCallback(async (postId, text) => {
    if (!authUser) return false;
    const content = (text || '').trim();
    if (!content) return false;
    const newComment = {
      id: `comment-${uid()}`, post_id: postId, user_id: authUser.id,
      text: content, created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('comments').insert(newComment);
    if (error) { setFeedback('Comment failed. Try again.'); return false; }
    setComments((prev) => [...prev, newComment]);

    // Notify the POST AUTHOR (not the commenter — fixing the original bug)
    const post = posts.find((p) => p.id === postId);
    if (post && post.user_id !== authUser.id) {
      const note = {
        id: `note-${uid()}`, user_id: post.user_id,
        text: `${authUser.display_name} replied to your post.`,
        type: 'comment', ref_id: postId, read: false,
        created_at: new Date().toISOString(),
      };
      await supabase.from('notifications').insert(note);
      setNotifications((prev) => [note, ...prev]);
    }
    return true;
  }, [authUser, posts]);

  const handleDeleteComment = useCallback(async (commentId) => {
    if (!authUser) return;
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    if (comment.user_id !== authUser.id && authUser.role !== 'admin' && authUser.role !== 'owner') return;
    await supabase.from('comments').delete().eq('id', commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }, [authUser, comments]);

  // ── Likes ──────────────────────────────────────────────────────────────────

  const handleLike = useCallback(async (postId) => {
    if (!authUser) return;
    const alreadyLiked = likes.some((l) => l.post_id === postId && l.user_id === authUser.id);
    if (alreadyLiked) {
      await supabase.from('likes').delete().eq('user_id', authUser.id).eq('post_id', postId);
      setLikes((prev) => prev.filter((l) => !(l.user_id === authUser.id && l.post_id === postId)));
    } else {
      const l = { user_id: authUser.id, post_id: postId, created_at: new Date().toISOString() };
      await supabase.from('likes').insert(l);
      setLikes((prev) => [...prev, l]);
      const post = posts.find((p) => p.id === postId);
      if (post && post.user_id !== authUser.id) {
        const note = {
          id: `note-${uid()}`, user_id: post.user_id,
          text: `${authUser.display_name} liked your post.`,
          type: 'like', ref_id: postId, read: false,
          created_at: new Date().toISOString(),
        };
        await supabase.from('notifications').insert(note);
        setNotifications((prev) => [note, ...prev]);
      }
    }
  }, [authUser, likes, posts]);

  // ── Bookmarks ──────────────────────────────────────────────────────────────

  const toggleBookmark = useCallback(async (postId) => {
    if (!authUser) return;
    const exists = bookmarks.some((b) => b.user_id === authUser.id && b.post_id === postId);
    if (exists) {
      await supabase.from('bookmarks').delete().eq('user_id', authUser.id).eq('post_id', postId);
      setBookmarks((prev) => prev.filter((b) => !(b.user_id === authUser.id && b.post_id === postId)));
    } else {
      const b = { user_id: authUser.id, post_id: postId, created_at: new Date().toISOString() };
      await supabase.from('bookmarks').insert(b);
      setBookmarks((prev) => [...prev, b]);
    }
  }, [authUser, bookmarks]);

  // ── Follows ────────────────────────────────────────────────────────────────

  const toggleFollow = async (userId) => {
    if (!authUser || userId === authUser.id) return;
    const following = isFollowing(userId);
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', authUser.id).eq('following_id', userId);
      setFollows((prev) => prev.filter((f) => !(f.follower_id === authUser.id && f.following_id === userId)));
    } else {
      const f = { follower_id: authUser.id, following_id: userId, created_at: new Date().toISOString() };
      await supabase.from('follows').insert(f);
      setFollows((prev) => [...prev, f]);
      const note = {
        id: `note-${uid()}`, user_id: userId,
        text: `${authUser.display_name} followed you.`,
        type: 'follow', ref_id: authUser.id, read: false,
        created_at: new Date().toISOString(),
      };
      await supabase.from('notifications').insert(note);
      setNotifications((prev) => [note, ...prev]);
    }
    setFeedback(following ? 'Unfollowed.' : 'Following!');
  };

  // ── Block / Mute ───────────────────────────────────────────────────────────

  const toggleBlock = async (userId) => {
    if (!authUser || userId === authUser.id) return;
    const blocked = isBlocking(userId);
    if (blocked) {
      await supabase.from('blocks').delete().eq('blocker_id', authUser.id).eq('blocked_id', userId);
      setBlocks((prev) => prev.filter((b) => !(b.blocker_id === authUser.id && b.blocked_id === userId)));
      setFeedback('User unblocked.');
    } else {
      const b = { blocker_id: authUser.id, blocked_id: userId, created_at: new Date().toISOString() };
      await supabase.from('blocks').insert(b);
      setBlocks((prev) => [...prev, b]);
      // auto-unfollow when blocking
      await supabase.from('follows').delete().eq('follower_id', authUser.id).eq('following_id', userId);
      setFollows((prev) => prev.filter((f) => !(f.follower_id === authUser.id && f.following_id === userId)));
      setFeedback('User blocked.');
    }
  };

  // ── Admin ──────────────────────────────────────────────────────────────────

  const toggleBan = async (userId) => {
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'owner')) return;
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const banned = !target.banned;
    await supabase.from('users').update({ banned }).eq('id', userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, banned } : u));
    setFeedback(banned ? 'User banned.' : 'User unbanned.');
  };

  const toggleVerify = async (userId) => {
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'owner')) return;
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const verified = !target.verified;
    await supabase.from('users').update({ verified }).eq('id', userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, verified } : u));
    setFeedback(verified ? 'User verified.' : 'Verification removed.');
  };

  const togglePremium = async (userId) => {
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'owner')) return;
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const premium = !target.premium;
    await supabase.from('users').update({ premium }).eq('id', userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, premium } : u));
    if (authUser.id === userId) setAuthUser((prev) => ({ ...prev, premium }));
    setFeedback(premium ? 'Premium activated.' : 'Premium removed.');
  };

  // ── Communities ────────────────────────────────────────────────────────────

  const handleCreateCommunity = async () => {
    if (!authUser) return;
    const name = newCommunityForm.name.trim();
    const description = newCommunityForm.description.trim();
    if (!name) { setFeedback('Give your community a name.'); return; }
    const newCommunity = { id: `community-${uid()}`, name, description, created_at: new Date().toISOString() };
    const { error } = await supabase.from('communities').insert(newCommunity);
    if (error) { setFeedback('Could not create community.'); return; }
    setCommunities((prev) => [...prev, newCommunity]);
    const m = { community_id: newCommunity.id, user_id: authUser.id, created_at: new Date().toISOString() };
    await supabase.from('community_members').insert(m);
    setCommunityMembers((prev) => [...prev, m]);
    setNewCommunityForm({ name: '', description: '' });
    setFeedback(`Community "${name}" created!`);
  };

  const toggleJoinCommunity = async (communityId) => {
    if (!authUser) return;
    const member = isCommunityMember(communityId);
    if (member) {
      await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', authUser.id);
      setCommunityMembers((prev) => prev.filter((m) => !(m.community_id === communityId && m.user_id === authUser.id)));
      setFeedback('Left community.');
    } else {
      const m = { community_id: communityId, user_id: authUser.id, created_at: new Date().toISOString() };
      await supabase.from('community_members').insert(m);
      setCommunityMembers((prev) => [...prev, m]);
      setFeedback('Joined community!');
    }
  };

  const handleCreateCommunityPost = async (communityId, text) => {
    if (!authUser || !text.trim()) return false;
    if (!isCommunityMember(communityId)) { setFeedback('Join this community to post.'); return false; }
    const newPost = {
      id: `cpost-${uid()}`, community_id: communityId, user_id: authUser.id,
      content: text.trim(), created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('community_posts').insert(newPost);
    if (error) { setFeedback('Could not post. Try again.'); return false; }
    setCommunityPosts((prev) => [newPost, ...prev]);
    return true;
  };

  // ── DMs ────────────────────────────────────────────────────────────────────

  const handleSendMessage = async () => {
    if (!authUser || !selectedChatUser) return;
    const text = messageDraft.trim();
    if (!text) return;
    const dm = {
      id: `dm-${uid()}`, sender_id: authUser.id, recipient_id: selectedChatUser.id,
      text, read: false, created_at: new Date().toISOString(),
    };
    await supabase.from('direct_messages').insert(dm);
    setDMs((prev) => [...prev, dm]);
    const note = {
      id: `note-${uid()}`, user_id: selectedChatUser.id,
      text: `${authUser.display_name} sent you a message.`,
      type: 'dm', ref_id: authUser.id, read: false,
      created_at: new Date().toISOString(),
    };
    await supabase.from('notifications').insert(note);
    setNotifications((prev) => [note, ...prev]);
    setMessageDraft('');
  };

  // ── Notification deep link ─────────────────────────────────────────────────

  const handleNotifPress = (notif) => {
    if (notif.type === 'comment' || notif.type === 'like') {
      setSelectedPostId(notif.ref_id);
      setViewMode('postDetail');
    } else if (notif.type === 'follow') {
      setSelectedProfileId(notif.ref_id);
      setViewMode('profile');
    } else if (notif.type === 'dm') {
      setSelectedChatUserId(notif.ref_id);
      setViewMode('messages');
    }
    setFeedback('');
  };

  // ── Auth screen ────────────────────────────────────────────────────────────

  if (!authUser) {
    return (
      <View style={styles.screen}>
        <View style={styles.backgroundGlow1} pointerEvents="none" />
        <View style={styles.backgroundGlow2} pointerEvents="none" />
        <View style={styles.backgroundGlow3} pointerEvents="none" />
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.authCard}>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>KNOT SOCIAL</Text></View>
            <Text style={styles.appTitle}>Knot</Text>
            <Text style={styles.subtitle}>Where your people are.</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleButton, authMode === 'signin' && styles.toggleButtonActive]}
                onPress={() => setAuthMode('signin')}
              >
                <Text style={[styles.toggleText, authMode === 'signin' && styles.toggleTextActive]}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, authMode === 'signup' && styles.toggleButtonActive]}
                onPress={() => setAuthMode('signup')}
              >
                <Text style={[styles.toggleText, authMode === 'signup' && styles.toggleTextActive]}>Sign up</Text>
              </TouchableOpacity>
            </View>
            {feedback ? <View style={styles.notice}><Text style={styles.noticeText}>{feedback}</Text></View> : null}
            {authMode === 'signup' && (
              <TextInput
                style={styles.input} placeholder="Display name" placeholderTextColor="#6b7280"
                value={authForm.displayName} onChangeText={(v) => setAuthForm((p) => ({ ...p, displayName: v }))}
              />
            )}
            <TextInput
              style={styles.input} placeholder="Username" placeholderTextColor="#6b7280"
              autoCapitalize="none" value={authForm.username}
              onChangeText={(v) => setAuthForm((p) => ({ ...p, username: v }))}
            />
            <TextInput
              style={styles.input} placeholder="Password" placeholderTextColor="#6b7280"
              secureTextEntry value={authForm.password}
              onChangeText={(v) => setAuthForm((p) => ({ ...p, password: v }))}
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={authMode === 'signin' ? handleSignIn : handleSignUp}
            >
              <Text style={styles.primaryButtonText}>
                {authMode === 'signin' ? '→ Sign in' : '→ Create account'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Nav items ──────────────────────────────────────────────────────────────

  const navItems = [
    { mode: 'feed',          icon: '⌂',  label: 'Home' },
    { mode: 'profile',       icon: '◉',  label: 'Profile' },
    { mode: 'profiles',      icon: '⊕',  label: 'People' },
    { mode: 'notifications', icon: '◎',  label: 'Alerts',  badge: unreadNotifCount },
    { mode: 'bookmarks',     icon: '◆',  label: 'Saved' },
    { mode: 'messages',      icon: '✉',  label: 'Messages', badge: unreadDMCount },
    { mode: 'communities',   icon: '⬡',  label: 'Groups' },
    { mode: 'hashtags',      icon: '◇',  label: 'Explore' },
    { mode: 'premium',       icon: '★',  label: 'Premium' },
  ];

  const handleNavPress = (mode) => {
    if (mode === 'profile') setSelectedProfileId(authUser.id);
    navTo(mode);
  };

  // ── Mobile bottom nav ──────────────────────────────────────────────────────

  const MobileNav = () => (
    <View style={styles.mobileNav}>
      {navItems.slice(0, 5).map(({ mode, icon, badge }) => (
        <TouchableOpacity
          key={mode}
          style={styles.mobileNavItem}
          onPress={() => handleNavPress(mode)}
        >
          <View>
            <Text style={[styles.mobileNavIcon, viewMode === mode && styles.mobileNavIconActive]}>{icon}</Text>
            {badge > 0 && <View style={styles.navBadge}><Text style={styles.navBadgeText}>{badge > 99 ? '99+' : badge}</Text></View>}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Main layout ────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.content, IS_MOBILE && { paddingBottom: 80 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#5b4fff"
            colors={['#5b4fff']}
          />
        }
      >
        <View style={[styles.appShell, IS_MOBILE && { flexDirection: 'column' }]}>

          {/* ── Desktop sidebar ── */}
          {!IS_MOBILE && (
            <View style={styles.sidebar}>
              <Text style={styles.brand}>Knot</Text>
              {navItems.map(({ mode, icon, label, badge }) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.navItem, viewMode === mode && styles.navItemActive]}
                  onPress={() => handleNavPress(mode)}
                >
                  <View style={{ position: 'relative' }}>
                    <Text style={[styles.navIcon, viewMode === mode && styles.navIconActive]}>{icon}</Text>
                    {badge > 0 && <View style={styles.navBadge}><Text style={styles.navBadgeText}>{badge > 99 ? '99+' : badge}</Text></View>}
                  </View>
                  <Text style={[styles.navText, viewMode === mode && styles.navTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.primaryButton} onPress={() => navTo('feed')}>
                <Text style={styles.primaryButtonText}>+ New Post</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { marginTop: 8 }]} onPress={handleSignOut}>
                <Text style={styles.secondaryButtonText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Feed column ── */}
          <View style={[styles.feedColumn, IS_MOBILE && { width: '100%' }]}>

            {/* Post detail */}
            {viewMode === 'postDetail' && (
              <PostDetailView
                post={selectedPost}
                comments={comments}
                users={users}
                authUser={authUser}
                likes={likes}
                isBookmarked={bookmarks.some((b) => b.user_id === authUser.id && b.post_id === selectedPostId)}
                onBack={() => setViewMode('feed')}
                onLike={handleLike}
                onToggleBookmark={toggleBookmark}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onProfilePress={onProfilePress}
                blocks={blocks}
              />
            )}

            {/* Settings */}
            {viewMode === 'settings' && (
              <View style={styles.card}>
                <View style={styles.inlineRow}>
                  <TouchableOpacity onPress={() => setViewMode('profile')} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.sectionTitle}>Settings</Text>
                </View>
                <TextInput style={styles.input} placeholder="Display name" placeholderTextColor="#6b7280"
                  value={settingsForm.displayName} onChangeText={(v) => setSettingsForm((p) => ({ ...p, displayName: v }))} />
                <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#6b7280"
                  autoCapitalize="none" value={settingsForm.username} onChangeText={(v) => setSettingsForm((p) => ({ ...p, username: v }))} />
                <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#6b7280"
                  secureTextEntry value={settingsForm.password} onChangeText={(v) => setSettingsForm((p) => ({ ...p, password: v }))} />
                <TextInput style={styles.input} placeholder="Email (optional)" placeholderTextColor="#6b7280"
                  autoCapitalize="none" keyboardType="email-address" value={settingsForm.email} onChangeText={(v) => setSettingsForm((p) => ({ ...p, email: v }))} />
                <TextInput style={[styles.input, { minHeight: 70 }]} placeholder="Bio" placeholderTextColor="#6b7280"
                  multiline value={settingsForm.bio} onChangeText={(v) => setSettingsForm((p) => ({ ...p, bio: v }))} />

                <Text style={[styles.helperText, { marginBottom: 6, marginTop: 4 }]}>Profile image</Text>
                <View style={styles.imagePickerRow}>
                  <View style={styles.settingsAvatarPreview}>
                    {settingsForm.profileImage
                      ? <Image source={{ uri: settingsForm.profileImage }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                      : <Text style={styles.avatarText}>{getAvatarLabel(authUser)}</Text>}
                  </View>
                  <TouchableOpacity style={styles.uploadButton} onPress={handlePickProfileImage}>
                    <Text style={styles.uploadButtonText}>⬆ Update image</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.helperText, { marginBottom: 6, marginTop: 12 }]}>Profile banner</Text>
                <View style={styles.bannerPickerWrap}>
                  {settingsForm.bannerImage
                    ? <Image source={{ uri: settingsForm.bannerImage }} style={styles.settingsBannerPreview} />
                    : <View style={styles.settingsBannerPreview}><Text style={styles.helperText}>No banner set</Text></View>}
                  <TouchableOpacity style={[styles.uploadButton, { marginTop: 8 }]} onPress={handlePickBannerImage}>
                    <Text style={styles.uploadButtonText}>⬆ Update banner</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.primaryButton, { marginTop: 14 }]} onPress={handleUpdateSettings}>
                  <Text style={styles.primaryButtonText}>Save settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { marginTop: 8 }]} onPress={handleSignOut}>
                  <Text style={styles.secondaryButtonText}>Sign out</Text>
                </TouchableOpacity>
                {feedback ? <View style={[styles.notice, { marginTop: 10 }]}><Text style={styles.noticeText}>{feedback}</Text></View> : null}
              </View>
            )}

            {/* Profile */}
            {viewMode === 'profile' && selectedProfile && (
              <View style={styles.card}>
                <View style={styles.profileBanner}>
                  {selectedProfile.banner_image
                    ? <Image source={{ uri: selectedProfile.banner_image }} style={styles.profileBannerImage} />
                    : <View style={styles.profileBannerPlaceholder} />}
                  <View style={styles.profileAvatarOverlay}>
                    <Avatar user={selectedProfile} size={68} />
                  </View>
                </View>
                <View style={{ marginTop: 44, paddingHorizontal: 4 }}>
                  <View style={styles.inlineRow}>
                    <Text style={styles.profileName}>{selectedProfile.display_name}</Text>
                    <UserBadges user={selectedProfile} />
                  </View>
                  <Text style={styles.userMetaText}>@{selectedProfile.username}</Text>
                  {selectedProfile.bio ? <Text style={styles.profileBio}>{selectedProfile.bio}</Text> : null}
                </View>
                <View style={[styles.inlineRow, { marginTop: 12, flexWrap: 'wrap', gap: 8 }]}>
                  <Text style={styles.helperText}>{followerCount(selectedProfile.id)} followers</Text>
                  <Text style={styles.helperText}>{followingCount(selectedProfile.id)} following</Text>
                  {selectedProfile.role !== 'user' && <Text style={styles.roleBadge}>{selectedProfile.role}</Text>}
                </View>
                {selectedProfile.banned && <Text style={styles.bannedText}>Banned</Text>}

                {selectedProfile.id !== authUser.id && (
                  <View style={[styles.inlineRow, { marginTop: 12, gap: 8 }]}>
                    <TouchableOpacity style={[styles.smallButton, isFollowing(selectedProfile.id) && styles.actionBtnActive]} onPress={() => toggleFollow(selectedProfile.id)}>
                      <Text style={[styles.smallButtonText, isFollowing(selectedProfile.id) && styles.actionBtnTextActive]}>
                        {isFollowing(selectedProfile.id) ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallButton, isBlocking(selectedProfile.id) && { borderColor: '#ef4444' }]}
                      onPress={() => toggleBlock(selectedProfile.id)}
                    >
                      <Text style={[styles.smallButtonText, isBlocking(selectedProfile.id) && { color: '#ef4444' }]}>
                        {isBlocking(selectedProfile.id) ? 'Unblock' : 'Block'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.smallButton} onPress={() => { setSelectedChatUserId(selectedProfile.id); navTo('messages'); }}>
                      <Text style={styles.smallButtonText}>Message</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {selectedProfile.id === authUser.id && (
                  <TouchableOpacity style={[styles.smallButton, { marginTop: 12, alignSelf: 'flex-start' }]} onPress={() => navTo('settings')}>
                    <Text style={styles.smallButtonText}>⚙ Edit profile</Text>
                  </TouchableOpacity>
                )}

                <View style={[styles.divider, { marginTop: 16 }]} />
                <Text style={[styles.sectionTitle, { marginTop: 12, marginBottom: 8 }]}>Posts</Text>
                {selectedProfilePosts.length === 0
                  ? <Text style={styles.helperText}>No posts yet.</Text>
                  : selectedProfilePosts.map((post) => (
                      <FeedPost
                        key={post.id}
                        post={post}
                        comments={comments}
                        users={users}
                        authUser={authUser}
                        likes={likes}
                        isBookmarked={bookmarks.some((b) => b.user_id === authUser.id && b.post_id === post.id)}
                        onToggleBookmark={toggleBookmark}
                        onAddComment={handleAddComment}
                        onLike={handleLike}
                        onDelete={handleDeletePost}
                        onViewPost={onViewPost}
                        onProfilePress={onProfilePress}
                        blocks={blocks}
                      />
                    ))
                }
              </View>
            )}

            {/* People */}
            {viewMode === 'profiles' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>People</Text>
                <TextInput style={styles.input} placeholder="Search by name or username"
                  placeholderTextColor="#6b7280" value={searchQuery} onChangeText={setSearchQuery} />
                {users
                  .filter((u) => {
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) return u.id !== authUser.id;
                    return `${u.username} ${u.display_name}`.toLowerCase().includes(q);
                  })
                  .map((user) => (
                    <View key={user.id} style={styles.listItem}>
                      <Avatar user={user} size={40} onPress={() => onProfilePress(user.id)} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.inlineRow}>
                          <TouchableOpacity onPress={() => onProfilePress(user.id)}>
                            <Text style={styles.userNameText}>{user.display_name}</Text>
                          </TouchableOpacity>
                          <UserBadges user={user} />
                        </View>
                        <Text style={styles.userMetaText}>@{user.username} · {followerCount(user.id)} followers</Text>
                      </View>
                      {user.id !== authUser.id && (
                        <TouchableOpacity
                          style={[styles.smallButton, isFollowing(user.id) && styles.actionBtnActive]}
                          onPress={() => toggleFollow(user.id)}
                        >
                          <Text style={[styles.smallButtonText, isFollowing(user.id) && styles.actionBtnTextActive]}>
                            {isFollowing(user.id) ? 'Following' : 'Follow'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                }
              </View>
            )}

            {/* Notifications */}
            {viewMode === 'notifications' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Notifications</Text>
                {notificationsForUser.length === 0
                  ? <Text style={styles.helperText}>You're all caught up.</Text>
                  : notificationsForUser.map((note) => (
                      <TouchableOpacity
                        key={note.id}
                        style={[styles.listItem, !note.read && styles.unreadItem]}
                        onPress={() => handleNotifPress(note)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.postText}>{note.text}</Text>
                          <Text style={styles.helperText}>{timeAgo(note.created_at)}</Text>
                        </View>
                        {!note.read && <View style={styles.unreadDot} />}
                      </TouchableOpacity>
                    ))
                }
              </View>
            )}

            {/* Bookmarks */}
            {viewMode === 'bookmarks' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Saved posts</Text>
                {bookmarkedPosts.length === 0
                  ? <Text style={styles.helperText}>No saved posts yet.</Text>
                  : bookmarkedPosts.map((post) => (
                      <FeedPost
                        key={post.id}
                        post={post}
                        comments={comments}
                        users={users}
                        authUser={authUser}
                        likes={likes}
                        isBookmarked
                        onToggleBookmark={toggleBookmark}
                        onAddComment={handleAddComment}
                        onLike={handleLike}
                        onDelete={handleDeletePost}
                        onViewPost={onViewPost}
                        onProfilePress={onProfilePress}
                        blocks={blocks}
                      />
                    ))
                }
              </View>
            )}

            {/* Messages */}
            {viewMode === 'messages' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Direct messages</Text>
                <View style={IS_MOBILE ? styles.messageLayoutMobile : styles.messageLayout}>
                  {(!IS_MOBILE || !selectedChatUserId) && (
                    <View style={IS_MOBILE ? { width: '100%', marginBottom: 12 } : styles.messageList}>
                      <TextInput
                        style={[styles.input, { marginBottom: 8 }]}
                        placeholder="Search users…"
                        placeholderTextColor="#6b7280"
                        value={dmSearch}
                        onChangeText={setDmSearch}
                      />
                      {users
                        .filter((u) => {
                          if (u.id === authUser.id) return false;
                          if (isBlocking(u.id)) return false;
                          if (!dmSearch.trim()) return true;
                          return `${u.username} ${u.display_name}`.toLowerCase().includes(dmSearch.trim().toLowerCase());
                        })
                        .map((user) => {
                          const hasUnread = directMessages.some(
                            (m) => m.sender_id === user.id && m.recipient_id === authUser.id && !m.read
                          );
                          return (
                            <TouchableOpacity
                              key={user.id}
                              style={[styles.messageRow, selectedChatUserId === user.id && { borderColor: '#5b21b6' }]}
                              onPress={() => { setSelectedChatUserId(user.id); setDmSearch(''); }}
                            >
                              <View style={styles.inlineRow}>
                                <Avatar user={user} size={30} />
                                <View style={{ flex: 1 }}>
                                  <View style={styles.inlineRow}>
                                    <Text style={styles.userNameText}>{user.display_name}</Text>
                                    <UserBadges user={user} />
                                  </View>
                                  <Text style={styles.userMetaText}>@{user.username}</Text>
                                </View>
                                {hasUnread && <View style={styles.unreadDot} />}
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      }
                    </View>
                  )}
                  {(!IS_MOBILE || selectedChatUserId) && (
                    <View style={{ flex: 1 }}>
                      {IS_MOBILE && selectedChatUserId && (
                        <TouchableOpacity onPress={() => setSelectedChatUserId(null)} style={styles.backBtn}>
                          <Text style={styles.backBtnText}>← Back</Text>
                        </TouchableOpacity>
                      )}
                      {selectedChatUser ? (
                        <>
                          <View style={[styles.inlineRow, { marginBottom: 10 }]}>
                            <Avatar user={selectedChatUser} size={32} onPress={() => onProfilePress(selectedChatUser.id)} />
                            <Text style={styles.userNameText}>{selectedChatUser.display_name}</Text>
                            <UserBadges user={selectedChatUser} />
                          </View>
                          {conversationMessages.map((msg) => (
                            <View key={msg.id} style={msg.sender_id === authUser.id ? styles.sentBubble : styles.receivedBubble}>
                              <Text style={msg.sender_id === authUser.id ? styles.sentBubbleText : styles.receivedBubbleText}>{msg.text}</Text>
                              <Text style={[styles.helperText, { fontSize: 10, marginTop: 3, textAlign: msg.sender_id === authUser.id ? 'right' : 'left' }]}>
                                {timeAgo(msg.created_at)}{msg.sender_id === authUser.id && msg.read ? ' · Read' : ''}
                              </Text>
                            </View>
                          ))}
                          <TextInput
                            style={styles.postInput}
                            placeholder="Write a message…"
                            placeholderTextColor="#6b7280"
                            value={messageDraft}
                            onChangeText={setMessageDraft}
                          />
                          <TouchableOpacity style={styles.primaryButton} onPress={handleSendMessage}>
                            <Text style={styles.primaryButtonText}>Send</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <Text style={styles.helperText}>Select a conversation.</Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Communities */}
            {viewMode === 'communities' && !selectedCommunityId && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Communities</Text>
                <View style={styles.composeCard}>
                  <Text style={styles.composeLabel}>✦ Create a community</Text>
                  <TextInput style={styles.input} placeholder="Community name" placeholderTextColor="#6b7280"
                    value={newCommunityForm.name} onChangeText={(v) => setNewCommunityForm((p) => ({ ...p, name: v }))} />
                  <TextInput style={styles.input} placeholder="Description (optional)" placeholderTextColor="#6b7280"
                    value={newCommunityForm.description} onChangeText={(v) => setNewCommunityForm((p) => ({ ...p, description: v }))} />
                  <TouchableOpacity style={styles.primaryButton} onPress={handleCreateCommunity}>
                    <Text style={styles.primaryButtonText}>Create</Text>
                  </TouchableOpacity>
                </View>
                {feedback ? <View style={[styles.notice, { marginTop: 8 }]}><Text style={styles.noticeText}>{feedback}</Text></View> : null}
                {communities.map((community) => {
                  const memberCount = communityMembers.filter((m) => m.community_id === community.id).length;
                  return (
                    <View key={community.id} style={styles.postCard}>
                      <TouchableOpacity onPress={() => setSelectedCommunityId(community.id)}>
                        <View style={styles.inlineRow}>
                          <Text style={styles.userNameText}>{community.name}</Text>
                          <Text style={styles.helperText}>{memberCount} members</Text>
                        </View>
                        <Text style={styles.postText}>{community.description}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.smallButton, { marginTop: 8 }]} onPress={() => toggleJoinCommunity(community.id)}>
                        <Text style={styles.smallButtonText}>{isCommunityMember(community.id) ? 'Leave' : 'Join'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Community detail */}
            {viewMode === 'communities' && selectedCommunityId && selectedCommunity && (
              <View style={styles.card}>
                <TouchableOpacity onPress={() => setSelectedCommunityId(null)} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Communities</Text>
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>{selectedCommunity.name}</Text>
                <Text style={styles.profileBio}>{selectedCommunity.description}</Text>
                <View style={[styles.inlineRow, { marginBottom: 12 }]}>
                  <Text style={styles.helperText}>
                    {communityMembers.filter((m) => m.community_id === selectedCommunityId).length} members
                  </Text>
                  <TouchableOpacity style={styles.smallButton} onPress={() => toggleJoinCommunity(selectedCommunityId)}>
                    <Text style={styles.smallButtonText}>{isCommunityMember(selectedCommunityId) ? 'Leave' : 'Join'}</Text>
                  </TouchableOpacity>
                </View>

                {isCommunityMember(selectedCommunityId) && (
                  <CommunityCompose
                    authUser={authUser}
                    onSubmit={(text) => handleCreateCommunityPost(selectedCommunityId, text)}
                  />
                )}

                {selectedCommunityPostsFiltered.length === 0
                  ? <Text style={styles.helperText}>No posts yet. Be the first!</Text>
                  : selectedCommunityPostsFiltered.map((cp) => {
                      const cpAuthor = users.find((u) => u.id === cp.user_id);
                      return (
                        <View key={cp.id} style={styles.postCard}>
                          <View style={styles.postHeader}>
                            <Avatar user={cpAuthor} size={36} onPress={() => onProfilePress(cpAuthor?.id)} />
                            <View>
                              <View style={styles.inlineRow}>
                                <TouchableOpacity onPress={() => onProfilePress(cpAuthor?.id)}>
                                  <Text style={styles.postAuthor}>{cpAuthor?.display_name || '?'}</Text>
                                </TouchableOpacity>
                                <UserBadges user={cpAuthor} />
                              </View>
                              <Text style={styles.userMetaText}>{timeAgo(cp.created_at)}</Text>
                            </View>
                          </View>
                          <Text style={styles.postText}>{cp.content}</Text>
                        </View>
                      );
                    })
                }
              </View>
            )}

            {/* Hashtags / Explore */}
            {viewMode === 'hashtags' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Explore</Text>
                <TextInput style={styles.input} placeholder="Search posts by hashtag or keyword"
                  placeholderTextColor="#6b7280" value={searchQuery} onChangeText={setSearchQuery} />
                <View style={[styles.inlineRow, { flexWrap: 'wrap', gap: 6, marginBottom: 12 }]}>
                  {trendingTags.map((tag) => (
                    <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => setSearchQuery(tag)}>
                      <Text style={styles.tagChipText}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {posts
                  .filter((p) => {
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return p.content.toLowerCase().includes(q);
                  })
                  .map((post) => (
                    <FeedPost
                      key={post.id}
                      post={post}
                      comments={comments}
                      users={users}
                      authUser={authUser}
                      likes={likes}
                      isBookmarked={bookmarks.some((b) => b.user_id === authUser.id && b.post_id === post.id)}
                      onToggleBookmark={toggleBookmark}
                      onAddComment={handleAddComment}
                      onLike={handleLike}
                      onDelete={handleDeletePost}
                      onViewPost={onViewPost}
                      onProfilePress={onProfilePress}
                      blocks={blocks}
                    />
                  ))
                }
              </View>
            )}

            {/* Premium */}
            {viewMode === 'premium' && (
              <View style={styles.card}>
                {authUser.premium ? (
                  <>
                    <View style={styles.premiumActiveHeader}>
                      <Text style={styles.premiumActiveIcon}>✦</Text>
                      <Text style={styles.premiumActiveTitle}>You're Premium</Text>
                    </View>
                    <Text style={styles.premiumDesc}>Your gold badge is active on your profile and all your posts. Thank you for supporting Knot!</Text>
                    {['Gold badge next to your name', 'Premium supporter status', 'Priority community features'].map((perk) => (
                      <View key={perk} style={styles.premiumPerk}>
                        <Text style={styles.premiumPerkText}>✦  {perk}</Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <>
                    <View style={styles.premiumHeader}>
                      <Text style={styles.premiumIcon}>★</Text>
                      <Text style={styles.premiumTitle}>Knot Premium</Text>
                      <Text style={styles.premiumPrice}>$4.99 / month</Text>
                    </View>
                    <Text style={styles.premiumDesc}>Support Knot and stand out with a gold badge next to your name everywhere on the platform.</Text>
                    {['Gold badge next to your name', 'Premium supporter status', 'Priority community features'].map((perk) => (
                      <View key={perk} style={styles.premiumPerk}>
                        <Text style={styles.premiumPerkText}>✦  {perk}</Text>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={styles.premiumButton}
                      onPress={() => Linking.openURL(`${PREMIUM_LINK}?client_reference_id=${authUser.id}`)}
                    >
                      <Text style={styles.premiumButtonText}>★ Subscribe for $4.99/mo</Text>
                    </TouchableOpacity>
                    <Text style={styles.helperText}>After payment your gold badge will activate automatically. Billed monthly, cancel anytime.</Text>
                  </>
                )}
              </View>
            )}

            {/* Feed */}
            {viewMode === 'feed' && (
              <>
                <View style={styles.feedHeader}>
                  <Text style={styles.feedTitle}>Home</Text>
                  <View style={styles.feedTabRow}>
                    <TouchableOpacity
                      style={[styles.feedTab, feedTab === 'forYou' && styles.feedTabActive]}
                      onPress={() => setFeedTab('forYou')}
                    >
                      <Text style={[styles.feedTabText, feedTab === 'forYou' && styles.feedTabTextActive]}>For You</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.feedTab, feedTab === 'following' && styles.feedTabActive]}
                      onPress={() => setFeedTab('following')}
                    >
                      <Text style={[styles.feedTabText, feedTab === 'following' && styles.feedTabTextActive]}>Following</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Castyr banner */}
                <TouchableOpacity
                  style={styles.castyrBanner}
                  onPress={() => Linking.openURL('https://castyr.live')}
                  activeOpacity={0.85}
                >
                  <View style={styles.castyrBannerInner}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.castyrBannerLabel}>PARTNER</Text>
                      <Text style={styles.castyrBannerTitle}>Castyr.live</Text>
                      <Text style={styles.castyrBannerDesc}>The next gen live streaming platform. Go live, grow your audience, and own your stream.</Text>
                    </View>
                    <View style={styles.castyrBannerButton}>
                      <Text style={styles.castyrBannerButtonText}>Go live →</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {feedback ? <View style={styles.notice}><Text style={styles.noticeText}>{feedback}</Text></View> : null}

                <ComposeCard authUser={authUser} onSubmit={handleCreatePost} />

                {feedTab === 'following' && followingIds.size === 0 && (
                  <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
                    <Text style={styles.helperText}>Follow some people to see their posts here.</Text>
                    <TouchableOpacity style={[styles.primaryButton, { marginTop: 12, paddingHorizontal: 24 }]} onPress={() => navTo('profiles')}>
                      <Text style={styles.primaryButtonText}>Find people</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {orderedPosts.map((post) => (
                  <FeedPost
                    key={post.id}
                    post={post}
                    comments={comments}
                    users={users}
                    authUser={authUser}
                    likes={likes}
                    isBookmarked={bookmarks.some((b) => b.user_id === authUser.id && b.post_id === post.id)}
                    onToggleBookmark={toggleBookmark}
                    onAddComment={handleAddComment}
                    onLike={handleLike}
                    onDelete={handleDeletePost}
                    onViewPost={onViewPost}
                    onProfilePress={onProfilePress}
                    blocks={blocks}
                  />
                ))}

                {hasMorePosts && (
                  <TouchableOpacity style={[styles.secondaryButton, { marginTop: 10 }]} onPress={loadMorePosts}>
                    <Text style={styles.secondaryButtonText}>Load more posts</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

          </View>
          {/* end feedColumn */}

          {/* ── Right column (desktop only) ── */}
          {!IS_MOBILE && (
            <View style={styles.rightColumn}>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Search users</Text>
                <TextInput style={styles.input} placeholder="Try a username" placeholderTextColor="#6b7280"
                  value={searchQuery} onChangeText={setSearchQuery} />
                {visibleUsers.map((user) => (
                  <TouchableOpacity key={user.id} style={styles.userRow}
                    onPress={() => { setSelectedProfileId(user.id); setViewMode('profile'); }}>
                    <Avatar user={user} size={36} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.inlineRow}>
                        <Text style={styles.userNameText}>{user.display_name}</Text>
                        <UserBadges user={user} />
                      </View>
                      <Text style={styles.userMetaText}>@{user.username}</Text>
                    </View>
                    {user.id !== authUser.id && (
                      <TouchableOpacity
                        style={[styles.smallButton, isFollowing(user.id) && styles.actionBtnActive]}
                        onPress={() => toggleFollow(user.id)}
                      >
                        <Text style={[styles.smallButtonText, isFollowing(user.id) && styles.actionBtnTextActive]}>
                          {isFollowing(user.id) ? '✓' : '+'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Quick stats</Text>
                <Text style={styles.helperText}>Followers: {followerCount(authUser.id)}</Text>
                <Text style={styles.helperText}>Following: {followingCount(authUser.id)}</Text>
                <Text style={styles.helperText}>Likes received: {likes.filter((l) => posts.find((p) => p.id === l.post_id && p.user_id === authUser.id)).length}</Text>
                <Text style={styles.helperText}>Bookmarks: {bookmarkedPosts.length}</Text>
              </View>

              <TouchableOpacity style={styles.castyrSideCard} onPress={() => Linking.openURL('https://castyr.live')} activeOpacity={0.85}>
                <Text style={styles.castyrSideLabel}>PARTNER</Text>
                <Text style={styles.castyrSideTitle}>Castyr.live</Text>
                <Text style={styles.castyrSideDesc}>The next gen live streaming platform. Go live and grow your audience.</Text>
                <View style={styles.castyrSideButton}><Text style={styles.castyrSideButtonText}>Try it free →</Text></View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => navTo('settings')}>
                <Text style={styles.secondaryButtonText}>⚙ Settings</Text>
              </TouchableOpacity>

              {(authUser.role === 'admin' || authUser.role === 'owner') && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Admin</Text>
                  {users.map((user) => (
                    <View key={user.id} style={styles.adminRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.inlineRow}>
                          <Text style={styles.userNameText}>{user.display_name}</Text>
                          <UserBadges user={user} />
                        </View>
                        <Text style={styles.userMetaText}>@{user.username}</Text>
                        {user.banned && <Text style={styles.bannedText}>Banned</Text>}
                      </View>
                      <View style={styles.adminActions}>
                        <TouchableOpacity style={styles.smallButton} onPress={() => toggleBan(user.id)}>
                          <Text style={styles.smallButtonText}>{user.banned ? 'Unban' : 'Ban'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.smallButton} onPress={() => toggleVerify(user.id)}>
                          <Text style={styles.smallButtonText}>{user.verified ? 'Unverify' : 'Verify'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.smallButton} onPress={() => togglePremium(user.id)}>
                          <Text style={styles.smallButtonText}>{user.premium ? 'Rem. ★' : 'Give ★'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {IS_MOBILE && <MobileNav />}
    </View>
  );
}

// ─── CommunityCompose (separate to avoid hooks-in-conditional issue) ──────────

function CommunityCompose({ authUser, onSubmit }) {
  const [text, setText] = useState('');
  const remaining = MAX_POST_CHARS - text.length;
  const submit = () => {
    if (onSubmit(text)) setText('');
  };
  return (
    <View style={[styles.composeCard, { marginBottom: 14 }]}>
      <View style={styles.composeRow}>
        <Avatar user={authUser} size={32} />
        <TextInput
          style={[styles.composeInput, { flex: 1 }]}
          multiline
          placeholder="Post to this community…"
          placeholderTextColor="#4b5563"
          value={text}
          onChangeText={setText}
          maxLength={MAX_POST_CHARS + 10}
        />
      </View>
      <View style={styles.composeActions}>
        <Text style={[styles.charCount, remaining < 50 && { color: remaining < 0 ? '#ef4444' : '#f59e0b' }]}>{remaining}</Text>
        <TouchableOpacity
          style={[styles.postBtn, (text.trim().length === 0 || remaining < 0) && styles.postBtnDisabled]}
          onPress={submit}
          disabled={text.trim().length === 0 || remaining < 0}
        >
          <Text style={styles.postBtnText}>Post</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Base
  screen:           { flex: 1, backgroundColor: '#080810' },
  authContainer:    { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#080810' },
  content:          { padding: IS_MOBILE ? 10 : 16, backgroundColor: '#080810' },
  appShell:         { flexDirection: 'row', maxWidth: 1280, alignSelf: 'center', width: '100%', gap: 14 },

  // Auth
  authCard:         { backgroundColor: '#0f0f1a', borderRadius: 20, padding: 36, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#1c1c2e' },
  appTitle:         { fontSize: 48, fontWeight: '900', color: '#ffffff', letterSpacing: -2, marginBottom: 4 },
  subtitle:         { color: '#4b4b6b', fontSize: 14, marginBottom: 28 },
  heroBadge:        { alignSelf: 'flex-start', backgroundColor: '#13132a', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 18, borderWidth: 1, borderColor: '#2a2a50' },
  heroBadgeText:    { color: '#6060a0', fontWeight: '700', fontSize: 10, letterSpacing: 1.5 },
  backgroundGlow1:  { position: 'absolute', width: 500, height: 500, borderRadius: 250, backgroundColor: '#4f46e5', top: -200, left: -150, opacity: 0.06 },
  backgroundGlow2:  { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: '#7c3aed', bottom: -100, right: -100, opacity: 0.05 },
  backgroundGlow3:  { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: '#ec4899', top: '35%', right: -60, opacity: 0.04 },

  // Sidebar
  sidebar:          { width: 220, backgroundColor: '#0f0f1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#141428', alignSelf: 'flex-start', minHeight: 600 },
  brand:            { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 24, letterSpacing: -1 },
  navItem:          { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 11, marginBottom: 2 },
  navItemActive:    { backgroundColor: '#16162a' },
  navIcon:          { fontSize: 14, color: '#33334d', width: 18, textAlign: 'center' },
  navIconActive:    { color: '#fff' },
  navText:          { color: '#3d3d5c', fontWeight: '600', fontSize: 13 },
  navTextActive:    { color: '#fff', fontWeight: '700' },
  navBadge:         { position: 'absolute', top: -4, right: -6, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  navBadgeText:     { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Mobile nav
  mobileNav:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0f0f1a', borderTopWidth: 1, borderTopColor: '#1c1c2e', flexDirection: 'row', paddingBottom: Platform.OS === 'ios' ? 20 : 8, paddingTop: 8 },
  mobileNavItem:    { flex: 1, alignItems: 'center' },
  mobileNavIcon:    { fontSize: 20, color: '#33334d' },
  mobileNavIconActive: { color: '#5b4fff' },

  // Layout
  feedColumn:       { flex: 1, minWidth: 0, gap: 10 },
  rightColumn:      { width: 270, gap: 10 },

  // Cards
  card:             { backgroundColor: '#0f0f1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#141428' },
  feedHeader:       { backgroundColor: '#0f0f1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#141428' },
  feedTitle:        { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  feedTabRow:       { flexDirection: 'row', marginTop: 12, borderBottomWidth: 1, borderBottomColor: '#141428' },
  feedTab:          { paddingVertical: 8, paddingHorizontal: 16, marginRight: 4 },
  feedTabActive:    { borderBottomWidth: 2, borderBottomColor: '#5b4fff' },
  feedTabText:      { color: '#33334d', fontWeight: '600', fontSize: 14 },
  feedTabTextActive:{ color: '#fff', fontWeight: '700' },
  composeCard:      { backgroundColor: '#0f0f1a', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1a1a2e' },
  composeRow:       { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  composeInput:     { color: '#fff', fontSize: 15, paddingTop: 4, minHeight: 60 },
  composeActions:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  composeLabel:     { fontSize: 13, fontWeight: '600', color: '#404060', marginBottom: 10 },
  composeImageWrap: { position: 'relative', marginBottom: 8 },
  composeImagePreview: { width: '100%', height: 180, borderRadius: 10, resizeMode: 'cover' },
  removeImageBtn:   { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  removeImageBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  imageAttachBtn:   { padding: 6 },
  imageAttachBtnText: { fontSize: 18 },
  charCount:        { color: '#33334d', fontSize: 12, fontWeight: '600' },
  postBtn:          { backgroundColor: '#5b4fff', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 18 },
  postBtnDisabled:  { backgroundColor: '#2a2a4a' },
  postBtnText:      { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionTitle:     { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 14, letterSpacing: 0.5, textTransform: 'uppercase' },
  divider:          { height: 1, backgroundColor: '#141428' },
  backBtn:          { paddingVertical: 6, paddingHorizontal: 2, marginBottom: 12, alignSelf: 'flex-start' },
  backBtnText:      { color: '#5b4fff', fontWeight: '700', fontSize: 14 },

  // Posts
  postCard:         { backgroundColor: '#0f0f1a', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#141428', marginTop: 8 },
  postHeader:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  postAuthor:       { fontWeight: '700', color: '#fff', fontSize: 14 },
  postText:         { color: '#8080a8', lineHeight: 22, fontSize: 14 },
  postImage:        { width: '100%', height: 220, borderRadius: 10, marginTop: 10 },
  mentionText:      { color: '#5b4fff', fontWeight: '600' },
  deleteBtn:        { padding: 6 },
  deleteBtnText:    { color: '#33334d', fontSize: 14 },
  actionBtn:        { backgroundColor: '#0d0d20', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#1c1c30', flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnActive:  { backgroundColor: '#1a0a2e', borderColor: '#5b4fff' },
  actionBtnText:    { color: '#4b4b6b', fontSize: 13, fontWeight: '600' },
  actionBtnTextActive: { color: '#5b4fff' },
  viewMoreText:     { color: '#5b4fff', fontSize: 12, fontWeight: '600', marginTop: 8 },

  // Inputs
  input:            { borderWidth: 1, borderColor: '#1c1c30', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, backgroundColor: '#080810', color: '#fff', fontSize: 14 },
  postInput:        { borderWidth: 1, borderColor: '#1c1c30', borderRadius: 10, padding: 14, minHeight: 70, backgroundColor: '#080810', color: '#fff', marginBottom: 10, fontSize: 14 },
  commentInput:     { borderWidth: 1, borderColor: '#1c1c30', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#080810', color: '#fff', fontSize: 13, marginBottom: 6 },

  // Buttons
  primaryButton:    { backgroundColor: '#5b4fff', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  primaryButtonText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryButton:  { backgroundColor: 'transparent', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginTop: 4, borderWidth: 1, borderColor: '#1c1c30', alignItems: 'center' },
  secondaryButtonText: { color: '#404060', fontWeight: '600', fontSize: 13 },
  smallButton:      { backgroundColor: '#13132a', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, marginTop: 4, borderWidth: 1, borderColor: '#202040' },
  smallButtonText:  { color: '#8080c0', fontWeight: '600', fontSize: 12 },

  // Auth toggle
  toggleRow:        { flexDirection: 'row', gap: 4, marginBottom: 18, backgroundColor: '#080810', borderRadius: 10, padding: 3, borderWidth: 1, borderColor: '#1c1c30' },
  toggleButton:     { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#5b4fff' },
  toggleText:       { color: '#33334d', fontWeight: '600', fontSize: 13 },
  toggleTextActive: { color: '#fff', fontWeight: '700' },

  // Notices
  notice:           { backgroundColor: '#0d0d20', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e1e40' },
  noticeText:       { color: '#7070b0', fontWeight: '600', fontSize: 13 },
  unreadItem:       { backgroundColor: '#0d0d1f' },
  unreadDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5b4fff' },

  // Avatar
  avatar:           { backgroundColor: '#13132a', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#202040' },
  avatarText:       { fontWeight: '800', color: '#8080c0' },

  // User info
  userRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  userNameText:     { fontWeight: '700', color: '#fff', fontSize: 13 },
  userMetaText:     { color: '#33334d', fontSize: 12 },
  helperText:       { color: '#33334d', fontSize: 12, marginTop: 4 },
  roleBadge:        { backgroundColor: '#13132a', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#202040' },

  // Profile
  profileName:      { fontSize: 18, fontWeight: '800', color: '#fff' },
  profileBio:       { color: '#4b4b6b', marginTop: 6, fontSize: 13, lineHeight: 20 },
  bannedText:       { color: '#ef4444', fontWeight: '700', marginTop: 6, fontSize: 12 },

  // Lists
  listItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#111120' },
  adminRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#111120' },
  adminActions:     { flexDirection: 'column', gap: 4 },
  inlineRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Badges
  verifiedBadge:    { width: 16, height: 16, borderRadius: 8, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  verifiedBadgeText:{ color: '#fff', fontWeight: '900', fontSize: 10, lineHeight: 12 },
  goldBadge:        { width: 16, height: 16, borderRadius: 8, backgroundColor: '#d97706', justifyContent: 'center', alignItems: 'center' },
  goldBadgeText:    { color: '#fff', fontWeight: '900', fontSize: 9, lineHeight: 12 },

  // Comments
  commentBox:       { backgroundColor: '#0b0b16', borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#111120' },
  commentBoxFull:   { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#111120' },
  commentAuthor:    { fontWeight: '700', color: '#c0c0e0', fontSize: 13 },
  commentText:      { color: '#6060a0', fontSize: 13, lineHeight: 20 },

  // Messages
  messageLayout:    { flexDirection: 'row', gap: 10 },
  messageLayoutMobile: { flexDirection: 'column' },
  messageList:      { width: 150, gap: 4 },
  messageRow:       { padding: 10, borderRadius: 10, backgroundColor: '#0b0b16', borderWidth: 1, borderColor: '#111120', marginBottom: 4 },
  sentBubble:       { alignSelf: 'flex-end', backgroundColor: '#5b4fff', padding: 10, borderRadius: 14, borderBottomRightRadius: 3, marginTop: 6, maxWidth: '80%' },
  sentBubbleText:   { color: '#fff', fontSize: 14 },
  receivedBubble:   { alignSelf: 'flex-start', backgroundColor: '#111120', padding: 10, borderRadius: 14, borderBottomLeftRadius: 3, marginTop: 6, maxWidth: '80%', borderWidth: 1, borderColor: '#1c1c30' },
  receivedBubbleText: { color: '#a0a0c0', fontSize: 14 },

  // Profile banner
  profileBanner:           { height: 130, borderRadius: 14, overflow: 'hidden', backgroundColor: '#13132a', position: 'relative' },
  profileBannerImage:      { width: '100%', height: '100%' },
  profileBannerPlaceholder:{ flex: 1, backgroundColor: '#0f0f20' },
  profileAvatarOverlay:    { position: 'absolute', bottom: -34, left: 14 },

  // Settings
  imagePickerRow:          { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  settingsAvatarPreview:   { width: 64, height: 64, borderRadius: 32, backgroundColor: '#13132a', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#5b4fff' },
  bannerPickerWrap:        { marginBottom: 6 },
  settingsBannerPreview:   { width: '100%', height: 88, borderRadius: 10, backgroundColor: '#13132a', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#1c1c30' },
  uploadButton:            { backgroundColor: '#13132a', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 16, borderWidth: 1, borderColor: '#202040' },
  uploadButtonText:        { color: '#8080c0', fontWeight: '600', fontSize: 13 },

  // Premium
  premiumHeader:        { alignItems: 'center', marginBottom: 20, paddingVertical: 28, borderRadius: 14, backgroundColor: '#100d00', borderWidth: 1, borderColor: '#2a1f00' },
  premiumActiveHeader:  { alignItems: 'center', marginBottom: 20, paddingVertical: 28, borderRadius: 14, backgroundColor: '#0f0d00', borderWidth: 1, borderColor: '#a16207' },
  premiumIcon:          { fontSize: 36, marginBottom: 8, color: '#eab308' },
  premiumActiveIcon:    { fontSize: 36, marginBottom: 8, color: '#facc15' },
  premiumTitle:         { fontSize: 24, fontWeight: '900', color: '#fef9c3', letterSpacing: -0.5 },
  premiumActiveTitle:   { fontSize: 24, fontWeight: '900', color: '#fde047', letterSpacing: -0.5 },
  premiumPrice:         { fontSize: 16, fontWeight: '700', color: '#eab308', marginTop: 6 },
  premiumDesc:          { color: '#6b7280', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  premiumPerk:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#1a1800' },
  premiumPerkText:      { color: '#fde047', fontWeight: '600', fontSize: 14 },
  premiumButton:        { backgroundColor: '#ca8a04', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  premiumButtonText:    { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Tags
  tagChip:              { backgroundColor: '#13132a', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12, borderWidth: 1, borderColor: '#202040' },
  tagChipText:          { color: '#8080c0', fontSize: 12, fontWeight: '600' },

  // Castyr feed banner
  castyrBanner:         { borderRadius: 14, backgroundColor: '#090914', borderWidth: 1, borderColor: '#1e1e38', padding: 16 },
  castyrBannerInner:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  castyrBannerLabel:    { color: '#5b4fff', fontWeight: '800', fontSize: 10, letterSpacing: 1.5, marginBottom: 5 },
  castyrBannerTitle:    { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: -0.5, marginBottom: 4 },
  castyrBannerDesc:     { color: '#4b4b6b', fontSize: 12, lineHeight: 17, maxWidth: 240 },
  castyrBannerButton:   { backgroundColor: '#5b4fff', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  castyrBannerButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Castyr sidebar
  castyrSideCard:       { backgroundColor: '#090914', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e1e38' },
  castyrSideLabel:      { color: '#5b4fff', fontWeight: '800', fontSize: 10, letterSpacing: 1.5, marginBottom: 5 },
  castyrSideTitle:      { color: '#fff', fontWeight: '900', fontSize: 15, marginBottom: 5 },
  castyrSideDesc:       { color: '#4b4b6b', fontSize: 12, lineHeight: 16, marginBottom: 12 },
  castyrSideButton:     { backgroundColor: '#5b4fff', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  castyrSideButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
