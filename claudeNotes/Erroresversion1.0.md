-Notas de versión no funciona el scroll
-Que en el gráfico de patrimonio se vea en el eje Y a la izq, los valores del dinero, marcadno siempre el valor de cada punto de la base de datos.
-Genera un mock de la base de datos, un ejemplo que abarque ingresos y gastos a lo largo de un buen rango temporal, para testear funcionalidades. El mock debe de verse solo para la prueba en Expo GO, no en produccion
-Los botones de seleccion de rango temporal del gráfico de patrimonio, quita el de dos años y hazlos algo mas pequeños para que quepan en una sola fila.
-Para el diseño de notas de versión, te adjunto el siguiente ejemplo de formato de otra app de gimnasio, para que intentes copiar el estilo exacto:
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GymTheme, Radius, Spacing } from '@/constants/gym-theme';
import { CURRENT_VERSION, PATCH_NOTES, type PatchEntry } from '@/constants/patch-notes';

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

function Section({
  icon,
  label,
  color,
  entries,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  color: string;
  entries: PatchEntry[];
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
            <Text style={styles.entryTitle}>{entry.title}</Text>
            {entry.detail ? <Text style={styles.entryDetail}>{entry.detail}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function PatchNotesScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: GymTheme.background }}
      contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Resumen de las novedades y correcciones de cada versión de GymApp.
      </Text>

      {PATCH_NOTES.map((v) => {
        const isCurrent = v.version === CURRENT_VERSION;
        return (
          <View key={v.version} style={[styles.card, isCurrent && styles.cardCurrent]}>
            <View style={styles.cardHeader}>
              <View style={[styles.versionBadge, isCurrent && styles.versionBadgeCurrent]}>
                <Text style={[styles.versionText, isCurrent && styles.versionTextCurrent]}>
                  v{v.version}
                </Text>
              </View>
              {isCurrent ? <Text style={styles.currentTag}>Versión actual</Text> : null}
              <Text style={styles.date}>{formatDate(v.date)}</Text>
            </View>

            {v.summary ? <Text style={styles.summary}>{v.summary}</Text> : null}

            <Section
              icon="star-four-points"
              label="Nuevas funcionalidades"
              color={GymTheme.primary}
              entries={v.features}
            />
            <Section
              icon="bug-check"
              label="Solución de errores"
              color={GymTheme.active}
              entries={v.fixes}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  intro: { color: GymTheme.textMuted, fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: GymTheme.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: GymTheme.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardCurrent: { borderColor: GymTheme.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  versionBadge: {
    backgroundColor: GymTheme.surfaceElevated,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  versionBadgeCurrent: { backgroundColor: GymTheme.primary },
  versionText: { color: GymTheme.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  versionTextCurrent: { color: '#0C0C0E' },
  currentTag: {
    color: GymTheme.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  date: { color: GymTheme.textFaint, fontSize: 12, marginLeft: 'auto' },
  summary: { color: GymTheme.textMuted, fontSize: 13, lineHeight: 18 },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  entry: { flexDirection: 'row', gap: Spacing.sm, paddingLeft: Spacing.xs },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  entryBody: { flex: 1, gap: 2 },
  entryTitle: { color: GymTheme.text, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  entryDetail: { color: GymTheme.textMuted, fontSize: 13, lineHeight: 18 },
});
