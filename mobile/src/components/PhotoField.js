import { Alert, Image, Platform, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { GlassPressable } from './Glass';
import { colors, font } from '../theme';

async function pick(fromCamera) {
  if (fromCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access in Settings, or choose a photo from your gallery.');
      return null;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    return r.canceled ? null : r.assets[0].uri;
  }
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  return r.canceled ? null : r.assets[0].uri;
}

export function PhotoField({ uri, onChange, label }) {
  const choose = () => {
    if (Platform.OS === 'web') return pick(false).then((u) => u && onChange(u));
    Alert.alert(label, undefined, [
      { text: 'Take photo', onPress: () => pick(true).then((u) => u && onChange(u)) },
      { text: 'Choose from gallery', onPress: () => pick(false).then((u) => u && onChange(u)) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  return (
    <GlassPressable onPress={choose} contentStyle={styles.box}>
      {uri ? (
        <Image source={{ uri }} style={styles.img} />
      ) : (
        <View style={styles.empty}>
          <Ionicons name="camera" size={34} color={colors.text} />
          <Text style={font.headline}>{label}</Text>
          <Text style={font.sub}>Tap to use the camera or gallery</Text>
        </View>
      )}
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  box: { height: 220 },
  img: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
});
