import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { useMe } from '../state/auth';
import { Glass, GlassPressable } from '../components/Glass';
import { Backdrop, IconButton } from '../components/ui';
import { colors, font } from '../theme';

const SUGGESTIONS = ['How do I report an issue?', 'What do the pin colours mean?', 'How are workers paid?', 'How do points work?'];

export default function AuraBotScreen() {
  const me = useMe();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi ${me?.full_name.split(' ')[0] ?? 'there'}! I'm AuraBot. Ask me anything about using Auracity.` },
  ]);
  const listRef = useRef(null);

  const send = async (text) => {
    const t = text.trim();
    if (!t || busy) return;
    const next = [...messages, { role: 'user', content: t }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const reply = await api.aurabot(next.slice(1), me?.role ?? 'citizen');
      setMessages([...next, { role: 'assistant', content: reply.trim() }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `Sorry, I couldn't answer that right now (${e.message.slice(0, 80)}).` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        <Glass radius={999} tint={colors.primary} style={styles.title}>
          <Ionicons name="sparkles" size={16} color="#fff" />
          <Text style={font.headline}>AuraBot</Text>
        </Glass>
        <View style={{ width: 42 }} />
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) =>
          item.role === 'user' ? (
            <Glass tint={colors.primary} radius={20} style={[styles.bubble, styles.user]}>
              <Text style={font.body}>{item.content}</Text>
            </Glass>
          ) : (
            <Glass radius={20} style={[styles.bubble, styles.bot]}>
              <Text style={font.body}>{item.content}</Text>
            </Glass>
          )
        }
        ListFooterComponent={
          <View style={{ gap: 8 }}>
            {busy && <ActivityIndicator color={colors.text} style={{ alignSelf: 'flex-start', marginLeft: 12 }} />}
            {messages.length === 1 && (
              <View style={styles.chips}>
                {SUGGESTIONS.map((s) => (
                  <GlassPressable key={s} radius={16} onPress={() => send(s)} contentStyle={styles.chip}>
                    <Text style={{ color: colors.text, fontSize: 13 }}>{s}</Text>
                  </GlassPressable>
                ))}
              </View>
            )}
          </View>
        }
      />
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10 }]}>
        <Glass radius={24} style={{ flex: 1, paddingHorizontal: 16 }}>
          <TextInput value={input} onChangeText={setInput} placeholder="Ask AuraBot…" placeholderTextColor={colors.faint} style={styles.input} onSubmitEditing={() => send(input)} returnKeyType="send" />
        </Glass>
        <IconButton icon="arrow-up" label="Send" tint={colors.primary} size={48} onPress={() => send(input)} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10 },
  user: { alignSelf: 'flex-end' },
  bot: { alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  input: { color: colors.text, fontSize: 16, paddingVertical: 12 },
});
