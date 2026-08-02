import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const STORAGE_KEY = 'knot-social-state';

const seededUsers = [
  {
    id: 'admin-1',
    username: 'admin',
    password: 'KnotAdmin!2026',
    displayName: 'Admin',
    role: 'admin',
    verified: true,
    banned: false,
    profileImage: '',
    bio: 'Website administrator and moderator.',
    followers: ['user-knot'],
    following: ['user-mila'],
  },
  {
    id: 'admin-2',
    username: 'admin2',
    password: 'KnotAdmin2!2026',
    displayName: 'Admin Two',
    role: 'admin',
    verified: true,
    banned: false,
    profileImage: '',
    bio: 'Secondary administrator account.',
    followers: ['user-knot'],
    following: ['admin-1'],
  },
  {
    id: 'user-knot',
    username: 'knot',
    password: 'KnotOwner!2026',
    displayName: 'Knot',
    role: 'owner',
    verified: true,
    banned: false,
    profileImage: '',
    bio: 'Owner of this social website.',
    followers: ['admin-1', 'admin-2', 'user-mila'],
    following: ['admin-1', 'admin-2'],
  },
  {
    id: 'user-mila',
    username: 'mila',
    password: 'KnotMila!2026',
    displayName: 'Mila',
    role: 'user',
    verified: false,
    banned: false,
    profileImage: '',
    bio: 'Sharing updates and ideas.',
    followers: ['user-knot'],
    following: ['user-knot', 'admin-1'],
  },
];

function getDefaultUsers() {
  return seededUsers.map((user) => ({ ...user, followers: [...(user.followers || [])], following: [...(user.following || [])] }));
}

function normalizeUsers(users = []) {
  const builtInByUsername = new Map(getDefaultUsers().map((user) => [user.username.toLowerCase(), user]));
  const mergedUsers = [];
  const seenUsernames = new Set();

  for (const builtInUser of getDefaultUsers()) {
    mergedUsers.push({ ...builtInUser, followers: [...(builtInUser.followers || [])], following: [...(builtInUser.following || [])] });
    seenUsernames.add(builtInUser.username.toLowerCase());
  }

  for (const user of users) {
    const normalizedUsername = user?.username?.toLowerCase();
    if (!normalizedUsername || builtInByUsername.has(normalizedUsername)) {
      continue;
    }

    if (!seenUsernames.has(normalizedUsername)) {
      mergedUsers.push({
        ...user,
        followers: [...(user.followers || [])],
        following: [...(user.following || [])],
      });
      seenUsernames.add(normalizedUsername);
    }
  }

  return mergedUsers;
}

const defaultPosts = [
  {
    id: 'post-1',
    userId: 'user-knot',
    content: 'Welcome to Knot Social. Search for @knot to view the owner profile. #launch',
    createdAt: '2026-07-31T09:00:00.000Z',
    comments: [{ id: 'comment-1', userId: 'user-mila', text: 'Love this update!', createdAt: '2026-07-31T10:00:00.000Z' }],
    bookmarkedBy: [],
  },
  {
    id: 'post-2',
    userId: 'user-mila',
    content: 'The web version is live and ready for posting. #web',
    createdAt: '2026-07-31T10:15:00.000Z',
    comments: [],
    bookmarkedBy: [],
  },
];

const defaultNotifications = [
  { id: 'note-1', userId: 'user-mila', text: 'Knot mentioned you in the latest post.', createdAt: '2026-07-31T10:30:00.000Z' },
];

const defaultDirectMessages = [
  { id: 'dm-1', senderId: 'user-knot', recipientId: 'user-mila', text: 'Welcome to direct messages.', createdAt: '2026-07-31T11:00:00.000Z' },
];

const defaultCommunities = [
  { id: 'community-1', name: 'Creators', description: 'Share launches and feedback with creators.', members: ['user-knot', 'user-mila'] },
  { id: 'community-2', name: 'Developers', description: 'Discuss the latest web and mobile builds.', members: ['admin-1'] },
];

function getInitialState() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(users, posts, authUser, notifications, directMessages) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ users, posts, authUser, notifications, directMessages })
    );
  } catch {
    // Ignore storage errors in this demo build.
  }
}

function getAvatarLabel(user) {
  const base = user?.displayName || user?.username || 'U';
  const initials = base
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'U';
}

