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

const defaultUsers = [
  {
    id: 'admin-1',
    username: 'admin',
    password: 'KnotAdmin2026!',
    displayName: 'Admin',
    role: 'admin',
    verified: true,
    banned: false,
    profileImage: '',
    bio: 'Website administrator and moderator.',
  },
  {
    id: 'admin-2',
    username: 'admin2',
    password: 'admin222',
    displayName: 'Admin Two',
    role: 'admin',
    verified: true,
    banned: false,
    profileImage: '',
    bio: 'Secondary administrator account.',
  },
  {
    id: 'user-knot',
    username: 'knot',
    password: 'knot123',
    displayName: 'Knot',
    role: 'owner',
    verified: true,
    banned: false,
    profileImage: '',
    bio: 'Owner of this social website.',
  },
  {
    id: 'user-mila',
    username: 'mila',
    password: 'mila123',
    displayName: 'Mila',
    role: 'user',
    verified: false,
    banned: false,
    profileImage: '',
    bio: 'Sharing updates and ideas.',
  },
];

const defaultPosts = [
  {
    id: 'post-1',
    userId: 'user-knot',
    content: 'Welcome to Knot Social. Search for @knot to view the owner profile.',
    createdAt: '2026-07-31T09:00:00.000Z',
  },
  {
    id: 'post-2',
    userId: 'user-mila',
    content: 'The web version is live and ready for posting.',
    createdAt: '2026-07-31T10:15:00.000Z',
  },
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

function saveState(users, posts, authUser) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ users, posts, authUser })
    );
  } catch {
    // Ignore storage errors in this demo build.
  }
}

function getAvatarLabel(user) {
  const base = user.displayName || user.username || 'U';
  const initials = base
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'U';
}

export default function App() {
  const [users, setUsers] = useState(defaultUsers);
  const [posts, setPosts] = useState(defaultPosts);
  const [authUser, setAuthUser] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState({ username: 'knot', password: 'knot123', displayName: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('user-knot');
  const [viewMode, setViewMode] = useState('feed');
  const [postText, setPostText] = useState('');
  const [settingsForm, setSettingsForm] = useState({
    displayName: '',
    username: '',
    password: '',
    profileImage: '',
  });
  const [feedback, setFeedback] = useState('Use the built-in demo accounts from the sign-in screen.');

  useEffect(() => {
    const stored = getInitialState();
    if (stored) {
      setUsers(stored.users || defaultUsers);
      setPosts(stored.posts || defaultPosts);
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
    saveState(users, posts, authUser);
  }, [authUser, hydrated, posts, users]);

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

  const handleUseDemoAccount = () => {
    setAuthMode('signin');
    setAuthForm({ username: 'knot', password: 'knot123', displayName: '' });
    setFeedback('Demo account ready. Use knot / knot123 to sign in.');
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
    };

    setPosts((prev) => [newPost, ...prev]);
    setPostText('');
    setFeedback('Post published.');
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

            <View style={styles.demoCard}>
              <Text style={styles.demoTitle}>Demo accounts</Text>
              <Text style={styles.demoText}>Owner: knot / knot123</Text>
              <Text style={styles.demoText}>Admin: admin / KnotAdmin2026!</Text>
              <Text style={styles.demoText}>Admin 2: admin2 / admin222</Text>
              <TouchableOpacity style={styles.demoButton} onPress={handleUseDemoAccount}>
                <Text style={styles.demoButtonText}>Use owner account</Text>
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
            <TouchableOpacity style={styles.navItem} onPress={() => { setViewMode('settings'); setFeedback('Editing your settings.'); }}>
              <Text style={styles.navText}>Settings</Text>
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
                <TextInput
                  style={styles.input}
                  placeholder="Display name"
                  value={settingsForm.displayName}
                  onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, displayName: value }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  value={settingsForm.username}
                  onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, username: value }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  secureTextEntry
                  value={settingsForm.password}
                  onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, password: value }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Profile image URL"
                  value={settingsForm.profileImage}
                  onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, profileImage: value }))}
                />
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
                        <Text style={styles.profileName}>
                          {selectedProfile.displayName}
                          {selectedProfile.verified ? <Text style={styles.badge}> Verified</Text> : null}
                        </Text>
                        <Text style={styles.userMetaText}>@{selectedProfile.username}</Text>
                        <Text style={styles.profileBio}>{selectedProfile.bio}</Text>
                      </View>
                    </View>
                    <Text style={styles.helperText}>Role: {selectedProfile.role}</Text>
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
                  <TextInput
                    style={styles.postInput}
                    multiline
                    placeholder="Share an update with the community..."
                    value={postText}
                    onChangeText={setPostText}
                  />
                  <TouchableOpacity style={styles.primaryButton} onPress={handleCreatePost}>
                    <Text style={styles.primaryButtonText}>Publish</Text>
                  </TouchableOpacity>
                </View>

                {orderedPosts.map((post) => {
                  const author = users.find((user) => user.id === post.userId) || authUser;
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
                          <Text style={styles.postAuthor}>
                            {author?.displayName || 'Unknown'}
                            {author?.verified ? <Text style={styles.badge}> Verified</Text> : null}
                          </Text>
                          <Text style={styles.userMetaText}>@{author?.username || 'unknown'}</Text>
                        </View>
                      </View>
                      <Text style={styles.postText}>{post.content}</Text>
                      <Text style={styles.helperText}>{new Date(post.createdAt).toLocaleString()}</Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>

          <View style={styles.rightColumn}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Search users</Text>
              <TextInput
                style={styles.input}
                placeholder="Try knot"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
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
                    <Text style={styles.userNameText}>{user.displayName}</Text>
                    <Text style={styles.userMetaText}>@{user.username}</Text>
                    {user.verified ? <Text style={styles.badge}>Verified</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {authUser.role === 'admin' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Admin controls</Text>
                {users.map((user) => (
                  <View key={user.id} style={styles.adminRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userNameText}>{user.displayName}</Text>
                      <Text style={styles.userMetaText}>@{user.username}</Text>
                      {user.verified ? <Text style={styles.badge}>Verified</Text> : null}
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
    minHeight: 480,
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
  demoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 16,
  },
  demoTitle: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 6,
  },
  demoText: {
    color: '#475569',
    fontSize: 13,
    marginBottom: 4,
  },
  demoButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  demoButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
  badge: {
    color: '#1d4ed8',
    fontWeight: '700',
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
});
