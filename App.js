import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from './supabase';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── App ─────────────────────────────────────────────────────────────────────

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
  const [postText, setPostText]         = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [settingsForm, setSettingsForm] = useState({ displayName: '', username: '', password: '', profileImage: '' });
  const [messageDraft, setMessageDraft] = useState('');
  const [selectedChatUserId, setSelectedChatUserId] = useState(null);
  const [feedback, setFeedback]         = useState('Sign in to continue.');

  // ─── Load all data on mount ───────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const [
        { data: u }, { data: p }, { data: c }, { data: b },
        { data: f }, { data: n }, { data: d }, { data: cm }, { data: cmm },
      ] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('posts').select('*').order('created_at', { ascending: false }),
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
      setLoading(false);
    }
    loadAll();
  }, []);

  // ─── Derived state ───────────────────────────────────────────────────────
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

  // ─── Auth ────────────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    const username = authForm.username.trim().toLowerCase();
    const password = authForm.password.trim();
    const { data, error } = await supabase.from('users').select('*').eq('username', username).eq('password', password).single();
    if (error || !data) { setFeedback('No matching account. Check username and password.'); return; }
    if (data.banned)    { setFeedback('This account is banned.'); return; }
    setAuthUser(data);
    setSelectedProfileId(data.id);
    setSelectedChatUserId(users.find((u) => u.id !== data.id)?.id || null);
    setSettingsForm({ displayName: data.display_name, username: data.username, password: data.password, profileImage: data.profile_image });
    setFeedback(`Welcome back, ${data.display_name}!`);
  };

  const handleSignUp = async () => {
    const username    = authForm.username.trim().toLowerCase();
    const password    = authForm.password.trim();
    const displayName = authForm.displayName.trim() || username;
    if (!username || !password) { setFeedback('Enter a username and password.'); return; }
    const { data: existing } = await supabase.from('users').select('id').eq('username', username).single();
    if (existing) { setFeedback('That username is already taken.'); return; }
    const newUser = { id: `user-${uid()}`, username, password, display_name: displayName, role: 'user', verified: false, banned: false, profile_image: '', bio: 'New to Knot Social.' };
    const { error } = await supabase.from('users').insert(newUser);
    if (error) { setFeedback('Sign up failed. Try again.'); return; }
    setUsers((prev) => [newUser, ...prev]);
    setAuthUser(newUser);
    setSelectedProfileId(newUser.id);
    setSettingsForm({ displayName, username, password, profileImage: '' });
    setFeedback(`Account created for @${username}.`);
  };

  const handleSignOut = () => { setAuthUser(null); setFeedback('Signed out.'); };

  const handleUpdateSettings = async () => {
    if (!authUser) return;
    const username    = settingsForm.username.trim().toLowerCase();
    const displayName = settingsForm.displayName.trim();
    const password    = settingsForm.password.trim();
    if (!username || !password || !displayName) { setFeedback('Fill out all fields.'); return; }
    const dup = users.find((u) => u.id !== authUser.id && u.username.toLowerCase() === username);
    if (dup) { setFeedback('Username already in use.'); return; }
    const updates = { username, password, display_name: displayName, profile_image: settingsForm.profileImage.trim() };
    await supabase.from('users').update(updates).eq('id', authUser.id);
    const updated = { ...authUser, ...updates };
    setUsers((prev) => prev.map((u) => u.id === authUser.id ? updated : u));
    setAuthUser(updated);
    setFeedback('Profile updated.');
  };

  // ─── Posts ───────────────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!authUser) return;
    const text = postText.trim();
    if (!text) { setFeedback('Write something before posting.'); return; }
    const newPost = { id: `post-${uid()}`, user_id: authUser.id, content: text, created_at: new Date().toISOString() };
    await supabase.from('posts').insert(newPost);
    setPosts((prev) => [newPost, ...prev]);
    setPostText('');
    setFeedback('Post published.');
  };

  // ─── Comments ────────────────────────────────────────────────────────────
  const handleAddComment = async (postId) => {
    if (!authUser) return;
    const text = (commentDrafts[postId] || '').trim();
    if (!text) { setFeedback('Write a comment first.'); return; }
    const newComment = { id: `comment-${uid()}`, post_id: postId, user_id: authUser.id, text, created_at: new Date().toISOString() };
    await supabase.from('comments').insert(newComment);
    setComments((prev) => [...prev, newComment]);
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    const note = { id: `note-${uid()}`, user_id: authUser.id, text: 'You commented on a post.', created_at: new Date().toISOString() };
    await supabase.from('notifications').insert(note);
    setNotifications((prev) => [note, ...prev]);
    setFeedback('Comment posted.');
  };

  // ─── Bookmarks ───────────────────────────────────────────────────────────
  const toggleBookmark = async (postId) => {
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
  };

  // ─── Follows ─────────────────────────────────────────────────────────────
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

  // ─── Admin ───────────────────────────────────────────────────────────────
  const toggleBan = async (userId) => {
    if (!authUser || authUser.role !== 'admin') return;
    const target = users.find((u) => u.id === userId);
    const banned = !target.banned;
    await supabase.from('users').update({ banned }).eq('id', userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, banned } : u));
    setFeedback('Ban state updated.');
  };

  const toggleVerify = async (userId) => {
    if (!authUser || authUser.role !== 'admin') return;
    const target = users.find((u) => u.id === userId);
    const verified = !target.verified;
    await supabase.from('users').update({ verified }).eq('id', userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, verified } : u));
    setFeedback('Verification updated.');
  };

  // ─── Communities ─────────────────────────────────────────────────────────
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

  // ─── DMs ─────────────────────────────────────────────────────────────────
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

  const hasTag = (content, term) => {
    const n = (term || '').trim().toLowerCase();
    if (!n) return true;
    const tags = extractHashtags(content);
    return tags.includes(n.startsWith('#') ? n : `#${n}`) || content.toLowerCase().includes(n);
  };

  // ─── Loading screen ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#a78bfa', fontSize: 18, fontWeight: '700' }}>Loading…</Text>
      </View>
    );
  }

  // ─── Auth screen ─────────────────────────────────────────────────────────
  if (!authUser) {
    return (
      <View style={styles.screen}>
        <View style={styles.backgroundGlow1} />
        <View style={styles.backgroundGlow2} />
        <View style={styles.backgroundGlow3} />
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.authContainer}>
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

  // ─── Main app ────────────────────────────────────────────────────────────
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
  ];

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.appShell}>

          {/* ── Sidebar ── */}
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

          {/* ── Feed column ── */}
          <View style={styles.feedColumn}>

            {/* Settings */}
            {viewMode === 'settings' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Settings</Text>
                <TextInput style={styles.input} placeholder="Display name" placeholderTextColor="#6b7280" value={settingsForm.displayName} onChangeText={(v) => setSettingsForm((p) => ({ ...p, displayName: v }))} />
                <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#6b7280" value={settingsForm.username} onChangeText={(v) => setSettingsForm((p) => ({ ...p, username: v }))} />
                <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#6b7280" secureTextEntry value={settingsForm.password} onChangeText={(v) => setSettingsForm((p) => ({ ...p, password: v }))} />
                <TextInput style={styles.input} placeholder="Profile image URL" placeholderTextColor="#6b7280" value={settingsForm.profileImage} onChangeText={(v) => setSettingsForm((p) => ({ ...p, profileImage: v }))} />
                <TouchableOpacity style={styles.primaryButton} onPress={handleUpdateSettings}>
                  <Text style={styles.primaryButtonText}>Save settings</Text>
                </TouchableOpacity>
                {feedback ? <View style={[styles.notice, { marginTop: 10 }]}><Text style={styles.noticeText}>{feedback}</Text></View> : null}
              </View>
            )}

            {/* Profile */}
            {viewMode === 'profile' && selectedProfile && (
              <View style={styles.card}>
                <View style={styles.profileHeader}>
                  <View style={styles.avatarLarge}>
                    {selectedProfile.profile_image ? (
                      <Image source={{ uri: selectedProfile.profile_image }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{getAvatarLabel(selectedProfile)}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.inlineRow}>
                      <Text style={styles.profileName}>{selectedProfile.display_name}</Text>
                      {selectedProfile.verified ? <VerifiedBadge /> : null}
                    </View>
                    <Text style={styles.userMetaText}>@{selectedProfile.username}</Text>
                    <Text style={styles.profileBio}>{selectedProfile.bio}</Text>
                  </View>
                </View>
                <View style={styles.inlineRow}>
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
                        {user.verified ? <VerifiedBadge /> : null}
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
                {orderedPosts.map((post) => {
                  const postComments = comments.filter((c) => c.post_id === post.id);
                  return (
                    <View key={post.id} style={styles.postCard}>
                      <Text style={styles.postText}>{post.content}</Text>
                      <Text style={styles.helperText}>{new Date(post.created_at).toLocaleString()}</Text>
                      {postComments.map((comment) => {
                        const author = users.find((u) => u.id === comment.user_id);
                        return (
                          <View key={comment.id} style={styles.commentBox}>
                            <View style={styles.inlineRow}>
                              <Text style={styles.userNameText}>{author?.display_name || '?'}</Text>
                              {author?.verified ? <VerifiedBadge /> : null}
                            </View>
                            <Text style={styles.postText}>{comment.text}</Text>
                          </View>
                        );
                      })}
                      <TextInput style={styles.postInput} placeholder="Reply…" placeholderTextColor="#6b7280" value={commentDrafts[post.id] || ''} onChangeText={(v) => setCommentDrafts((p) => ({ ...p, [post.id]: v }))} />
                      <TouchableOpacity style={styles.smallButton} onPress={() => handleAddComment(post.id)}>
                        <Text style={styles.smallButtonText}>Comment</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
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
                    {users.filter((u) => u.id !== authUser.id).map((user) => (
                      <TouchableOpacity key={user.id} style={[styles.messageRow, selectedChatUserId === user.id && { borderColor: '#5b21b6' }]} onPress={() => setSelectedChatUserId(user.id)}>
                        <Text style={styles.userNameText}>{user.display_name}</Text>
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

            {/* Feed (default) */}
            {viewMode === 'feed' && (
              <>
                <View style={styles.feedHeader}>
                  <Text style={styles.feedTitle}>Home</Text>
                  <Text style={styles.feedSubtitle}>Your live social feed — what's happening right now.</Text>
                </View>

                {feedback ? <View style={styles.notice}><Text style={styles.noticeText}>{feedback}</Text></View> : null}

                <View style={styles.composeCard}>
                  <Text style={styles.composeLabel}>What's happening?</Text>
                  <TextInput style={styles.postInput} multiline placeholder="Share an update…" placeholderTextColor="#6b7280" value={postText} onChangeText={setPostText} />
                  <TouchableOpacity style={styles.primaryButton} onPress={handleCreatePost}>
                    <Text style={styles.primaryButtonText}>Publish</Text>
                  </TouchableOpacity>
                </View>

                {orderedPosts.map((post) => {
                  const author      = users.find((u) => u.id === post.user_id);
                  const isBookmarked = bookmarks.some((b) => b.user_id === authUser.id && b.post_id === post.id);
                  const postComments = comments.filter((c) => c.post_id === post.id);
                  return (
                    <View key={post.id} style={styles.postCard}>
                      <View style={styles.postHeader}>
                        <View style={styles.avatarSmall}>
                          {author?.profile_image
                            ? <Image source={{ uri: author.profile_image }} style={styles.avatarImage} />
                            : <Text style={styles.avatarText}>{getAvatarLabel(author)}</Text>
                          }
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.inlineRow}>
                            <Text style={styles.postAuthor}>{author?.display_name || 'Unknown'}</Text>
                            {author?.verified ? <VerifiedBadge /> : null}
                          </View>
                          <Text style={styles.userMetaText}>@{author?.username || '?'}</Text>
                        </View>
                      </View>
                      <Text style={styles.postText}>{post.content}</Text>
                      <Text style={styles.helperText}>{new Date(post.created_at).toLocaleString()}</Text>
                      <View style={styles.inlineRow}>
                        <TouchableOpacity style={styles.smallButton} onPress={() => toggleBookmark(post.id)}>
                          <Text style={styles.smallButtonText}>{isBookmarked ? 'Remove bookmark' : 'Bookmark'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.smallButton} onPress={() => setViewMode('comments')}>
                          <Text style={styles.smallButtonText}>View comments</Text>
                        </TouchableOpacity>
                      </View>
                      {postComments.slice(0, 2).map((comment) => {
                        const ca = users.find((u) => u.id === comment.user_id);
                        return (
                          <View key={comment.id} style={styles.commentBox}>
                            <View style={styles.inlineRow}>
                              <Text style={styles.userNameText}>{ca?.display_name || '?'}</Text>
                              {ca?.verified ? <VerifiedBadge /> : null}
                            </View>
                            <Text style={styles.postText}>{comment.text}</Text>
                          </View>
                        );
                      })}
                      <TextInput style={styles.postInput} placeholder="Write a comment" placeholderTextColor="#6b7280" value={commentDrafts[post.id] || ''} onChangeText={(v) => setCommentDrafts((p) => ({ ...p, [post.id]: v }))} />
                      <TouchableOpacity style={styles.smallButton} onPress={() => handleAddComment(post.id)}>
                        <Text style={styles.smallButtonText}>Comment</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}

          </View>
          {/* end feedColumn */}

          {/* ── Right column ── */}
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
                      {user.verified ? <VerifiedBadge /> : null}
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
                        {user.verified ? <VerifiedBadge /> : null}
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

// ─── VerifiedBadge ────────────────────────────────────────────────────────────
function VerifiedBadge() {
  return (
    <View style={styles.badgeChip}>
      <Text style={styles.badgeChipText}>✓ Verified</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
  commentBox:       { backgroundColor: '#0f0f1a', borderRadius: 12, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#1e1e30' },
  messageLayout:    { flexDirection: 'row', gap: 12 },
  messageList:      { width: 148, gap: 6 },
  messageRow:       { padding: 10, borderRadius: 12, backgroundColor: '#0f0f1a', borderWidth: 1, borderColor: '#1e1e30' },
  sentBubble:       { alignSelf: 'flex-end', backgroundColor: '#7c3aed', padding: 10, borderRadius: 16, borderBottomRightRadius: 4, marginTop: 8, maxWidth: '75%', shadowColor: '#7c3aed', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  sentBubbleText:   { color: '#fff', fontSize: 14 },
  receivedBubble:   { alignSelf: 'flex-start', backgroundColor: '#1a1a2e', padding: 10, borderRadius: 16, borderBottomLeftRadius: 4, marginTop: 8, maxWidth: '75%', borderWidth: 1, borderColor: '#2a2a40' },
  receivedBubbleText: { color: '#c4b5fd', fontSize: 14 },
});
