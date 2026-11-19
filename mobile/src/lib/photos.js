// Photo handling: bundled seed scenes, on-device storage, compression and fingerprints.
import { Paths, File, Directory } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

export const SCENES = {
  'pothole-before': require('../../assets/scenes/pothole-before.jpg'),
  'pothole-after': require('../../assets/scenes/pothole-after.jpg'),
  'garbage-before': require('../../assets/scenes/garbage-before.jpg'),
  'garbage-after': require('../../assets/scenes/garbage-after.jpg'),
  'streetlight-before': require('../../assets/scenes/streetlight-before.jpg'),
  'streetlight-after': require('../../assets/scenes/streetlight-after.jpg'),
  'leak-before': require('../../assets/scenes/leak-before.jpg'),
  'leak-after': require('../../assets/scenes/leak-after.jpg'),
  'park-before': require('../../assets/scenes/park-before.jpg'),
  'park-after': require('../../assets/scenes/park-after.jpg'),
};

/** Turns a stored photo reference into an <Image> source. */
export function photoSource(ref) {
  if (!ref) return undefined;
  if (ref.startsWith('asset:')) return SCENES[ref.slice(6)];
  return { uri: ref };
}

/** A local file URI for any photo reference (downloads bundled assets if needed). */
async function localUri(ref) {
  if (ref.startsWith('asset:')) {
    const asset = Asset.fromModule(SCENES[ref.slice(6)]);
    await asset.downloadAsync();
    return asset.localUri ?? asset.uri;
  }
  return ref;
}

/** Resize + JPEG-compress (cost control from the business model). Returns { uri, base64 }. */
export async function compress(uri, maxWidth = 1024, quality = 0.7) {
  const img = await ImageManipulator.manipulate(uri).resize({ width: maxWidth }).renderAsync();
  const out = await img.saveAsync({ compress: quality, format: SaveFormat.JPEG, base64: true });
  return { uri: out.uri, base64: out.base64 };
}

/** Copies a compressed photo into the app's documents folder so it survives cache clears. */
export function persist(uri, base64) {
  // Web blob: URLs die on reload, so keep the image inline there.
  if (Platform.OS === 'web') return base64 ? `data:image/jpeg;base64,${base64}` : uri;
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create();
  const dest = new File(dir, `${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`);
  new File(uri).copySync(dest);
  return dest.uri;
}

/** Base64 JPEG for sending to the vision model. */
export async function toBase64(ref) {
  const uri = await localUri(ref);
  return (await compress(uri, 512, 0.7)).base64;
}

/** Tiny thumbnail used by the offline auditor to spot a reused photo. */
export async function fingerprint(ref) {
  const uri = await localUri(ref);
  const img = await ImageManipulator.manipulate(uri).resize({ width: 12, height: 12 }).renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.PNG, base64: true });
  return out.base64;
}