function normalizePosts(posts = []) {
  return (posts || []).map((post) => ({
    ...post,
    comments: post.comments || [],
    bookmarkedBy: post.bookmarkedBy || [],
  }));
}

function extractHashtags(content = '') {
  return (content.match(/#[\w-]+/g) || []).map((tag) => tag.toLowerCase());
}

export default function App() {
  const [users, setUsers] = useState(getDefaultUsers());
  const [posts, setPosts] = useState(defaultPosts);
  const [authUser, setAuthUser] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState({ username: '', password: '', displayName: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('user-knot');
  const [viewMode, setViewMode] = useState('feed');
  const [postText, setPostText] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [settingsForm, setSettingsForm] = useState({
    displayName: '',
    username: '',
    password: '',
    profileImage: '',
  });
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [directMessages, setDirectMessages] = useState(defaultDirectMessages);
  const [messageDraft, setMessageDraft] = useState('');
  const [selectedChatUserId, setSelectedChatUserId] = useState('user-mila');
  const [feedback, setFeedback] = useState('Sign in to continue.');

  useEffect(() => {
    const stored = getInitialState();
    if (stored) {
      setUsers(normalizeUsers(stored.users || getDefaultUsers()));
      setPosts(normalizePosts(stored.posts || defaultPosts));
      setNotifications(stored.notifications || defaultNotifications);
      setDirectMessages(stored.directMessages || defaultDirectMessages);
      setAuthUser(stored.authUser || null);
      if (stored.authUser) {
        setSelectedProfileId(stored.authUser.id);
        setSettingsForm({
          displayName: stored.authUser.displayName || '',
          username: stored.authUser.username || '',
          password: stored.authUser.password || '',
          profileImage: stored.authUser.profileImage || '',
        });
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    saveState(users, posts, authUser, notifications, directMessages);
  }, [authUser, hydrated, posts, users, notifications, directMessages]);

  const selectedProfile = useMemo(() => {
    if (!authUser) {
      return null;
    }
    return users.find((user) => user.id === selectedProfileId) || authUser;
  }, [authUser, selectedProfileId, users]);

  const visibleUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return users.slice(0, 5);
    }

    return users.filter((user) => {
      const haystack = `${user.username} ${user.displayName}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [searchQuery, users]);

  const orderedPosts = useMemo(() => {
    return [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [posts]);

  const selectedProfilePosts = useMemo(() => {
    if (!selectedProfile) {
      return [];
    }

    return [...posts]
      .filter((post) => post.userId === selectedProfile.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [posts, selectedProfile]);

  const notificationsForUser = useMemo(() => {
    if (!authUser) {
      return [];
    }
    return [...notifications]
      .filter((note) => note.userId === authUser.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [authUser, notifications]);

  const bookmarkedPosts = useMemo(() => {
    if (!authUser) {
      return [];
    }
    return posts.filter((post) => (post.bookmarkedBy || []).includes(authUser.id));
  }, [authUser, posts]);

  const communities = useMemo(() => defaultCommunities, []);

  const selectedChatUser = useMemo(() => {
    if (!authUser) {
      return null;
    }
    return users.find((user) => user.id === selectedChatUserId) || null;
  }, [authUser, selectedChatUserId, users]);

  const conversationMessages = useMemo(() => {
    if (!authUser || !selectedChatUser) {
      return [];
    }
    return directMessages
      .filter((message) => {
        const isSentByAuth = message.senderId === authUser.id && message.recipientId === selectedChatUser.id;
        const isSentToAuth = message.senderId === selectedChatUser.id && message.recipientId === authUser.id;
        return isSentByAuth || isSentToAuth;
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [authUser, directMessages, selectedChatUser]);

  const trendingTags = useMemo(() => {
    const counts = new Map();
    posts.forEach((post) => {
      extractHashtags(post.content).forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([tag]) => tag);
  }, [posts]);

  const isFollowing = (userId) => (authUser?.following || []).includes(userId);

  const handleSignIn = () => {
    const username = authForm.username.trim().toLowerCase();
    const password = authForm.password.trim();

    const user = users.find(
      (candidate) => candidate.username.toLowerCase() === username && candidate.password === password
    );

    if (!user) {
      setFeedback('No matching account was found. Check your username and password.');
      return;
    }

    if (user.banned) {
      setFeedback('This account is banned and cannot sign in.');
      return;
    }

    setAuthUser(user);
    setSelectedProfileId(user.id);
    setSettingsForm({
      displayName: user.displayName,
      username: user.username,
      password: user.password,
      profileImage: user.profileImage || '',
    });
    setFeedback(`Welcome back, ${user.displayName}!`);
  };

  const handleSignUp = () => {
    const username = authForm.username.trim().toLowerCase();
    const password = authForm.password.trim();
    const displayName = authForm.displayName.trim() || username;

    if (!username || !password) {
      setFeedback('Please enter both a username and password.');
      return;
    }

    const existing = users.some((user) => user.username.toLowerCase() === username);
    if (existing) {
      setFeedback('That username is already taken.');
      return;
    }

    const user = {
      id: `user-${Date.now()}`,
      username,
      password,
      displayName,
      role: 'user',
      verified: false,
      banned: false,
      profileImage: '',
      bio: 'New to Knot Social.',
      followers: [],
      following: [],
    };

    setUsers((prev) => [user, ...prev]);
    setAuthUser(user);
    setSelectedProfileId(user.id);
    setSettingsForm({
      displayName,
      username,
      password,
      profileImage: '',
    });
    setFeedback(`Account created for @${username}.`);
  };

  const handleSignOut = () => {
    setAuthUser(null);
    setFeedback('Signed out.');
  };

  const handleUpdateSettings = () => {
    if (!authUser) {
      return;
    }

    const username = settingsForm.username.trim().toLowerCase();
    const displayName = settingsForm.displayName.trim();
    const password = settingsForm.password.trim();

    if (!username || !password || !displayName) {
      setFeedback('Please fill out your display name, username, and password.');
      return;
    }

    const duplicate = users.find(
      (user) => user.id !== authUser.id && user.username.toLowerCase() === username
    );

    if (duplicate) {
      setFeedback('That username is already in use.');
      return;
    }

    const updatedUser = {
      ...authUser,
      username,
      password,
      displayName,
      profileImage: settingsForm.profileImage.trim(),
    };

    setUsers((prev) => prev.map((user) => (user.id === authUser.id ? updatedUser : user)));
    setAuthUser(updatedUser);
    setSettingsForm({
      displayName,
      username,
      password,
      profileImage: settingsForm.profileImage.trim(),
    });
    setFeedback('Your profile was updated.');
  };

  const handleCreatePost = () => {
    if (!authUser) {
      return;
    }

    const text = postText.trim();
    if (!text) {
      setFeedback('Write something before posting.');
      return;
    }

    const newPost = {
      id: `post-${Date.now()}`,
      userId: authUser.id,
      content: text,
      createdAt: new Date().toISOString(),
      comments: [],
      bookmarkedBy: [],
    };

    setPosts((prev) => [newPost, ...prev]);
    setPostText('');
    setFeedback('Post published.');
  };

  const toggleBookmark = (postId) => {
    if (!authUser) {
      return;
    }

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) {
          return post;
        }
        const alreadyBookmarked = (post.bookmarkedBy || []).includes(authUser.id);
        return {
          ...post,
          bookmarkedBy: alreadyBookmarked
            ? (post.bookmarkedBy || []).filter((id) => id !== authUser.id)
            : [...(post.bookmarkedBy || []), authUser.id],
        };
      })
    );
    setFeedback('Bookmark updated.');
  };

  const handleAddComment = (postId) => {
    if (!authUser) {
      return;
    }

    const text = (commentDrafts[postId] || '').trim();
    if (!text) {
      setFeedback('Write a comment before sending.');
      return;
    }

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) {
          return post;
        }
        return {
          ...post,
          comments: [
            ...(post.comments || []),
            {
              id: `comment-${Date.now()}`,
              userId: authUser.id,
              text,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      })
    );

    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    setNotifications((prev) => [
      ...prev,
      {
        id: `note-${Date.now()}`,
        userId: authUser.id,
        text: `You commented on a post.`,
        createdAt: new Date().toISOString(),
      },
    ]);
    setFeedback('Comment posted.');
  };

  const toggleFollow = (userId) => {
    if (!authUser || userId === authUser.id) {
      return;
    }

    const following = (authUser.following || []).includes(userId)
      ? (authUser.following || []).filter((id) => id !== userId)
      : [...(authUser.following || []), userId];

    const updatedAuthUser = { ...authUser, following };

    setUsers((prev) =>
      prev.map((user) => {
        if (user.id === authUser.id) {
          return { ...user, following };
        }
        if (user.id === userId) {
          const followers = (user.followers || []).includes(authUser.id)
            ? (user.followers || []).filter((id) => id !== authUser.id)
            : [...(user.followers || []), authUser.id];
          return { ...user, followers };
        }
        return user;
      })
    );

    setAuthUser(updatedAuthUser);
    setNotifications((prev) => [
      ...prev,
      {
        id: `note-${Date.now()}`,
        userId: userId,
        text: `${updatedAuthUser.displayName} ${following.includes(userId) ? 'followed' : 'unfollowed'} you.`,
        createdAt: new Date().toISOString(),
      },
    ]);
    setFeedback(following.includes(userId) ? 'Followed successfully.' : 'Unfollowed successfully.');
  };

  const toggleBan = (userId) => {
    if (!authUser || authUser.role !== 'admin') {
      return;
    }

    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, banned: !user.banned } : user))
    );
    setFeedback('Account ban state updated.');
  };

  const toggleVerify = (userId) => {
    if (!authUser || authUser.role !== 'admin') {
      return;
    }

    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, verified: !user.verified } : user))
    );
    setFeedback('Verification state updated.');
  };

  const toggleJoinCommunity = (communityId) => {
    if (!authUser) {
      return;
    }

    setNotifications((prev) => [
      ...prev,
      {
        id: `note-${Date.now()}`,
        userId: authUser.id,
        text: `Community update received.`,
        createdAt: new Date().toISOString(),
      },
    ]);
    setFeedback('Community membership updated.');
  };

  const isCommunityMember = (communityId) => defaultCommunities.find((community) => community.id === communityId)?.members.includes(authUser?.id);

  const handleSendMessage = () => {
    if (!authUser || !selectedChatUser) {
      return;
    }

    const text = messageDraft.trim();
    if (!text) {
      setFeedback('Write a message before sending.');
      return;
    }

    setDirectMessages((prev) => [
      ...prev,
      {
        id: `dm-${Date.now()}`,
        senderId: authUser.id,
        recipientId: selectedChatUser.id,
        text,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNotifications((prev) => [
      ...prev,
      {
        id: `note-${Date.now()}`,
        userId: selectedChatUser.id,
        text: `${authUser.displayName} sent you a direct message.`,
        createdAt: new Date().toISOString(),
      },
    ]);
    setMessageDraft('');
    setFeedback('Direct message sent.');
  };

  const hasTag = (content, term) => {
    const normalized = (term || '').trim().toLowerCase();
    if (!normalized) {
      return true;
    }
    const tags = extractHashtags(content).map((tag) => tag.toLowerCase());
    const tagMatch = normalized.startsWith('#') ? tags.includes(normalized) : tags.includes(`#${normalized}`);
    return tagMatch || content.toLowerCase().includes(normalized);
  };

  if (!authUser) {
    return (
      <View style={styles.screen}>
        <View style={styles.backgroundGlow1} />
        <View style={styles.backgroundGlow2} />
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.authContainer}>
          <View style={styles.authCard}>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>Live social hub</Text></View>
            <Text style={styles.appTitle}>Knot</Text>
            <Text style={styles.subtitle}>Sign in or create an account on the web version.</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleButton, authMode === 'signin' && styles.toggleButtonActive]}
                onPress={() => setAuthMode('signin')}
              >
                <Text style={styles.toggleText}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, authMode === 'signup' && styles.toggleButtonActive]}
                onPress={() => setAuthMode('signup')}
              >
                <Text style={styles.toggleText}>Sign up</Text>
              </TouchableOpacity>
            </View>

            {feedback ? <View style={styles.notice}><Text style={styles.noticeText}>{feedback}</Text></View> : null}

            {authMode === 'signup' ? (
              <TextInput
                style={styles.input}
                placeholder="Display name"
                value={authForm.displayName}
                onChangeText={(value) => setAuthForm((prev) => ({ ...prev, displayName: value }))}
              />
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Username"
              value={authForm.username}
              onChangeText={(value) => setAuthForm((prev) => ({ ...prev, username: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={authForm.password}
              onChangeText={(value) => setAuthForm((prev) => ({ ...prev, password: value }))}
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={authMode === 'signin' ? handleSignIn : handleSignUp}
            >
              <Text style={styles.primaryButtonText}>{authMode === 'signin' ? 'Sign in' : 'Create account'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.appShell}>
          <View style={styles.sidebar}>
            <Text style={styles.brand}>Knot</Text>
            <TouchableOpacity style={styles.navItem} onPress={() => { setViewMode('feed'); setFeedback('Viewing your home feed.'); }}>
              <Text style={styles.navText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => { setViewMode('profile'); setSelectedProfileId(authUser.id); setFeedback('Viewing your profile.'); }}>
              <Text style={styles.navText}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => { setViewMode('profiles'); setFeedback('Browsing profiles and follows.'); }}>
              <Text style={styles.navText}>Profiles & follows</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => { setViewMode('notifications'); setFeedback('Checking your notifications.'); }}>
              <Text style={styles.navText}>Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => { setViewMode('comments'); setFeedback('Viewing comments and replies.'); }}>
              <Text style={styles.navText}>Comments & replies</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => { setViewMode('hashtags'); setFeedback('Searching tags and conversations.'); }}>
              <Text style={styles.navText}>Search & hashtags</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => { setViewMode('bookmarks'); setFeedback('Viewing your saved posts.'); }}>
              <Text style={styles.navText}>Bookmarks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => { setViewMode('messages'); setFeedback('Opening your inbox.'); }}>
              <Text style={styles.navText}>Direct messages</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => { setViewMode('communities'); setFeedback('Joining communities.'); }}>
              <Text style={styles.navText}>Communities</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleCreatePost}>
              <Text style={styles.primaryButtonText}>Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut}>
              <Text style={styles.secondaryButtonText}>Sign out</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.feedColumn}>
            {viewMode === 'settings' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Settings</Text>
                <TextInput style={styles.input} placeholder="Display name" value={settingsForm.displayName} onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, displayName: value }))} />
                <TextInput style={styles.input} placeholder="Username" value={settingsForm.username} onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, username: value }))} />
                <TextInput style={styles.input} placeholder="Password" secureTextEntry value={settingsForm.password} onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, password: value }))} />
                <TextInput style={styles.input} placeholder="Profile image URL" value={settingsForm.profileImage} onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, profileImage: value }))} />
                <TouchableOpacity style={styles.primaryButton} onPress={handleUpdateSettings}>
                  <Text style={styles.primaryButtonText}>Save settings</Text>
                </TouchableOpacity>
              </View>
            ) : viewMode === 'profile' ? (
              <View style={styles.card}>
                {selectedProfile ? (
                  <>
                    <View style={styles.profileHeader}>
                      <View style={styles.avatarLarge}>
                        {selectedProfile.profileImage ? (
                          <Image source={{ uri: selectedProfile.profileImage }} style={styles.avatarImage} />
                        ) : (
                          <Text style={styles.avatarText}>{getAvatarLabel(selectedProfile)}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.inlineRow}>
                          <Text style={styles.profileName}>{selectedProfile.displayName}</Text>
                          {selectedProfile.verified ? <VerifiedBadge /> : null}
                        </View>
                        <Text style={styles.userMetaText}>@{selectedProfile.username}</Text>
                        <Text style={styles.profileBio}>{selectedProfile.bio}</Text>
                      </View>
                    </View>
                    <View style={styles.inlineRow}>
                      <Text style={styles.helperText}>Role: {selectedProfile.role}</Text>
                      {selectedProfile.id !== authUser.id ? (
                        <TouchableOpacity style={styles.smallButton} onPress={() => toggleFollow(selectedProfile.id)}>
                          <Text style={styles.smallButtonText}>{isFollowing(selectedProfile.id) ? 'Unfollow' : 'Follow'}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {selectedProfile.banned ? <Text style={styles.bannedText}>Banned</Text> : null}
                    <View style={styles.composeCard}>
                      <Text style={styles.composeLabel}>Posts by {selectedProfile.displayName}</Text>
                      {selectedProfilePosts.length === 0 ? (
                        <Text style={styles.helperText}>No posts from this profile yet.</Text>
                      ) : selectedProfilePosts.map((post) => (
                        <View key={post.id} style={styles.postCard}>
                          <Text style={styles.postText}>{post.content}</Text>
                          <Text style={styles.helperText}>{new Date(post.createdAt).toLocaleString()}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            ) : viewMode === 'profiles' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Profiles & follows</Text>
                {users.map((user) => (
                  <View key={user.id} style={styles.listItem}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.inlineRow}>
                        <Text style={styles.userNameText}>{user.displayName}</Text>
                        {user.verified ? <VerifiedBadge /> : null}
                      </View>
                      <Text style={styles.userMetaText}>@{user.username}</Text>
                      <Text style={styles.helperText}>{(user.followers || []).length} followers • {(user.following || []).length} following</Text>
                    </View>
                    {user.id !== authUser.id ? (
                      <TouchableOpacity style={styles.smallButton} onPress={() => toggleFollow(user.id)}>
                        <Text style={styles.smallButtonText}>{isFollowing(user.id) ? 'Unfollow' : 'Follow'}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : viewMode === 'notifications' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Notifications</Text>
                {notificationsForUser.length === 0 ? (
                  <Text style={styles.helperText}>You are all caught up.</Text>
                ) : notificationsForUser.map((note) => (
                  <View key={note.id} style={styles.listItem}>
                    <Text style={styles.postText}>{note.text}</Text>
                    <Text style={styles.helperText}>{new Date(note.createdAt).toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            ) : viewMode === 'comments' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Comments & replies</Text>
                {orderedPosts.map((post) => (
                  <View key={post.id} style={styles.postCard}>
                    <Text style={styles.postText}>{post.content}</Text>
                    <Text style={styles.helperText}>{new Date(post.createdAt).toLocaleString()}</Text>
                    {(post.comments || []).map((comment) => {
                      const author = users.find((user) => user.id === comment.userId) || authUser;
                      return (
                        <View key={comment.id} style={styles.commentBox}>
                          <View style={styles.inlineRow}>
                            <Text style={styles.userNameText}>{author?.displayName || 'You'}</Text>
                            {author?.verified ? <VerifiedBadge /> : null}
                          </View>
                          <Text style={styles.postText}>{comment.text}</Text>
                        </View>
                      );
                    })}
                    <TextInput style={styles.postInput} placeholder="Reply to this post" value={commentDrafts[post.id] || ''} onChangeText={(value) => setCommentDrafts((prev) => ({ ...prev, [post.id]: value }))} />
                    <TouchableOpacity style={styles.smallButton} onPress={() => handleAddComment(post.id)}>
                      <Text style={styles.smallButtonText}>Comment</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : viewMode === 'hashtags' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Search & hashtags</Text>
                <TextInput style={styles.input} placeholder="Search by hashtag or topic" value={searchQuery} onChangeText={setSearchQuery} />
                <Text style={styles.helperText}>Trending: {trendingTags.join(', ')}</Text>
                {posts.filter((post) => hasTag(post.content, searchQuery)).map((post) => (
                  <View key={post.id} style={styles.postCard}>
                    <Text style={styles.postText}>{post.content}</Text>
                  </View>
                ))}
              </View>
            ) : viewMode === 'bookmarks' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Bookmarks</Text>
                {bookmarkedPosts.length === 0 ? (
                  <Text style={styles.helperText}>You have no saved posts yet.</Text>
                ) : bookmarkedPosts.map((post) => (
                  <View key={post.id} style={styles.postCard}>
                    <Text style={styles.postText}>{post.content}</Text>
                    <Text style={styles.helperText}>{new Date(post.createdAt).toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            ) : viewMode === 'messages' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Direct messages</Text>
                <View style={styles.messageLayout}>
                  <View style={styles.messageList}>
                    {users.filter((user) => user.id !== authUser.id).map((user) => (
                      <TouchableOpacity key={user.id} style={styles.messageRow} onPress={() => setSelectedChatUserId(user.id)}>
                        <Text style={styles.userNameText}>{user.displayName}</Text>
                        <Text style={styles.userMetaText}>@{user.username}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.helperText}>Chat with @{selectedChatUser?.username || 'a friend'}</Text>
                    {conversationMessages.map((message) => (
                      <View key={message.id} style={message.senderId === authUser.id ? styles.sentBubble : styles.receivedBubble}>
                        <Text style={message.senderId === authUser.id ? styles.sentBubbleText : styles.receivedBubbleText}>{message.text}</Text>
                      </View>
                    ))}
                    <TextInput style={styles.postInput} placeholder="Write a private message" value={messageDraft} onChangeText={setMessageDraft} />
                    <TouchableOpacity style={styles.primaryButton} onPress={handleSendMessage}>
                      <Text style={styles.primaryButtonText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : viewMode === 'communities' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Communities</Text>
                {communities.map((community) => (
                  <View key={community.id} style={styles.postCard}>
                    <View style={styles.inlineRow}>
                      <Text style={styles.userNameText}>{community.name}</Text>
                      <Text style={styles.helperText}>{community.members.length} members</Text>
                    </View>
                    <Text style={styles.postText}>{community.description}</Text>
                    <TouchableOpacity style={styles.smallButton} onPress={() => toggleJoinCommunity(community.id)}>
                      <Text style={styles.smallButtonText}>{isCommunityMember(community.id) ? 'Leave' : 'Join'}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <>
                <View style={styles.feedHeader}>
                  <View>
                    <Text style={styles.feedTitle}>Home</Text>
                    <Text style={styles.feedSubtitle}>A Twitter-style social feed for Knot.</Text>
                  </View>
                </View>

                {feedback ? (
                  <View style={styles.notice}>
                    <Text style={styles.noticeText}>{feedback}</Text>
                  </View>
                ) : null}

                <View style={styles.composeCard}>
                  <Text style={styles.composeLabel}>What’s happening?</Text>
                  <TextInput style={styles.postInput} multiline placeholder="Share an update with the community..." value={postText} onChangeText={setPostText} />
                  <TouchableOpacity style={styles.primaryButton} onPress={handleCreatePost}>
                    <Text style={styles.primaryButtonText}>Publish</Text>
                  </TouchableOpacity>
                </View>

                {orderedPosts.map((post) => {
                  const author = users.find((user) => user.id === post.userId) || authUser;
                  const isBookmarked = (post.bookmarkedBy || []).includes(authUser.id);
                  return (
                    <View key={post.id} style={styles.postCard}>
                      <View style={styles.postHeader}>
                        <View style={styles.avatarSmall}>
                          {author?.profileImage ? (
                            <Image source={{ uri: author.profileImage }} style={styles.avatarImage} />
                          ) : (
                            <Text style={styles.avatarText}>{getAvatarLabel(author)}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.inlineRow}>
                            <Text style={styles.postAuthor}>{author?.displayName || 'Unknown'}</Text>
                            {author?.verified ? <VerifiedBadge /> : null}
                          </View>
                          <Text style={styles.userMetaText}>@{author?.username || 'unknown'}</Text>
                        </View>
                      </View>
                      <Text style={styles.postText}>{post.content}</Text>
                      <Text style={styles.helperText}>{new Date(post.createdAt).toLocaleString()}</Text>
                      <View style={styles.inlineRow}>
                        <TouchableOpacity style={styles.smallButton} onPress={() => toggleBookmark(post.id)}>
                          <Text style={styles.smallButtonText}>{isBookmarked ? 'Remove bookmark' : 'Bookmark'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.smallButton} onPress={() => setViewMode('comments')}>
                          <Text style={styles.smallButtonText}>View comments</Text>
                        </TouchableOpacity>
                      </View>
                      {(post.comments || []).slice(0, 2).map((comment) => {
                        const commentAuthor = users.find((user) => user.id === comment.userId) || authUser;
                        return (
                          <View key={comment.id} style={styles.commentBox}>
                            <View style={styles.inlineRow}>
                              <Text style={styles.userNameText}>{commentAuthor?.displayName || 'You'}</Text>
                              {commentAuthor?.verified ? <VerifiedBadge /> : null}
                            </View>
                            <Text style={styles.postText}>{comment.text}</Text>
                          </View>
                        );
                      })}
                      <TextInput style={styles.postInput} placeholder="Write a comment" value={commentDrafts[post.id] || ''} onChangeText={(value) => setCommentDrafts((prev) => ({ ...prev, [post.id]: value }))} />
                      <TouchableOpacity style={styles.smallButton} onPress={() => handleAddComment(post.id)}>
                        <Text style={styles.smallButtonText}>Comment</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}
          </View>

          <View style={styles.rightColumn}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Search users</Text>
              <TextInput style={styles.input} placeholder="Try knot" value={searchQuery} onChangeText={setSearchQuery} />
              {visibleUsers.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.userRow}
                  onPress={() => {
                    setSelectedProfileId(user.id);
                    setSearchQuery(user.username);
                    setViewMode('profile');
                    setFeedback(`Viewing @${user.username}.`);
                  }}
                >
                  <View style={styles.avatarSmall}>
                    {user.profileImage ? (
                      <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{getAvatarLabel(user)}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.inlineRow}>
                      <Text style={styles.userNameText}>{user.displayName}</Text>
                      {user.verified ? <VerifiedBadge /> : null}
                    </View>
                    <Text style={styles.userMetaText}>@{user.username}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Quick stats</Text>
              <Text style={styles.helperText}>Followers: {(authUser.followers || []).length}</Text>
              <Text style={styles.helperText}>Following: {(authUser.following || []).length}</Text>
              <Text style={styles.helperText}>Bookmarks: {bookmarkedPosts.length}</Text>
              <Text style={styles.helperText}>DMs: {directMessages.filter((message) => message.senderId === authUser.id || message.recipientId === authUser.id).length}</Text>
            </View>

            {authUser.role === 'admin' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Admin controls</Text>
                {users.map((user) => (
                  <View key={user.id} style={styles.adminRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.inlineRow}>
                        <Text style={styles.userNameText}>{user.displayName}</Text>
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
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function VerifiedBadge() {
  return (
    <View style={styles.badgeChip}>
      <Text style={styles.badgeChipText}>✓ Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f7f9fa',
  },
  authContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f7f9fa',
  },
  authCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  content: {
    padding: 16,
    backgroundColor: '#f7f9fa',
  },
  appShell: {
    flexDirection: 'row',
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    gap: 16,
  },
  sidebar: {
    width: 220,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignSelf: 'flex-start',
    minHeight: 520,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  navItem: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#f3f4f6',
  },
  navText: {
    color: '#111827',
    fontWeight: '700',
  },
  feedColumn: {
    flex: 1,
    minWidth: 320,
    gap: 12,
  },
  feedHeader: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  feedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  feedSubtitle: {
    color: '#6b7280',
    marginTop: 4,
  },
  composeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  composeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  rightColumn: {
    width: 280,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  postInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  toggleButtonActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  toggleText: {
    color: '#111827',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  notice: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  noticeText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  avatarSmall: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarLarge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
  userNameText: {
    fontWeight: '700',
    color: '#111827',
  },
  userMetaText: {
    color: '#6b7280',
    fontSize: 12,
  },
  helperText: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  profileBio: {
    color: '#374151',
    marginTop: 4,
  },
  bannedText: {
    color: '#dc2626',
    fontWeight: '700',
    marginTop: 6,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 10,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  postAuthor: {
    fontWeight: '700',
    color: '#111827',
  },
  postText: {
    color: '#374151',
    lineHeight: 20,
  },
  smallButton: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  smallButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  adminActions: {
    flexDirection: 'column',
    gap: 4,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeChip: {
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeChipText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  commentBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  messageLayout: {
    flexDirection: 'row',
    gap: 12,
  },
  messageList: {
    width: 140,
    gap: 6,
  },
  messageRow: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  sentBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1d4ed8',
    padding: 10,
    borderRadius: 14,
    marginTop: 8,
  },
  sentBubbleText: {
    color: '#fff',
  },
  receivedBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderRadius: 14,
    marginTop: 8,
  },
  receivedBubbleText: {
    color: '#111827',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  heroBadgeText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12,
  },
  appTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 16,
  },
  backgroundGlow1: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#bfdbfe',
    top: -70,
    left: -60,
    opacity: 0.4,
  },
  backgroundGlow2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#dbeafe',
    bottom: -40,
    right: -40,
    opacity: 0.45,
  },
});
