import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { CURRENT_VERSION, PATCH_NOTES, type PatchEntry } from '@/constants/patchnotes';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatDate(date: string | null): string {
  if (!date) return 'Primera versión';
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

type Palette = (typeof Colors)['light'];

function Section({
  icon,
  label,
  color,
  entries,
  palette,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  color: string;
  entries: PatchEntry[];
  palette: Palette;
}) {
  if (entries.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name={icon} size={16} color={color} />
        <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
      </View>
      {entries.map((entry, i) => (
        <View key={i} style={styles.entry}>
          <View style={[styles.bullet, { backgroundColor: color }]} />
          <View style={styles.entryBody}>
            <Text style={[styles.entryTitle, { color: palette.text }]}>{entry.title}</Text>
            {entry.detail ? (
              <Text style={[styles.entryDetail, { color: palette.muted }]}>{entry.detail}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function PatchNotesScreen() {
  const palette = Colors[useColorScheme() ?? 'light'];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: palette.muted }]}>
        Resumen de las novedades y correcciones de cada versión de Mis Finanzas.
      </Text>

      {PATCH_NOTES.map((v) => {
        const isCurrent = v.version === CURRENT_VERSION;
        return (
          <View
            key={v.version}
            style={[
              styles.card,
              { backgroundColor: palette.card, borderColor: palette.border },
              isCurrent && { borderColor: palette.tint },
            ]}>
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.versionBadge,
                  { backgroundColor: palette.background },
                  isCurrent && { backgroundColor: palette.tint },
                ]}>
                <Text
                  style={[
                    styles.versionText,
                    { color: isCurrent ? palette.background : palette.text },
                  ]}>
                  v{v.version}
                </Text>
              </View>
              {isCurrent ? (
                <Text style={[styles.currentTag, { color: palette.tint }]}>Versión actual</Text>
              ) : null}
              <Text style={[styles.date, { color: palette.muted }]}>{formatDate(v.date)}</Text>
            </View>

            {v.summary ? (
              <Text style={[styles.summary, { color: palette.muted }]}>{v.summary}</Text>
            ) : null}

            <Section
              icon="star-four-points"
              label="Nuevas funcionalidades"
              color={palette.tint}
              entries={v.features}
              palette={palette}
            />
            <Section
              icon="bug-check"
              label="Solución de errores"
              color={palette.success}
              entries={v.fixes}
              palette={palette}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  intro: { fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  versionBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  versionText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  currentTag: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  date: { fontSize: 12, marginLeft: 'auto' },
  summary: { fontSize: 13, lineHeight: 18 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  entry: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  entryBody: { flex: 1, gap: 2 },
  entryTitle: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  entryDetail: { fontSize: 13, lineHeight: 18 },
});
