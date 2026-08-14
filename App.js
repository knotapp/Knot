import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
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

// --- Helpers -----------------------------------------------------------------

function getAvatarLabel(user) {
  const base = user?.display_name || user?.username || 'U';
  return base.split(/\s+/).map((p) => p[0] || '').join('').slice(0, 2).toUpperCase() || 'U';
}

function extractHashtags(content = '') {
  return (content.match(/#[\w-]+/g) || []).map((t) => t.toLowerCase());
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Memoized building blocks ------------------------------------------------

const ComposeCard = memo(function ComposeCard({ onSubmit }) {
  const [text, setText] = useState('');

  const submit = () => {
    if (onSubmit(text)) setText('');
  };

  return (
    <View style={styles.composeCard}>
      <Text style={styles.composeLabel}>What's happening?</Text>
      <TextInput
        style={styles.postInput}
        multiline
        placeholder="Share an update…"
        placeholderTextColor="#6b7280"
        value={text}
        onChangeText={setText}
      />
      <TouchableOpacity style={styles.primaryButton} onPress={submit}>
        <Text style={styles.primaryButtonText}>Publish</Text>
      </TouchableOpacity>
    </View>
  );
});

const FeedPost = memo(function FeedPost({
  post,
  comments,
  users,
  authUser,
  isBookmarked,
  expanded,
  onToggleBookmark,
  onAddComment,
  onViewComments,
}) {
  const [draft, setDraft] = useState('');

  const postComments = useMemo(
    () => comments.filter((c) => c.post_id === post.id),
    [comments, post]
  );

  const visibleComments = expanded ? postComments : postComments.slice(0, 2);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    const ok = await onAddComment(post.id, text);
    if (ok) setDraft('');
  };

  const author = users.find((u) => u.id === post.user_id);

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatarSmall}>
          {author?.profile_image ? (
            <Image source={{ uri: author.profile_image }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{getAvatarLabel(author)}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.inlineRow}>
            <Text style={styles.postAuthor}>{author?.display_name || 'Unknown'}</Text>
            <UserBadges user={author} />
          </View>
          <Text style={styles.userMetaText}>@{author?.username || '?'}</Text>
        </View>
      </View>
      <Text style={styles.postText}>{post.content}</Text>
      <Text style={styles.helperText}>{new Date(post.created_at).toLocaleString()}</Text>
      <View style={styles.inlineRow}>
        <TouchableOpacity style={styles.smallButton} onPress={() => onToggleBookmark(post.id)}>
          <Text style={styles.smallButtonText}>{isBookmarked ? 'Remove bookmark' : 'Bookmark'}</Text>
        </TouchableOpacity>
        {!expanded ? (
          <TouchableOpacity style={styles.smallButton} onPress={() => onViewComments()}>
            <Text style={styles.smallButtonText}>View comments</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {visibleComments.map((comment) => {
        const ca = users.find((u) => u.id === comment.user_id);
        return (
          <View key={comment.id} style={styles.commentBox}>
            <View style={styles.inlineRow}>
              <Text style={styles.userNameText}>{ca?.display_name || '?'}</Text>
              <UserBadges user={ca} />
            </View>
            <Text style={styles.postText}>{comment.text}</Text>
          </View>
        );
      })}
      <TextInput
        style={styles.postInput}
        placeholder="Write a comment"
        placeholderTextColor="#6b7280"
        value={draft}
        onChangeText={setDraft}
      />
      <TouchableOpacity style={styles.smallButton} onPress={submit}>
        <Text style={styles.smallButtonText}>Comment</Text>
      </TouchableOpacity>
    </View>
  );
});

// --- App ---------------------------------------------------------------------

export default function App() {
  const [users, setUsers]               = useState([]);
  const [posts, setPosts]               = useState([]);
  const [comments, setComments]         = useState([]);
  const [bookmarks, setBookmarks]       = useState([]);
  const [follows, setFollows]           = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [directMessages, setDMs]        = useState([]);
  const [communities, setCommunities]   = useState([]);
  const [communityMembers, setCommunityMembers] = useState([]);

  const [authUser, setAuthUser]         = useState(null);
  const [loading, setLoading]           = useState(true);
  const [authMode, setAuthMode]         = useState('signin');
  const [authForm, setAuthForm]         = useState({ username: '', password: '', displayName: '' });
  const [searchQuery, setSearchQuery]   = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [viewMode, setViewMode]         = useState('feed');
  const [settingsForm, setSettingsForm] = useState({ displayName: '', username: '', password: '', profileImage: '', bannerImage: '' });
  const [selectedChatUserId, setSelectedChatUserId] = useState(null);
  const [dmSearch, setDmSearch]         = useState('');

  const PREMIUM_LINK = 'https://buy.stripe.com/test_14AeVf2sG1Ei8jubIj53O00';
  const [feedback, setFeedback]         = useState('Sign in to continue.');

  // --- Load data -----------------------------------------------------------
  // Don't load anything on mount — show auth screen instantly.
  // Data loads only after sign in.
  useEffect(() => { setLoading(false); }, []);

  const loadAllData = async () => {
    const [
      { data: u }, { data: p }, { data: c }, { data: b },
      { data: f }, { data: n }, { data: d }, { data: cm }, { data: cmm },
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('comments').select('*').order('created_at', { ascending: true }),
      supabase.from('bookmarks').select('*'),
      supabase.from('follows').select('*'),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }),
      supabase.from('direct_messages').select('*').order('created_at', { ascending: true }),
      supabase.from('communities').select('*'),
      supabase.from('community_members').select('*'),
    ]);
    setUsers(u || []);
    setPosts(p || []);
    setComments(c || []);
    setBookmarks(b || []);
    setFollows(f || []);
    setNotifications(n || []);
    setDMs(d || []);
    setCommunities(cm || []);
    setCommunityMembers(cmm || []);
  };

  // --- Derived state -------------------------------------------------------
  const selectedProfile = useMemo(() => users.find((u) => u.id === selectedProfileId) || authUser, [users, selectedProfileId, authUser]);

  const visibleUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users.slice(0, 5);
    return users.filter((u) => `${u.username} ${u.display_name}`.toLowerCase().includes(q));
  }, [searchQuery, users]);

  const orderedPosts = useMemo(() => [...posts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [posts]);

  const selectedProfilePosts = useMemo(() =>
    posts.filter((p) => p.user_id === selectedProfile?.id)
         .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  [posts, selectedProfile]);

  const notificationsForUser = useMemo(() =>
    notifications.filter((n) => n.user_id === authUser?.id),
  [notifications, authUser]);

  const bookmarkedPosts = useMemo(() => {
    if (!authUser) return [];
    const ids = new Set(bookmarks.filter((b) => b.user_id === authUser.id).map((b) => b.post_id));
    return posts.filter((p) => ids.has(p.id));
  }, [bookmarks, posts, authUser]);

  const trendingTags = useMemo(() => {
    const counts = new Map();
    posts.forEach((p) => extractHashtags(p.content).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
  }, [posts]);

  const isFollowing = useCallback((userId) =>
    follows.some((f) => f.follower_id === authUser?.id && f.following_id === userId),
  [follows, authUser]);

  const selectedChatUser = useMemo(() => users.find((u) => u.id === selectedChatUserId) || null, [users, selectedChatUserId]);

  const conversationMessages = useMemo(() => {
    if (!authUser || !selectedChatUser) return [];
    return directMessages.filter((m) =>
      (m.sender_id === authUser.id && m.recipient_id === selectedChatUser.id) ||
      (m.sender_id === selectedChatUser.id && m.recipient_id === authUser.id)
    );
  }, [directMessages, authUser, selectedChatUser]);

  const isCommunityMember = (communityId) =>
    communityMembers.some((m) => m.community_id === communityId && m.user_id === authUser?.id);

  const followerCount  = (userId) => follows.filter((f) => f.following_id === userId).length;
  const followingCount = (userId) => follows.filter((f) => f.follower_id  === userId).length;

  // --- Auth ----------------------------------------------------------------
  const handleSignIn = async () => {
    const username = authForm.username.trim().toLowerCase();
    const password = authForm.password.trim();
    if (!username || !password) { setFeedback('Enter your username and password.'); return; }
    setFeedback('Signing in…');
    try {
      const { data: rows, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .limit(1);
      if (error) throw error;
      const data = rows?.[0];
      if (!data) { setFeedback('No matching account. Check your username and password.'); return; }
      if (data.banned) { setFeedback('This account is banned.'); return; }
      setAuthUser(data);
      setSelectedProfileId(data.id);
      setSettingsForm({ displayName: data.display_name, username: data.username, password: data.password, profileImage: data.profile_image || '', bannerImage: data.banner_image || '' });
      setFeedback(`Welcome back, ${data.display_name}!`);
      // Load all app data now in background
      loadAllData().then(() => {
        setSelectedChatUserId((prev) => prev || null);
      });
    } catch (e) {
      setFeedback('Sign in failed. Please try again.');
    }
  };

  const handleSignUp = async () => {
    const username    = authForm.username.trim().toLowerCase();
    const password    = authForm.password.trim();
    const displayName = authForm.displayName.trim() || username;
    if (!username || !password) { setFeedback('Enter a username and password.'); return; }
    setFeedback('Creating account…');
    try {
      const { data: rows } = await supabase.from('users').select('id').eq('username', username).limit(1);
      if (rows?.length > 0) { setFeedback('That username is already taken.'); return; }
      const newUser = { id: `user-${uid()}`, username, password, display_name: displayName, role: 'user', verified: false, banned: false, profile_image: '', bio: 'New to Knot Social.' };
      const { error } = await supabase.from('users').insert(newUser);
      if (error) throw error;
      setUsers((prev) => [newUser, ...prev]);
      setAuthUser(newUser);
      setSelectedProfileId(newUser.id);
      setSettingsForm({ displayName, username, password, profileImage: '', bannerImage: '' });
      setFeedback(`Account created for @${username}.`);
    } catch (e) {
      setFeedback('Sign up failed. Please try again.');
    }
  };

  const handleSignOut = useCallback(() => {
    setAuthUser(null);
    setSelectedChatUserId(null);
    setFeedback('Signed out.');
  }, []);

  const handleUpdateSettings = async () => {
    if (!authUser) return;
    const username    = settingsForm.username.trim().toLowerCase();
    const displayName = settingsForm.displayName.trim();
    const password    = settingsForm.password.trim();
    if (!username || !password || !displayName) { setFeedback('Fill out all fields.'); return; }
    const dup = users.find((u) => u.id !== authUser.id && u.username.toLowerCase() === username);
    if (dup) { setFeedback('Username already in use.'); return; }
    const updates = { username, password, display_name: displayName, profile_image: settingsForm.profileImage.trim(), banner_image: settingsForm.bannerImage.trim() };
    await supabase.from('users').update(updates).eq('id', authUser.id);
    const updated = { ...authUser, ...updates };
    setUsers((prev) => prev.map((u) => u.id === authUser.id ? updated : u));
    setAuthUser(updated);
    setFeedback('Profile updated.');
  };

  const handlePickProfileImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setFeedback('Camera roll permission is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const base64Uri = `data:image/jpeg;base64,${asset.base64}`;
    setSettingsForm((p) => ({ ...p, profileImage: base64Uri }));
    setFeedback('Image selected — tap Save settings to apply.');
  };

  const handlePickBannerImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setFeedback('Camera roll permission is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const base64Uri = `data:image/jpeg;base64,${asset.base64}`;
    setSettingsForm((p) => ({ ...p, bannerImage: base64Uri }));
    setFeedback('Banner selected — tap Save settings to apply.');
  };

  // --- Posts ---------------------------------------------------------------
  const handleCreatePost = useCallback((text) => {
    if (!authUser) return false;
    const content = (text || '').trim();
    if (!content) { setFeedback('Write something before posting.'); return false; }
    const newPost = { id: `post-${uid()}`, user_id: authUser.id, content, created_at: new Date().toISOString() };
    supabase.from('posts').insert(newPost).then(() => {
      setPosts((prev) => [newPost, ...prev]);
      setFeedback('Post published.');
    });
    return true;
  }, [authUser]);

  // --- Comments ------------------------------------------------------------
  const handleAddComment = useCallback(async (postId, text) => {
    if (!authUser) return false;
    const content = (text || '').trim();
    if (!content) { setFeedback('Write a comment first.'); return false; }
    const newComment = { id: `comment-${uid()}`, post_id: postId, user_id: authUser.id, text: content, created_at: new Date().toISOString() };
    await supabase.from('comments').insert(newComment);
    setComments((prev) => [...prev, newComment]);
    const note = { id: `note-${uid()}`, user_id: authUser.id, text: 'You commented on a post.', created_at: new Date().toISOString() };
    await supabase.from('notifications').insert(note);
    setNotifications((prev) => [note, ...prev]);
    setFeedback('Comment posted.');
    return true;
  }, [authUser]);

  // --- Bookmarks -----------------------------------------------------------
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
    setFeedback('Bookmark updated.');
  }, [authUser, bookmarks]);

  // --- Follows -------------------------------------------------------------
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
      const target = users.find((u) => u.id === userId);
      const note = { id: `note-${uid()}`, user_id: userId, text: `${authUser.display_name} followed you.`, created_at: new Date().toISOString() };
      await supabase.from('notifications').insert(note);
      setNotifications((prev) => [note, ...prev]);
    }
    setFeedback(following ? 'Unfollowed.' : 'Followed.');
  };

  // --- Admin ---------------------------------------------------------------
  const toggleBan = async (userId) => {
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'owner')) return;
    const target = users.find((u) => u.id === userId);
    const banned = !target.banned;
    await supabase.from('users').update({ banned }).eq('id', userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, banned } : u));
    setFeedback('Ban state updated.');
  };

  const toggleVerify = async (userId) => {
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'owner')) return;
    const target = users.find((u) => u.id === userId);
    const verified = !target.verified;
    await supabase.from('users').update({ verified }).eq('id', userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, verified } : u));
    setFeedback('Verification updated.');
  };

  // --- Communities ---------------------------------------------------------
  const [newCommunityForm, setNewCommunityForm] = useState({ name: '', description: '' });

  const handleCreateCommunity = async () => {
    if (!authUser) return;
    const name = newCommunityForm.name.trim();
    const description = newCommunityForm.description.trim();
    if (!name) { setFeedback('Give your community a name.'); return; }
    const newCommunity = { id: `community-${uid()}`, name, description, created_at: new Date().toISOString() };
    const { error } = await supabase.from('communities').insert(newCommunity);
    if (error) { setFeedback('Could not create community.'); return; }
    setCommunities((prev) => [...prev, newCommunity]);
    // auto-join as creator
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
      setFeedback('Joined community.');
    }
  };

  // --- DMs -----------------------------------------------------------------
  const handleSendMessage = async () => {
    if (!authUser || !selectedChatUser) return;
    const text = messageDraft.trim();
    if (!text) { setFeedback('Write a message first.'); return; }
    const dm = { id: `dm-${uid()}`, sender_id: authUser.id, recipient_id: selectedChatUser.id, text, created_at: new Date().toISOString() };
    await supabase.from('direct_messages').insert(dm);
    setDMs((prev) => [...prev, dm]);
    const note = { id: `note-${uid()}`, user_id: selectedChatUser.id, text: `${authUser.display_name} sent you a direct message.`, created_at: new Date().toISOString() };
    await supabase.from('notifications').insert(note);
    setNotifications((prev) => [note, ...prev]);
    setMessageDraft('');
    setFeedback('Message sent.');
  };

  const [messageDraft, setMessageDraft] = useState('');

  const hasTag = (content, term) => {
    const n = (term || '').trim().toLowerCase();
    if (!n) return true;
    const tags = extractHashtags(content);
    return tags.includes(n.startsWith('#') ? n : `#${n}`) || content.toLowerCase().includes(n);
  };

  // --- Auth screen ---------------------------------------------------------
  if (!authUser) {
    return (
      <View style={styles.screen}>
        <View style={styles.backgroundGlow1} pointerEvents="none" />
        <View style={styles.backgroundGlow2} pointerEvents="none" />
        <View style={styles.backgroundGlow3} pointerEvents="none" />
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.authCard}>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>✦ Live social hub</Text></View>
            <Text style={styles.appTitle}>Knot</Text>
            <Text style={styles.subtitle}>Connect, post, and grow your community.</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity style={[styles.toggleButton, authMode === 'signin' && styles.toggleButtonActive]} onPress={() => setAuthMode('signin')}>
                <Text style={[styles.toggleText, authMode === 'signin' && styles.toggleTextActive]}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleButton, authMode === 'signup' && styles.toggleButtonActive]} onPress={() => setAuthMode('signup')}>
                <Text style={[styles.toggleText, authMode === 'signup' && styles.toggleTextActive]}>Sign up</Text>
              </TouchableOpacity>
            </View>
            {feedback ? <View style={styles.notice}><Text style={styles.noticeText}>{feedback}</Text></View> : null}
            {authMode === 'signup' ? (
              <TextInput style={styles.input} placeholder="Display name" placeholderTextColor="#6b7280" value={authForm.displayName} onChangeText={(v) => setAuthForm((p) => ({ ...p, displayName: v }))} />
            ) : null}
            <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#6b7280" value={authForm.username} onChangeText={(v) => setAuthForm((p) => ({ ...p, username: v }))} />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#6b7280" secureTextEntry value={authForm.password} onChangeText={(v) => setAuthForm((p) => ({ ...p, password: v }))} />
            <TouchableOpacity style={styles.primaryButton} onPress={authMode === 'signin' ? handleSignIn : handleSignUp}>
              <Text style={styles.primaryButtonText}>{authMode === 'signin' ? '→ Sign in' : '→ Create account'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- Main app ------------------------------------------------------------
  const navItems = [
    { mode: 'feed',          icon: '⌂', label: 'Home' },
    { mode: 'profile',       icon: '◉', label: 'Profile' },
    { mode: 'profiles',      icon: '⊕', label: 'Profiles & follows' },
    { mode: 'notifications', icon: '◎', label: 'Notifications' },
    { mode: 'comments',      icon: '◈', label: 'Comments & replies' },
    { mode: 'hashtags',      icon: '◇', label: 'Search & hashtags' },
    { mode: 'bookmarks',     icon: '◆', label: 'Bookmarks' },
    { mode: 'messages',      icon: '✉', label: 'Direct messages' },
    { mode: 'communities',   icon: '⬡', label: 'Communities' },
    { mode: 'premium',       icon: '★', label: 'Premium' },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.appShell}>

          {/* -- Sidebar -- */}
          <View style={styles.sidebar}>
            <Text style={styles.brand}>Knot</Text>
            {navItems.map(({ mode, icon, label }) => (
              <TouchableOpacity key={mode} style={[styles.navItem, viewMode === mode && styles.navItemActive]}
                onPress={() => { if (mode === 'profile') setSelectedProfileId(authUser.id); setViewMode(mode); setFeedback(''); }}>
                <Text style={[styles.navIcon, viewMode === mode && styles.navIconActive]}>{icon}</Text>
                <Text style={[styles.navText,  viewMode === mode && styles.navTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.primaryButton} onPress={() => setViewMode('feed')}>
              <Text style={styles.primaryButtonText}>✦ Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut}>
              <Text style={styles.secondaryButtonText}>Sign out</Text>
            </TouchableOpacity>
          </View>

          {/* -- Feed column -- */}
          <View style={styles.feedColumn}>

            {/* Settings */}
            {viewMode === 'settings' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Settings</Text>
                <TextInput style={styles.input} placeholder="Display name" placeholderTextColor="#6b7280" value={settingsForm.displayName} onChangeText={(v) => setSettingsForm((p) => ({ ...p, displayName: v }))} />
                <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#6b7280" value={settingsForm.username} onChangeText={(v) => setSettingsForm((p) => ({ ...p, username: v }))} />
                <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#6b7280" secureTextEntry value={settingsForm.password} onChangeText={(v) => setSettingsForm((p) => ({ ...p, password: v }))} />

                {/* Profile image picker */}
                <Text style={[styles.helperText, { marginBottom: 6, marginTop: 4 }]}>Profile image</Text>
                <View style={styles.imagePickerRow}>
                  {settingsForm.profileImage ? (
                    <Image source={{ uri: settingsForm.profileImage }} style={styles.settingsAvatarPreview} />
                  ) : (
                    <View style={styles.settingsAvatarPreview}>
                      <Text style={styles.avatarText}>{getAvatarLabel(authUser)}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.uploadButton} onPress={handlePickProfileImage}>
                    <Text style={styles.uploadButtonText}>⬆ Update image</Text>
                  </TouchableOpacity>
                </View>

                {/* Banner image picker */}
                <Text style={[styles.helperText, { marginBottom: 6, marginTop: 12 }]}>Profile banner</Text>
                <View style={styles.bannerPickerWrap}>
                  {settingsForm.bannerImage ? (
                    <Image source={{ uri: settingsForm.bannerImage }} style={styles.settingsBannerPreview} />
                  ) : (
                    <View style={styles.settingsBannerPreview}>
                      <Text style={styles.helperText}>No banner set</Text>
                    </View>
                  )}
                  <TouchableOpacity style={[styles.uploadButton, { marginTop: 8 }]} onPress={handlePickBannerImage}>
                    <Text style={styles.uploadButtonText}>⬆ Update banner</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.primaryButton, { marginTop: 14 }]} onPress={handleUpdateSettings}>
                  <Text style={styles.primaryButtonText}>Save settings</Text>
                </TouchableOpacity>
                {feedback ? <View style={[styles.notice, { marginTop: 10 }]}><Text style={styles.noticeText}>{feedback}</Text></View> : null}
              </View>
            )}

            {/* Profile */}
            {viewMode === 'profile' && selectedProfile && (
              <View style={styles.card}>
                {/* Banner */}
                <View style={styles.profileBanner}>
                  {selectedProfile.banner_image ? (
                    <Image source={{ uri: selectedProfile.banner_image }} style={styles.profileBannerImage} />
                  ) : (
                    <View style={styles.profileBannerPlaceholder} />
                  )}
                  {/* Avatar overlaid on banner */}
                  <View style={styles.profileAvatarOverlay}>
                    <View style={styles.avatarLarge}>
                      {selectedProfile.profile_image ? (
                        <Image source={{ uri: selectedProfile.profile_image }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarText}>{getAvatarLabel(selectedProfile)}</Text>
                      )}
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: 44, paddingHorizontal: 4 }}>
                  <View style={styles.inlineRow}>
                    <Text style={styles.profileName}>{selectedProfile.display_name}</Text>
                    <UserBadges user={selectedProfile} />
                  </View>
                  <Text style={styles.userMetaText}>@{selectedProfile.username}</Text>
                  <Text style={styles.profileBio}>{selectedProfile.bio}</Text>
                </View>

                <View style={[styles.inlineRow, { marginTop: 10 }]}>
                  <Text style={styles.helperText}>
                    {followerCount(selectedProfile.id)} followers · {followingCount(selectedProfile.id)} following · Role: {selectedProfile.role}
                  </Text>
                  {selectedProfile.id !== authUser.id && (
                    <TouchableOpacity style={styles.smallButton} onPress={() => toggleFollow(selectedProfile.id)}>
                      <Text style={styles.smallButtonText}>{isFollowing(selectedProfile.id) ? 'Unfollow' : 'Follow'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {selectedProfile.banned ? <Text style={styles.bannedText}>Banned</Text> : null}
                <View style={[styles.composeCard, { marginTop: 12 }]}>
                  <Text style={styles.composeLabel}>Posts by {selectedProfile.display_name}</Text>
                  {selectedProfilePosts.length === 0
                    ? <Text style={styles.helperText}>No posts yet.</Text>
                    : selectedProfilePosts.map((post) => (
                        <View key={post.id} style={styles.postCard}>
                          <Text style={styles.postText}>{post.content}</Text>
                          <Text style={styles.helperText}>{new Date(post.created_at).toLocaleString()}</Text>
                        </View>
                      ))
                  }
                </View>
              </View>
            )}

            {/* Profiles & follows */}
            {viewMode === 'profiles' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Profiles & follows</Text>
                {users.map((user) => (
                  <View key={user.id} style={styles.listItem}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.inlineRow}>
                        <Text style={styles.userNameText}>{user.display_name}</Text>
                        <UserBadges user={user} />
                      </View>
                      <Text style={styles.userMetaText}>@{user.username}</Text>
                      <Text style={styles.helperText}>{followerCount(user.id)} followers · {followingCount(user.id)} following</Text>
                    </View>
                    {user.id !== authUser.id && (
                      <TouchableOpacity style={styles.smallButton} onPress={() => toggleFollow(user.id)}>
                        <Text style={styles.smallButtonText}>{isFollowing(user.id) ? 'Unfollow' : 'Follow'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Notifications */}
            {viewMode === 'notifications' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Notifications</Text>
                {notificationsForUser.length === 0
                  ? <Text style={styles.helperText}>You are all caught up.</Text>
                  : notificationsForUser.map((note) => (
                      <View key={note.id} style={styles.listItem}>
                        <Text style={styles.postText}>{note.text}</Text>
                        <Text style={styles.helperText}>{new Date(note.created_at).toLocaleString()}</Text>
                      </View>
                    ))
                }
              </View>
            )}

            {/* Comments */}
            {viewMode === 'comments' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Comments & replies</Text>
                {orderedPosts.map((post) => (
                  <FeedPost
                    key={post.id}
                    post={post}
                    comments={comments}
                    users={users}
                    authUser={authUser}
                    isBookmarked={false}
                    expanded
                    onToggleBookmark={toggleBookmark}
                    onAddComment={handleAddComment}
                    onViewComments={() => setViewMode('comments')}
                  />
                ))}
              </View>
            )}

            {/* Hashtags */}
            {viewMode === 'hashtags' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Search & hashtags</Text>
                <TextInput style={styles.input} placeholder="Search by hashtag or topic" placeholderTextColor="#6b7280" value={searchQuery} onChangeText={setSearchQuery} />
                <Text style={styles.helperText}>Trending: {trendingTags.join(', ')}</Text>
                {posts.filter((p) => hasTag(p.content, searchQuery)).map((post) => (
                  <View key={post.id} style={styles.postCard}>
                    <Text style={styles.postText}>{post.content}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Bookmarks */}
            {viewMode === 'bookmarks' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Bookmarks</Text>
                {bookmarkedPosts.length === 0
                  ? <Text style={styles.helperText}>No saved posts yet.</Text>
                  : bookmarkedPosts.map((post) => (
                      <View key={post.id} style={styles.postCard}>
                        <Text style={styles.postText}>{post.content}</Text>
                        <Text style={styles.helperText}>{new Date(post.created_at).toLocaleString()}</Text>
                      </View>
                    ))
                }
              </View>
            )}

            {/* Messages */}
            {viewMode === 'messages' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Direct messages</Text>
                <View style={styles.messageLayout}>
                  <View style={styles.messageList}>
                    {/* Search box */}
                    <TextInput
                      style={[styles.input, { marginBottom: 8, minHeight: undefined }]}
                      placeholder="Search username…"
                      placeholderTextColor="#6b7280"
                      value={dmSearch}
                      onChangeText={setDmSearch}
                    />
                    {users
                      .filter((u) => {
                        if (u.id === authUser.id) return false;
                        if (!dmSearch.trim()) return true;
                        return u.username.toLowerCase().includes(dmSearch.trim().toLowerCase()) ||
                               u.display_name.toLowerCase().includes(dmSearch.trim().toLowerCase());
                      })
                      .map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        style={[styles.messageRow, selectedChatUserId === user.id && { borderColor: '#5b21b6' }]}
                        onPress={() => { setSelectedChatUserId(user.id); setDmSearch(''); }}
                      >
                        <View style={styles.inlineRow}>
                          <Text style={styles.userNameText}>{user.display_name}</Text>
                          <UserBadges user={user} />
                        </View>
                        <Text style={styles.userMetaText}>@{user.username}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.helperText}>Chat with @{selectedChatUser?.username || '—'}</Text>
                    {conversationMessages.map((msg) => (
                      <View key={msg.id} style={msg.sender_id === authUser.id ? styles.sentBubble : styles.receivedBubble}>
                        <Text style={msg.sender_id === authUser.id ? styles.sentBubbleText : styles.receivedBubbleText}>{msg.text}</Text>
                      </View>
                    ))}
                    <TextInput style={styles.postInput} placeholder="Write a private message" placeholderTextColor="#6b7280" value={messageDraft} onChangeText={setMessageDraft} />
                    <TouchableOpacity style={styles.primaryButton} onPress={handleSendMessage}>
                      <Text style={styles.primaryButtonText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Communities */}
            {viewMode === 'communities' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Communities</Text>

                {/* Create community form */}
                <View style={styles.composeCard}>
                  <Text style={styles.composeLabel}>✦ Create a community</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Community name"
                    placeholderTextColor="#6b7280"
                    value={newCommunityForm.name}
                    onChangeText={(v) => setNewCommunityForm((p) => ({ ...p, name: v }))}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Description (optional)"
                    placeholderTextColor="#6b7280"
                    value={newCommunityForm.description}
                    onChangeText={(v) => setNewCommunityForm((p) => ({ ...p, description: v }))}
                  />
                  <TouchableOpacity style={styles.primaryButton} onPress={handleCreateCommunity}>
                    <Text style={styles.primaryButtonText}>Create</Text>
                  </TouchableOpacity>
                </View>

                {communities.map((community) => (
                  <View key={community.id} style={styles.postCard}>
                    <View style={styles.inlineRow}>
                      <Text style={styles.userNameText}>{community.name}</Text>
                      <Text style={styles.helperText}>{communityMembers.filter((m) => m.community_id === community.id).length} members</Text>
                    </View>
                    <Text style={styles.postText}>{community.description}</Text>
                    <TouchableOpacity style={styles.smallButton} onPress={() => toggleJoinCommunity(community.id)}>
                      <Text style={styles.smallButtonText}>{isCommunityMember(community.id) ? 'Leave' : 'Join'}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
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
                    <View style={styles.premiumPerk}>
                      <Text style={styles.premiumPerkText}>✦  Gold badge next to your name</Text>
                    </View>
                    <View style={styles.premiumPerk}>
                      <Text style={styles.premiumPerkText}>✦  Premium supporter status</Text>
                    </View>
                    <View style={styles.premiumPerk}>
                      <Text style={styles.premiumPerkText}>✦  Priority community features</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.premiumHeader}>
                      <Text style={styles.premiumIcon}>★</Text>
                      <Text style={styles.premiumTitle}>Knot Premium</Text>
                      <Text style={styles.premiumPrice}>$4.99 / month</Text>
                    </View>
                    <Text style={styles.premiumDesc}>Support Knot and stand out with a gold badge next to your name everywhere on the platform.</Text>
                    <View style={styles.premiumPerk}>
                      <Text style={styles.premiumPerkText}>✦  Gold badge next to your name</Text>
                    </View>
                    <View style={styles.premiumPerk}>
                      <Text style={styles.premiumPerkText}>✦  Premium supporter status</Text>
                    </View>
                    <View style={styles.premiumPerk}>
                      <Text style={styles.premiumPerkText}>✦  Priority community features</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.premiumButton}
                      onPress={() => {
                        if (typeof window !== 'undefined') {
                          window.open(PREMIUM_LINK + '?client_reference_id=' + authUser.id, '_blank');
                        }
                      }}
                    >
                      <Text style={styles.premiumButtonText}>★ Subscribe for $4.99/mo</Text>
                    </TouchableOpacity>
                    <Text style={styles.helperText}>After payment your gold badge will activate automatically. Billed monthly, cancel anytime.</Text>
                  </>
                )}
              </View>
            )}

            {/* Feed (default) */}
            {viewMode === 'feed' && (
              <>
                <View style={styles.feedHeader}>
                  <Text style={styles.feedTitle}>Home</Text>
                  <Text style={styles.feedSubtitle}>Your live social hub — what's happening right now.</Text>
                </View>

                {/* Castyr promo banner */}
                <TouchableOpacity
                  style={styles.castyrBanner}
                  onPress={() => Linking.openURL('https://castyr.live')}
                  activeOpacity={0.85}
                >
                  <View style={styles.castyrBannerInner}>
                    <View>
                      <Text style={styles.castyrBannerLabel}>✦ Sponsored</Text>
                      <Text style={styles.castyrBannerTitle}>🎙 Castyr.live</Text>
                      <Text style={styles.castyrBannerDesc}>Record, host, and share your podcast in minutes. Try Castyr free.</Text>
                    </View>
                    <View style={styles.castyrBannerButton}>
                      <Text style={styles.castyrBannerButtonText}>Visit →</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {feedback ? <View style={styles.notice}><Text style={styles.noticeText}>{feedback}</Text></View> : null}

                <ComposeCard onSubmit={handleCreatePost} />

                {orderedPosts.map((post) => {
                  const isBookmarked = bookmarks.some((b) => b.user_id === authUser.id && b.post_id === post.id);
                  return (
                    <FeedPost
                      key={post.id}
                      post={post}
                      comments={comments}
                      users={users}
                      authUser={authUser}
                      isBookmarked={isBookmarked}
                      expanded={false}
                      onToggleBookmark={toggleBookmark}
                      onAddComment={handleAddComment}
                      onViewComments={() => setViewMode('comments')}
                    />
                  );
                })}
              </>
            )}

          </View>
          {/* end feedColumn */}

          {/* -- Right column -- */}
          <View style={styles.rightColumn}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Search users</Text>
              <TextInput style={styles.input} placeholder="Try knot" placeholderTextColor="#6b7280" value={searchQuery} onChangeText={setSearchQuery} />
              {visibleUsers.map((user) => (
                <TouchableOpacity key={user.id} style={styles.userRow} onPress={() => { setSelectedProfileId(user.id); setSearchQuery(user.username); setViewMode('profile'); }}>
                  <View style={styles.avatarSmall}>
                    {user.profile_image
                      ? <Image source={{ uri: user.profile_image }} style={styles.avatarImage} />
                      : <Text style={styles.avatarText}>{getAvatarLabel(user)}</Text>
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.inlineRow}>
                      <Text style={styles.userNameText}>{user.display_name}</Text>
                      <UserBadges user={user} />
                    </View>
                    <Text style={styles.userMetaText}>@{user.username}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Quick stats</Text>
              <Text style={styles.helperText}>Followers: {followerCount(authUser.id)}</Text>
              <Text style={styles.helperText}>Following: {followingCount(authUser.id)}</Text>
              <Text style={styles.helperText}>Bookmarks: {bookmarkedPosts.length}</Text>
              <Text style={styles.helperText}>DMs: {directMessages.filter((m) => m.sender_id === authUser.id || m.recipient_id === authUser.id).length}</Text>
            </View>

            {/* Castyr sidebar promo */}
            <TouchableOpacity
              style={styles.castyrSideCard}
              onPress={() => Linking.openURL('https://castyr.live')}
              activeOpacity={0.85}
            >
              <Text style={styles.castyrSideLabel}>✦ Sponsored</Text>
              <Text style={styles.castyrSideTitle}>🎙 Castyr.live</Text>
              <Text style={styles.castyrSideDesc}>Your podcast, live in minutes. Record, host & share for free.</Text>
              <View style={styles.castyrSideButton}>
                <Text style={styles.castyrSideButtonText}>Try Castyr free →</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setViewMode('settings')}>
              <Text style={styles.secondaryButtonText}>⚙ Settings</Text>
            </TouchableOpacity>

            {(authUser.role === 'admin' || authUser.role === 'owner') && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Admin controls</Text>
                {users.map((user) => (
                  <View key={user.id} style={styles.adminRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.inlineRow}>
                        <Text style={styles.userNameText}>{user.display_name}</Text>
                        <UserBadges user={user} />
                      </View>
                      <Text style={styles.userMetaText}>@{user.username}</Text>
                      {user.banned ? <Text style={styles.bannedText}>Banned</Text> : null}
                    </View>
                    <View style={styles.adminActions}>
                      <TouchableOpacity style={styles.smallButton} onPress={() => toggleBan(user.id)}>
                        <Text style={styles.smallButtonText}>{user.banned ? 'Unban' : 'Ban'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smallButton} onPress={() => toggleVerify(user.id)}>
                        <Text style={styles.smallButtonText}>{user.verified ? 'Unverify' : 'Verify'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
          {/* end rightColumn */}

        </View>
      </ScrollView>
    </View>
  );
}

// --- VerifiedBadge ------------------------------------------------------------
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
  return (
    <>
      {user?.verified ? <VerifiedBadge /> : null}
      {user?.premium ? <GoldBadge /> : null}
    </>
  );
}

// --- Styles -------------------------------------------------------------------
const styles = StyleSheet.create({
  screen:           { flex: 1, backgroundColor: '#0d0d14' },
  authContainer:    { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#0d0d14' },
  content:          { padding: 16, backgroundColor: '#0d0d14' },
  appShell:         { flexDirection: 'row', maxWidth: 1300, alignSelf: 'center', width: '100%', gap: 16 },
  authCard:         { backgroundColor: '#13131f', borderRadius: 28, padding: 32, width: '100%', maxWidth: 420, borderWidth: 1, borderColor: '#2a2a40', shadowColor: '#7c3aed', shadowOpacity: 0.18, shadowRadius: 40, shadowOffset: { width: 0, height: 16 }, elevation: 10 },
  appTitle:         { fontSize: 44, fontWeight: '800', color: '#f0e6ff', letterSpacing: -1.5, marginBottom: 6 },
  subtitle:         { color: '#7c7c9a', fontSize: 14, marginBottom: 22 },
  heroBadge:        { alignSelf: 'flex-start', backgroundColor: '#1e1030', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 14, borderWidth: 1, borderColor: '#5b21b6' },
  heroBadgeText:    { color: '#a78bfa', fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
  backgroundGlow1:  { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: '#7c3aed', top: -140, left: -100, opacity: 0.12 },
  backgroundGlow2:  { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#2563eb', bottom: -80, right: -60, opacity: 0.1 },
  backgroundGlow3:  { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#ec4899', top: '40%', right: -40, opacity: 0.06 },
  sidebar:          { width: 230, backgroundColor: '#13131f', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#1e1e30', alignSelf: 'flex-start', minHeight: 580 },
  brand:            { fontSize: 28, fontWeight: '900', color: '#c4b5fd', marginBottom: 22, letterSpacing: -1 },
  navItem:          { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4 },
  navItemActive:    { backgroundColor: '#1e1030', borderWidth: 1, borderColor: '#5b21b6' },
  navIcon:          { fontSize: 15, color: '#55556b', width: 18, textAlign: 'center' },
  navIconActive:    { color: '#a78bfa' },
  navText:          { color: '#6b6b82', fontWeight: '600', fontSize: 13 },
  navTextActive:    { color: '#c4b5fd', fontWeight: '700' },
  feedColumn:       { flex: 1, minWidth: 320, gap: 12 },
  rightColumn:      { width: 280, gap: 12 },
  card:             { backgroundColor: '#13131f', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#1e1e30' },
  feedHeader:       { backgroundColor: '#13131f', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#1e1e30' },
  feedTitle:        { fontSize: 22, fontWeight: '800', color: '#e8e0ff', letterSpacing: -0.5 },
  feedSubtitle:     { color: '#55556b', marginTop: 4, fontSize: 13 },
  composeCard:      { backgroundColor: '#13131f', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#2a1f4a' },
  composeLabel:     { fontSize: 15, fontWeight: '700', color: '#c4b5fd', marginBottom: 10 },
  sectionTitle:     { fontSize: 15, fontWeight: '800', color: '#e8e0ff', marginBottom: 12, letterSpacing: -0.3 },
  postCard:         { backgroundColor: '#13131f', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#1e1e30', marginTop: 10 },
  postHeader:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  postAuthor:       { fontWeight: '700', color: '#e8e0ff', fontSize: 14 },
  postText:         { color: '#b0b0c8', lineHeight: 22, fontSize: 14 },
  input:            { borderWidth: 1, borderColor: '#2a2a40', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 10, backgroundColor: '#0d0d14', color: '#e8e0ff', fontSize: 14 },
  postInput:        { borderWidth: 1, borderColor: '#2a2a40', borderRadius: 12, padding: 14, minHeight: 90, backgroundColor: '#0d0d14', color: '#e8e0ff', marginBottom: 10, fontSize: 14 },
  primaryButton:    { backgroundColor: '#7c3aed', borderRadius: 999, paddingVertical: 13, alignItems: 'center', marginTop: 6, shadowColor: '#7c3aed', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  primaryButtonText:{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  secondaryButton:  { backgroundColor: 'transparent', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, marginTop: 4, borderWidth: 1, borderColor: '#2a2a40', alignItems: 'center' },
  secondaryButtonText: { color: '#7c7c9a', fontWeight: '700', fontSize: 13 },
  smallButton:      { backgroundColor: '#1a1030', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, marginTop: 4, borderWidth: 1, borderColor: '#3b1d8a' },
  smallButtonText:  { color: '#a78bfa', fontWeight: '700', fontSize: 12 },
  toggleRow:        { flexDirection: 'row', gap: 6, marginBottom: 14, backgroundColor: '#0d0d14', borderRadius: 999, padding: 4, borderWidth: 1, borderColor: '#2a2a40' },
  toggleButton:     { flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#7c3aed', shadowColor: '#7c3aed', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  toggleText:       { color: '#55556b', fontWeight: '600', fontSize: 13 },
  toggleTextActive: { color: '#fff', fontWeight: '800' },
  notice:           { backgroundColor: '#1a0f2e', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#4c1d95' },
  noticeText:       { color: '#a78bfa', fontWeight: '600', fontSize: 13 },
  avatarSmall:      { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1e1030', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: '#5b21b6' },
  avatarLarge:      { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1e1030', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#7c3aed' },
  avatarImage:      { width: '100%', height: '100%' },
  avatarText:       { fontWeight: '800', color: '#a78bfa', fontSize: 15 },
  userRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  userNameText:     { fontWeight: '700', color: '#e8e0ff', fontSize: 13 },
  userMetaText:     { color: '#55556b', fontSize: 12 },
  helperText:       { color: '#55556b', fontSize: 12, marginTop: 4 },
  profileHeader:    { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  profileName:      { fontSize: 18, fontWeight: '800', color: '#e8e0ff' },
  profileBio:       { color: '#7c7c9a', marginTop: 4, fontSize: 13 },
  bannedText:       { color: '#f87171', fontWeight: '700', marginTop: 6, fontSize: 12 },
  listItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1a1a28' },
  adminRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1a1a28' },
  adminActions:     { flexDirection: 'column', gap: 4 },
  inlineRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeChip:        { backgroundColor: '#1e1030', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#5b21b6' },
  badgeChipText:    { color: '#a78bfa', fontWeight: '700', fontSize: 11 },
  verifiedBadge:    { width: 18, height: 18, borderRadius: 9, backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center' },
  verifiedBadgeText:{ color: '#fff', fontWeight: '900', fontSize: 11, lineHeight: 13 },
  goldBadge:        { width: 18, height: 18, borderRadius: 9, backgroundColor: '#b45309', justifyContent: 'center', alignItems: 'center' },
  goldBadgeText:    { color: '#fef3c7', fontWeight: '900', fontSize: 10, lineHeight: 13 },
  premiumHeader:    { alignItems: 'center', marginBottom: 20, paddingVertical: 24, borderRadius: 20, backgroundColor: '#1a0f00', borderWidth: 1, borderColor: '#92400e' },
  premiumActiveHeader: { alignItems: 'center', marginBottom: 20, paddingVertical: 24, borderRadius: 20, backgroundColor: '#1a1200', borderWidth: 1, borderColor: '#d97706' },
  premiumIcon:      { fontSize: 40, marginBottom: 8, color: '#f59e0b' },
  premiumActiveIcon:{ fontSize: 40, marginBottom: 8, color: '#fbbf24' },
  premiumTitle:     { fontSize: 26, fontWeight: '900', color: '#fef3c7', letterSpacing: -0.5 },
  premiumActiveTitle:{ fontSize: 26, fontWeight: '900', color: '#fcd34d', letterSpacing: -0.5 },
  premiumPrice:     { fontSize: 18, fontWeight: '700', color: '#f59e0b', marginTop: 6 },
  premiumDesc:      { color: '#9ca3af', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  premiumPerk:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1f1f00' },
  premiumPerkText:  { color: '#fcd34d', fontWeight: '600', fontSize: 14 },
  premiumButton:    { backgroundColor: '#d97706', borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 20, shadowColor: '#f59e0b', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
  premiumButtonText:{ color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
  commentBox:       { backgroundColor: '#0f0f1a', borderRadius: 12, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#1e1e30' },
  messageLayout:    { flexDirection: 'row', gap: 12 },
  messageList:      { width: 148, gap: 6 },
  messageRow:       { padding: 10, borderRadius: 12, backgroundColor: '#0f0f1a', borderWidth: 1, borderColor: '#1e1e30' },
  sentBubble:       { alignSelf: 'flex-end', backgroundColor: '#7c3aed', padding: 10, borderRadius: 16, borderBottomRightRadius: 4, marginTop: 8, maxWidth: '75%', shadowColor: '#7c3aed', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  sentBubbleText:   { color: '#fff', fontSize: 14 },
  receivedBubble:   { alignSelf: 'flex-start', backgroundColor: '#1a1a2e', padding: 10, borderRadius: 16, borderBottomLeftRadius: 4, marginTop: 8, maxWidth: '75%', borderWidth: 1, borderColor: '#2a2a40' },
  receivedBubbleText: { color: '#c4b5fd', fontSize: 14 },

  // --- Profile banner ---
  profileBanner:           { height: 140, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1a1030', marginBottom: 0, position: 'relative' },
  profileBannerImage:      { width: '100%', height: '100%' },
  profileBannerPlaceholder:{ flex: 1, backgroundColor: '#1e1030' },
  profileAvatarOverlay:    { position: 'absolute', bottom: -32, left: 16 },

  // --- Settings image pickers ---
  imagePickerRow:          { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  settingsAvatarPreview:   { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1e1030', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#7c3aed' },
  bannerPickerWrap:        { marginBottom: 6 },
  settingsBannerPreview:   { width: '100%', height: 90, borderRadius: 12, backgroundColor: '#1e1030', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a40' },
  uploadButton:            { backgroundColor: '#1a1030', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, borderWidth: 1, borderColor: '#5b21b6' },
  uploadButtonText:        { color: '#a78bfa', fontWeight: '700', fontSize: 13 },

  // --- Castyr feed banner ---
  castyrBanner:            { borderRadius: 20, overflow: 'hidden', backgroundColor: '#0e0a1f', borderWidth: 1, borderColor: '#4f36a0', padding: 18 },
  castyrBannerInner:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  castyrBannerLabel:       { color: '#7c5cbf', fontWeight: '700', fontSize: 11, marginBottom: 4 },
  castyrBannerTitle:       { color: '#e8e0ff', fontWeight: '900', fontSize: 20, letterSpacing: -0.5, marginBottom: 4 },
  castyrBannerDesc:        { color: '#9b8ec4', fontSize: 13, lineHeight: 18, maxWidth: 260 },
  castyrBannerButton:      { backgroundColor: '#7c3aed', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18, shadowColor: '#7c3aed', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  castyrBannerButtonText:  { color: '#fff', fontWeight: '800', fontSize: 14 },

  // --- Castyr sidebar card ---
  castyrSideCard:          { backgroundColor: '#0e0a1f', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#4f36a0' },
  castyrSideLabel:         { color: '#7c5cbf', fontWeight: '700', fontSize: 11, marginBottom: 4 },
  castyrSideTitle:         { color: '#e8e0ff', fontWeight: '900', fontSize: 17, marginBottom: 6 },
  castyrSideDesc:          { color: '#9b8ec4', fontSize: 12, lineHeight: 17, marginBottom: 12 },
  castyrSideButton:        { backgroundColor: '#7c3aed', borderRadius: 999, paddingVertical: 9, alignItems: 'center', shadowColor: '#7c3aed', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  castyrSideButtonText:    { color: '#fff', fontWeight: '800', fontSize: 13 },
});
